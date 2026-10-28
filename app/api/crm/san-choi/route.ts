import { getDb } from '@/lib/db'
import { requireCrm, handle, HttpError, clientIp, can } from '@/lib/crm/session'
import { managesDept } from '@/lib/crm/permissions'
import { playerState, spin, requestRedeem, giveKudos, inGame, exchangeVoucher, SanChoiError } from '@/lib/crm/san-choi'
import { rateLimit } from '@/lib/ratelimit'

const wrap = async <T>(fn: () => Promise<T>) => {
  try { return await fn() } catch (e) { if (e instanceof SanChoiError) throw new HttpError(400, e.message); throw e }
}

/** Trạng thái Sân chơi của tôi: chuỗi, cấp, lượt quay, ví, túi quà. */
export const GET = handle(async () => {
  const user = await requireCrm('cham_cong.cua_toi')
  return Response.json(await playerState(user.id))
})

/** action = quay | doi | doi_voucher | khen */
export const POST = handle(async (req: Request) => {
  const user = await requireCrm('cham_cong.cua_toi')
  const b = await req.json().catch(() => ({}))
  if (b.action === 'quay') {
    if (!rateLimit('spin:' + user.id, 30, 60 * 1000)) throw new HttpError(429, 'Quay chậm thôi nào')
    if (!(await inGame(user.id)).playing) throw new HttpError(403, 'Bộ phận bạn chưa vào Sân chơi')
    return Response.json(await wrap(() => spin(user.id)))
  }
  if (b.action === 'doi_voucher') {
    if (!rateLimit('voucher:' + user.id, 10, 60 * 1000)) throw new HttpError(429, 'Thao tác chậm thôi nào')
    return Response.json(await wrap(() => exchangeVoucher(user.id, Number(b.amount))))
  }
  if (b.action === 'doi') {
    return Response.json(await wrap(() => requestRedeem(user.id, { kind: String(b.kind), amount: Number(b.amount), item_id: Number(b.item_id), note: b.note })))
  }
  if (b.action === 'khen') {
    // Khen 0 lượt: quản lý khen người trong bộ phận mình; thưởng lượt: như trên + giới hạn tháng. Ban giám đốc / quản trị khen mọi người.
    if (!can(user, 'viec.giao') && !can(user, 'cai_dat.sua')) throw new HttpError(403, 'Chỉ quản lý được thưởng nóng')
    const to = (await getDb()`SELECT id, department FROM staff WHERE id = ${Number(b.to_staff)} AND status = 'active'`)[0]
    if (!to) throw new HttpError(404, 'Không tìm thấy người được khen')
    if (!managesDept(user, to.department)) throw new HttpError(403, 'Chỉ khen người trong bộ phận mình')
    return Response.json(await wrap(() => giveKudos(user.id, to.id, String(b.reason || ''), String(b.message || ''), Number(b.tokens) || 0, clientIp(req))))
  }
  throw new HttpError(400, 'Thao tác không hợp lệ')
})
