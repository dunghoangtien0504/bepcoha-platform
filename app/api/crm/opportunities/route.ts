import { getDb } from '@/lib/db'
import { requireCrm, handle, HttpError, clientIp } from '@/lib/crm/session'
import { logAction } from '@/lib/crm/audit'
import { OPP_STAGES } from '@/lib/crm-db'

const PIPELINES = ['khoa_offline', 'khoa_online', 'si', 'setup_quan']

export const POST = handle(async (req: Request) => {
  const user = await requireCrm('co_hoi.sua')
  const b = await req.json().catch(() => ({}))
  const customerId = Number(b.customer_id)
  const title = String(b.title || '').trim().slice(0, 200)
  if (!Number.isInteger(customerId) || !title) throw new HttpError(400, 'Thiếu khách hoặc tên cơ hội')
  const pipeline = PIPELINES.includes(b.pipeline) ? b.pipeline : 'khoa_offline'
  const sql = getDb()
  const row = (await sql`
    INSERT INTO opportunities (customer_id, title, pipeline, value, assigned_staff_id, product_interest, note)
    VALUES (${customerId}, ${title}, ${pipeline}, ${Math.max(0, Number(b.value) || 0)}, ${user.id}, ${String(b.product_interest || '')}, ${String(b.note || '')})
    RETURNING id`)[0]
  await logAction({ actorId: user.id, action: 'INSERT', table: 'opportunities', recordId: row.id, after: { title, pipeline, customerId }, ip: clientIp(req) })
  return Response.json({ ok: true, id: row.id })
})

export const PATCH = handle(async (req: Request) => {
  const user = await requireCrm('co_hoi.sua')
  const b = await req.json().catch(() => ({}))
  const id = Number(b.id)
  const sql = getDb()
  return sql.begin(async tx => {
    const t = tx as unknown as typeof sql
    const before = (await t`SELECT * FROM opportunities WHERE id = ${id} FOR UPDATE`)[0]
    if (!before) throw new HttpError(404, 'Không tìm thấy cơ hội')
    const set: Record<string, unknown> = { updated_at: new Date() }
    if (b.stage !== undefined) {
      if (!(OPP_STAGES as readonly string[]).includes(b.stage)) throw new HttpError(400, 'Giai đoạn không hợp lệ')
      if (b.stage === 'khong_chot' && !String(b.lost_reason || '').trim()) throw new HttpError(400, 'Ghi lý do không chốt để rút kinh nghiệm')
      set.stage = b.stage
      if (b.stage === 'da_chot' || b.stage === 'khong_chot') set.closed_at = new Date()
      if (b.lost_reason) set.lost_reason = String(b.lost_reason).slice(0, 1000)
    }
    if (b.value !== undefined) set.value = Math.max(0, Number(b.value) || 0)
    if (b.next_step_at !== undefined) set.next_step_at = b.next_step_at ? new Date(b.next_step_at) : null
    if (b.note !== undefined) set.note = String(b.note).slice(0, 4000)
    if (b.assigned_staff_id !== undefined) set.assigned_staff_id = b.assigned_staff_id ? Number(b.assigned_staff_id) : null
    const after = (await t`UPDATE opportunities SET ${t(set as never)} WHERE id = ${id} RETURNING *`)[0]
    if (b.stage && b.stage !== before.stage) {
      await t`INSERT INTO customer_activities (customer_id, kind, content, staff_id)
              VALUES (${before.customer_id}, 'co_hoi', ${`Cơ hội "${before.title}": ${before.stage} → ${b.stage}${b.lost_reason ? ' (' + b.lost_reason + ')' : ''}`}, ${user.id})`
    }
    await logAction({ actorId: user.id, action: 'UPDATE', table: 'opportunities', recordId: id, before, after, reason: b.lost_reason ?? null, ip: clientIp(req) }, t)
    return Response.json({ ok: true })
  })
})
