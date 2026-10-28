import Link from 'next/link'
import { getDb } from '@/lib/db'
import { pageUser, can } from '@/lib/crm/session'
import { DEPARTMENT_LABEL, DEPARTMENTS, type Department } from '@/lib/crm/permissions'
import { listProjects, TEMPLATES } from '@/lib/crm/du-an'
import { PageHeader, Empty, Badge } from '../../_components/ui'
import { NewProjectForm } from './du-an-client'

export const metadata = { title: 'Dự án' }

const STATUS = { dang_chay: ['Đang chạy', 'blue'], xong: ['Xong', 'green'], tam_dung: ['Tạm dừng', 'gray'] } as const

/** Dự án = nhóm việc nhiều bộ phận có hạn chót (Asana/Monday thu gọn). Dự án có việc trễ nổi lên đầu. */
export default async function DuAnPage() {
  const user = await pageUser()
  const manager = can(user, 'viec.giao')
  const boss = user.role === 'admin' || user.department === 'ban_giam_doc'
  const projects = await listProjects()
  const staff = manager ? await getDb()`SELECT id, name FROM staff WHERE status = 'active' ORDER BY name` : []

  return (
    <>
      <PageHeader title="Dự án" sub="Việc nhiều bước, nhiều bộ phận, có hạn chót. Việc của dự án tự hiện ở “Việc của tôi” và “Hôm nay” của người được giao." />
      {manager && (
        <details className="mb-5 rounded-xl border border-stone-200 bg-white p-4 shadow-sm" open={projects.length === 0}>
          <summary className="cursor-pointer text-sm font-semibold text-emerald-800">+ Tạo dự án mới</summary>
          <div className="mt-3">
            <NewProjectForm boss={boss} myDept={user.department} staff={staff.map(s => ({ id: s.id, name: s.name }))}
              departments={DEPARTMENTS.map(d => ({ key: d, label: DEPARTMENT_LABEL[d] }))}
              templates={Object.values(TEMPLATES).map(t => ({ key: t.key, name: t.name, hint: t.hint, count: t.tasks.length }))} />
          </div>
        </details>
      )}
      {projects.length === 0 ? <Empty>Chưa có dự án nào.{manager ? ' Bấm “Tạo dự án mới”, chọn mẫu “Chiến dịch Tết” để có sẵn việc cho mọi bộ phận.' : ''}</Empty> : (
        <div className="grid gap-3 md:grid-cols-2">
          {projects.map(p => {
            const pct = p.total ? Math.round(p.done / p.total * 100) : 0
            const [label, tone] = STATUS[p.status as keyof typeof STATUS]
            const days = Number(p.days_left)
            return (
              <Link key={p.id} href={`/crm/du-an/${p.id}`} className={`block rounded-xl border bg-white p-4 shadow-sm transition hover:shadow ${p.late > 0 ? 'border-rose-200' : 'border-stone-200'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-base font-semibold text-stone-900">{p.name}</div>
                    <div className="text-xs text-stone-500">{p.department ? DEPARTMENT_LABEL[p.department as Department] : ''}{p.owner_name ? ` · ${p.owner_name}` : ''}</div>
                  </div>
                  <Badge tone={tone}>{label}</Badge>
                </div>
                <div className="mt-3 flex items-baseline justify-between text-sm">
                  <span><b className="text-2xl tabular-nums text-emerald-700">{pct}%</b> <span className="text-stone-500">{p.done}/{p.total} việc</span></span>
                  <span className={days < 0 ? 'font-semibold text-rose-600' : days <= 7 ? 'font-semibold text-amber-700' : 'text-stone-600'}>
                    {days < 0 ? `Quá hạn ${-days} ngày` : days === 0 ? 'Hạn hôm nay' : `Còn ${days} ngày`} · {p.deadline_text.split('-').reverse().join('/')}
                  </span>
                </div>
                <div className="mt-2 h-2.5 rounded-full bg-stone-100"><div className="h-2.5 rounded-full bg-emerald-600" style={{ width: `${pct}%` }} /></div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  {p.late > 0 && <Badge tone="red">{p.late} việc trễ</Badge>}
                  {p.soon > 0 && <Badge tone="amber">{p.soon} việc tới hạn trong 3 ngày</Badge>}
                  {p.unassigned > 0 && <Badge tone="gray">{p.unassigned} việc chưa có người</Badge>}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </>
  )
}
