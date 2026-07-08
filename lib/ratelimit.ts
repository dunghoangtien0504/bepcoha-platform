// Rate limiter in-memory đơn giản (không cần Redis/dịch vụ ngoài).
// Giới hạn theo IP để chống spam đơn hàng. Lưu ý: trên serverless nhiều instance,
// bộ nhớ không chia sẻ giữa các instance — đây là lớp chặn cơ bản chống flood,
// không thay thế cho rate-limit phân tán (Upstash/Cloudflare) nếu cần mạnh hơn.

type Hit = { count: number; resetAt: number }
const store = new Map<string, Hit>()

/**
 * @param key      định danh (thường là IP)
 * @param limit    số request tối đa trong cửa sổ
 * @param windowMs độ dài cửa sổ (ms)
 * @returns true nếu được phép, false nếu vượt giới hạn
 */
export function rateLimit(key: string, limit = 5, windowMs = 10 * 60 * 1000): boolean {
  const now = Date.now()
  const hit = store.get(key)

  if (!hit || now > hit.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    // Dọn rác định kỳ để Map không phình vô hạn
    if (store.size > 5000) {
      for (const [k, v] of store) if (now > v.resetAt) store.delete(k)
    }
    return true
  }

  if (hit.count >= limit) return false
  hit.count++
  return true
}

/** Lấy IP client từ request headers (Vercel/proxy) */
export function getClientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return req.headers.get('x-real-ip') || 'unknown'
}
