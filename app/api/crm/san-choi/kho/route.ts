import { getDb } from '@/lib/db'
import { requireCrm, handle, HttpError, clientIp, can } from '@/lib/crm/session'
import { redeemVoucherAtKho, isKho, SanChoiError, ensureSanChoiSchema } from '@/lib/crm/san-choi'

/** Phiếu xuất voucher hôm nay (cho kế toán). */
export const GET = handle(async () => {
  const user = await requireCrm()
  if (!isKho(user)) throw new HttpError(403, 'Chỉ kho được xem')
  await ensureSanChoiSchema()
  const rows = await getDb()`SELECT v.code, v.amount, v.used_at, v.used_note, s.name AS staff_name FROM sc_vouchers v JOIN staff s ON s.id = v.staff_id
                             WHERE v.status = 'da_dung' ORDER BY v.used_at DESC LIMIT 50`
  return Response.json({ rows })
})

/** Thủ kho quét/nhập mã → đánh dấu đã dùng. */
export const POST = handle(async (req: Request) => {
  const user = await requireCrm()
  if (!isKho(user)) throw new HttpError(403, 'Chỉ kho được nhận voucher')
  const b = await req.json().catch(() => ({}))
  try {
    const boss = user.role === 'admin' || user.department === 'ban_giam_doc' || can(user, 'cai_dat.sua')
    return Response.json(await redeemVoucherAtKho(String(b.code || ''), { id: user.id, boss }, String(b.note || ''), clientIp(req)))
  } catch (e) {
    if (e instanceof SanChoiError) throw new HttpError(400, e.message)
    throw e
  }
})
