import { rateLimit } from '@/lib/ratelimit'
import { rateLimited } from '@/lib/mini/errors'
import { clientInfo, miniRoute, readJson, sessionIdFrom } from '@/lib/mini/http'
import { previewOrder } from '@/lib/mini/orders'

/** Tính tiền giỏ hàng trước khi đặt: tạm tính, voucher, Hạt Cốm dùng được, tổng. Không ghi gì. */
export const POST = miniRoute(async (req: Request) => {
  if (!rateLimit('mini-quote:' + clientInfo(req).ip, 60, 60 * 1000)) throw rateLimited()
  return Response.json(await previewOrder(await sessionIdFrom(req), await readJson(req)))
})
