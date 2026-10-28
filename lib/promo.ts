import { createHmac, timingSafeEqual } from 'crypto'

// Mã khuyến mãi có chữ ký: gắn với 1 email, có hạn dùng, chỉ máy chủ mới tạo/kiểm tra được.
// Cần biến môi trường PROMO_SECRET. Không có thì KHÔNG có khuyến mãi nào hợp lệ.

export const PROMO_PRICE = 239000
export const PROMO_TTL_MS = 48 * 60 * 60 * 1000

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function sign(email: string, expiresAt: number, secret: string): string {
  return createHmac('sha256', secret).update(`${normalizeEmail(email)}|${expiresAt}`).digest('hex').slice(0, 32)
}

/** Tạo cặp (x = hạn dùng, t = chữ ký) để gắn vào link khuyến mãi gửi cho đúng 1 email. Trả null nếu chưa cấu hình PROMO_SECRET. */
export function createPromoParams(email: string, now = Date.now()): { x: string; t: string } | null {
  const secret = process.env.PROMO_SECRET
  if (!secret) return null
  const expiresAt = now + PROMO_TTL_MS
  return { x: String(expiresAt), t: sign(email, expiresAt, secret) }
}

/** Kiểm tra mã khuyến mãi khách gửi lên: đúng chữ ký, đúng email, chưa hết hạn. */
export function isPromoValid(email: string, x: unknown, t: unknown, now = Date.now()): boolean {
  const secret = process.env.PROMO_SECRET
  if (!secret) return false
  const expiresAt = Number(x)
  if (!Number.isFinite(expiresAt) || expiresAt < now) return false
  if (typeof t !== 'string' || t.length !== 32) return false
  const expected = sign(email, expiresAt, secret)
  try {
    return timingSafeEqual(Buffer.from(t), Buffer.from(expected))
  } catch {
    return false
  }
}

/** Chỉ dùng tạm sau khi triển khai để không làm hỏng link Email 5 cũ đã gửi: đặt PROMO_LEGACY_UNTIL = mốc ISO, vd 2026-09-22T00:00:00Z */
export function isLegacyPromoAllowed(now = Date.now()): boolean {
  const until = process.env.PROMO_LEGACY_UNTIL
  if (!until) return false
  const ms = Date.parse(until)
  return Number.isFinite(ms) && now < ms
}

export const COURSE_PRICE = 299000

/**
 * Giá khoá học do MÁY CHỦ quyết (K2, HACO-LOOP/05): chỉ áp giá khuyến mãi khi link có chữ ký hợp lệ cho đúng email,
 * hoặc link cũ "?promo=239" còn trong cửa sổ chuyển tiếp PROMO_LEGACY_UNTIL. Mọi trường hợp khác: giá gốc.
 */
export function coursePriceFor(email: string, q: { promo?: unknown; x?: unknown; t?: unknown }, now = Date.now()): number {
  if (String(q.promo ?? '') !== '239') return COURSE_PRICE
  if (isPromoValid(email, q.x, q.t, now)) return PROMO_PRICE
  if (q.x === undefined && q.t === undefined && isLegacyPromoAllowed(now)) return PROMO_PRICE
  return COURSE_PRICE
}
