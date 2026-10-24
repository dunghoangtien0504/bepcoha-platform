import Link from 'next/link'
import { pageUser, can } from '@/lib/crm/session'
import { timesheet, DAY_STATUS_LABEL, type DayStatus } from '@/lib/crm/attendance'
import { DEPARTMENT_LABEL, type Department } from '@/lib/crm/permissions'
import { todayVN, time, weekdayShort, minutesToHours } from '@/lib/crm/format'
import { PageHeader, Card, Table, Td, Badge } from '../../_components/ui'
import { ManualPunch } from './timesheet-client'

export const metadata = { title: 'Bảng công' }

function monthRange(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return { from: `${ym}-01`, to: `${ym}-${String(last).padStart(2, '0')}` }
}

export default async function TimesheetPage(props: PageProps<'/crm/bang-cong'>) {
  const user = await pageUser()
  const sp = await props.searchParams
  const ym = typeof sp.thang === 'string' && /^\d{4}-\d{2}$/.test(sp.thang) ? sp.thang : todayVN().slice(0, 7)
  const { from, to } = monthRange(ym)
  const all = can(user, 'cham_cong.bang_cong') || can(user, 'cham_cong.duyet')
  const sel = all && typeof sp.nv === 'string' ? Number(sp.nv) : all ? null : user.id
  let rows = [...await timesheet(from, to, all ? null : user.id)]
  if (all && user.role !== 'admin' && !can(user, 'cham_cong.bang_cong')) rows = rows.filter(r => r.department === user.department)

  const by = new Map<number, { name: string; dept: string; shifts: number; worked: number; planned: number; late: number; lateMin: number; absent: number; missing: number; leave: number; flagged: number }>()
  for (const r of rows) {
    if (r.day_status === 'chua_den') continue
    const s = by.get(r.staff_id) ?? { name: r.staff_name, dept: r.department, shifts: 0, worked: 0, planned: 0, late: 0, lateMin: 0, absent: 0, missing: 0, leave: 0, flagged: 0 }
    s.shifts++; s.worked += r.worked_min; s.planned += r.planned_min; s.flagged += r.flagged
    if (r.late_min > 0) { s.late++; s.lateMin += r.late_min }
    if (r.day_status === 'vang') s.absent++
    if (r.day_status === 'thieu_cham') s.missing++
    if (r.day_status === 'nghi_co_phep') s.leave++
    by.set(r.staff_id, s)
  }
  const prev = (() => { const [y, m] = ym.split('-').map(Number); const d = new Date(Date.UTC(y, m - 2, 1)); return d.toISOString().slice(0, 7) })()
  const next = (() => { const [y, m] = ym.split('-').map(Number); const d = new Date(Date.UTC(y, m, 1)); return d.toISOString().slice(0, 7) })()
  const detail = sel ? rows.filter(r => r.staff_id === sel) : []

  return (
    <>
      <PageHeader title={`Bảng công tháng ${ym.slice(5)}/${ym.slice(0, 4)}`} sub="Công = thời gian có mặt trong khung ca, trừ nghỉ giữa ca. Lượt chấm ngoài vùng/máy lạ không được tính cho tới khi quản lý xem xét."
        actions={<>
          <Link className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm" href={`/crm/bang-cong?thang=${prev}`}>← {prev.slice(5)}/{prev.slice(0, 4)}</Link>
          <Link className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm" href={`/crm/bang-cong?thang=${next}`}>{next.slice(5)}/{next.slice(0, 4)} →</Link>
          <a className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-medium text-white" href={`/api/crm/timesheet?thang=${ym}`}>Tải CSV</a>
        </>} />
      <Card pad={false} title="Tổng hợp theo người">
        <Table head={['Nhân viên', 'Bộ phận', 'Số ca', 'Công thực tế', 'Theo lịch', 'Đi muộn', 'Vắng', 'Thiếu chấm', 'Nghỉ có phép', 'Cần xem']}>
          {[...by.entries()].map(([id, s]) => (
            <tr key={id} className={sel === id ? 'bg-emerald-50/60' : ''}>
              <Td>{all ? <Link className="font-medium text-emerald-800 hover:underline" href={`/crm/bang-cong?thang=${ym}&nv=${id}`}>{s.name}</Link> : s.name}</Td>
              <Td>{DEPARTMENT_LABEL[s.dept as Department] ?? s.dept}</Td>
              <Td className="tabular-nums">{s.shifts}</Td>
              <Td className="tabular-nums">{minutesToHours(s.worked)}</Td>
              <Td className="tabular-nums text-stone-500">{minutesToHours(s.planned)}</Td>
              <Td className="tabular-nums">{s.late ? `${s.late} lần · ${s.lateMin}′` : '—'}</Td>
              <Td className="tabular-nums">{s.absent || '—'}</Td>
              <Td className="tabular-nums">{s.missing || '—'}</Td>
              <Td className="tabular-nums">{s.leave || '—'}</Td>
              <Td>{s.flagged ? <Badge tone="red">{s.flagged} lượt</Badge> : '—'}</Td>
            </tr>
          ))}
        </Table>
      </Card>
      {detail.length > 0 && (
        <Card pad={false} className="mt-4" title={`Chi tiết: ${detail[0].staff_name}`}
          actions={can(user, 'cham_cong.duyet') ? <ManualPunch staffId={sel!} assignments={detail.map(d => ({ id: d.assignment_id, label: `${d.work_date} ${d.code}` }))} /> : undefined}>
          <Table head={['Ngày', 'Ca', 'Vào', 'Ra', 'Muộn', 'Sớm', 'Công', 'Trạng thái']}>
            {detail.map(d => (
              <tr key={d.assignment_id}>
                <Td>{weekdayShort(d.work_date)} {d.work_date.slice(8)}/{d.work_date.slice(5, 7)}</Td>
                <Td>{d.shift_name} <span className="text-xs text-stone-400">{time(d.start_at)}–{time(d.end_at)}</span></Td>
                <Td className="tabular-nums">{d.in_at ? time(d.in_at) : '—'}</Td>
                <Td className="tabular-nums">{d.out_at ? time(d.out_at) : '—'}</Td>
                <Td className="tabular-nums">{d.late_min ? d.late_min + '′' : ''}</Td>
                <Td className="tabular-nums">{d.early_min ? d.early_min + '′' : ''}</Td>
                <Td className="tabular-nums">{minutesToHours(d.worked_min)}</Td>
                <Td><Badge tone={d.day_status === 'du_cong' ? 'green' : ['vang', 'thieu_cham'].includes(d.day_status) ? 'red' : 'amber'}>{DAY_STATUS_LABEL[d.day_status as DayStatus]}</Badge>{d.leave_kind && <span className="ml-1 text-xs text-stone-500">({d.leave_kind})</span>}</Td>
              </tr>
            ))}
          </Table>
        </Card>
      )}
    </>
  )
}
