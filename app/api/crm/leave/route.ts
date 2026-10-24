import { getDb } from '@/lib/db'
import { requireCrm, handle, HttpError, clientIp } from '@/lib/crm/session'
import { logAction } from '@/lib/crm/audit'
import { reviewLeave, LEAVE_KINDS } from '@/lib/crm/attendance'

const isDay = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)

export const POST = handle(async (req: Request) => {
  const user = await requireCrm('cham_cong.cua_toi')
  const b = await req.json().catch(() => ({}))
  if (!(b.kind in LEAVE_KINDS)) throw new HttpError(400, 'Chọn loại đơn')
  if (!isDay(b.from_date) || !isDay(b.to_date) || b.to_date < b.from_date) throw new HttpError(400, 'Ngày không hợp lệ')
  const reason = String(b.reason || '').trim().slice(0, 1000)
  if (!reason) throw new HttpError(400, 'Ghi lý do')
  const sql = getDb()
  const row = (await sql`
    INSERT INTO leave_requests (staff_id, kind, from_date, to_date, minutes, reason)
    VALUES (${user.id}, ${b.kind}, ${b.from_date}, ${b.to_date}, ${b.minutes ? Number(b.minutes) : null}, ${reason}) RETURNING id`)[0]
  // Việc cho quản lý bộ phận: duyệt trong 24h
  await sql`
    INSERT INTO crm_tasks (title, kind, priority, due_at, assigned_staff_id, created_by, auto_key, source, department)
    SELECT ${'Duyệt đơn ' + LEAVE_KINDS[b.kind as keyof typeof LEAVE_KINDS].toLowerCase() + ' của ' + user.name}, 'duyet_don_tu', 1, NOW() + INTERVAL '24 hours',
           s.id, ${user.id}, ${'leave:' + row.id}, 'tu_dong', ${user.department}
    FROM staff s WHERE s.status = 'active' AND s.id <> ${user.id}
      AND ((s.role = 'quan_ly' AND s.department = ${user.department}) OR s.role = 'admin')
    ORDER BY (s.role = 'quan_ly') DESC, s.id LIMIT 1
    ON CONFLICT (auto_key) WHERE auto_key IS NOT NULL DO NOTHING`
  await logAction({ actorId: user.id, action: 'INSERT', table: 'leave_requests', recordId: row.id, after: b, ip: clientIp(req) })
  return Response.json({ ok: true, id: row.id })
})

export const PATCH = handle(async (req: Request) => {
  const b = await req.json().catch(() => ({}))
  const id = Number(b.id)
  const sql = getDb()
  if (b.action === 'cancel') {
    const user = await requireCrm('cham_cong.cua_toi')
    const r = await sql`UPDATE leave_requests SET status = 'huy' WHERE id = ${id} AND staff_id = ${user.id} AND status = 'cho_duyet'`
    if (!r.count) throw new HttpError(400, 'Không huỷ được (đơn đã được xử lý)')
    return Response.json({ ok: true })
  }
  const user = await requireCrm('cham_cong.duyet')
  const lr = (await sql`SELECT l.staff_id, s.department FROM leave_requests l JOIN staff s ON s.id = l.staff_id WHERE l.id = ${id}`)[0]
  if (!lr) throw new HttpError(404, 'Không tìm thấy đơn')
  if (lr.staff_id === user.id) throw new HttpError(403, 'Không tự duyệt đơn của mình')
  if (user.role !== 'admin' && lr.department !== user.department) throw new HttpError(403, 'Chỉ duyệt đơn của bộ phận mình')
  const out = await reviewLeave(id, user.id, b.action === 'approve', String(b.note || '').slice(0, 500), clientIp(req))
  await sql`UPDATE crm_tasks SET status = 'xong', done_at = NOW(), result = 'da_xong' WHERE auto_key = ${'leave:' + id} AND status <> 'xong'`
  return Response.json({ ok: true, status: out?.status })
})
