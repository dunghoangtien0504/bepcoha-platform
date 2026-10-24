import { getDb } from '@/lib/db'
import { pageUser } from '@/lib/crm/session'
import { timesheet, onTimeStreak, DAY_STATUS_LABEL, type DayStatus } from '@/lib/crm/attendance'
import { todayVN, mondayOf, addDays, time, dateTime, weekdayShort, minutesToHours } from '@/lib/crm/format'
import { PageHeader, Card, Badge, Table, Td, Note } from '../../_components/ui'
import { PunchPanel } from './punch-client'

export const metadata = { title: 'Chấm công' }

const TONE: Record<string, 'green' | 'amber' | 'red' | 'blue' | 'gray'> = {
  du_cong: 'green', di_muon: 'amber', ve_som: 'amber', muon_som: 'amber', thieu_cham: 'red', vang: 'red', nghi_co_phep: 'gray', chua_den: 'blue', dang_lam: 'blue',
}

export default async function MyAttendance() {
  const user = await pageUser()
  const today = todayVN()
  const mon = mondayOf(today)
  const sql = getDb()
  const [week, streak, logs, site] = await Promise.all([
    timesheet(mon, addDays(mon, 6), user.id),
    onTimeStreak(user.id),
    sql`SELECT kind, at, validity, distance_m, method, note FROM attendance_logs WHERE staff_id = ${user.id} ORDER BY at DESC LIMIT 10`,
    sql`SELECT name, lat, lng, radius_m FROM work_sites WHERE active ORDER BY id LIMIT 1`,
  ])
  const todayShifts = week.filter(w => w.work_date === today)
  const worked = week.reduce((a, w) => a + (w.worked_min as number), 0)
  const planned = week.reduce((a, w) => a + (w.planned_min as number), 0)

  return (
    <>
      <PageHeader title="Chấm công" sub="Chấm bằng vị trí GPS trên điện thoại đã đăng ký. Lần chấm đầu tiên sẽ đăng ký máy này." />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-1">
          <PunchPanel shifts={todayShifts.map(s => ({ id: s.assignment_id as number, name: s.shift_name as string, start: time(s.start_at), end: time(s.end_at), inAt: s.in_at ? time(s.in_at) : null, outAt: s.out_at ? time(s.out_at) : null }))}
            siteName={site[0]?.name ?? null} />
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-emerald-200 bg-white p-4 text-center shadow-sm">
              <div className="text-3xl font-semibold text-emerald-700">{streak}</div><div className="text-xs text-stone-500">ca đúng giờ liên tiếp</div></div>
            <div className="rounded-xl border border-stone-200 bg-white p-4 text-center shadow-sm">
              <div className="text-xl font-semibold tabular-nums">{minutesToHours(worked)}</div><div className="text-xs text-stone-500">tuần này / {minutesToHours(planned)} theo lịch</div></div>
          </div>
        </div>
        <Card title="Lịch ca tuần này" className="lg:col-span-2" pad={false}>
          <Table head={['Ngày', 'Ca', 'Giờ ca', 'Vào', 'Ra', 'Công', 'Trạng thái']} empty="Tuần này chưa có ca.">
            {week.map(w => (
              <tr key={w.assignment_id} className={w.work_date === today ? 'bg-emerald-50/50' : ''}>
                <Td>{weekdayShort(w.work_date)} {w.work_date.slice(8)}/{w.work_date.slice(5, 7)}</Td>
                <Td><span className="inline-block h-2 w-2 rounded-full" style={{ background: w.color }} /> {w.shift_name}</Td>
                <Td className="tabular-nums">{time(w.start_at)}–{time(w.end_at)}</Td>
                <Td className="tabular-nums">{w.in_at ? time(w.in_at) : '—'}{w.late_min > 0 && <span className="ml-1 text-xs text-amber-700">+{w.late_min}′</span>}</Td>
                <Td className="tabular-nums">{w.out_at ? time(w.out_at) : '—'}{w.early_min > 0 && <span className="ml-1 text-xs text-amber-700">−{w.early_min}′</span>}</Td>
                <Td className="tabular-nums">{minutesToHours(w.worked_min)}</Td>
                <Td><Badge tone={TONE[w.day_status] ?? 'gray'}>{DAY_STATUS_LABEL[w.day_status as DayStatus]}</Badge>{w.flagged > 0 && <Badge tone="red" title="Có lượt chấm ngoài vùng/thiết bị lạ">!</Badge>}</Td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>
      <Card title="Lượt chấm gần đây" className="mt-4" pad={false}>
        <Table head={['Thời điểm', 'Loại', 'Hợp lệ', 'Khoảng cách', 'Cách chấm', 'Ghi chú']}>
          {logs.map((l, i) => (
            <tr key={i}>
              <Td>{dateTime(l.at)}</Td><Td>{l.kind === 'vao' ? 'Vào ca' : 'Ra ca'}</Td>
              <Td><Badge tone={l.validity === 'hop_le' ? 'green' : 'red'}>{{ hop_le: 'Hợp lệ', ngoai_vung: 'Ngoài vùng', thiet_bi_la: 'Máy lạ', khong_vi_tri: 'Không có vị trí' }[l.validity as string]}</Badge></Td>
              <Td className="tabular-nums">{l.distance_m != null ? Math.round(l.distance_m) + 'm' : '—'}</Td>
              <Td>{{ gps: 'GPS', ip: 'Wi-Fi bếp', sua_tay: 'Quản lý sửa' }[l.method as string]}</Td><Td className="text-stone-500">{l.note}</Td>
            </tr>
          ))}
        </Table>
      </Card>
      <div className="mt-4"><Note>Quên chấm hoặc chấm lỗi? Gửi đơn “Quên chấm công” ở mục Đơn từ — quản lý duyệt thì ca được tính đủ công.</Note></div>
    </>
  )
}
