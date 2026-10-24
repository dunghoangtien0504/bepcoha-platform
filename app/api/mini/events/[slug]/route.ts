import { getEvent } from '@/lib/mini/events'
import { miniRoute, sessionIdFrom } from '@/lib/mini/http'

export const GET = miniRoute(async (req: Request, ctx: { params: Promise<{ slug: string }> }) => {
  const { slug } = await ctx.params
  return Response.json(await getEvent(await sessionIdFrom(req), slug), { headers: { 'Cache-Control': 'no-store' } })
})
