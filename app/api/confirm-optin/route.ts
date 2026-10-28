import { NextRequest } from 'next/server'
import { initDb, confirmGiftOptIn } from '@/lib/db'
import { verifyConfirmToken } from '@/lib/unsubscribe'
import { linkPage } from '@/lib/email-link-page'

function params(req: NextRequest) {
  const u = req.nextUrl
  return { email: (u.searchParams.get('e') || '').trim().toLowerCase(), token: u.searchParams.get('t') }
}

/** Bước 2 của "đồng ý 2 bước": mở link chỉ hiện nút, bấm nút mới ghi nhận (bằng chứng là chính chủ email). */
export async function GET(req: NextRequest) {
  const { email, token } = params(req)
  if (!verifyConfirmToken(email, token)) return linkPage('Link không hợp lệ', 'Link xác nhận không đúng hoặc đã bị sửa.')
  return linkPage('Xác nhận nhận tin', `Bấm nút để nhận công thức và ưu đãi từ Cô Hạ qua ${email}. Bạn có thể huỷ bất cứ lúc nào.`, { action: req.nextUrl.pathname + req.nextUrl.search, button: 'Có, tôi muốn nhận tin' })
}

export async function POST(req: NextRequest) {
  const { email, token } = params(req)
  if (!verifyConfirmToken(email, token)) return linkPage('Link không hợp lệ', 'Link xác nhận không đúng hoặc đã bị sửa.')
  await initDb()
  const ok = await confirmGiftOptIn(email)
  return ok
    ? linkPage('Đã xác nhận', 'Cảm ơn bạn! Email công thức đầu tiên sẽ tới trong khoảng 1 ngày.')
    : linkPage('Đã ghi nhận', 'Email này đã được xác nhận trước đó, hoặc chưa đăng ký nhận tin khi nhận quà.')
}
