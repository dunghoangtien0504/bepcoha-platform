import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getDb } from '@/lib/db'
import { pageUser, can } from '@/lib/crm/session'
import { getCustomer360, maskPhone } from '@/lib/crm/customers'
import { logAction } from '@/lib/crm/audit'
import { LIFECYCLE, SEGMENT_LABEL, PLATFORM_LABEL, PRODUCT_LINES, TASK_KINDS, TASK_RESULTS, STATUS_LABEL, type Platform, type ProductLine, type TaskKind } from '@/lib/crm/labels'
import { money, moneyShort, date, dateTime, num } from '@/lib/crm/format'
import { PageHeader, Card, Badge, Table, Td, Forbidden } from '../../../_components/ui'
import { CustomerEditor, ActivityForm, NewOpportunity } from './customer-client'
import { getPancakeConversationUrl } from '@/lib/pancake'
import type { ChatMessage } from '@/lib/crm/pancake-chat'

export const metadata = { title: 'Hồ sơ khách' }

export default async function Customer360(props: PageProps<'/crm/khach-hang/[id]'>) {
  const user = await pageUser()
  if (!can(user, 'khach.xem')) return <Forbidden />
  const id = Number((await props.params).id)
  if (!Number.isInteger(id)) notFound()
  const d = await getCustomer360(id)
  if (!d) notFound()
  const c = d.customer
  const showPhone = can(user, 'khach.xem_sdt')
  // Xem đủ SĐT là thao tác với dữ liệu cá nhân → ghi nhật ký
  if (showPhone) await logAction({ actorId: user.id, action: 'VIEW_PII', table: 'customers', recordId: id }).catch(() => {})
  const staff = can(user, 'khach.sua') ? await getDb()`SELECT id, name FROM staff WHERE status = 'active' AND department IN ('sale_cskh', 'dao_tao', 'ban_giam_doc') ORDER BY name` : []
  const realOrders = d.orders.filter(o => o.is_real)
  // Hội thoại inbox Pancake đã ghép với khách theo SĐT (đồng bộ mỗi giờ, chỉ đọc)
  const chats = await getDb()`SELECT pancake_conversation_id, page_name, platform, last_message_preview, last_message_at, assignees, is_unread, messages
                              FROM conversations WHERE customer_id = ${id} ORDER BY last_message_at DESC NULLS LAST LIMIT 5`

  return (
    <>
      <div className="mb-2 text-sm"><Link href="/crm/khach-hang" className="text-stone-500 hover:underline">← Khách hàng</Link></div>
      <PageHeader title={c.name || `Khách #${c.id}`}
        sub={<span className="flex flex-wrap items-center gap-2">
          <span className="tabular-nums">{showPhone ? c.phone : maskPhone(c.phone)}</span>
          <Badge tone="blue">{LIFECYCLE[c.lifecycle as keyof typeof LIFECYCLE]}</Badge>
          {(c.segments as string[]).map(s => <Badge key={s} tone="green">{SEGMENT_LABEL[s] ?? s}</Badge>)}
          {c.opted_out_at && <Badge tone="red">Từ chối nhận tin từ {date(c.opted_out_at)}</Badge>}
          {!c.phone_verified_at && <Badge tone="amber">SĐT chưa xác minh — chưa được liên hệ chủ động</Badge>}
          {c.referral_code && <Badge>Mã giới thiệu {c.referral_code}</Badge>}
        </span>} />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Mini label="Số lần mua" value={num(c.order_count)} />
            <Mini label="Tổng chi" value={moneyShort(c.total_spent)} />
            <Mini label="Mua đầu" value={date(c.first_order_at)} />
            <Mini label="Mua gần nhất" value={date(c.last_order_at)} />
          </div>
          <Card title={`Đơn hàng (${realOrders.length} đơn thật / ${d.orders.length} bản ghi)`} pad={false}>
            <Table head={['Ngày', 'Mã đơn', 'Kênh', 'Sản phẩm', 'Doanh thu', 'Trạng thái', 'Người bán']}>
              {d.orders.slice(0, 30).map(o => (
                <tr key={o.pos_order_id} className={o.is_real ? '' : 'text-stone-400'}>
                  <Td>{date(o.inserted_at)}</Td>
                  <Td className="font-mono text-xs">{o.pos_order_id}</Td>
                  <Td>{PLATFORM_LABEL[o.platform as Platform]}</Td>
                  <Td className="max-w-xs">{(o.items as { name: string; qty: number; bonus: boolean }[]).map((i, k) => <div key={k}>{i.qty}× {i.name}{i.bonus ? ' (tặng)' : ''}</div>)}</Td>
                  <Td className="tabular-nums">{money(o.revenue ?? o.total)}</Td>
                  <Td>{STATUS_LABEL[o.status as number] ?? o.status_name}</Td>
                  <Td className="text-xs">{o.seller_name ?? '—'}</Td>
                </tr>
              ))}
            </Table>
          </Card>
          <Card title={`Hội thoại Pancake (${chats.length})`}>
            {chats.length === 0 ? <p className="text-sm text-stone-500">Chưa thấy hội thoại inbox nào có SĐT của khách này (ghép theo SĐT khách để lại trong chat).</p> : (
              <ul className="space-y-3">
                {chats.map(v => {
                  const msgs = ((v.messages as ChatMessage[]) ?? []).slice(-20)
                  return (
                    <li key={v.pancake_conversation_id} className="rounded-lg border border-stone-200 p-3">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
                        <span className="font-medium text-stone-700">{v.page_name || 'Pancake'}</span>
                        <span>· {dateTime(v.last_message_at)}</span>
                        {(v.assignees as string[]).length > 0 && <span>· phụ trách: {(v.assignees as string[]).join(', ')}</span>}
                        {v.is_unread && <Badge tone="red">Khách đang chờ trả lời</Badge>}
                        <a href={getPancakeConversationUrl(v.pancake_conversation_id)} target="_blank" rel="noreferrer" className="ml-auto text-emerald-700 underline">Mở trên Pancake</a>
                      </div>
                      <p className="mt-1 text-sm text-stone-700">{v.last_message_preview}</p>
                      {msgs.length > 0 && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-xs text-emerald-800">Xem {msgs.length} tin gần nhất</summary>
                          <ul className="mt-2 space-y-1.5 text-sm">
                            {msgs.map(m => (
                              <li key={m.id} className={`max-w-[85%] rounded-lg px-3 py-1.5 ${m.fromCustomer ? 'bg-stone-100' : 'ml-auto bg-emerald-50'}`}>
                                <div className="text-[11px] text-stone-500">{m.sender} · {m.at ? dateTime(m.at) : ''}</div>
                                <div className="whitespace-pre-wrap">{m.text}</div>
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
          <Card title="Dòng thời gian">
            <ActivityForm customerId={id} />
            <ul className="mt-4 space-y-3">
              {d.activities.map(a => (
                <li key={a.id} className="border-l-2 border-emerald-200 pl-3 text-sm">
                  <div className="text-xs text-stone-500">{dateTime(a.created_at)} · {a.staff_name ?? 'Hệ thống'} · {a.kind}</div>
                  <div className="whitespace-pre-wrap">{a.content}</div>
                </li>
              ))}
              {!d.activities.length && <li className="text-sm text-stone-400">Chưa có hoạt động nào.</li>}
            </ul>
          </Card>
        </div>

        <div className="space-y-4">
          {can(user, 'khach.sua') && (
            <Card title="Chăm sóc">
              <CustomerEditor customer={{ id: c.id, stage: c.stage, segments: c.segments, assigned_staff_id: c.assigned_staff_id, internal_note: c.internal_note,
                stars: c.stars, birthday: c.birthday ? new Date(c.birthday).toISOString().slice(0, 10) : '', opted_out: !!c.opted_out_at }}
                staff={staff.map(s => ({ id: s.id, name: s.name }))} isAdmin={user.role === 'admin'} />
            </Card>
          )}
          <Card title="Sản phẩm đã mua">
            {d.lines.length ? <ul className="space-y-1 text-sm">{d.lines.map(([l, n]) => <li key={l} className="flex justify-between"><span>{PRODUCT_LINES[l as ProductLine] ?? l}</span><span className="text-stone-500">{n} đơn</span></li>)}</ul>
              : <p className="text-sm text-stone-400">Chưa mua.</p>}
          </Card>
          <Card title="Việc liên quan">
            <ul className="space-y-2 text-sm">
              {d.tasks.slice(0, 10).map(t => (
                <li key={t.id}><div className="font-medium">{TASK_KINDS[t.kind as TaskKind] ?? t.title}</div>
                  <div className="text-xs text-stone-500">{t.assignee_name ?? '—'} · {t.status === 'xong' ? `xong ${dateTime(t.done_at)} · ${TASK_RESULTS[t.result as keyof typeof TASK_RESULTS] ?? ''}` : `hạn ${dateTime(t.due_at)}`}</div>
                  {t.edit_reason && <div className="text-xs text-amber-700">Lý do làm khác: {t.edit_reason}</div>}</li>
              ))}
              {!d.tasks.length && <li className="text-stone-400">Chưa có việc.</li>}
            </ul>
          </Card>
          <Card title="Cơ hội bán" actions={can(user, 'co_hoi.sua') ? <NewOpportunity customerId={id} /> : undefined}>
            <ul className="space-y-2 text-sm">
              {d.opportunities.map(o => <li key={o.id}><Link href="/crm/co-hoi" className="font-medium text-emerald-800 hover:underline">{o.title}</Link>
                <div className="text-xs text-stone-500">{o.pipeline} · {o.stage} · {moneyShort(o.value)}</div></li>)}
              {!d.opportunities.length && <li className="text-stone-400">Chưa có.</li>}
            </ul>
          </Card>
          <Card title="Mini App & đồng ý nhận tin">
            <div className="space-y-2 text-sm">
              {d.mini.map(m => <div key={m.id}>Phiên #{m.id} · lô {m.batch_code ?? '—'} · {m.verified ? `đã xác minh (${m.verified_via})` : 'chưa xác minh'}{m.lessons_done ? ` · học tới bài ${m.lessons_done}` : ''}</div>)}
              {d.consents.map((k, i) => <div key={i}>{k.channel}: {k.purpose} · {k.revoked_at ? `rút lại ${date(k.revoked_at)}` : `đồng ý ${date(k.granted_at)}`}{!k.verified && ' (chưa xác minh)'}</div>)}
              {d.rewards.map((r, i) => <div key={i}>Ưu đãi {r.code} · {r.program} · {r.status}</div>)}
              {!d.mini.length && !d.consents.length && <p className="text-stone-400">Khách chưa dùng Mini App.</p>}
            </div>
          </Card>
          {(c.referrer_name || d.referred.length > 0) && (
            <Card title="Giới thiệu">
              {c.referrer_name && <p className="text-sm">Được giới thiệu bởi <Link className="text-emerald-800 underline" href={`/crm/khach-hang/${c.referred_by}`}>{c.referrer_name}</Link></p>}
              {d.referred.map(r => <p key={r.id} className="text-sm">Đã giới thiệu <Link className="text-emerald-800 underline" href={`/crm/khach-hang/${r.id}`}>{r.name || '#' + r.id}</Link> ({r.order_count} lần mua)</p>)}
            </Card>
          )}
        </div>
      </div>
    </>
  )
}

function Mini({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-stone-200 bg-white p-3 shadow-sm"><div className="text-xs text-stone-500">{label}</div><div className="mt-0.5 font-semibold tabular-nums">{value}</div></div>
}
