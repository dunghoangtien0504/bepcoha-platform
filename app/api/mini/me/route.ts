import { homeState } from '@/lib/mini/checkin'
import { miniRoute, sessionIdFrom } from '@/lib/mini/http'
import { unreadCount } from '@/lib/mini/notifications'
import { getMe, loadSession } from '@/lib/mini/service'

/**
 * "Của tôi" + trạng thái trang chủ (Hạt Cốm, điểm danh, Sổ tay).
 * Phiên chưa xác minh chỉ thấy dữ liệu do chính phiên tạo ra — không lịch sử đơn, địa chỉ, tổng chi tiêu.
 */
export const GET = miniRoute(async (req: Request) => {
  const id = await sessionIdFrom(req)
  const me = await getMe(id) // ném no_session nếu chưa đăng ký
  const s = (await loadSession(id))!
  return Response.json({ ...me, ...(await homeState(s)), unread_notifications: await unreadCount(s) }, { headers: { 'Cache-Control': 'no-store' } })
})
