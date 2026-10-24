import Link from 'next/link'
import { getDb } from '@/lib/db'
import { pageUser, can } from '@/lib/crm/session'
import { mondaySix, revenueByMonth, reportAsOf, retention, businessSummary, type BizRow } from '@/lib/crm/reports'
import { TASK_KINDS, TASK_RESULTS, type TaskKind } from '@/lib/crm/labels'
import { money, moneyShort, num, pct, date, addDays } from '@/lib/crm/format'
import { PageHeader, Card, Table, Td, Forbidden, Bar, Note, Stat } from '../../_components/ui'

export const metadata = { title: 'Báo cáo' }

const isDay = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
const pc = (v: number) => (v * 100).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + '%'

function BizTable({ rows, label }: { rows: BizRow[]; label: string }) {
  return (
    <Table head={[label, 'Đơn', 'Đơn chốt', 'Hủy', 'Tỷ lệ hủy', 'Doanh thu', 'Tỷ trọng', 'Giá trị đơn TB']}>
      {rows.map(r => (
        <tr key={r.k}><Td>{r.k}</Td><Td className="tabular-nums">{num(r.don)}</Td><Td className="tabular-nums">{num(r.chot)}</Td>
          <Td className="tabular-nums">{num(r.huy)}</Td><Td className="tabular-nums">{pc(r.ty_le_huy)}</Td>
          <Td className="tabular-nums">{money(Math.round(r.doanh_thu))}</Td><Td className="tabular-nums">{pc(r.ty_trong)}</Td>
          <Td className="tabular-nums">{money(Math.round(r.aov))}</Td></tr>
      ))}
    </Table>
  )
}

export default async function ReportsPage(props: PageProps<'/crm/bao-cao'>) {
  const user = await pageUser()
  if (!can(user, 'bao_cao.xem')) return <Forbidden />
  const sp = await props.searchParams
  const sql = getDb()
  const { asOf, stale } = await reportAsOf()
  // Kỳ mặc định: từ đầu tháng tới ngày có dữ liệu mới nhất (như báo cáo CEO của skill hacofood-baocao)
  const lastDay = addDays(asOf.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }), -1)
  const to = isDay(sp.den) ? sp.den : lastDay
  const from = isDay(sp.tu) ? sp.tu : to.slice(0, 8) + '01'
  const [biz, six, months, ret, cohorts, staffPerf, results] = await Promise.all([
    businessSummary(from, to), mondaySix(30, asOf), revenueByMonth(13), retention(),
    sql`WITH f AS (SELECT customer_id, MIN(inserted_at) AS first_at FROM pancake_orders WHERE is_real AND customer_id IS NOT NULL GROUP BY 1)
        SELECT to_char(date_trunc('month', f.first_at AT TIME ZONE 'Asia/Ho_Chi_Minh'), 'YYYY-MM') AS m, COUNT(*)::int AS n,
          COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM pancake_orders o WHERE o.customer_id = f.customer_id AND o.is_real
            AND (o.inserted_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date > (f.first_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
            AND o.inserted_at <= f.first_at + INTERVAL '90 days'))::int AS r90,
          bool_and(f.first_at + INTERVAL '90 days' <= ${asOf}::timestamptz) AS complete
        FROM f WHERE f.first_at > ${asOf}::timestamptz - INTERVAL '13 months' GROUP BY 1 ORDER BY 1`,
    sql`SELECT s.name, COUNT(t.*) FILTER (WHERE t.status IN ('can_lam','dang_lam'))::int AS open,
          COUNT(t.*) FILTER (WHERE t.status = 'xong' AND t.done_at > NOW() - INTERVAL '30 days')::int AS done30,
          COUNT(t.*) FILTER (WHERE t.result = 'chot_don' AND t.done_at > NOW() - INTERVAL '30 days')::int AS orders30,
          COUNT(t.*) FILTER (WHERE t.status IN ('can_lam','dang_lam') AND t.due_at < NOW())::int AS overdue,
          COUNT(t.*) FILTER (WHERE t.edit_reason <> '' AND t.done_at > NOW() - INTERVAL '30 days')::int AS deviated
        FROM staff s LEFT JOIN crm_tasks t ON t.assigned_staff_id = s.id
        WHERE s.status = 'active' AND s.department IN ('sale_cskh', 'dao_tao', 'san_tmdt') GROUP BY s.id, s.name ORDER BY s.name`,
    sql`SELECT result, COUNT(*)::int AS n FROM crm_tasks WHERE status = 'xong' AND result IS NOT NULL AND done_at > NOW() - INTERVAL '30 days' GROUP BY 1 ORDER BY 2 DESC`,
  ])
  const T = biz.tong
  const maxRev = Math.max(1, ...months.map(m => Number(m.revenue)))
  const maxDay = Math.max(1, ...biz.ngay.map(d => d.doanh_thu))
  const maxGroup = Math.max(1, ...biz.nhom_sp.map(g => g.doanh_thu))
  const noStaffData = biz.nhan_vien.length === 1 && biz.nhan_vien[0].k === 'Hệ thống'

  return (
    <>
      <PageHeader title="Báo cáo kinh doanh" sub="Đơn chốt, doanh thu, kênh, sản phẩm, nhân viên tính đúng quy tắc màn Thống kê Pancake (cùng cách tính với báo cáo CEO)." />
      {stale && <div className="mb-4"><Note tone="warn">Dữ liệu đơn chưa đồng bộ tới hôm nay (đơn mới nhất trước {date(asOf)}). Bật đồng bộ Pancake hằng giờ để số liệu cập nhật.</Note></div>}

      <form className="mb-4 flex flex-wrap items-end gap-2 text-sm" action="/crm/bao-cao">
        <label className="flex flex-col text-xs text-stone-500">Từ ngày<input type="date" name="tu" defaultValue={from} className="rounded-lg border border-stone-300 px-2 py-1.5 text-sm text-stone-900" /></label>
        <label className="flex flex-col text-xs text-stone-500">Đến ngày<input type="date" name="den" defaultValue={to} className="rounded-lg border border-stone-300 px-2 py-1.5 text-sm text-stone-900" /></label>
        <button className="rounded-lg bg-emerald-700 px-3 py-2 font-medium text-white">Xem kỳ này</button>
        <Link href="/crm/bao-cao" className="px-2 py-2 text-stone-500">Về tháng hiện tại</Link>
      </form>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={`Doanh thu ${date(from)} – ${date(to)}`} value={moneyShort(T.doanh_thu)} hint={`Tiền hàng ${moneyShort(T.tien_hang)} · đơn sàn tính theo tiền sàn trả`} />
        <Stat label="Đơn chốt" value={num(T.don_chot)} hint={`${num(T.don_dt)} đơn tính doanh thu · ${num(T.don_moi)} đơn Mới chưa chốt`} />
        <Stat label="Giá trị đơn trung bình" value={money(Math.round(T.aov))} />
        <Stat label="Đơn gắn quảng cáo Facebook" value={num(T.don_qc)} hint={T.don_qc ? `${moneyShort(T.doanh_thu_qc)} · ${pc(T.doanh_thu ? T.doanh_thu_qc / T.doanh_thu : 0)} doanh thu` : 'Chưa có mã quảng cáo trong dữ liệu kỳ này (có sau khi đồng bộ Pancake)'} />
        <Stat label="Tỷ lệ hủy" value={pc(T.ty_le_huy)} hint={`${num(T.huy)} đơn hủy / đơn trừ Mới`} tone={T.ty_le_huy > 0.1 ? 'warn' : 'default'} />
        <Stat label="Tỷ lệ hoàn" value={pc(T.ty_le_hoan)} hint={`${num(T.da_hoan)} đã hoàn · ${num(T.dang_hoan)} đang hoàn`} tone={T.ty_le_hoan > 0.05 ? 'warn' : 'default'} />
        <Stat label="Khách mua lần 2 (90 ngày)" value={pct(six.repeat90.repeated, six.repeat90.cohort)} hint={`Nhóm ${num(six.repeat90.cohort)} khách`} />
        <Stat label="Doanh thu từ khách cũ (30 ngày)" value={pct(six.oldCustomerRevenue.fromOld, six.oldCustomerRevenue.total)} />
      </div>
      {biz.khac_ty_trong > 0.02 && <div className="mt-3"><Note tone="warn">Nhóm sản phẩm “Khác” chiếm {pc(biz.khac_ty_trong)} doanh thu — có sản phẩm mới chưa được xếp nhóm. Thêm quy tắc nhóm ở lib/crm/labels.ts (cùng bảng với skill báo cáo).</Note></div>}

      <Card title="Nhịp ngày" className="mt-4">
        <div className="flex h-40 items-end gap-1 overflow-x-auto">
          {biz.ngay.map(d => (
            <div key={d.k} className="flex min-w-[22px] flex-1 flex-col items-center gap-1" title={`${date(d.k)}: ${money(Math.round(d.doanh_thu))} · ${d.don} đơn`}>
              <div className="w-full rounded-t bg-emerald-600" style={{ height: `${Math.max(2, d.doanh_thu / maxDay * 120)}px` }} />
              <span className="text-[10px] text-stone-500">{d.k.slice(8)}</span>
            </div>
          ))}
        </div>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Kênh bán" pad={false} className="lg:col-span-2"><BizTable rows={biz.kenh} label="Kênh" /></Card>
        <Card title="Nhóm sản phẩm (theo dòng)" pad={false}>
          <Table head={['Nhóm', 'Đơn', 'SL', 'Doanh thu', 'Tỷ trọng', '']}>
            {biz.nhom_sp.slice(0, 20).map(g => (
              <tr key={g.k}><Td>{g.k}</Td><Td className="tabular-nums">{num(g.don)}</Td><Td className="tabular-nums">{num(g.sl)}</Td>
                <Td className="tabular-nums">{moneyShort(g.doanh_thu)}</Td><Td className="tabular-nums">{pc(g.ty_trong)}</Td>
                <Td className="w-24"><Bar value={g.doanh_thu} max={maxGroup} tone="amber" /></Td></tr>
            ))}
          </Table>
        </Card>
        <Card title="Nhân viên (theo từng dòng sản phẩm, như Pancake)" pad={false}>
          {noStaffData && <div className="px-4 pt-3"><Note>Dữ liệu đơn đang có chưa kèm người xử lý (bản xuất cũ). Sau lần đồng bộ Pancake đầu tiên, bảng này hiện đúng như màn Thống kê → Nhân viên.</Note></div>}
          <Table head={['Nhân viên', 'Đơn', 'SL', 'Doanh thu', 'Tỷ trọng']}>
            {biz.nhan_vien.map(s => <tr key={s.k}><Td>{s.k}</Td><Td className="tabular-nums">{num(s.don)}</Td><Td className="tabular-nums">{num(s.sl)}</Td><Td className="tabular-nums">{money(s.doanh_thu)}</Td><Td className="tabular-nums">{pc(s.ty_trong)}</Td></tr>)}
          </Table>
        </Card>
        <Card title="Vùng miền" pad={false}><BizTable rows={biz.mien} label="Miền" /></Card>
        <Card title="Trạng thái đơn" pad={false}>
          <Table head={['Trạng thái', 'Đơn', 'Tiền hàng']}>
            {biz.trang_thai.map(s => <tr key={s.k}><Td>{s.k}</Td><Td className="tabular-nums">{num(Math.max(s.don, s.chot))}</Td><Td className="tabular-nums">{moneyShort(s.tien_hang)}</Td></tr>)}
          </Table>
        </Card>
      </div>

      <h2 className="mb-3 mt-8 text-base font-semibold">Xu hướng & giữ khách</h2>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Doanh thu & số đơn theo tháng" pad={false}>
          <Table head={['Tháng', 'Đơn tính DT', 'Doanh thu', '', 'FB / TikTok / Shopee']}>
            {months.map(m => (
              <tr key={m.month}><Td>{m.month.slice(5)}/{m.month.slice(0, 4)}</Td><Td className="tabular-nums">{num(m.orders)}</Td>
                <Td className="tabular-nums">{moneyShort(m.revenue)}</Td><Td className="w-32"><Bar value={Number(m.revenue)} max={maxRev} /></Td>
                <Td className="tabular-nums text-xs text-stone-500">{num(m.fb)} / {num(m.tiktok)} / {num(m.shopee)}</Td></tr>
            ))}
          </Table>
        </Card>
        <Card title="Mua lại trong 90 ngày theo tháng mua đầu" pad={false}>
          <Table head={['Tháng mua đầu', 'Khách mới', 'Mua lại ≤ 90 ngày', 'Tỷ lệ']}>
            {cohorts.map(c => (
              <tr key={c.m}><Td>{c.m.slice(5)}/{c.m.slice(0, 4)}</Td><Td className="tabular-nums">{num(c.n)}</Td><Td className="tabular-nums">{num(c.r90)}</Td>
                <Td className="tabular-nums">{pct(c.r90, c.n)}{!c.complete && <span className="ml-1 text-xs text-stone-400">(chưa đủ 90 ngày)</span>}</Td></tr>
            ))}
          </Table>
        </Card>
        <Card title="Luồng chăm sóc 30 ngày (việc đã xong)" pad={false}>
          <Table head={['Luồng', 'Việc xong', 'Phản hồi tốt', 'Ra đơn', 'Từ chối']} empty="Chưa có việc hoàn thành trong 30 ngày.">
            {six.flows.map(f => <tr key={f.kind}><Td>{TASK_KINDS[f.kind as TaskKind] ?? f.kind}</Td><Td className="tabular-nums">{f.done}</Td><Td className="tabular-nums">{pct(f.good, f.done)}</Td><Td className="tabular-nums">{f.orders}</Td><Td className="tabular-nums">{pct(f.refused, f.done)}</Td></tr>)}
          </Table>
          <div className="flex flex-wrap gap-3 px-4 py-2 text-xs text-stone-500">{results.map(r => <span key={r.result}>{TASK_RESULTS[r.result as keyof typeof TASK_RESULTS] ?? r.result}: {r.n}</span>)}</div>
        </Card>
        <Card title="Nhân viên chăm sóc khách (việc trong CRM)" pad={false}>
          <Table head={['Nhân viên', 'Việc mở', 'Quá hạn', 'Xong 30 ngày', 'Ra đơn', 'Làm khác gợi ý']}>
            {staffPerf.map(s => <tr key={s.name}><Td>{s.name}</Td><Td className="tabular-nums">{s.open}</Td><Td className={`tabular-nums ${s.overdue ? 'text-rose-600' : ''}`}>{s.overdue}</Td><Td className="tabular-nums">{s.done30}</Td><Td className="tabular-nums">{s.orders30}</Td><Td className="tabular-nums">{s.deviated}</Td></tr>)}
          </Table>
        </Card>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        <div className="rounded-xl border border-stone-200 bg-white p-3"><div className="text-xs text-stone-500">Giá trị đơn TB 90 ngày</div><div className="font-semibold">{money(ret.aov90)}</div></div>
        <div className="rounded-xl border border-stone-200 bg-white p-3"><div className="text-xs text-stone-500">Giá trị 1 khách 12 tháng</div><div className="font-semibold">{money(ret.ltv12)}</div></div>
        <div className="rounded-xl border border-stone-200 bg-white p-3"><div className="text-xs text-stone-500">Khách ngủ đông</div><div className="font-semibold">{num(ret.dormant)}</div></div>
      </div>
    </>
  )
}
