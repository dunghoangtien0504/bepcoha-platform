import { badRequest } from '@/lib/mini/errors'
import { miniRoute, sessionIdFrom } from '@/lib/mini/http'
import { orderStatus } from '@/lib/mini/orders'

/** Trạng thái 1 đơn của chính khách (app hỏi lại sau khi chuyển khoản). */
export const GET = miniRoute(async (req: Request, ctx: { params: Promise<{ ref: string }> }) => {
  const { ref } = await ctx.params
  if (!/^HMA[0-9A-F]{14}$/i.test(ref)) throw badRequest()
  return Response.json(await orderStatus(await sessionIdFrom(req), ref.toUpperCase()), { headers: { 'Cache-Control': 'no-store' } })
})
