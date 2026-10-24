import { clientInfo, miniRoute, readJson, sessionIdFrom } from '@/lib/mini/http'
import { claimOrder } from '@/lib/mini/service'

/** Khách nhập mã đơn (mã đơn sàn / số đơn Facebook). Không trả lý do đang chờ để chống dò mã. */
export const POST = miniRoute(async (req: Request) => {
  const body = await readJson(req)
  return Response.json(await claimOrder(await sessionIdFrom(req), body.code, clientInfo(req)))
})
