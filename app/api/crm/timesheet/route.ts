import { requireCrm, can, handle, HttpError, clientIp } from '@/lib/crm/session'
import { timesheet, DAY_STATUS_LABEL, type DayStatus } from '@/lib/crm/attendance'
import { logAction } from '@/lib/crm/audit'
import { toCsv } from '@/lib/campaigns'
import { time } from '@/lib/crm/format'

/** Xuất bảng công tháng ra CSV (người có quyền bảng công: cả công ty; còn lại: chỉ của mình). */
export const GET = handle(async (req: Request) => {
  const user = await requireCrm('cham_cong.cua_toi')
  const ym = new URL(req.url).searchParams.get('thang') || ''
  if (!/^\d{4}-\d{2}$/.test(ym)) throw new HttpError(400, 'Tháng không hợp lệ (YYYY-MM)')
  const [y, m] = ym.split('-').map(Number)
  const to = `${ym}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`
  const all = can(user, 'cham_cong.bang_cong')
  const rows = await timesheet(`${ym}-01`, to, all ? null : user.id)
  await logAction({ actorId: user.id, action: 'EXPORT', table: 'attendance', after: { month: ym, rows: rows.length, all }, ip: clientIp(req) })
  const csv = toCsv(['Nhân viên', 'Bộ phận', 'Ngày', 'Ca', 'Giờ ca', 'Vào', 'Ra', 'Muộn (phút)', 'Về sớm (phút)', 'Công (phút)', 'Trạng thái'],
    rows.map(r => [r.staff_name, r.department, r.work_date, r.shift_name, `${time(r.start_at)}-${time(r.end_at)}`, r.in_at ? time(r.in_at) : '', r.out_at ? time(r.out_at) : '',
      r.late_min, r.early_min, r.worked_min, DAY_STATUS_LABEL[r.day_status as DayStatus]]))
  return new Response(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="bang-cong-${ym}.csv"` } })
})
