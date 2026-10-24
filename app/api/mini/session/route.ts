import { miniRoute, readJson, sessionIdFrom } from '@/lib/mini/http'
import { startSession } from '@/lib/mini/service'

/** Mở Mini App: ghi lượt quét mã lô QR (step 1, server tự ghi) và trả phiên đang có (nếu cookie/token còn hạn). */
export const POST = miniRoute(async (req: Request) => {
  const body = await readJson(req)
  return Response.json(await startSession({ anon_id: body.anon_id, batch: body.batch, ref: body.ref }, await sessionIdFrom(req)))
})
