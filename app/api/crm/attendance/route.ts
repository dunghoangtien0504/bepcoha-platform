import { getDb } from '@/lib/db'
import { requireCrm, handle, HttpError, clientIp } from '@/lib/crm/session'
import { logAction } from '@/lib/crm/audit'
import { punch } from '@/lib/crm/attendance'
import { rateLimit } from '@/lib/ratelimit'

/** Tự chấm công vào/ra. */
export const POST = handle(async (req: Request) => {
  const user = await requireCrm('cham_cong.cua_toi')
  if (!rateLimit('punch:' + user.id, 10, 10 * 60 * 1000)) throw new HttpError(429, 'Bạn bấm quá nhiều lần, đợi vài phút')
  const b = await req.json().catch(() => ({}))
  if (b.kind !== 'vao' && b.kind !== 'ra') throw new HttpError(400, 'Chọn chấm vào hay ra')
  const num = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null)
  const r = await punch(user.id, { kind: b.kind, lat: num(b.lat), lng: num(b.lng), accuracy: num(b.accuracy), deviceId: typeof b.device_id === 'string' ? b.device_id : null, ip: clientIp(req) })
  return Response.json(r)
})

/** Quản lý sửa công tay (thêm lượt chấm thay nhân viên) — luôn ghi lý do và nhật ký. Hoặc đặt lại thiết bị chấm công. */
export const PATCH = handle(async (req: Request) => {
  const user = await requireCrm('cham_cong.duyet')
  const b = await req.json().catch(() => ({}))
  const sql = getDb()
  const staffId = Number(b.staff_id)
  const reason = String(b.reason || '').trim()
  if (!Number.isInteger(staffId)) throw new HttpError(400, 'Thiếu nhân viên')
  if (!reason) throw new HttpError(400, 'Ghi lý do (bắt buộc với mọi thao tác sửa công)')
  if (b.action === 'reset_device') {
    await sql`UPDATE staff SET registered_device = NULL WHERE id = ${staffId}`
    await logAction({ actorId: user.id, action: 'RESET_DEVICE', table: 'staff', recordId: staffId, reason, ip: clientIp(req) })
    return Response.json({ ok: true })
  }
  if (b.kind !== 'vao' && b.kind !== 'ra') throw new HttpError(400, 'Chọn lượt vào hay ra')
  const at = new Date(b.at)
  if (isNaN(at.getTime())) throw new HttpError(400, 'Thời điểm không hợp lệ')
  const row = (await sql`
    INSERT INTO attendance_logs (staff_id, assignment_id, kind, at, method, validity, note, created_by)
    VALUES (${staffId}, ${b.assignment_id ? Number(b.assignment_id) : null}, ${b.kind}, ${at}, 'sua_tay', 'hop_le', ${reason}, ${user.id})
    RETURNING id`)[0]
  await logAction({ actorId: user.id, action: 'MANUAL_PUNCH', table: 'attendance_logs', recordId: row.id, after: { staffId, kind: b.kind, at }, reason, ip: clientIp(req) })
  return Response.json({ ok: true })
})
