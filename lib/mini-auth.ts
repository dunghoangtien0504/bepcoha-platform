// Phiên của KHÁCH trên Mini App: JWT HS256 ký bằng MINI_SESSION_SECRET (khác JWT_SECRET và CRM_SESSION_SECRET),
// aud = 'mini', sub = mini_sessions.id. Token này không bao giờ được chấp nhận ở route nhân viên và ngược lại.
// Bản web: cookie httpOnly `mini_session` (cùng origin /m). Bản Zalo Mini App: header Authorization: Bearer.
import { jwtVerify, SignJWT } from 'jose'

export const MINI_COOKIE = 'mini_session'
export const MINI_AUDIENCE = 'mini'
export const MINI_TTL_SECONDS = 30 * 24 * 60 * 60

function secret(): Uint8Array {
  const s = process.env.MINI_SESSION_SECRET
  if (!s || s.length < 32) throw new Error('MINI_SESSION_SECRET chưa cấu hình (cần ≥32 ký tự ngẫu nhiên)')
  return new TextEncoder().encode(s)
}

export async function createMiniToken(miniSessionId: number): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(miniSessionId))
    .setAudience(MINI_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${MINI_TTL_SECONDS}s`)
    .sign(secret())
}

/** Trả về mini_sessions.id nếu token hợp lệ, ngược lại null. */
export async function verifyMiniToken(token: string | null | undefined): Promise<number | null> {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, secret(), { audience: MINI_AUDIENCE, algorithms: ['HS256'] })
    const id = Number(payload.sub)
    return Number.isInteger(id) && id > 0 ? id : null
  } catch {
    return null
  }
}

/** Lấy token từ header Authorization (Zalo) hoặc cookie (web). Header được ưu tiên. */
export function miniTokenFromRequest(req: Request): string | null {
  const auth = req.headers.get('authorization') || ''
  if (auth.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim() || null
  const cookie = req.headers.get('cookie') || ''
  for (const part of cookie.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === MINI_COOKIE) return decodeURIComponent(v.join('=')) || null
  }
  return null
}

export function miniCookieHeader(token: string | null): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  if (!token) return `${MINI_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`
  return `${MINI_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MINI_TTL_SECONDS}${secure}`
}
