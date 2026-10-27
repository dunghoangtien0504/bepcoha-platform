import Link from 'next/link'
import { getDb } from '@/lib/db'
import { pageUser, can } from '@/lib/crm/session'
import { getControl, agentStats, LEVELS, MODEL_TIERS, ACTION_KINDS, type Level, type ActionKind, type AgentRow } from '@/lib/crm/ai'
import { businessSummary, reportAsOf } from '@/lib/crm/reports'
import { moneyShort, num, pct, dateTime, addDays } from '@/lib/crm/format'
import { PageHeader, Card, Stat, Badge, Forbidden, Note } from '../../_components/ui'
import { StopButton, SimulationToggle, AgentControls } from './ai-client'

export const metadata = { title: 'Trung tâm AI' }

const LEVEL_TONE = { L0: 'gray', L1: 'amber', L2: 'green' } as const

export default async function AiCenterPage() {
  const user = await pageUser()
  if (!can(user, 'ai.xem')) return <Forbidden />
  const sql = getDb()
  const { asOf } = await reportAsOf()
  const to = addDays(asOf.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }), -1)
  const [control, agents, stats, brief, counts, biz] = await Promise.all([
    getControl(),
    sql`SELECT * FROM ai_agents ORDER BY sort, code` as unknown as Promise<AgentRow[]>,
    agentStats(7),
    sql`SELECT title, body, executed_at FROM ai_actions WHERE agent_code = 'tro_ly_ceo' AND status = 'da_thuc_hien' ORDER BY executed_at DESC LIMIT 1`,
    sql`SELECT COUNT(*) FILTER (WHERE status IN ('cho_duyet', 'de_xuat'))::int AS waiting,
               COUNT(*) FILTER (WHERE status = 'mo_phong' AND sim_verdict IS NULL)::int AS sim_open,
               COUNT(*) FILTER (WHERE status = 'loi' AND created_at > NOW() - INTERVAL '7 days')::int AS errors
        FROM ai_actions`,
    businessSummary(addDays(to, -6), to),
  ])
  const st = new Map(stats.map(s => [s.code as string, s]))
  const c = counts[0]
  const manage = can(user, 'ai.quan_ly')
  const zlUrl = process.env.ZL_CRM_PUBLIC_URL || 'http://localhost:3090'
  return (
    <>
      <PageHeader title="Trung tâm AI" sub="Một người điều hành, đội agent làm việc dưới quyền duyệt của Cô Hạ và quản lý. Mọi việc agent làm đều có nhật ký và hoàn tác."
        actions={<div className="flex items-start gap-2">{manage && <SimulationToggle on={control.simulation} />}<StopButton stopped={control.stopped} canResume={manage} /></div>} />

      {control.stopped && <div className="mb-4 rounded-xl border-2 border-rose-300 bg-rose-50 p-4 text-sm text-rose-900">
        <div className="text-base font-semibold">ĐANG DỪNG KHẨN CẤP</div>
        <div>Từ {control.stopped_at ? dateTime(control.stopped_at) : '—'} · Lý do: {control.reason || '—'}</div>
        <div>Không agent nào được thực hiện việc gì, kể cả việc đã duyệt. Zalo CRM: {control.zalo ? (control.zalo.ok ? '✓ ' : '⚠ ') + control.zalo.detail : 'chưa gọi'}</div>
      </div>}
      {control.simulation && !control.stopped && <div className="mb-4"><Note tone="warn">Đang ở chế độ mô phỏng: agent chạy trên dữ liệu thật nhưng chỉ ghi lại việc sẽ làm. Chấm “Giống / Khác” ở Hàng chờ để đo độ khớp; mở thật khi khớp ≥ 85%.</Note></div>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Doanh thu 7 ngày" value={moneyShort(biz.tong.doanh_thu)} hint={`đến ${to.slice(8)}/${to.slice(5, 7)} · ${num(biz.tong.don_chot)} đơn chốt`} />
        <Stat label="Giá trị đơn TB 7 ngày" value={moneyShort(biz.tong.aov)} />
        <Stat label="Chờ duyệt" value={num(c.waiting)} tone={c.waiting > 20 ? 'warn' : 'default'} href="/crm/ai/duyet" hint="việc agent đề xuất" />
        <Stat label="Mô phỏng chưa chấm · Lỗi 7 ngày" value={`${num(c.sim_open)} · ${num(c.errors)}`} tone={c.errors ? 'bad' : 'default'} href="/crm/ai/duyet?tab=mo_phong" />
      </div>

      {brief[0] && <Card title={brief[0].title} className="mt-4" actions={<span className="text-xs text-stone-400">Trợ lý CEO · {dateTime(brief[0].executed_at)}</span>}>
        <pre className="whitespace-pre-wrap font-sans text-sm text-stone-700">{brief[0].body}</pre>
      </Card>}

      <h2 className="mb-3 mt-6 text-base font-semibold">Bản đồ điều phối</h2>
      <div className="mb-3 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900">
        <b>AI điều phối · Cô Hạ duyệt quyết định.</b> L0 chỉ đề xuất · L1 làm khi người duyệt · L2 tự làm trong trần mỗi ngày.
        Agent L2 bị sửa/từ chối &gt; 20% trên ≥ 20 việc trong 7 ngày thì tự về L1. Quyền của agent không vượt quyền người duyệt.
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {agents.map(a => {
          const s = st.get(a.code)
          const decided = s ? s.as_is + s.edited + s.rejected + s.undone : 0
          return (
            <div key={a.code} className={`rounded-xl border bg-white p-4 shadow-sm ${a.enabled ? 'border-stone-200' : 'border-dashed border-stone-300 opacity-80'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="font-semibold">{a.name}</div>
                <Badge tone={LEVEL_TONE[a.level as Level]}>{LEVELS[a.level as Level]}</Badge>
              </div>
              <p className="mt-1 text-sm text-stone-600">{a.purpose}</p>
              <div className="mt-2 text-xs text-stone-500">KPI: {a.kpi}</div>
              <div className="mt-1 text-xs text-stone-500">
                {a.enabled ? '● Đang bật' : '○ Đang tắt'} · {MODEL_TIERS[a.model_tier]} · {a.kinds.map(k => ACTION_KINDS[k as ActionKind] ?? k).join(', ') || 'chưa có việc'}
                {a.max_level !== 'L2' && <> · tối đa {a.max_level}</>}
                {a.home === 'zalo' && <> · chạy trong <a href={zlUrl} className="text-emerald-700 underline" target="_blank" rel="noreferrer">Zalo CRM</a></>}
              </div>
              {s && s.total > 0 && <div className="mt-2 grid grid-cols-4 gap-1 text-center text-xs">
                <div><div className="font-semibold tabular-nums">{num(s.total)}</div><div className="text-stone-400">7 ngày</div></div>
                <div><div className="font-semibold tabular-nums">{decided ? pct(s.as_is, decided) : '—'}</div><div className="text-stone-400">nguyên văn</div></div>
                <div><div className="font-semibold tabular-nums">{num(s.waiting)}</div><div className="text-stone-400">chờ</div></div>
                <div><div className="font-semibold tabular-nums">{s.sim_rated ? pct(s.sim_agree, s.sim_rated) : '—'}</div><div className="text-stone-400">khớp mô phỏng</div></div>
              </div>}
              {manage && a.home === 'crm' && <AgentControls code={a.code} level={a.level} maxLevel={a.max_level} enabled={a.enabled} canRun={['tro_ly_ceo', 'giu_chan'].includes(a.code)} />}
              {manage && a.home === 'zalo' && <p className="mt-3 border-t border-stone-100 pt-3 text-xs text-stone-500">Bật/tắt nháp AI trong Zalo CRM → Cài đặt → Trả lời tự động. Nút Dừng khẩn cấp ở trên tắt được cả phần này.</p>}
            </div>
          )
        })}
      </div>
      <p className="mt-4 text-xs text-stone-500"><Link href="/crm/ai/duyet" className="text-emerald-800 underline">Hàng chờ duyệt và nhật ký →</Link> · Bản tin Trợ lý CEO và đề xuất Giữ chân chạy lúc 8h sáng mỗi ngày.</p>
    </>
  )
}
