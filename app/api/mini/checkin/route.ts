import { rateLimit } from '@/lib/ratelimit'
import { checkin } from '@/lib/mini/checkin'
import { rateLimited } from '@/lib/mini/errors'
import { clientInfo, miniRoute, sessionIdFrom } from '@/lib/mini/http'

/** Điểm danh hôm nay (giờ VN). Gọi lặp trong ngày không cộng thêm Hạt Cốm (khoá trong DB). */
export const POST = miniRoute(async (req: Request) => {
  if (!rateLimit('mini-checkin:' + clientInfo(req).ip, 30, 60 * 1000)) throw rateLimited()
  return Response.json(await checkin(await sessionIdFrom(req)))
})
