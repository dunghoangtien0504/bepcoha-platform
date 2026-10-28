import { createHmac, timingSafeEqual } from 'crypto'

const BASE = process.env.SITE_URL || 'https://khoaduacamuoi.hacofood.vn'

function secret(): string | null {
  const s = process.env.UNSUBSCRIBE_SECRET
  return s && s.length >= 16 ? s : null
}

type Purpose = 'unsub' | 'confirm'

function sign(purpose: Purpose, email: string, s: string): string {
  return createHmac('sha256', s).update(`${purpose}:${email.trim().toLowerCase()}`).digest('hex').slice(0, 32)
}

function make(purpose: Purpose, email: string): string | null {
  const s = secret()
  return s ? sign(purpose, email, s) : null
}

function verify(purpose: Purpose, email: string, token: string | null | undefined): boolean {
  const s = secret()
  if (!s || !token || typeof token !== 'string' || !/^[0-9a-f]{32}$/.test(token)) return false
  const a = Buffer.from(sign(purpose, email, s))
  const b = Buffer.from(token)
  return a.length === b.length && timingSafeEqual(a, b)
}

/** Token gắn với đúng 1 email + đúng 1 mục đích: không ai đoán được link hủy/xác nhận của người khác. Thiếu khoá bí mật thì trả null. */
export const createUnsubscribeToken = (email: string) => make('unsub', email)
export const verifyUnsubscribeToken = (email: string, token: string | null | undefined) => verify('unsub', email, token)
export const createConfirmToken = (email: string) => make('confirm', email)
export const verifyConfirmToken = (email: string, token: string | null | undefined) => verify('confirm', email, token)

function url(path: string, email: string, t: string | null): string | null {
  return t ? `${BASE}${path}?e=${encodeURIComponent(email.trim().toLowerCase())}&t=${t}` : null
}
export const unsubscribeUrl = (email: string) => url('/api/unsubscribe', email, createUnsubscribeToken(email))
export const confirmOptInUrl = (email: string) => url('/api/confirm-optin', email, createConfirmToken(email))
