import { getDb } from '@/lib/db'
import { pageUser, can } from '@/lib/crm/session'
import { DEPARTMENT_LABEL, type Department } from '@/lib/crm/permissions'
import { PRODUCT_LINES, type ProductLine } from '@/lib/crm/labels'
import { money, dateTime } from '@/lib/crm/format'
import { getPancakePages } from '@/lib/pancake'
import { PancakeChatClient } from '@/lib/crm/pancake-chat'
import { PageHeader, Card, Table, Td, Forbidden, Note } from '../../_components/ui'
import { SiteForm, ShiftForm, TargetRow, ProductRow, VoucherForm, PointsForm } from './settings-client'

export const metadata = { title: 'Cài đặt' }

export default async function SettingsPage() {
  const user = await pageUser()
  if (!can(user, 'cai_dat.sua')) return <Forbidden />
  const sql = getDb()
  const [sites, shifts, targets, products, voucher, points] = await Promise.all([
    sql`SELECT * FROM work_sites ORDER BY id`,
    sql`SELECT code, name, department, to_char(start_time, 'HH24:MI') AS s, to_char(end_time, 'HH24:MI') AS e, break_minutes, kind, late_grace_minutes, color FROM shift_templates WHERE active ORDER BY start_time`,
    sql`SELECT department, array_agg(hours::float ORDER BY weekday) AS hours FROM staffing_targets GROUP BY department ORDER BY department`,
    sql`SELECT id, line, name, retail_price, wholesale_note, use_up_days, private_channel_only, next_offer, revenue_rank FROM products ORDER BY revenue_rank NULLS LAST, name`,
    sql`SELECT value FROM app_settings WHERE key = 'mini_voucher'`,
    sql`SELECT value FROM app_settings WHERE key = 'mini_points'`,
  ])
  // Kết nối inbox Pancake: page lấy từ biến môi trường, kiểm tra token bằng 1 lượt gọi đọc (không hiện token)
  const pancakePages = await getPancakePages().catch(() => [])
  const pancakeHealth = await Promise.all(pancakePages.map(async p => {
    try { await new PancakeChatClient(p).healthCheck(); return { name: p.name, pageId: p.pageId, ok: true, error: '' } }
    catch (e) { return { name: p.name, pageId: p.pageId, ok: false, error: e instanceof Error ? e.message : String(e) } }
  }))
  const chatStats = (await sql`SELECT COUNT(*)::int AS n, COUNT(customer_id)::int AS linked, MAX(updated_at) AS last FROM conversations WHERE page_id IS NOT NULL`)[0]
  return (
    <>
      <PageHeader title="Cài đặt" />
      <Card title="Kết nối Pancake (inbox)" className="mb-4">
        {pancakeHealth.length === 0 ? <p className="text-sm text-stone-500">Chưa có page nào. Thêm biến môi trường PANCAKE_PAGE_ID và PANCAKE_PAGE_TOKEN (hoặc _1, _2…) trên máy chủ.</p> : (
          <ul className="space-y-1 text-sm">
            {pancakeHealth.map(p => <li key={p.pageId}>{p.ok ? '✓' : '✗'} <b>{p.name}</b> <span className="text-stone-500">({p.pageId})</span> {p.ok ? <span className="text-emerald-700">kết nối tốt</span> : <span className="text-rose-600">{p.error}</span>}</li>)}
          </ul>
        )}
        <p className="mt-2 text-sm text-stone-600">Đã đồng bộ {chatStats.n} hội thoại, ghép được {chatStats.linked} với khách theo SĐT. Lần cuối: {chatStats.last ? dateTime(chatStats.last) : 'chưa có'}.</p>
        <p className="mt-2 text-xs text-stone-500">Lấy token: Pancake → mở page → Cài đặt → Công cụ → “Public API access token” → Sao chép (đã có token thì chỉ Sao chép, đừng bấm Tạo Token vì token cũ sẽ mất hiệu lực). Token đọc được mọi hội thoại và gửi tin thay page: chỉ đặt trong biến môi trường máy chủ, không dán vào chat. CRM chỉ đọc, không gửi tin.</p>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Điểm làm việc (chấm công GPS)">
          {sites.map(s => <SiteForm key={s.id} site={{ id: s.id, name: s.name, address: s.address, lat: s.lat, lng: s.lng, radius_m: s.radius_m, allowed_ips: (s.allowed_ips as string[]).join(', ') }} />)}
          <p className="mt-2 text-xs text-stone-500">Lấy toạ độ: mở Google Maps tại bếp, nhấn giữ vào vị trí → sao chép 2 số đầu. IP Wi-Fi bếp giúp chấm công khi điện thoại không bật định vị.</p>
        </Card>
        <Card title="Định biên giờ công theo ngày (T2 → CN)">
          <div className="space-y-2">{targets.map(t => <TargetRow key={t.department} department={t.department} label={DEPARTMENT_LABEL[t.department as Department]} hours={t.hours} />)}</div>
        </Card>
        <Card title="Voucher Mini App (Đợt A)" className="lg:col-span-2">
          <VoucherForm current={(voucher[0]?.value as { program: string; amount: number; valid_days: number } | undefined) ?? null} />
          <p className="mt-2 text-xs text-stone-500">Mỗi SĐT nhận 1 lần, chỉ dùng khi đặt đơn bằng đúng SĐT đó. Cấp cả khi khách không tick đồng ý nhận tin (đồng ý phải tự nguyện, không đổi lấy quà). Chưa cài thì Mini App không cấp voucher.</p>
        </Card>
        <Card title="Điểm Hạt Cốm (Mini App v2-A)" className="lg:col-span-2">
          <PointsForm current={(points[0]?.value as { checkin: number; milestones: Record<string, number> } | undefined) ?? null} />
          <p className="mt-2 text-xs text-stone-500">Chưa cài thì Mini App dùng mức mặc định: điểm danh 5; chuỗi 3 ngày +10, 7 ngày +30, 14 ngày +60, 30 ngày +150. Điểm chỉ dùng để đổi quà khi khách đã xác minh SĐT.</p>
        </Card>
        <Card title="Kho ca" className="lg:col-span-2" pad={false}>
          <Table head={['Mã', 'Tên', 'Bộ phận', 'Giờ', 'Nghỉ giữa ca', 'Cho phép muộn', 'Loại']}>
            {shifts.map(s => <tr key={s.code}><Td><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: s.color }} /> {s.code}</Td><Td>{s.name}</Td><Td>{s.department ? DEPARTMENT_LABEL[s.department as Department] : 'Mọi bộ phận'}</Td>
              <Td className="tabular-nums">{s.s}–{s.e}</Td><Td>{s.break_minutes}′</Td><Td>{s.late_grace_minutes}′</Td><Td>{({ toan_ca: 'Toàn ca', ban_thoi_gian: 'Bán thời gian', ca_gay: 'Ca gãy', ca_dem: 'Ca đêm' } as Record<string, string>)[s.kind] ?? s.kind}</Td></tr>)}
          </Table>
          <div className="border-t border-stone-100 p-4"><ShiftForm departments={DEPARTMENT_LABEL} /></div>
        </Card>
        <Card title="Sản phẩm (bảng giá BG0926-001)" className="lg:col-span-2" pad={false}>
          <div className="px-4 pt-3"><Note>“Ngày dùng hết” để trống nghĩa là CHƯA bật nhắc mua lại tự động cho sản phẩm đó. Theo HACO-LOOP/09, chưa sản phẩm nào đạt ngưỡng 15% mua lại cùng dòng — chỉ bật khi có nhóm đối chứng.</Note></div>
          <Table head={['#', 'Sản phẩm', 'Dòng', 'Giá lẻ', 'Giá sỉ', 'Ngày dùng hết', 'Chỉ bán kênh riêng', 'Gợi ý mua kèm', '']}>
            {products.map(p => <ProductRow key={p.id} p={{ id: p.id, rank: p.revenue_rank, name: p.name, line: PRODUCT_LINES[p.line as ProductLine] ?? p.line, price: money(p.retail_price), ws: p.wholesale_note,
              use_up_days: p.use_up_days ?? '', private_channel_only: p.private_channel_only, next_offer: p.next_offer }} />)}
          </Table>
        </Card>
      </div>
    </>
  )
}
