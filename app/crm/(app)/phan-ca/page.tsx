import Link from 'next/link'
import { Fragment } from 'react'
import { getDb } from '@/lib/db'
import { pageUser, can } from '@/lib/crm/session'
import { coverage } from '@/lib/crm/attendance'
import { DEPARTMENT_LABEL, type Department } from '@/lib/crm/permissions'
import { todayVN, mondayOf, addDays, weekdayShort } from '@/lib/crm/format'
import { PageHeader, Card, Forbidden, Note } from '../../_components/ui'
import { AddShift, RemoveShift, CopyWeek } from './shift-client'

export const metadata = { title: 'Xếp ca' }

export default async function SchedulePage(props: PageProps<'/crm/phan-ca'>) {
  const user = await pageUser()
  if (!can(user, 'cham_cong.phan_ca')) return <Forbidden />
  const sp = await props.searchParams
  const mon = mondayOf(typeof sp.tuan === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(sp.tuan) ? sp.tuan : todayVN())
  const days = Array.from({ length: 7 }, (_, i) => addDays(mon, i))
  const sql = getDb()
  const deptFilter = user.role === 'admin' ? null : user.department
  const [staff, templates, asg, cov] = await Promise.all([
    sql`SELECT id, name, department FROM staff WHERE status = 'active' AND department IS NOT NULL AND (${deptFilter}::text IS NULL OR department = ${deptFilter}) ORDER BY department, name`,
    sql`SELECT id, code, name, department, to_char(start_time, 'HH24:MI') AS s, to_char(end_time, 'HH24:MI') AS e, color FROM shift_templates WHERE active ORDER BY start_time`,
    sql`SELECT a.id, a.staff_id, a.work_date::text AS d, t.code, t.color, to_char(t.start_time, 'HH24:MI') AS s, to_char(t.end_time, 'HH24:MI') AS e,
          EXISTS (SELECT 1 FROM attendance_logs l WHERE l.assignment_id = a.id) AS punched
        FROM shift_assignments a JOIN shift_templates t ON t.id = a.template_id WHERE a.work_date BETWEEN ${mon}::date AND ${days[6]}::date`,
    coverage(mon, days[6]),
  ])
  const byCell = new Map<string, (typeof asg)[number][]>()
  for (const a of asg) { const k = `${a.staff_id}|${a.d}`; byCell.set(k, [...(byCell.get(k) ?? []), a]) }
  const depts = [...new Set(staff.map(s => s.department as Department))]
  const tpl = templates.map(t => ({ id: t.id, label: `${t.code} ${t.s}–${t.e}`, department: t.department }))

  return (
    <>
      <PageHeader title="Xếp ca" sub="Định biên theo TỔNG GIỜ CÔNG của bộ phận mỗi ngày (B2 Z09), không định biên theo số người. Ô đỏ = thiếu giờ so với định biên."
        actions={<>
          <Link className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm" href={`/crm/phan-ca?tuan=${addDays(mon, -7)}`}>← Tuần trước</Link>
          <Link className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm" href={`/crm/phan-ca?tuan=${addDays(mon, 7)}`}>Tuần sau →</Link>
          <CopyWeek from={addDays(mon, -7)} to={mon} />
        </>} />
      <Card pad={false} title={`Tuần ${days[0].slice(8)}/${days[0].slice(5, 7)} – ${days[6].slice(8)}/${days[6].slice(5, 7)}/${days[6].slice(0, 4)}`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-stone-50 text-xs text-stone-500">
              <tr><th className="px-3 py-2 text-left font-medium">Nhân viên</th>{days.map(d => <th key={d} className={`px-2 py-2 text-left font-medium ${d === todayVN() ? 'text-emerald-700' : ''}`}>{weekdayShort(d)} {d.slice(8)}/{d.slice(5, 7)}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {depts.map(dep => (
                <Fragment key={dep}>
                  <tr className="bg-stone-50/70">
                    <td className="px-3 py-1.5 text-xs font-semibold text-stone-600">{DEPARTMENT_LABEL[dep]}</td>
                    {days.map(d => {
                      const c = cov.find(x => x.day === d && x.department === dep)
                      const short = c && c.planned_hours + 0.01 < c.target_hours
                      return <td key={d} className={`px-2 py-1.5 text-xs tabular-nums ${short ? 'bg-rose-50 text-rose-700' : 'text-stone-500'}`}>{c ? `${c.planned_hours.toFixed(1)}/${c.target_hours}g` : '—'}</td>
                    })}
                  </tr>
                  {staff.filter(s => s.department === dep).map(s => (
                    <tr key={s.id}>
                      <td className="whitespace-nowrap px-3 py-2">{s.name}</td>
                      {days.map(d => (
                        <td key={d} className="px-2 py-1.5 align-top">
                          <div className="flex flex-col gap-1">
                            {(byCell.get(`${s.id}|${d}`) ?? []).map(a => (
                              <span key={a.id} className="flex items-center justify-between gap-1 rounded px-1.5 py-0.5 text-xs text-white" style={{ background: a.color }}>
                                {a.code} {a.s}{!a.punched && <RemoveShift id={a.id} />}
                              </span>
                            ))}
                            <AddShift staffId={s.id} day={d} templates={tpl.filter(t => !t.department || t.department === dep)} />
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <div className="mt-4"><Note>Ca đã có lượt chấm công thì không xoá được. Đổi định biên giờ công và kho ca ở mục Cài đặt.</Note></div>
    </>
  )
}
