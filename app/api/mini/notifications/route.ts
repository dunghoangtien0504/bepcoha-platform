import { miniRoute, sessionIdFrom } from '@/lib/mini/http'
import { listNotifications } from '@/lib/mini/notifications'

/** Hộp thư: tin của Bếp + nhắc sự kiện sắp diễn ra trong 24 giờ (khách đã bấm "Nhắc tôi"). */
export const GET = miniRoute(async (req: Request) => {
  return Response.json(await listNotifications(await sessionIdFrom(req)), { headers: { 'Cache-Control': 'no-store' } })
})
