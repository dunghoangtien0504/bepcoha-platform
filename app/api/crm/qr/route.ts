import { getDb } from '@/lib/db'
import { requireCrm, handle, HttpError, clientIp } from '@/lib/crm/session'
import { logAction } from '@/lib/crm/audit'
import { reviewClaim, promoteMiniSession, cancelMiniOrder, ClaimConflictError } from '@/lib/crm/mini'

const CHANNELS = ['shopee', 'tiktok', 'facebook', 'bep']

/** Tạo lô QR (mỗi lô 1 mã để đo tỷ lệ quét — B4 K10). */
export const POST = handle(async (req: Request) => {
  const user = await requireCrm('qr.quan_ly')
  const b = await req.json().catch(() => ({}))
  const code = String(b.code || '').trim().toUpperCase()
  if (!/^[A-Z0-9-]{4,30}$/.test(code)) throw new HttpError(400, 'Mã lô 4–30 ký tự, chỉ chữ, số và dấu gạch (VD: SXC-FB-2611)')
  if (!CHANNELS.includes(b.channel)) throw new HttpError(400, 'Chọn kênh')
  const cta = String(b.cta || '').trim().slice(0, 200)
  if (!cta) throw new HttpError(400, 'Nhập lời kêu gọi in trên thẻ (chỉ 1 lời kêu gọi mỗi hộp)')
  if ((b.channel === 'shopee' || b.channel === 'tiktok') && /mua|đặt|giảm|ưu đãi|voucher/i.test(cta)) {
    throw new HttpError(400, 'Thẻ trong đơn sàn chưa được kêu gọi mua ngoài sàn (chờ quản lý sàn kiểm điều khoản). Dùng thẻ hướng dẫn nấu.')
  }
  const sql = getDb()
  await sql`INSERT INTO qr_batches (code, sku, channel, cta, printed_qty, note, created_by, landing_variant)
            VALUES (${code}, ${String(b.sku || '').slice(0, 50)}, ${b.channel}, ${cta}, ${Math.max(0, Number(b.printed_qty) || 0)}, ${String(b.note || '').slice(0, 500)}, ${user.id}, ${String(b.landing_variant || 'a').slice(0, 10)})`
    .catch(e => { if (String(e?.code) === '23505') throw new HttpError(409, 'Mã lô đã tồn tại'); throw e })
  await logAction({ actorId: user.id, action: 'INSERT', table: 'qr_batches', recordKey: code, after: b, ip: clientIp(req) })
  return Response.json({ ok: true, code })
})

/** Duyệt ghép đơn sàn, hoặc xác minh cả phiên Mini App (verified_via = 'staff'). */
export const PATCH = handle(async (req: Request) => {
  const user = await requireCrm('qr.quan_ly')
  const b = await req.json().catch(() => ({}))
  const ip = clientIp(req)
  if (b.action === 'verify_session') {
    const reason = String(b.reason || '').trim()
    if (!reason) throw new HttpError(400, 'Ghi lý do xác minh (VD: đã gọi điện đúng số, khách xác nhận)')
    const cid = await promoteMiniSession(Number(b.session_id), 'staff', { type: 'staff', id: user.id })
    await logAction({ actorId: user.id, action: 'VERIFY_SESSION', table: 'mini_sessions', recordId: Number(b.session_id), after: { customer_id: cid }, reason, ip })
    return Response.json({ ok: true, customer_id: cid })
  }
  if (b.action === 'cancel_order') {
    const reason = String(b.reason || '').trim().slice(0, 500)
    if (!reason) throw new HttpError(400, 'Ghi lý do huỷ (VD: khách báo đặt nhầm)')
    const r = await cancelMiniOrder(Number(b.order_id), user.id, reason, ip)
    if (!r) throw new HttpError(404, 'Không tìm thấy đơn')
    return Response.json({ ok: true, already: r.already, pos_order_id: r.order.pos_order_id ?? null, paid: r.order.payment_status === 'da_tra',
      voucher_restored: r.voucherRestored ?? false, points_restored: r.pointsRestored ?? 0 })
  }
  try {
    const r = await reviewClaim(Number(b.id), user.id, b.action === 'approve', b.order_id ? String(b.order_id) : null, String(b.note || ''), ip)
    if (!r) throw new HttpError(404, 'Không tìm thấy yêu cầu')
    return Response.json({ ok: true, status: r.status })
  } catch (e) {
    if (e instanceof ClaimConflictError) throw new HttpError(409, e.message)
    if (e instanceof Error && e.message.startsWith('Cần chọn đơn')) throw new HttpError(400, e.message)
    throw e
  }
})
