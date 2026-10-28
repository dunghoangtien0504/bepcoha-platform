import { NextRequest } from 'next/server'
import { safeEqual } from './internal-auth'

/**
 * Kiểm tra mật khẩu admin cho các API portal.
 * Fail-closed: nếu ADMIN_PASSWORD chưa được set → luôn từ chối (không có fallback mặc định).
 * Chỉ chấp nhận qua header Authorization: Bearer <password> (KHÔNG qua query param).
 */
export function checkAdminAuth(req: NextRequest): boolean {
  const expected = process.env.ADMIN_PASSWORD
  if (!expected) {
    console.error('[admin-auth] ADMIN_PASSWORD chưa được cấu hình')
    return false
  }
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim()
  return token.length > 0 && safeEqual(token, expected)
}

/** Chấp nhận mật khẩu admin (portal cũ) HOẶC JWT nhân viên (CRM mới). */
export async function checkPortalAuth(req: NextRequest): Promise<boolean> {
  if (checkAdminAuth(req)) return true
  const { verifyAuthHeader } = await import('./auth')
  return !!(await verifyAuthHeader(req.headers.get('authorization')))
}
