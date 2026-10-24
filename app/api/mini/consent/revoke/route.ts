import { clientInfo, miniRoute, readJson, sessionIdFrom } from '@/lib/mini/http'
import { revokeConsent } from '@/lib/mini/service'

/** Khách tự ngừng nhận tin. Chưa xác minh: chỉ ghi revoked_at trên consent của phiên. Đã xác minh: bật opted_out_at của khách. */
export const POST = miniRoute(async (req: Request) => {
  const body = await readJson(req)
  await revokeConsent(await sessionIdFrom(req), body.channel, clientInfo(req))
  return Response.json({ ok: true })
})
