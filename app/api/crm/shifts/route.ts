import { getDb } from '@/lib/db'
import { requireCrm, handle, HttpError, clientIp, type CrmUser } from '@/lib/crm/session'
import { logAction } from '@/lib/crm/audit'

const isDay = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)

/** Quản lý chỉ xếp ca cho bộ phận mình (admin xếp cho mọi người). */
async function assertCanSchedule(sql: ReturnType<typeof getDb>, user: CrmUser, staffId: number) {
  if (user.role === 'admin') return
  const s = (await sql`SELECT department FROM staff WHERE id = ${staffId}`)[0]
  if (!s || s.department !== user.department) throw new HttpError(403, 'Chỉ xếp ca được cho nhân viên bộ phận mình')
}

export const POST = handle(async (req: Request) => {
  const user = await requireCrm('cham_cong.phan_ca')
  const b = await req.json().catch(() => ({}))
  const sql = getDb()
  const ip = clientIp(req)
  if (b.action === 'copy_week') {
    if (!isDay(b.from) || !isDay(b.to)) throw new HttpError(400, 'Ngày không hợp lệ')
    const r = await sql`
      INSERT INTO shift_assignments (staff_id, work_date, template_id, site_id, created_by)
      SELECT a.staff_id, a.work_date + (${b.to}::date - ${b.from}::date), a.template_id, a.site_id, ${user.id}
      FROM shift_assignments a JOIN staff s ON s.id = a.staff_id
      WHERE a.work_date BETWEEN ${b.from}::date AND ${b.from}::date + 6 AND s.status = 'active'
        AND (${user.role === 'admin'} OR s.department = ${user.department})
      ON CONFLICT DO NOTHING`
    await logAction({ actorId: user.id, action: 'COPY_WEEK', table: 'shift_assignments', after: { from: b.from, to: b.to, rows: r.count }, ip })
    return Response.json({ ok: true, created: r.count })
  }
  const staffId = Number(b.staff_id), templateId = Number(b.template_id)
  if (!Number.isInteger(staffId) || !Number.isInteger(templateId) || !isDay(b.work_date)) throw new HttpError(400, 'Thiếu thông tin ca')
  await assertCanSchedule(sql, user, staffId)
  const site = (await sql`SELECT id FROM work_sites WHERE active ORDER BY id LIMIT 1`)[0]
  const row = (await sql`
    INSERT INTO shift_assignments (staff_id, work_date, template_id, site_id, created_by)
    VALUES (${staffId}, ${b.work_date}, ${templateId}, ${site?.id ?? null}, ${user.id})
    ON CONFLICT DO NOTHING RETURNING id`)[0]
  if (row) await logAction({ actorId: user.id, action: 'INSERT', table: 'shift_assignments', recordId: row.id, after: { staffId, date: b.work_date, templateId }, ip })
  return Response.json({ ok: true })
})

export const DELETE = handle(async (req: Request) => {
  const user = await requireCrm('cham_cong.phan_ca')
  const b = await req.json().catch(() => ({}))
  const sql = getDb()
  const a = (await sql`SELECT * FROM shift_assignments WHERE id = ${Number(b.id)}`)[0]
  if (!a) throw new HttpError(404, 'Không tìm thấy ca')
  await assertCanSchedule(sql, user, a.staff_id)
  const punched = (await sql`SELECT 1 FROM attendance_logs WHERE assignment_id = ${a.id} LIMIT 1`)[0]
  if (punched) throw new HttpError(400, 'Ca đã có lượt chấm công, không xoá được. Dùng đơn đổi ca.')
  await sql`DELETE FROM shift_assignments WHERE id = ${a.id}`
  await logAction({ actorId: user.id, action: 'DELETE', table: 'shift_assignments', recordId: a.id, before: a, ip: clientIp(req) })
  return Response.json({ ok: true })
})
