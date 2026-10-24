import { rateLimit } from '@/lib/ratelimit'
import { setReminder } from '@/lib/mini/events'
import { rateLimited } from '@/lib/mini/errors'
import { clientInfo, miniRoute, readJson, sessionIdFrom } from '@/lib/mini/http'

/** "Nhắc tôi" / "Giữ chỗ". Body: { kind: 'nhac' | 'giu_cho', on: boolean }. */
export const POST = miniRoute(async (req: Request, ctx: { params: Promise<{ slug: string }> }) => {
  if (!rateLimit('mini-remind:' + clientInfo(req).ip, 30, 60 * 1000)) throw rateLimited()
  const { slug } = await ctx.params
  const body = await readJson(req)
  return Response.json(await setReminder(await sessionIdFrom(req), slug, body.kind, body.on))
})
