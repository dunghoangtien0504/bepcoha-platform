import Link from 'next/link'
import { pageUser, can } from '@/lib/crm/session'
import { listAudit } from '@/lib/crm/audit'
import { dateTime } from '@/lib/crm/format'
import { PageHeader, Card, Table, Td, Badge, Forbidden } from '../../_components/ui'

export const metadata = { title: 'Nhật ký thao tác' }

const TABLES = ['customers', 'crm_tasks', 'opportunities', 'care_campaigns', 'staff', 'attendance_logs', 'shift_assignments', 'leave_requests', 'order_claims', 'mini_sessions', 'qr_batches', 'app_settings']

function short(v: unknown): string {
  if (v === null || v === undefined) return ''
  const s = typeof v === 'string' ? v : JSON.stringify(v)
  return s.length > 160 ? s.slice(0, 160) + '…' : s
}

export default async function AuditPage(props: PageProps<'/crm/nhat-ky'>) {
  const user = await pageUser()
  if (!can(user, 'nhat_ky.xem')) return <Forbidden />
  const sp = await props.searchParams
  const table = typeof sp.bang === 'string' && TABLES.includes(sp.bang) ? sp.bang : undefined
  const before = typeof sp.truoc === 'string' ? Number(sp.truoc) : undefined
  const rows = await listAudit({ table, before, limit: 100 })
  return (
    <>
      <PageHeader title="Nhật ký thao tác" sub="Ai làm gì, lúc nào, trên bản ghi nào, vì sao. Không sửa/xoá được từ giao diện." />
      <div className="mb-3 flex flex-wrap gap-1.5 text-xs">
        <Link href="/crm/nhat-ky" className={`rounded-full px-2.5 py-1 ${!table ? 'bg-emerald-700 text-white' : 'bg-white ring-1 ring-stone-200'}`}>Tất cả</Link>
        {TABLES.map(t => <Link key={t} href={`/crm/nhat-ky?bang=${t}`} className={`rounded-full px-2.5 py-1 ${table === t ? 'bg-emerald-700 text-white' : 'bg-white ring-1 ring-stone-200'}`}>{t}</Link>)}
      </div>
      <Card pad={false}>
        <Table head={['Lúc', 'Ai', 'Thao tác', 'Bảng / bản ghi', 'Thay đổi', 'Lý do', 'IP']}>
          {rows.map(r => (
            <tr key={r.id}>
              <Td className="whitespace-nowrap">{dateTime(r.created_at)}</Td>
              <Td>{r.actor_name}{r.actor_type !== 'staff' && <Badge tone="violet">{r.actor_type}</Badge>}</Td>
              <Td><Badge tone={String(r.action).includes('FAIL') || r.action === 'DELETE' ? 'red' : r.action === 'EXPORT' || r.action === 'VIEW_PII' ? 'amber' : 'gray'}>{r.action}</Badge></Td>
              <Td className="text-xs">{r.table_name} {r.record_id ?? r.record_key ?? ''}</Td>
              <Td className="max-w-md break-all font-mono text-[11px] text-stone-500">{r.old_value ? <div>trước: {short(r.old_value)}</div> : null}{r.new_value ? <div>sau: {short(r.new_value)}</div> : null}</Td>
              <Td className="text-xs">{r.reason}</Td>
              <Td className="text-xs text-stone-400">{r.ip_address}</Td>
            </tr>
          ))}
        </Table>
        {rows.length === 100 && <div className="border-t border-stone-100 p-3 text-right text-sm"><Link className="text-emerald-700" href={`/crm/nhat-ky?${table ? 'bang=' + table + '&' : ''}truoc=${rows[rows.length - 1].id}`}>Cũ hơn →</Link></div>}
      </Card>
    </>
  )
}
