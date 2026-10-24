import { getDb } from '@/lib/db'
import { requireCrm, handle, HttpError, clientIp } from '@/lib/crm/session'
import { logAction } from '@/lib/crm/audit'
import { getCustomer360 } from '@/lib/crm/customers'
import { normalizeSegments } from '@/lib/loop'
import { CUSTOMER_STAGE_LABEL } from '@/lib/crm/labels'

type Ctx = { params: Promise<{ id: string }> }

export const GET = handle(async (_req: Request, ctx: Ctx) => {
  await requireCrm('khach.xem')
  const id = Number((await ctx.params).id)
  const data = await getCustomer360(id)
  if (!data) throw new HttpError(404, 'Không tìm thấy khách')
  return Response.json(data)
})

/** Sửa hồ sơ khách. Gỡ cờ "từ chối nhận tin" chỉ quản trị làm được (nhân viên chỉ được bật). */
export const PATCH = handle(async (req: Request, ctx: Ctx) => {
  const user = await requireCrm('khach.sua')
  const id = Number((await ctx.params).id)
  const b = await req.json().catch(() => ({}))
  const sql = getDb()
  return sql.begin(async tx => {
    const t = tx as unknown as typeof sql
    const before = (await t`SELECT id, stage, segments, assigned_staff_id, internal_note, stars, birthday, opted_out_at, name FROM customers WHERE id = ${id} FOR UPDATE`)[0]
    if (!before) throw new HttpError(404, 'Không tìm thấy khách')
    const set: Record<string, unknown> = {}
    if (b.stage !== undefined) {
      if (!(b.stage in CUSTOMER_STAGE_LABEL)) throw new HttpError(400, 'Giai đoạn không hợp lệ')
      set.stage = b.stage
    }
    if (b.segments !== undefined) set.segments = normalizeSegments(b.segments)
    if (b.assigned_staff_id !== undefined) set.assigned_staff_id = b.assigned_staff_id ? Number(b.assigned_staff_id) : null
    if (b.internal_note !== undefined) set.internal_note = String(b.internal_note).slice(0, 4000)
    if (b.name !== undefined) set.name = String(b.name).trim().slice(0, 200)
    if (b.stars !== undefined) set.stars = b.stars ? Math.min(5, Math.max(1, Number(b.stars))) : null
    if (b.birthday !== undefined) set.birthday = b.birthday ? String(b.birthday).slice(0, 10) : null
    if (b.opted_out === true) set.opted_out_at = before.opted_out_at ?? new Date()
    if (b.opted_out === false && before.opted_out_at) {
      if (user.role !== 'admin') throw new HttpError(403, 'Chỉ quản trị được gỡ cờ "từ chối nhận tin"')
      if (!String(b.reason || '').trim()) throw new HttpError(400, 'Ghi lý do gỡ cờ (vd: khách chủ động nhắn lại xin nhận tin)')
      set.opted_out_at = null
    }
    if (!Object.keys(set).length) throw new HttpError(400, 'Không có gì để cập nhật')
    const after = (await t`UPDATE customers SET ${t(set as never)}, updated_at = NOW() WHERE id = ${id}
      RETURNING id, stage, segments, assigned_staff_id, internal_note, stars, birthday, opted_out_at, name`)[0]
    await logAction({ actorId: user.id, action: 'UPDATE', table: 'customers', recordId: id, before, after, reason: b.reason ?? null, ip: clientIp(req) }, t)
    return Response.json({ ok: true, customer: after })
  })
})

/** Ghi chú / ghi nhận một lần liên hệ thủ công vào dòng thời gian của khách. */
export const POST = handle(async (req: Request, ctx: Ctx) => {
  const user = await requireCrm('khach.xem')
  const id = Number((await ctx.params).id)
  const b = await req.json().catch(() => ({}))
  const content = String(b.content || '').trim().slice(0, 4000)
  if (!content) throw new HttpError(400, 'Nhập nội dung')
  const kind = ['ghi_chu', 'goi_dien', 'nhan_tin', 'gap_truc_tiep'].includes(b.kind) ? b.kind : 'ghi_chu'
  const sql = getDb()
  await sql`INSERT INTO customer_activities (customer_id, kind, content, staff_id) VALUES (${id}, ${kind}, ${content}, ${user.id})`
  if (kind !== 'ghi_chu') await sql`UPDATE customers SET last_contact_at = NOW() WHERE id = ${id}`
  return Response.json({ ok: true })
})
