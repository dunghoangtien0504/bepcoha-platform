import { NextRequest } from 'next/server'
import { verifyAuthHeader } from './auth'
import type { JWTPayload } from './auth'

/**
 * Nhân viên phải còn HOẠT ĐỘNG trong DB (token 7 ngày của người đã bị khoá không còn dùng được).
 * Tài khoản admin lấy từ biến môi trường (id = 0) không có dòng trong DB nên được bỏ qua bước tra.
 */
export async function requireStaff(req: NextRequest): Promise<JWTPayload | null> {
  const payload = await verifyAuthHeader(req.headers.get('authorization'))
  if (!payload) return null
  if (payload.id === 0) return payload
  const { getStaffById } = await import('./db')
  const staff = await getStaffById(payload.id)
  return staff && staff.status === 'active' ? payload : null
}
