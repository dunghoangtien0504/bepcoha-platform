import { rateLimit } from '@/lib/ratelimit'
import { rateLimited } from '@/lib/mini/errors'
import { clientInfo, miniRoute, readJson, sessionIdFrom } from '@/lib/mini/http'
import { recordEvents } from '@/lib/mini/service'

/** Event đo phễu, gửi theo lô (≤ 20). Giới hạn 60 event/anon_id/phút đếm trong DB; rate limit bộ nhớ chỉ chống flood theo IP. */
export const POST = miniRoute(async (req: Request) => {
  if (!rateLimit('mini-event:' + clientInfo(req).ip, 120, 60 * 1000)) throw rateLimited()
  const body = await readJson(req)
  await recordEvents({ anon_id: body.anon_id, events: body.events }, await sessionIdFrom(req))
  return new Response(null, { status: 204 })
})
