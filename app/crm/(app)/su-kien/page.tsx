import Link from 'next/link'
import { pageUser, can } from '@/lib/crm/session'
import { listEvents, EVENT_KINDS, EVENT_STATUS, type EventKind, type EventStatus } from '@/lib/crm/events'
import { dateTime, num } from '@/lib/crm/format'
import { PageHeader, Card, Table, Td, Badge, Forbidden, Note } from '../../_components/ui'
import { EventForm, EMPTY_EVENT } from './event-client'

export const metadata = { title: 'Sự kiện' }

const TONE = { nhap: 'gray', cong_bo: 'green', huy: 'red' } as const

export default async function EventsPage() {
  const user = await pageUser()
  if (!can(user, 'su_kien.quan_ly')) return <Forbidden />
  const events = await listEvents()
  return (
    <>
      <PageHeader title="Sự kiện Mini App" sub="Livestream, workshop, thử thách nấu, ưu đãi theo mùa. Khách bấm “Nhắc tôi” hoặc “Giữ chỗ” trong Mini App." />
      <div className="mb-4"><Note>Theo chính sách Zalo Mini App: không có thích/bình luận trong app; link tham gia mở ra ngoài phải là https. Sự kiện tạo xong ở dạng nháp, bấm Công bố mới hiện cho khách.</Note></div>
      <Card title="Danh sách" pad={false}>
        <Table head={['Bắt đầu', 'Sự kiện', 'Loại', 'Trạng thái', 'Giữ chỗ', 'Nhắc']} empty="Chưa có sự kiện nào.">
          {events.map(e => {
            const past = e.is_past as boolean
            return (
              <tr key={e.id} className={past || e.status === 'huy' ? 'text-stone-400' : ''}>
                <Td className="whitespace-nowrap">{dateTime(e.starts_at)}{past && <div className="text-xs">đã qua</div>}</Td>
                <Td><Link href={`/crm/su-kien/${e.id}`} className="font-medium text-emerald-800 hover:underline">{e.title}</Link><div className="font-mono text-xs text-stone-400">/su-kien/{e.slug}</div></Td>
                <Td>{EVENT_KINDS[e.kind as EventKind]}</Td>
                <Td><Badge tone={TONE[e.status as EventStatus]}>{EVENT_STATUS[e.status as EventStatus]}</Badge></Td>
                <Td className="tabular-nums">{e.capacity ? `${num(e.reserved)} / ${num(e.capacity)}` : '—'}</Td>
                <Td className="tabular-nums">{num(e.reminders)}</Td>
              </tr>
            )
          })}
        </Table>
      </Card>
      <Card title="Tạo sự kiện mới" className="mt-4"><EventForm initial={EMPTY_EVENT} /></Card>
    </>
  )
}
