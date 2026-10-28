import { getDb } from '@/lib/db'
import { pageUser, can } from '@/lib/crm/session'
import { listTasks, TASK_KINDS } from '@/lib/crm/tasks'
import { maskPhone } from '@/lib/crm/customers'
import { PageHeader, Tabs, Empty, Note } from '../../_components/ui'
import { TaskCard, NewTaskForm, GenerateButton } from './task-client'

export const metadata = { title: 'Việc' }

export default async function TasksPage(props: PageProps<'/crm/viec'>) {
  const user = await pageUser()
  const sp = await props.searchParams
  const manager = can(user, 'viec.giao')
  const tab = (typeof sp.tab === 'string' ? sp.tab : 'cua_toi') as 'cua_toi' | 'doi' | 'xong' | 'cho_duyet'
  const kind = typeof sp.loai === 'string' && sp.loai in TASK_KINDS ? sp.loai : undefined
  const sql = getDb()

  let rows
  const allDepts = user.role === 'admin' || user.department === 'ban_giam_doc'
  const dept = allDepts ? undefined : user.department ?? undefined
  if (tab === 'doi' && manager) rows = await listTasks({ status: 'mo', kind, department: dept, limit: 300 })
  else if (tab === 'cho_duyet' && manager) rows = (await listTasks({ status: 'xong', kind, department: dept, limit: 300 })).filter(r => !r.reviewed_at)
  else if (tab === 'xong') rows = await listTasks({ staffId: user.id, status: 'xong', kind, limit: 100 })
  else rows = await listTasks({ staffId: user.id, status: 'mo', kind })

  const staff = manager ? await sql`SELECT id, name FROM staff WHERE status = 'active' ORDER BY name` : []
  const showPhone = can(user, 'khach.xem_sdt')
  const items = (rows as unknown as Record<string, unknown>[]).map((r): Record<string, unknown> => ({
    ...r, customer_phone: r.customer_phone ? (showPhone ? String(r.customer_phone) : maskPhone(String(r.customer_phone))) : null,
    due_at: r.due_at ? new Date(r.due_at as string).toISOString() : null, done_at: r.done_at ? new Date(r.done_at as string).toISOString() : null,
  }))
  const base = (t: string) => `/crm/viec?tab=${t}${kind ? '&loai=' + kind : ''}`
  const tabs = [
    { key: 'cua_toi', label: 'Việc của tôi', href: base('cua_toi') },
    ...(manager ? [{ key: 'doi', label: 'Cả đội', href: base('doi') }, { key: 'cho_duyet', label: 'Chờ duyệt (24h)', href: base('cho_duyet') }] : []),
    { key: 'xong', label: 'Tôi đã xong', href: base('xong') },
  ]

  return (
    <>
      <PageHeader title="Việc" sub="Máy sinh việc mỗi sáng theo vòng đời khách. Người thật quyết định và liên hệ — không tin nào tự gửi."
        actions={manager ? <GenerateButton /> : undefined} />
      <Tabs items={tabs} current={tab} />
      <div className="-mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4 pb-1 text-xs sm:mx-0 sm:flex-wrap sm:px-0">
        <a href={base(tab)} className={`whitespace-nowrap rounded-full px-2.5 py-1 ${!kind ? 'bg-emerald-700 text-white' : 'bg-white text-stone-600 ring-1 ring-stone-200'}`}>Tất cả</a>
        {Object.entries(TASK_KINDS).map(([k, v]) => (
          <a key={k} href={`/crm/viec?tab=${tab}&loai=${k}`} className={`whitespace-nowrap rounded-full px-2.5 py-1 ${kind === k ? 'bg-emerald-700 text-white' : 'bg-white text-stone-600 ring-1 ring-stone-200'}`}>{v}</a>
        ))}
      </div>
      {tab === 'cua_toi' && <div className="mb-4"><NewTaskForm staff={manager ? staff.map(s => ({ id: s.id, name: s.name })) : []} /></div>}
      {tab === 'cho_duyet' && <div className="mb-4"><Note>Quản lý duyệt kết quả trong 24 giờ. Ô “lý do làm khác gợi ý” là tri thức để chỉnh lại cách máy gợi ý (B2 Z04).</Note></div>}
      {items.length === 0 ? <Empty>Không có việc nào ở mục này.</Empty> : (
        <div className="grid gap-3 xl:grid-cols-2">
          {items.map(t => <TaskCard key={t.id as number} task={t as never} manager={manager} staff={staff.map(s => ({ id: s.id, name: s.name }))} mine={t.assigned_staff_id === user.id} />)}
        </div>
      )}
    </>
  )
}
