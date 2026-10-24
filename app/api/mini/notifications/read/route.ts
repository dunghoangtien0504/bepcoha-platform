import { miniRoute, readJson, sessionIdFrom } from '@/lib/mini/http'
import { markRead } from '@/lib/mini/notifications'

/** Đánh dấu đã đọc. Body: { ids: number[] } hoặc { all: true }. */
export const POST = miniRoute(async (req: Request) => {
  return Response.json(await markRead(await sessionIdFrom(req), await readJson(req)))
})
