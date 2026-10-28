import { getDb } from '@/lib/db'
import { pageUser, can } from '@/lib/crm/session'
import { grantList, GRANT_REASONS, type GrantReason } from '@/lib/crm/san-choi'
import { dateTime } from '@/lib/crm/format'
import { PageHeader, Card, Forbidden, Table, Td, Badge, Bar, Note } from '../../../_components/ui'
import { GrantForm, GrantReview } from '../admin-client'

export const metadata = { title: 'Cấp / Bỏ lượt' }

/** Cấp / Bỏ lượt tay (Easymart có mục này). Chốt chặn CEO: quỹ tháng, lý do chọn sẵn, quá N lượt cần người thứ hai, bỏ lượt là dòng âm. */
export default async function CapLuot() {
  const user = await pageUser()
  if (!can(user, 'cai_dat.sua')) return <Forbidden />
  const [g, staff] = await Promise.all([grantList(), getDb()`SELECT id, name FROM staff WHERE status = 'active' AND id <> ${user.id} ORDER BY name`])
  const pending = g.rows.filter(r => r.status === 'cho_duyet')
  const opts = staff.map(s => ({ id: s.id, name: s.name }))
  return (
    <>
      <PageHeader title="Cấp / Bỏ lượt" sub="Chỉ dùng khi máy tính sai hoặc có giải thi đua. Mọi lần cấp/bỏ đều hiện trong Báo cáo tuần." />
      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <Card title="Quỹ lượt cấp tay tháng này">
          <div className="text-3xl font-bold tabular-nums">{g.used}<span className="text-base font-normal text-stone-500"> / {g.fund} lượt</span></div>
          <div className="mt-2"><Bar value={g.used} max={g.fund} tone={g.used > g.fund * 0.8 ? 'rose' : 'amber'} /></div>
          <p className="mt-2 text-xs text-stone-500">Cấp quá {g.secondOver} lượt một lần cần người thứ hai duyệt. Không tự cấp cho mình.</p>
        </Card>
        <Card title="Cấp lượt" className="lg:col-span-2"><GrantForm mode="cap" staff={opts} reasons={GRANT_REASONS} /></Card>
      </div>
      {pending.length > 0 && (
        <Card title={`Chờ người thứ hai duyệt · ${pending.length}`} className="mb-4" pad={false}>
          <Table head={['Người nhận', 'Lượt', 'Lý do', 'Người tạo', '']}>
            {pending.map(r => <tr key={r.id}><Td className="font-medium">{r.staff_name}</Td><Td>+{r.tokens}</Td><Td>{GRANT_REASONS[r.reason as GrantReason]} · {r.note}</Td><Td>{r.by_name}</Td>
              <Td>{r.created_by === user.id ? <span className="text-xs text-stone-400">Người khác duyệt</span> : <GrantReview id={r.id} />}</Td></tr>)}
          </Table>
        </Card>
      )}
      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <Card title="Lịch sử cấp / bỏ" pad={false}>
          <Table head={['Lúc', 'Người nhận', 'Lượt', 'Lý do', 'Người làm', 'Trạng thái']} empty="Chưa cấp lượt tay lần nào.">
            {g.rows.map(r => (
              <tr key={r.id}><Td className="whitespace-nowrap text-xs">{dateTime(r.created_at)}</Td><Td className="font-medium">{r.staff_name}</Td>
                <Td className={r.tokens > 0 ? 'text-emerald-700' : 'text-rose-600'}>{r.tokens > 0 ? '+' : ''}{r.tokens}</Td>
                <Td className="max-w-xs">{GRANT_REASONS[r.reason as GrantReason] ?? r.reason}<span className="block text-xs text-stone-500">{r.note}</span></Td>
                <Td className="text-xs">{r.by_name}{r.approver_name && r.approver_name !== r.by_name ? ` · duyệt: ${r.approver_name}` : ''}</Td>
                <Td><Badge tone={r.status === 'da_duyet' ? 'green' : r.status === 'cho_duyet' ? 'amber' : 'red'}>{r.status === 'da_duyet' ? 'Hiệu lực' : r.status === 'cho_duyet' ? 'Chờ duyệt' : 'Từ chối'}</Badge></Td></tr>
            ))}
          </Table>
        </Card>
        <Card title="Thu hồi lượt">
          <GrantForm mode="bo" staff={opts} reasons={GRANT_REASONS} />
          <div className="mt-3"><Note tone="warn">Chỉ thu hồi lượt CHƯA quay. Ghi thành dòng âm, không xoá lịch sử.</Note></div>
        </Card>
      </div>
    </>
  )
}
