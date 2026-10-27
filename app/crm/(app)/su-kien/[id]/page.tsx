import Link from 'next/link'
import { notFound } from 'next/navigation'
import { pageUser, can } from '@/lib/crm/session'
import { getEvent, dateToVnLocal, EVENT_STATUS, type EventStatus } from '@/lib/crm/events'
import { maskPhone } from '@/lib/crm/customers'
import { dateTime, num } from '@/lib/crm/format'
import { PageHeader, Card, Table, Td, Badge, Forbidden, Note } from '../../../_components/ui'
import { EventForm, EventStatusActions } from '../event-client'

export const metadata = { title: 'Sự kiện' }

export default async function EventPage(props: PageProps<'/crm/su-kien/[id]'>) {
  const user = await pageUser()
  if (!can(user, 'su_kien.quan_ly')) return <Forbidden />
  const id = Number((await props.params).id)
  if (!Number.isInteger(id)) notFound()
  const data = await getEvent(id)
  if (!data) notFound()
  const { event: e, reminders, notification } = data
  const showPhone = can(user, 'khach.xem_sdt')
  const active = reminders.filter(r => !r.cancelled_at)
  const reserved = active.filter(r => r.kind === 'giu_cho').length
  return (
    <>
      <PageHeader title={e.title} sub={<><Link href="/crm/su-kien" className="underline">Sự kiện</Link> · <span className="font-mono">/su-kien/{e.slug}</span> · <Badge tone={e.status === 'cong_bo' ? 'green' : e.status === 'huy' ? 'red' : 'gray'}>{EVENT_STATUS[e.status as EventStatus]}</Badge></>}
        actions={<EventStatusActions id={e.id} status={e.status} hasNotification={!!notification} />} />
      {notification && <div className="mb-4"><Note>Đã có thông báo gửi mọi người cho sự kiện này (lúc {dateTime(notification.publish_at)}). Công bố lại không gửi thêm.</Note></div>}
      {e.status === 'huy' && reserved > 0 && <div className="mb-4"><Note tone="warn">Sự kiện đã huỷ nhưng còn {reserved} người giữ chỗ. Soạn thông báo riêng cho họ ở mục Thông báo Mini App.</Note></div>}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Nội dung" className="lg:col-span-2">
          <EventForm published={e.status === 'cong_bo'} initial={{
            id: e.id, title: e.title, slug: e.slug, kind: e.kind, starts_at: dateToVnLocal(e.starts_at), ends_at: dateToVnLocal(e.ends_at),
            location: e.location, capacity: e.capacity ? String(e.capacity) : '', image: e.image, join_url: e.join_url, summary: e.summary, body: e.body,
          }} />
        </Card>
        <Card title={`Khách đăng ký (${num(active.length)})`} pad={false}>
          <div className="px-4 py-2 text-sm text-stone-600">Giữ chỗ: <b>{num(reserved)}</b>{e.capacity ? ` / ${num(e.capacity)}` : ''} · Nhắc: <b>{num(active.length - reserved)}</b></div>
          <Table head={['Khách', 'Loại', 'Lúc']} empty="Chưa có ai bấm nhắc hoặc giữ chỗ.">
            {reminders.map((r, i) => (
              <tr key={i} className={r.cancelled_at ? 'text-stone-400 line-through' : ''}>
                <Td>{r.customer_id ? <Link href={`/crm/khach-hang/${r.customer_id}`} className="text-emerald-800 hover:underline">{r.customer_name || 'Khách'}</Link> : 'Chưa xác minh'}
                  <div className="text-xs tabular-nums text-stone-500">{r.phone ? (showPhone ? r.phone : maskPhone(r.phone)) : '—'}</div></Td>
                <Td>{r.kind === 'giu_cho' ? 'Giữ chỗ' : 'Nhắc'}</Td>
                <Td className="whitespace-nowrap text-xs">{dateTime(r.created_at)}</Td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>
    </>
  )
}
