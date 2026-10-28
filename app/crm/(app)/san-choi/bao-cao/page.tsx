import { pageUser, can } from '@/lib/crm/session'
import { DEPARTMENT_LABEL, type Department } from '@/lib/crm/permissions'
import { weeklyReport, grantList, GRANT_REASONS, type GrantReason } from '@/lib/crm/san-choi'
import { dateTime, money } from '@/lib/crm/format'
import { Card, PageHeader, Forbidden, Bar, Table, Td } from '../../../_components/ui'

export const metadata = { title: 'Báo cáo Sân chơi' }

/** 3 chỉ số CEO xem mỗi tuần (phản biện CEO) + toàn bộ lượt cấp tay (CEO vòng 2). */
export default async function BaoCao() {
  const user = await pageUser()
  if (!can(user, 'cai_dat.sua')) return <Forbidden />
  const [r, g] = await Promise.all([weeklyReport(), grantList()])
  const depts = [...new Set([...Object.keys(r.cur.by), ...Object.keys(r.prev.by)])]
  const pct = (x?: { shifts: number; onTime: number }) => x && x.shifts ? Math.round(x.onTime / x.shifts * 100) : null
  const weekGrants = g.rows.filter(x => +new Date(x.created_at) >= +new Date(r.cur.from + 'T00:00:00+07:00'))
  return (
    <>
      <PageHeader title="Báo cáo Sân chơi" sub={`Tuần này từ ${r.cur.from.split('-').reverse().join('/')}`} />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="① Ca đúng giờ, đủ ca theo bộ phận">
          {depts.length === 0 ? <p className="text-sm text-stone-500">Chưa có ca nào đã kết thúc.</p> : (
            <ul className="space-y-3 text-sm">
              {depts.map(d => {
                const now = pct(r.cur.by[d]), before = pct(r.prev.by[d])
                return (
                  <li key={d}>
                    <div className="font-medium">{DEPARTMENT_LABEL[d as Department] ?? d}</div>
                    <div className="flex justify-between"><span className="tabular-nums"><b>{now ?? '—'}%</b> <span className="text-xs text-stone-500">tuần trước {before ?? '—'}%</span>
                        {now !== null && before !== null && <span className={`ml-1 text-xs ${now >= before ? 'text-emerald-700' : 'text-rose-600'}`}>{now >= before ? '▲' : '▼'}{Math.abs(now - before)}</span>}</span></div>
                    <div className="mt-1"><Bar value={now ?? 0} max={100} tone={(now ?? 0) >= 90 ? 'emerald' : 'amber'} /></div>
                  </li>
                )
              })}
            </ul>
          )}
          <p className="mt-3 text-xs text-stone-500">Đúng giờ theo luật Sân chơi: vào trước giờ bắt đầu, ra sau giờ kết thúc. Ngưỡng COO: ≥ 90%.</p>
        </Card>
        <Card title="② Việc ca xong thật">
          <div className="text-3xl font-semibold tabular-nums">{r.tasks.total ? Math.round(r.tasks.on_time / r.tasks.total * 100) : 0}%</div>
          <p className="text-sm text-stone-600">{r.tasks.on_time}/{r.tasks.total} việc kho việc tới hạn tuần này xong đúng hạn</p>
          <p className="mt-2 text-sm text-stone-600">Đã được quản lý duyệt: <b>{r.tasks.reviewed}</b></p>
          <p className="mt-3 text-xs text-stone-500">Ngưỡng COO: ≥ 85% xong trước hết ca; ≥ 80% được duyệt trong 24 giờ.</p>
        </Card>
        <Card title="③ Tiền thưởng thực chi">
          <div className="text-3xl font-semibold tabular-nums">{money(r.paid)}</div>
          <p className="text-sm text-stone-600">tuần này / mở {money(r.settings.weekly_budget)} mỗi tuần · {r.paidPeople} người nhận · {r.spins} lượt quay</p>
          <div className="mt-2"><Bar value={r.budget.paid} max={r.budget.monthly} tone={r.budget.paid > r.budget.monthly * 0.9 ? 'rose' : 'emerald'} /></div>
          <p className="mt-1 text-xs text-stone-500">Tháng: {money(r.budget.paid)} / trần {money(r.budget.monthly)} · còn mở {money(r.budget.left)}</p>
          <p className="mt-2 text-sm text-stone-600">Mỗi ca đúng giờ tốn: <b>{r.costPerOnTimeShift === null ? '—' : money(r.costPerOnTimeShift)}</b></p>
          {r.kudos.length > 0 && (
            <div className="mt-3 text-xs text-stone-600">
              <div className="font-semibold">Thưởng nóng nhiều nhất tháng (soát người thân):</div>
              {r.kudos.map((k, i) => <div key={i}>{k.giver} → {k.receiver}: {k.times} lần, {k.tokens} lượt</div>)}
            </div>
          )}
        </Card>
      </div>

      <Card title={`Cấp / bỏ lượt tay tuần này · ${weekGrants.length}`} className="mt-4" pad={false}>
        <Table head={['Lúc', 'Người nhận', 'Lượt', 'Lý do', 'Người làm']} empty="Tuần này không cấp tay lượt nào.">
          {weekGrants.map(x => <tr key={x.id}><Td className="text-xs">{dateTime(x.created_at)}</Td><Td>{x.staff_name}</Td><Td>{x.tokens > 0 ? '+' : ''}{x.tokens}</Td>
            <Td>{GRANT_REASONS[x.reason as GrantReason] ?? x.reason} · {x.note}</Td><Td>{x.by_name}</Td></tr>)}
        </Table>
      </Card>
    </>
  )
}
