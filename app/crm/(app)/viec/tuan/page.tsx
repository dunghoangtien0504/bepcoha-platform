import Link from 'next/link'
import { getDb } from '@/lib/db'
import { pageUser, can } from '@/lib/crm/session'
import { DEPARTMENT_LABEL, DEPARTMENTS, type Department } from '@/lib/crm/permissions'
import { todayVN, mondayOf, addDays, weekdayShort } from '@/lib/crm/format'
import { Icon } from '../../../_components/icons'

export const metadata = { title: 'Giao việc theo tuần' }

// Màu trạng thái theo chú giải "Giao việc Cửa hàng" của EasyERP (khung hình B2 bài 11 · 10:56)
const STATES = {
  giao: { label: 'Đã giao (chưa làm)', chip: 'bg-amber-100 text-amber-900 ring-amber-300' },
  lam: { label: 'Đang làm', chip: 'bg-emerald-50 text-emerald-800 ring-emerald-300' },
  cho: { label: 'Chờ duyệt', chip: 'bg-yellow-50 text-yellow-800 ring-yellow-300' },
  duyet: { label: 'Đã duyệt', chip: 'bg-sky-50 text-sky-800 ring-sky-300' },
  khong: { label: 'Không hoàn thành', chip: 'bg-rose-50 text-rose-700 ring-rose-300' },
} as const
type State = keyof typeof STATES

/**
 * Lưới tuần người × ngày: mỗi việc là một ô màu theo trạng thái, đọc từ cùng bảng việc (không có hệ thống việc thứ hai).
 * Nhân viên thấy dòng của mình; quản lý thấy bộ phận mình; ban giám đốc lọc được mọi bộ phận. Mặc định không gồm việc chăm khách (máy sinh nhiều).
 */
export default async function TuanPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await pageUser()
  const sp = await props.searchParams
  const today = todayVN()
  const week = mondayOf(typeof sp.tuan === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(sp.tuan) ? sp.tuan : today)
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i))
  const boss = user.role === 'admin' || user.department === 'ban_giam_doc'
  const manager = can(user, 'viec.giao')
  const dept = boss ? (typeof sp.bp === 'string' && (DEPARTMENTS as readonly string[]).includes(sp.bp) ? sp.bp : null) : user.department
  const withCare = sp.khach === '1'
  const sql = getDb()

  const staff = manager
    ? await sql`SELECT id, name, department FROM staff WHERE status = 'active' AND (${dept}::text IS NULL OR department = ${dept}) ORDER BY department, name`
    : await sql`SELECT id, name, department FROM staff WHERE id = ${user.id}`
  const ids = staff.map(s => s.id as number)
  const tasks = await sql`
    SELECT t.id, t.title, t.status, t.reviewed_at, t.assigned_staff_id, t.source, t.department,
           ((t.due_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date)::text AS day, (t.due_at < NOW()) AS past
    FROM crm_tasks t
    WHERE t.due_at >= (${week}::date)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'
      AND t.due_at < (${addDays(week, 7)}::date)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'
      AND (t.assigned_staff_id = ANY(${ids}::int[]) OR (${manager} AND t.assigned_staff_id IS NULL AND (${dept}::text IS NULL OR t.department = ${dept})))
      AND (${withCare} OR t.customer_id IS NULL)
    ORDER BY t.due_at, t.id`
  const state = (t: Record<string, unknown>): State =>
    t.status === 'xong' ? (t.reviewed_at ? 'duyet' : 'cho') : t.status === 'bo_qua' ? 'khong' : t.past ? 'khong' : t.status === 'dang_lam' ? 'lam' : 'giao'
  const rows = [
    ...staff.map(s => ({ key: String(s.id), name: s.name as string, dept: s.department as string | null, items: tasks.filter(t => t.assigned_staff_id === s.id) })),
    ...(manager ? [{ key: 'none', name: 'Chưa giao', dept: null, items: tasks.filter(t => t.assigned_staff_id === null) }] : []),
  ].filter(r => r.key !== 'none' || r.items.length)
  const counts = Object.fromEntries((Object.keys(STATES) as State[]).map(k => [k, tasks.filter(t => state(t) === k).length])) as Record<State, number>
  const q = (o: Record<string, string | null>) => '/crm/viec/tuan?' + new URLSearchParams(Object.entries({ tuan: week, bp: dept ?? '', khach: withCare ? '1' : '', ...o }).filter(([, v]) => v) as [string, string][]).toString()
  // Tuần ISO (như EasyERP: "Tuần 39 21/09–27/09"): tuần chứa thứ Năm đầu tiên của năm là tuần 1
  const thu = new Date(addDays(week, 3) + 'T00:00:00Z')
  const jan4 = new Date(Date.UTC(thu.getUTCFullYear(), 0, 4))
  const weekNo = 1 + Math.round(((+thu - +jan4) / 86400000 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7)
  const btn = 'inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700 hover:bg-stone-50'

  return (
    <>
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-700"><Icon name="calendar" /></span>
        <div><h1 className="text-xl font-semibold text-stone-900">Giao việc theo tuần</h1><p className="text-sm text-stone-500">Mỗi ô là một việc, màu theo trạng thái. Bấm tên việc để mở và làm.</p></div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-stone-200 bg-white p-3">
        {boss && (
          <div className="flex flex-wrap gap-1">
            <Link href={q({ bp: null })} className={`rounded-full px-3 py-1.5 text-sm ${!dept ? 'bg-amber-500 font-semibold text-white' : 'bg-stone-100 text-stone-600'}`}>Tất cả</Link>
            {DEPARTMENTS.map(d => <Link key={d} href={q({ bp: d })} className={`rounded-full px-3 py-1.5 text-sm ${dept === d ? 'bg-amber-500 font-semibold text-white' : 'bg-stone-100 text-stone-600'}`}>{DEPARTMENT_LABEL[d]}</Link>)}
          </div>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Link href={q({ tuan: addDays(week, -7) })} className={btn} aria-label="Tuần trước"><Icon name="chevron" className="rotate-180" size={16} /></Link>
          <span className="rounded-lg bg-amber-50 px-3 py-2 text-sm"><b>Tuần {weekNo}</b> <span className="text-stone-500">{days[0].slice(8)}/{days[0].slice(5, 7)} – {days[6].slice(8)}/{days[6].slice(5, 7)}</span></span>
          <Link href={q({ tuan: addDays(week, 7) })} className={btn} aria-label="Tuần sau"><Icon name="chevron" size={16} /></Link>
          <Link href={q({ tuan: today })} className={btn}>Hôm nay</Link>
          <Link href={q({ khach: withCare ? null : '1' })} className={`${btn} ${withCare ? 'border-amber-400 bg-amber-50' : ''}`}>{withCare ? '✓ ' : ''}Gồm việc chăm khách</Link>
          {manager && <Link href="/crm/du-an" className={`${btn} border-amber-400 bg-amber-400 font-semibold text-amber-950 hover:bg-amber-500`}><Icon name="plus" size={16} />Giao việc dự án</Link>}
        </div>
        <div className="flex w-full flex-wrap gap-x-4 gap-y-1 pt-1 text-xs text-stone-600">
          {(Object.keys(STATES) as State[]).map(k => <span key={k} className="flex items-center gap-1.5"><span className={`h-3 w-3 rounded ring-1 ${STATES[k].chip}`} />{STATES[k].label} · <b>{counts[k]}</b></span>)}
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
        <table className="w-full min-w-[960px] table-fixed text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-xs text-stone-500">
            <tr>
              <th className="w-44 px-3 py-2 text-left font-medium">Người làm</th>
              {days.map(d => <th key={d} className={`px-2 py-2 text-left font-medium ${d === today ? 'bg-amber-50 text-amber-800' : ''}`}>{weekdayShort(d)} {d.slice(8)}/{d.slice(5, 7)}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {rows.map(r => (
              <tr key={r.key} className="align-top">
                <td className="px-3 py-2"><div className="font-medium text-stone-900">{r.name}</div><div className="text-xs text-stone-400">{r.dept ? DEPARTMENT_LABEL[r.dept as Department] : ''} · {r.items.length} việc</div></td>
                {days.map(d => {
                  const items = r.items.filter(t => t.day === d)
                  return (
                    <td key={d} className={`px-1.5 py-1.5 ${d === today ? 'bg-amber-50/40' : ''}`}>
                      <div className="space-y-1">
                        {items.slice(0, 4).map(t => (
                          <Link key={t.id} href={t.source === 'du_an' ? '/crm/du-an' : '/crm/viec'} title={`${t.title} · ${STATES[state(t)].label}`}
                            className={`block truncate rounded-md px-1.5 py-1 text-[12px] ring-1 ring-inset ${STATES[state(t)].chip}`}>{t.title}</Link>
                        ))}
                        {items.length > 4 && <div className="px-1 text-[11px] text-stone-500">+{items.length - 4} việc</div>}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={8} className="px-3 py-10 text-center text-stone-400">Tuần này chưa có việc nào.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  )
}
