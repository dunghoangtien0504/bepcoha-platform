import { requireCrm, handle, HttpError, clientIp } from '@/lib/crm/session'
import { grantTokens, revokeTokens, reviewGrant, SanChoiError } from '@/lib/crm/san-choi'

/** Cấp / Bỏ lượt tay — chỉ người có quyền Cài đặt (CEO + quản trị). action = cap | bo | duyet | tu_choi */
export const POST = handle(async (req: Request) => {
  const user = await requireCrm('cai_dat.sua')
  const b = await req.json().catch(() => ({}))
  const ip = clientIp(req)
  try {
    if (b.action === 'cap') return Response.json(await grantTokens(user.id, Number(b.staff_id), Number(b.tokens), String(b.reason || ''), String(b.note || ''), ip))
    if (b.action === 'bo') return Response.json(await revokeTokens(user.id, Number(b.staff_id), Number(b.tokens), String(b.reason || ''), String(b.note || ''), ip))
    if (b.action === 'duyet' || b.action === 'tu_choi') return Response.json(await reviewGrant(Number(b.id), user.id, b.action === 'duyet', ip))
  } catch (e) {
    if (e instanceof SanChoiError) throw new HttpError(400, e.message)
    throw e
  }
  throw new HttpError(400, 'Thao tác không hợp lệ')
})
