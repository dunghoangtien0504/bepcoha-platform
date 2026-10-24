import { timingSafeEqual } from 'crypto'

export type ApiKeyCheck = 'ok' | 'unauthorized' | 'misconfigured'

export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ba.length !== bb.length) return false
  return timingSafeEqual(ba, bb)
}

/**
 * Kiểm tra header x-api-key với biến môi trường tên `envName`.
 * Không có giá trị dự phòng: chưa cấu hình biến thì trả 'misconfigured' (route nên trả 500), không bao giờ cho qua.
 */
export function checkApiKey(req: Request, envName: string): ApiKeyCheck {
  const expected = process.env[envName]
  if (!expected) {
    console.error(`[auth] ${envName} chưa được cấu hình`)
    return 'misconfigured'
  }
  const given = req.headers.get('x-api-key') || ''
  return safeEqual(given, expected) ? 'ok' : 'unauthorized'
}
