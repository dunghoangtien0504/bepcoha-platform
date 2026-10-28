import { getDb } from '@/lib/db'
import { requireCrm, handle, HttpError, clientIp } from '@/lib/crm/session'
import { logAction } from '@/lib/crm/audit'
import { DEPARTMENTS } from '@/lib/crm/permissions'
import { reviewRedeem, getSettings, ensureSanChoiSchema, SanChoiError } from '@/lib/crm/san-choi'

/** Quản trị Sân chơi (quyền Cài đặt): duyệt đổi thưởng, sửa trần ngân sách / bộ phận thí điểm, bật-tắt và chỉnh tỷ lệ ô quà. */
export const POST = handle(async (req: Request) => {
  const user = await requireCrm('cai_dat.sua')
  const b = await req.json().catch(() => ({}))
  const ip = clientIp(req)
  const sql = getDb()
  try {
    if (b.action === 'duyet_doi') {
      return Response.json(await reviewRedeem(Number(b.id), user.id, !!b.approve, String(b.note || ''), ip))
    }
    if (b.action === 'cai_dat') {
      const before = await getSettings()
      const n = (v: unknown, min: number, max: number, label: string) => {
        const x = Math.round(Number(v))
        if (!Number.isFinite(x) || x < min || x > max) throw new HttpError(400, `${label}: ${min.toLocaleString('vi-VN')}–${max.toLocaleString('vi-VN')}`)
        return x
      }
      const departments = (Array.isArray(b.departments) ? b.departments : []).filter((d: unknown) => (DEPARTMENTS as readonly unknown[]).includes(d))
      const after = {
        ...before,
        monthly_budget: n(b.monthly_budget, 0, 50_000_000, 'Trần tháng'),
        weekly_budget: n(b.weekly_budget, 0, 20_000_000, 'Mở mỗi tuần'),
        kudos_per_manager_month: n(b.kudos_per_manager_month, 0, 50, 'Lượt thưởng nóng mỗi quản lý'),
        kudos_per_receiver_month: n(b.kudos_per_receiver_month, 0, 20, 'Lượt thưởng nóng mỗi người nhận'),
        manual_tokens_month: n(b.manual_tokens_month ?? before.manual_tokens_month, 0, 500, 'Quỹ lượt cấp tay / tháng'),
        manual_second_over: n(b.manual_second_over ?? before.manual_second_over, 1, 50, 'Cấp quá bao nhiêu lượt cần người thứ hai'),
        voucher_days: n(b.voucher_days ?? before.voucher_days, 1, 60, 'Hạn voucher (ngày)'),
        voucher_per_week: n(b.voucher_per_week ?? before.voucher_per_week, 1, 20, 'Voucher mỗi tuần'),
        salary_month_max: n(b.salary_month_max ?? before.salary_month_max, 0, 5_000_000, 'Cộng lương tối đa / tháng'),
        kho_window: (() => { const w = String(b.kho_window ?? before.kho_window ?? '').trim(); if (w && !/^\d{1,2}:\d{2}-\d{1,2}:\d{2}$/.test(w)) throw new HttpError(400, 'Giờ kho dạng 16:30-17:30 hoặc để trống'); return w })(),
        departments,
      }
      await sql`UPDATE app_settings SET value = ${sql.json(after as never)}, updated_by = ${user.id}, updated_at = NOW() WHERE key = 'san_choi'`
      await logAction({ actorId: user.id, action: 'UPDATE', table: 'app_settings', recordKey: 'san_choi', before, after, ip })
      return Response.json(after)
    }
    if (b.action === 'o_qua') {
      await ensureSanChoiSchema()
      const before = (await sql`SELECT * FROM sc_prizes WHERE id = ${Number(b.id)}`)[0]
      if (!before) throw new HttpError(404, 'Không tìm thấy ô quà')
      const weight = Math.round(Number(b.weight))
      if (!Number.isInteger(weight) || weight < 0 || weight > 1000) throw new HttpError(400, 'Tỷ lệ 0–1000')
      const after = (await sql`UPDATE sc_prizes SET weight = ${weight}, active = ${!!b.active} WHERE id = ${before.id} RETURNING *`)[0]
      await logAction({ actorId: user.id, action: 'UPDATE', table: 'sc_prizes', recordId: before.id, before, after, ip })
      return Response.json(after)
    }
  } catch (e) {
    if (e instanceof SanChoiError) throw new HttpError(400, e.message)
    throw e
  }
  throw new HttpError(400, 'Thao tác không hợp lệ')
})
