import Link from 'next/link'
import { pageUser, can } from '@/lib/crm/session'
import { listNotifications, NOTIFICATION_KINDS, STAFF_AUDIENCES, type NotificationKind, type StaffAudience } from '@/lib/crm/events'
import { dateTime, num } from '@/lib/crm/format'
import { PageHeader, Card, Table, Td, Badge, Forbidden, Note } from '../../_components/ui'
import { NotificationForm, ExpireButton } from './notify-client'

export const metadata = { title: 'Thông báo Mini App' }

export default async function NotificationsPage() {
  const user = await pageUser()
  if (!can(user, 'su_kien.quan_ly')) return <Forbidden />
  const rows = await listNotifications()
  return (
    <>
      <PageHeader title="Thông báo Mini App" sub="Tin vào hộp thư trong Mini App. Khách tự mở app mới thấy; không gửi tin nhắn ra ngoài." />
      <div className="mb-4"><Note>Link chỉ được dẫn tới trang trong Mini App (chính sách Zalo 4.1). Nhắc giờ sự kiện và tin đơn hàng do Mini App tự tạo, không cần soạn.</Note></div>
      <Card title="Soạn thông báo"><NotificationForm /></Card>
      <Card title="Đã gửi" className="mt-4" pad={false}>
        <Table head={['Gửi lúc', 'Tiêu đề', 'Loại', 'Gửi tới', 'Đã đọc', '']} empty="Chưa có thông báo nào.">
          {rows.map(n => {
            const scheduled = n.is_scheduled as boolean
            const expired = n.is_expired as boolean
            return (
              <tr key={n.id} className={expired ? 'text-stone-400' : ''}>
                <Td className="whitespace-nowrap">{dateTime(n.publish_at)}{scheduled && <div><Badge tone="amber">Hẹn giờ</Badge></div>}{expired && <div className="text-xs">hết hạn</div>}</Td>
                <Td>{n.title}{n.link && <div className="font-mono text-xs text-stone-400">{n.link}</div>}{n.event_id && <Link href={`/crm/su-kien/${n.event_id}`} className="text-xs text-emerald-800 hover:underline">xem sự kiện</Link>}</Td>
                <Td>{NOTIFICATION_KINDS[n.kind as NotificationKind]}</Td>
                <Td>{n.audience === 'khach' ? <Link href={`/crm/khach-hang/${n.customer_id}`} className="text-emerald-800 hover:underline">{n.customer_name || `Khách #${n.customer_id}`}</Link> : STAFF_AUDIENCES[n.audience as StaffAudience]}</Td>
                <Td className="tabular-nums">{num(n.reads)}</Td>
                <Td>{!expired && <ExpireButton id={n.id} />}</Td>
              </tr>
            )
          })}
        </Table>
      </Card>
    </>
  )
}
