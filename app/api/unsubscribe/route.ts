import { NextRequest } from 'next/server'
import { initDb, unsubscribeEmail } from '@/lib/db'
import { verifyUnsubscribeToken } from '@/lib/unsubscribe'
import { linkPage } from '@/lib/email-link-page'

function params(req: NextRequest) {
  const u = req.nextUrl
  return { email: (u.searchParams.get('e') || '').trim().toLowerCase(), token: u.searchParams.get('t') }
}

/** Mở link trong thư: chỉ hiện nút xác nhận huỷ. */
export async function GET(req: NextRequest) {
  const { email, token } = params(req)
  if (!verifyUnsubscribeToken(email, token)) return linkPage('Link không hợp lệ', 'Link huỷ nhận tin không đúng hoặc đã bị sửa. Bạn có thể trả lời email để Cô Hạ huỷ giúp.')
  return linkPage('Huỷ nhận email', `Bạn sẽ không nhận email chăm sóc/ưu đãi gửi tới ${email} nữa.`, { action: req.nextUrl.pathname + req.nextUrl.search, button: 'Xác nhận huỷ' })
}

/** Bấm nút trên trang, hoặc hộp thư gửi "List-Unsubscribe=One-Click" (RFC 8058). */
export async function POST(req: NextRequest) {
  const { email, token } = params(req)
  if (!verifyUnsubscribeToken(email, token)) return linkPage('Link không hợp lệ', 'Link huỷ nhận tin không đúng hoặc đã bị sửa.')
  await initDb()
  await unsubscribeEmail(email, 'link')
  return linkPage('Đã huỷ nhận email', 'Cô Hạ sẽ không gửi email chăm sóc/ưu đãi tới bạn nữa. Quà và hoá đơn đã đăng ký vẫn được gửi bình thường.')
}
