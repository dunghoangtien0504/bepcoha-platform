import { getDb, getCampaignTreatmentForExport, recordCampaignExport, campaignExists } from '@/lib/db'
import { requireCrm, handle, HttpError, clientIp } from '@/lib/crm/session'
import { logAction } from '@/lib/crm/audit'
import { toCsv } from '@/lib/campaigns'

type Ctx = { params: Promise<{ id: string }> }

/** Xuất danh sách nhóm LIÊN HỆ (không bao giờ có nhóm đối chứng) ra CSV — dữ liệu cá nhân, giới hạn số lần/ngày, có nhật ký. */
export const GET = handle(async (req: Request, ctx: Ctx) => {
  const user = await requireCrm('khach.xuat')
  const id = Number((await ctx.params).id)
  if (!(await campaignExists(id))) throw new HttpError(404, 'Không tìm thấy chiến dịch')
  const rows = await getCampaignTreatmentForExport(id)
  const ip = clientIp(req)
  if (!(await recordCampaignExport(id, user.id, rows.length, ip))) throw new HttpError(429, 'Đã xuất quá 10 lần trong 24 giờ')
  await logAction({ actorId: user.id, action: 'EXPORT', table: 'care_campaigns', recordId: id, after: { rows: rows.length }, ip })
  const csv = toCsv(['Tên', 'SĐT', 'Số lần mua', 'Tổng chi', 'Mua gần nhất'],
    rows.map(r => [r.name, r.phone, r.order_count, r.total_spent, r.last_order_at ? new Date(r.last_order_at).toLocaleDateString('vi-VN') : '']))
  return new Response(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="chien-dich-${id}.csv"` } })
})

/** Tạo việc gọi/nhắn cho từng khách nhóm LIÊN HỆ, chia đều cho Sale & CSKH (mỗi khách 1 việc nhờ auto_key). */
export const POST = handle(async (req: Request, ctx: Ctx) => {
  const user = await requireCrm('chien_dich.tao')
  const id = Number((await ctx.params).id)
  const b = await req.json().catch(() => ({}))
  const suggestion = String(b.suggestion || '').trim().slice(0, 1000)
  if (!suggestion) throw new HttpError(400, 'Nhập nội dung gợi ý cho nhân viên (ưu đãi, câu mở đầu)')
  const sql = getDb()
  const staff = (await sql`SELECT id FROM staff WHERE status = 'active' AND department = 'sale_cskh' ORDER BY id`).map(r => r.id as number)
  if (!staff.length) throw new HttpError(400, 'Chưa có nhân viên Sale & CSKH đang hoạt động')
  const r = await sql`
    WITH m AS (
      SELECT m.customer_id, ROW_NUMBER() OVER (ORDER BY md5(m.customer_id::text)) - 1 AS rn, k.name AS camp
      FROM care_campaign_members m JOIN care_campaigns k ON k.id = m.campaign_id JOIN customers c ON c.id = m.customer_id
      WHERE m.campaign_id = ${id} AND m.arm = 'treatment' AND c.opted_out_at IS NULL
    )
    INSERT INTO crm_tasks (customer_id, title, kind, priority, due_at, assigned_staff_id, created_by, auto_key, source, suggestion, department)
    SELECT m.customer_id, 'Chiến dịch: ' || m.camp, 'danh_thuc', 2, NOW() + INTERVAL '3 days',
           COALESCE(c.assigned_staff_id, (${staff}::int[])[(m.rn % ${staff.length}) + 1]), ${user.id}, 'camp:' || ${id} || ':' || m.customer_id,
           'chien_dich', ${suggestion}, 'sale_cskh'
    FROM m JOIN customers c ON c.id = m.customer_id
    ON CONFLICT (auto_key) WHERE auto_key IS NOT NULL DO NOTHING`
  await logAction({ actorId: user.id, action: 'CAMPAIGN_TASKS', table: 'care_campaigns', recordId: id, after: { created: r.count }, ip: clientIp(req) })
  return Response.json({ ok: true, created: r.count })
})
