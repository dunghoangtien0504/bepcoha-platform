import { getDb } from '@/lib/db'
import { pageUser, can } from '@/lib/crm/session'
import { LEAVE_KINDS, type LeaveKind } from '@/lib/crm/labels'
import { DEPARTMENT_LABEL, type Department } from '@/lib/crm/permissions'
import { date, dateTime } from '@/lib/crm/format'
import { PageHeader, Card, Table, Td, Badge } from '../../_components/ui'
import { LeaveForm, LeaveActions } from './leave-client'

export const metadata = { title: 'Đơn từ' }

const STATUS = { cho_duyet: ['Chờ duyệt', 'amber'], da_duyet: ['Đã duyệt', 'green'], tu_choi: ['Từ chối', 'red'], huy: ['Đã huỷ', 'gray'] } as const

export default async function LeavePage() {
  const user = await pageUser()
  const sql = getDb()
  const approver = can(user, 'cham_cong.duyet')
  const [mine, pending] = await Promise.all([
    sql`SELECT l.*, r.name AS reviewer FROM leave_requests l LEFT JOIN staff r ON r.id = l.reviewed_by WHERE l.staff_id = ${user.id} ORDER BY l.created_at DESC LIMIT 50`,
    approver ? sql`SELECT l.*, s.name AS staff_name, s.department FROM leave_requests l JOIN staff s ON s.id = l.staff_id
      WHERE l.status = 'cho_duyet' AND l.staff_id <> ${user.id} AND (${user.role === 'admin'} OR s.department = ${user.department})
      ORDER BY l.created_at` : Promise.resolve([]),
  ])
  return (
    <>
      <PageHeader title="Đơn từ" sub="Xin nghỉ, đổi ca, quên chấm công, tăng ca. Quản lý bộ phận nhận việc duyệt trong 24 giờ." />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Gửi đơn mới"><LeaveForm kinds={LEAVE_KINDS} /></Card>
        <div className="space-y-4 lg:col-span-2">
          {approver && (
            <Card title={`Chờ tôi duyệt (${pending.length})`} pad={false}>
              <Table head={['Người gửi', 'Loại', 'Ngày', 'Lý do', 'Gửi lúc', '']} empty="Không có đơn chờ duyệt.">
                {pending.map(l => (
                  <tr key={l.id}>
                    <Td><div className="font-medium">{l.staff_name}</div><div className="text-xs text-stone-500">{DEPARTMENT_LABEL[l.department as Department]}</div></Td>
                    <Td>{LEAVE_KINDS[l.kind as LeaveKind]}{l.minutes ? ` · ${l.minutes}′` : ''}</Td>
                    <Td>{date(l.from_date)}{l.to_date > l.from_date ? ` → ${date(l.to_date)}` : ''}</Td>
                    <Td className="max-w-xs">{l.reason}</Td>
                    <Td>{dateTime(l.created_at)}</Td>
                    <Td><LeaveActions id={l.id} mode="review" /></Td>
                  </tr>
                ))}
              </Table>
            </Card>
          )}
          <Card title="Đơn của tôi" pad={false}>
            <Table head={['Loại', 'Ngày', 'Lý do', 'Trạng thái', '']} empty="Bạn chưa gửi đơn nào.">
              {mine.map(l => {
                const st = STATUS[l.status as keyof typeof STATUS]
                return (
                  <tr key={l.id}>
                    <Td>{LEAVE_KINDS[l.kind as LeaveKind]}</Td>
                    <Td>{date(l.from_date)}{l.to_date > l.from_date ? ` → ${date(l.to_date)}` : ''}</Td>
                    <Td className="max-w-xs">{l.reason}</Td>
                    <Td><Badge tone={st[1]}>{st[0]}</Badge>{l.reviewer && <div className="mt-1 text-xs text-stone-500">{l.reviewer}{l.review_note ? `: ${l.review_note}` : ''}</div>}</Td>
                    <Td>{l.status === 'cho_duyet' && <LeaveActions id={l.id} mode="cancel" />}</Td>
                  </tr>
                )
              })}
            </Table>
          </Card>
        </div>
      </div>
    </>
  )
}
