import { listEvents } from '@/lib/mini/events'
import { miniRoute, sessionIdFrom } from '@/lib/mini/http'

/** Sự kiện đã công bố. ?tab=sap_toi (mặc định) | da_qua. Không cần đăng ký mới xem được. */
export const GET = miniRoute(async (req: Request) => {
  const tab = new URL(req.url).searchParams.get('tab')
  return Response.json(await listEvents(await sessionIdFrom(req), tab), { headers: { 'Cache-Control': 'no-store' } })
})
