import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getDb } from '@/lib/db'
import { pageUser, can } from '@/lib/crm/session'
import { DEPARTMENT_LABEL, DEPARTMENTS, type Department } from '@/lib/crm/permissions'
import { projectDetail } from '@/lib/crm/du-an'
import { date, relative } from '@/lib/crm/format'
import { Card, Badge, Note } from '../../../_components/ui'
import { AddTaskForm, ProjectControls } from '../du-an-client'

export const metadata = { title: 'Dự án' }

const TASK_STATUS = { can_lam: ['Cần làm', 'gray'], dang_lam: ['Đang làm', 'blue'], xong: ['Xong', 'green'], bo_qua: ['Bỏ qua', 'gray'] } as const

export default async function DuAnDetail(props: PageProps<'/crm/du-an/[id]'>) {
  const user = await pageUser()
  const { id } = await props.params
  const d = await projectDetail(Number(id))
  if (!d) notFound()
  const { project: p, tasks, byDept } = d
  const manager = can(user, 'viec.giao')
  const boss = user.role === 'admin' || user.department === 'ban_giam_doc'
  const staff = manager ? await getDb()`SELECT id, name, department FROM staff WHERE status = 'active' ORDER BY name` : []
  const done = tasks.filter(t => t.status === 'xong' || t.status === 'bo_qua').length
  const pct = tasks.length ? Math.round(done / tasks.length * 100) : 0
  const days = Number(p.days_left)

  return (
    <>
      <div className="mb-1 text-sm"><Link href="/crm/du-an" className="text-emerald-700">← Dự án</Link></div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-stone-900 sm:text-2xl">{p.name}</h1>
          {p.goal && <p className="mt-1 max-w-2xl text-sm text-stone-600">{p.goal}</p>}
          <p className="mt-1 text-xs text-stone-500">Chủ trì: {p.owner_name ?? '—'} · Hạn chót <b>{p.deadline_text.split('-').reverse().join('/')}</b>
            {' · '}<span className={days < 0 ? 'font-semibold text-rose-600' : days <= 7 ? 'font-semibold text-amber-700' : ''}>{days < 0 ? `quá hạn ${-days} ngày` : `còn ${days} ngày`}</span></p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-semibold tabular-nums text-emerald-700">{pct}%</div>
          <div className="text-xs text-stone-500">{done}/{tasks.length} việc xong</div>
        </div>
      </div>
      <div className="mb-5 h-3 rounded-full bg-stone-100"><div className="h-3 rounded-full bg-emerald-600" style={{ width: `${pct}%` }} /></div>

      {manager && <div className="mb-4"><ProjectControls id={p.id} status={p.status} deadline={p.deadline_text} boss={boss} /></div>}

      <div className="space-y-4">
        {byDept.map(g => {
          const gDone = g.tasks.filter(t => t.status === 'xong' || t.status === 'bo_qua').length
          return (
            <Card key={g.department} title={<>{g.label} <span className="font-normal text-stone-500">· {gDone}/{g.tasks.length}</span></>} pad={false}>
              <ul className="divide-y divide-stone-100">
                {g.tasks.map(t => {
                  const open = t.status === 'can_lam' || t.status === 'dang_lam'
                  const late = !!t.is_late
                  const soon = !!t.is_soon
                  const [label, tone] = TASK_STATUS[t.status as keyof typeof TASK_STATUS] ?? ['?', 'gray']
                  const cl = (t.checklist ?? []) as { done: boolean }[]
                  return (
                    <li key={t.id} className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm ${late ? 'bg-rose-50/60' : ''}`}>
                      <span className={`min-w-0 flex-1 ${open ? 'font-medium text-stone-900' : 'text-stone-400 line-through'}`}>{t.title}
                        {cl.length > 0 && <span className="ml-2 text-xs font-normal text-stone-400">☑ {cl.filter(c => c.done).length}/{cl.length}</span>}</span>
                      <span className="w-28 truncate text-xs text-stone-600">{t.assignee_name ?? <span className="text-amber-700">Chưa có người</span>}</span>
                      <span className={`w-32 text-xs ${late ? 'font-semibold text-rose-600' : soon ? 'font-semibold text-amber-700' : 'text-stone-500'}`}>
                        {t.due_at ? `${date(t.due_at)} · ${relative(t.due_at)}` : '—'}</span>
                      <Badge tone={tone}>{label}{t.status === 'xong' && !t.reviewed_at ? ' · chờ duyệt' : ''}</Badge>
                    </li>
                  )
                })}
              </ul>
            </Card>
          )
        })}
        {tasks.length === 0 && <Note>Dự án chưa có việc nào. Thêm việc ở dưới.</Note>}
      </div>

      {manager && (
        <Card title="Thêm việc vào dự án" className="mt-5">
          <AddTaskForm projectId={p.id} deadline={p.deadline_text} myDept={user.department} boss={boss}
            departments={DEPARTMENTS.map(d => ({ key: d, label: DEPARTMENT_LABEL[d as Department] }))}
            staff={staff.map(s => ({ id: s.id, name: s.name, department: s.department }))} />
        </Card>
      )}
      <p className="mt-4 text-xs text-stone-500">Người được giao làm và tick việc ở trang <Link href="/crm/viec" className="underline">Việc</Link>; quản lý duyệt trong 24 giờ ở <Link href="/crm/duyet" className="underline">Cần duyệt</Link>.</p>
    </>
  )
}
