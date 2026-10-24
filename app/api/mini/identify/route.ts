import { createMiniToken, miniCookieHeader } from '@/lib/mini-auth'
import { rateLimit } from '@/lib/ratelimit'
import { badRequest, rateLimited } from '@/lib/mini/errors'
import { clientInfo, miniRoute, readJson } from '@/lib/mini/http'
import { identify } from '@/lib/mini/service'
import { phoneFromZalo } from '@/lib/mini/zalo'

/**
 * Khách để lại SĐT để nhận khoá học.
 *  - Web: { phone } → phiên CHƯA xác minh, token đặt trong cookie httpOnly.
 *  - Zalo: { zalo_phone_token, zalo_access_token } → server đổi token lấy SĐT (đã xác minh), token phiên trả trong body.
 */
export const POST = miniRoute(async (req: Request) => {
  const info = clientInfo(req)
  if (!rateLimit('mini-identify:' + info.ip, 10, 10 * 60 * 1000)) throw rateLimited()
  const body = await readJson(req)
  let phone: string
  let verifiedVia: 'zalo_phone_token' | undefined
  if (typeof body.zalo_phone_token === 'string' && typeof body.zalo_access_token === 'string') {
    phone = await phoneFromZalo(body.zalo_access_token, body.zalo_phone_token)
    verifiedVia = 'zalo_phone_token'
  } else if (typeof body.phone === 'string') {
    phone = body.phone
  } else {
    throw badRequest()
  }
  const res = await identify({ anon_id: body.anon_id, batch_code: body.batch_code, name: body.name, consents: body.consents, phone, verifiedVia }, info)
  const token = await createMiniToken(res.session.id)
  if (info.zalo) return Response.json({ ...res, token })
  return Response.json(res, { headers: { 'Set-Cookie': miniCookieHeader(token) } })
})
