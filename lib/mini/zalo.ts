// Đổi token SĐT của Zalo Mini App (getPhoneNumber, dùng 1 lần, hạn 2 phút) thành số điện thoại.
// Tài liệu: docs.zaloplatforms.com/docs/MA/api/user/user-information/getPhoneNumber
// Khoá bí mật của Zalo App (ZALO_APP_SECRET) chỉ nằm ở server.
import { normalizePhone } from '../phone'
import { MiniError } from './errors'

export async function phoneFromZalo(accessToken: string, phoneToken: string): Promise<string> {
  const secret = process.env.ZALO_APP_SECRET
  if (!secret) throw new MiniError(503, 'zalo_not_configured', 'Mini App trên Zalo chưa sẵn sàng, chị dùng bản web giúp Cô nhé.')
  let data: { error?: number; data?: { number?: string } } = {}
  try {
    const res = await fetch('https://graph.zalo.me/v2.0/me/info', {
      headers: { access_token: accessToken, code: phoneToken, secret_key: secret },
      signal: AbortSignal.timeout(8000),
    })
    data = await res.json()
  } catch {
    // rơi xuống lỗi chung bên dưới
  }
  const phone = data.error === 0 && data.data?.number ? normalizePhone(String(data.data.number)) : ''
  if (!/^0(3|5|7|8|9)\d{8}$/.test(phone)) {
    throw new MiniError(400, 'zalo_phone_failed', 'Chưa lấy được số điện thoại từ Zalo, chị thử lại giúp Cô nhé.')
  }
  return phone
}
