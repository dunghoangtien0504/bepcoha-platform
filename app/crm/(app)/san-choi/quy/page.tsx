import { getDb } from '@/lib/db'
import { pageUser, can } from '@/lib/crm/session'
import { ensureSanChoiSchema, budgetLeft, REDEEM } from '@/lib/crm/san-choi'
import { dateTime, money } from '@/lib/crm/format'
import { Card, PageHeader, Forbidden, Bar, Table, Td, Note, Stat } from '../../../_components/ui'
import { ReviewButtons } from '../quan-tri/admin-client'

export const metadata = { title: 'Quỹ lượt quay & đổi thưởng' }

/** Quỹ: ngân sách tuần/tháng, tiền đang nằm trong ví + voucher chưa dùng (nghĩa vụ phải chi), duyệt cộng lương và quà hiện vật. */
export default async function Quy() {
  const user = await pageUser()
  if (!can(user, 'cai_dat.sua')) return <Forbidden />
  await ensureSanChoiSchema()
  const sql = getDb()
  const [b, pending, owe] = await Promise.all([
    budgetLeft(),
    sql`SELECT r.*, s.name AS staff_name, i.label AS item_label FROM sc_redemptions r JOIN staff s ON s.id = r.staff_id
        LEFT JOIN sc_items i ON i.id = r.item_id WHERE r.status = 'cho_duyet' ORDER BY r.id`,
    sql`SELECT (SELECT COALESCE(SUM(delta), 0) FROM sc_wallet)::int AS wallets,
               (SELECT COALESCE(SUM(amount), 0) FROM sc_vouchers WHERE status = 'con_han')::int AS vouchers,
               (SELECT COUNT(*) FROM sc_spin_tokens WHERE spin_id IS NULL AND revoked_at IS NULL)::int AS tokens`,
  ])
  return (
    <>
      <PageHeader title="Quỹ lượt quay & đổi thưởng" sub="Tiền thưởng là nghĩa vụ phải chi: số dư ví + voucher chưa dùng." />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Đã chi tháng này" value={money(b.paid)} hint={`trần ${money(b.monthly)}`} tone={b.paid > b.monthly * 0.9 ? 'bad' : 'default'} />
        <Stat label="Còn mở tới tuần này" value={money(b.left)} hint={`mở ${money(b.weekly)}/tuần`} />
        <Stat label="Đang nằm trong ví NV" value={money(owe[0].wallets)} hint="sẽ thành voucher / lương" />
        <Stat label="Voucher chưa dùng" value={money(owe[0].vouchers)} hint={`${owe[0].tokens} lượt quay chưa dùng`} />
      </div>
      <div className="mb-4"><Bar value={b.paid} max={b.monthly} tone={b.paid > b.monthly * 0.9 ? 'rose' : 'amber'} /></div>
      <Card title={`Yêu cầu đổi thưởng chờ duyệt · ${pending.length}`} pad={false}>
        <Table head={['Người', 'Đổi', 'Ghi chú', 'Lúc', '']} empty="Không có yêu cầu nào chờ duyệt.">
          {pending.map(p => (
            <tr key={p.id}>
              <Td className="font-medium">{p.staff_name}</Td>
              <Td>{p.kind === 'vat_pham' ? `🎁 ${p.item_label}` : `${REDEEM[p.kind as keyof typeof REDEEM].label}: ${money(p.amount)}`}</Td>
              <Td className="max-w-xs text-stone-600">{p.note}</Td>
              <Td className="whitespace-nowrap text-xs text-stone-500">{dateTime(p.created_at)}</Td>
              <Td><ReviewButtons id={p.id} self={p.staff_id === user.id} /></Td>
            </tr>
          ))}
        </Table>
        <div className="p-3"><Note>Lấy hàng HACO: duyệt xong có mã NV…, nhân viên đưa mã cho thủ kho, xuất hàng theo giá bán. Cộng lương: kế toán cộng vào bảng lương tháng.</Note></div>
      </Card>
    </>
  )
}
