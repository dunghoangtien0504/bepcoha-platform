import { getDb } from '@/lib/db'
import { pageUser, can } from '@/lib/crm/session'
import { getSettings, inWindow, isKho, ensureSanChoiSchema } from '@/lib/crm/san-choi'
import { dateTime } from '@/lib/crm/format'
import { PageHeader, Card, Forbidden, Table, Td } from '../../../_components/ui'
import { KhoScanner } from '../admin-client'

export const metadata = { title: 'Quét voucher tại kho' }

/** Thủ kho nhận voucher mua hàng nội bộ (thay thu ngân siêu thị của Easymart). Danh sách bên dưới là phiếu xuất voucher cho kế toán. */
export default async function KhoPage() {
  const user = await pageUser()
  if (!isKho(user)) return <Forbidden />
  await ensureSanChoiSchema()
  const [s, used] = await Promise.all([
    getSettings(),
    getDb()`SELECT v.code, v.amount, v.used_at, v.used_note, s.name AS staff_name, u.name AS by_name FROM sc_vouchers v
            JOIN staff s ON s.id = v.staff_id LEFT JOIN staff u ON u.id = v.used_by WHERE v.status = 'da_dung' ORDER BY v.used_at DESC LIMIT 40`,
  ])
  const boss = user.role === 'admin' || user.department === 'ban_giam_doc' || can(user, 'cai_dat.sua')
  return (
    <>
      <PageHeader title="Quét voucher tại kho" sub={`Nhân viên đưa mã vạch trên điện thoại → quét hoặc gõ mã → giao hàng theo giá nội bộ, không thối tiền thừa. Giờ nhận: ${s.kho_window || 'cả ngày'}.`} />
      <div className="grid gap-4 lg:grid-cols-[420px_1fr]">
        <Card><KhoScanner inWindow={inWindow(s.kho_window)} window={s.kho_window} boss={boss} /></Card>
        <Card title="Phiếu xuất voucher gần đây" pad={false}>
          <Table head={['Lúc', 'Người đổi', 'Mã', 'Mệnh giá', 'Hàng', 'Thủ kho']} empty="Chưa nhận voucher nào.">
            {used.map(u => (
              <tr key={u.code}><Td className="whitespace-nowrap text-xs">{dateTime(u.used_at)}</Td><Td className="font-medium">{u.staff_name}</Td>
                <Td className="font-mono text-xs">{u.code}</Td><Td className="tabular-nums">{Number(u.amount).toLocaleString('vi-VN')}đ</Td><Td className="text-stone-600">{u.used_note}</Td><Td>{u.by_name}</Td></tr>
            ))}
          </Table>
        </Card>
      </div>
    </>
  )
}
