import Link from 'next/link'
import { getDb } from '@/lib/db'
import { pageUser, can } from '@/lib/crm/session'
import { getControl, ACTION_KINDS, ACTION_STATUS, type ActionKind, type ActionStatus } from '@/lib/crm/ai'
import { dateTime, num } from '@/lib/crm/format'
import { PageHeader, Badge, Forbidden, Tabs, Empty, Note } from '../../../_components/ui'
import { ActionControls } from '../ai-client'

export const metadata = { title: 'Duyệt việc AI' }

const TABS = { cho: ['cho_duyet', 'de_xuat'], mo_phong: ['mo_phong'], xong: ['da_thuc_hien', 'tu_choi', 'loi', 'da_hoan_tac', 'het_han'] } as const
const TONE = { de_xuat: 'gray', cho_duyet: 'amber', mo_phong: 'violet', da_thuc_hien: 'green', tu_choi: 'red', loi: 'red', da_hoan_tac: 'gray', het_han: 'gray' } as const

export default async function AiQueuePage(props: PageProps<'/crm/ai/duyet'>) {
  const user = await pageUser()
  if (!can(user, 'ai.xem')) return <Forbidden />
  const sp = await props.searchParams
  const tab = (typeof sp.tab === 'string' && sp.tab in TABS ? sp.tab : 'cho') as keyof typeof TABS
  const sql = getDb()
  const [control, rows, counts] = await Promise.all([
    getControl(),
    sql`SELECT a.*, g.name AS agent_name, c.name AS customer_name, s.name AS decided_name,
               a.executed_at > NOW() - INTERVAL '24 hours' AS recent
        FROM ai_actions a JOIN ai_agents g ON g.code = a.agent_code
        LEFT JOIN customers c ON c.id = a.customer_id LEFT JOIN staff s ON s.id = a.decided_by
        WHERE a.status = ANY(${TABS[tab] as unknown as string[]})
        ORDER BY ${tab === 'xong' ? sql`COALESCE(a.decided_at, a.created_at) DESC` : sql`a.created_at ASC`} LIMIT 200`,
    sql`SELECT COUNT(*) FILTER (WHERE status IN ('cho_duyet', 'de_xuat'))::int AS cho, COUNT(*) FILTER (WHERE status = 'mo_phong')::int AS mo_phong FROM ai_actions`,
  ])
  const canDecide = can(user, 'ai.duyet')
  return (
    <>
      <PageHeader title="Duyệt việc AI" sub={<><Link href="/crm/ai" className="underline">Trung tâm AI</Link> · Sửa nội dung trước khi duyệt nếu cần: tỉ lệ duyệt nguyên văn là thước đo để mở mức tự chủ.</>} />
      {control.stopped && <div className="mb-4"><Note tone="warn">Đang DỪNG KHẨN CẤP: duyệt lúc này sẽ bị từ chối cho tới khi người quản lý cho chạy lại.</Note></div>}
      <Tabs current={tab} items={[
        { key: 'cho', label: 'Chờ duyệt', href: '/crm/ai/duyet', count: counts[0].cho },
        { key: 'mo_phong', label: 'Mô phỏng', href: '/crm/ai/duyet?tab=mo_phong', count: counts[0].mo_phong },
        { key: 'xong', label: 'Nhật ký', href: '/crm/ai/duyet?tab=xong' },
      ]} />
      {rows.length === 0 ? <Empty>{tab === 'cho' ? 'Không có gì chờ duyệt.' : tab === 'mo_phong' ? 'Chưa có việc mô phỏng.' : 'Chưa có việc nào.'}</Empty> : (
        <div className="space-y-3">
          {rows.map(a => (
            <div key={a.id} className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
                <Badge tone={TONE[a.status as ActionStatus]}>{ACTION_STATUS[a.status as ActionStatus]}</Badge>
                <span className="font-medium text-stone-700">{a.agent_name}</span>
                <span>· {ACTION_KINDS[a.kind as ActionKind]}</span>
                <span>· {a.level_at_create}{a.auto_executed ? ' tự làm' : ''}</span>
                <span>· {dateTime(a.created_at)}</span>
                {a.customer_id && <Link href={`/crm/khach-hang/${a.customer_id}`} className="text-emerald-800 hover:underline">· {a.customer_name || `khách #${a.customer_id}`}</Link>}
              </div>
              <div className="mt-1 font-medium">{a.title}</div>
              {a.rationale && <div className="mt-0.5 text-xs text-stone-500">Vì sao: {a.rationale}</div>}
              {(tab !== 'cho' || !canDecide || a.kind === 'bao_cao') && a.body && <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-stone-50 p-3 font-sans text-sm text-stone-700">{a.body}</pre>}
              {a.edited && a.original_body !== a.body && <details className="mt-1 text-xs text-stone-500"><summary>Bản agent soạn ban đầu</summary><pre className="whitespace-pre-wrap font-sans">{a.original_body}</pre></details>}
              {tab === 'xong' && <div className="mt-2 text-xs text-stone-500">
                {a.decided_name ? `${a.decided_name} · ` : a.auto_executed ? 'Agent tự làm · ' : ''}{a.decided_at ? dateTime(a.decided_at) : ''}
                {a.decision_note && <> · {a.decision_note}</>}{a.error && <span className="text-rose-600"> · Lỗi: {a.error}</span>}
                {a.result?.task_id && <> · tạo <Link href="/crm/viec" className="underline">việc #{a.result.task_id}</Link> cho người phụ trách</>}
              </div>}
              {a.sim_verdict && <div className="mt-1 text-xs text-stone-500">Đã chấm: {a.sim_verdict === 'dong_y' ? 'người sẽ làm giống' : 'người sẽ làm khác'}</div>}
              {canDecide && <div className="mt-3"><ActionControls id={a.id} status={a.status} body={a.body} editable={a.kind === 'gui_tin' || a.kind === 'tao_viec'} executedRecently={!!a.recent && a.kind !== 'bao_cao'} /></div>}
            </div>
          ))}
        </div>
      )}
      <p className="mt-4 text-xs text-stone-500">{num(rows.length)} mục. Tin “Gửi tin cho khách” đã duyệt thành việc cho người phụ trách khách gửi qua Zalo: CRM chưa tự gửi tin.</p>
    </>
  )
}
