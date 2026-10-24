import { pageUser, can } from '@/lib/crm/session'
import { retention, funnelByStep } from '@/lib/crm/reports'
import { listClaims, listMiniOrders } from '@/lib/crm/mini'
import { maskPhone } from '@/lib/crm/customers'
import { PLATFORM_LABEL, type Platform } from '@/lib/crm/labels'
import { date, dateTime, money, num, pct } from '@/lib/crm/format'
import { PageHeader, Card, Table, Td, Badge, Forbidden, Note, Bar } from '../../_components/ui'
import { NewBatch, ClaimActions, CancelMiniOrder } from './qr-client'

export const metadata = { title: 'QR & Mini App' }

const LOOKUP = { khop_sdt: 'Khớp SĐT', don_san: 'Đơn sàn (SĐT bị che)', nhieu_don: 'Trùng nhiều đơn', sai_sdt: 'Sai SĐT — xem kỹ', chua_thay: 'Chưa thấy đơn' } as const

export default async function QrPage() {
  const user = await pageUser()
  if (!can(user, 'qr.xem')) return <Forbidden />
  const manage = can(user, 'qr.quan_ly')
  const [ret, funnel, claims, miniOrders] = await Promise.all([retention(), funnelByStep(null), manage ? listClaims('cho_duyet') : Promise.resolve([]), listMiniOrders('moi')])
  const maxF = Math.max(1, ...funnel.map(f => f.people as number))
  const showPhone = can(user, 'khach.xem_sdt')
  return (
    <>
      <PageHeader title="QR & Mini App" sub="Mỗi hộp hàng 1 thẻ QR, 1 lời kêu gọi, mỗi lô 1 mã để đo tỷ lệ quét (B4 K10, Z04). Dữ liệu quét ghép với mã đơn sàn để biết khách là ai (K17)." />
      <div className="mb-4"><Note tone="warn">Đơn Shopee/TikTok: chưa in lời kêu gọi mua ngoài sàn cho tới khi quản lý sàn kiểm điều khoản sàn. Hệ thống chặn lời kêu gọi có chữ “mua/giảm/ưu đãi” cho lô sàn.</Note></div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Lô QR" className="lg:col-span-2" pad={false}>
          <Table head={['Mã lô', 'Kênh', 'Lời kêu gọi', 'Đã in', 'Lượt quét', 'Để lại SĐT', 'Ghép đơn']}>
            {(ret.batches as unknown as Record<string, never>[]).map(b => (
              <tr key={b.code}>
                <Td className="font-mono text-xs">{b.code}<div className="text-stone-400">{date(b.created_at)}</div></Td>
                <Td>{PLATFORM_LABEL[b.channel as Platform] ?? b.channel}</Td>
                <Td className="max-w-xs">{b.cta}</Td>
                <Td className="tabular-nums">{num(b.printed_qty)}</Td>
                <Td className="tabular-nums">{num(b.scans)} <span className="text-xs text-stone-500">({pct(b.scans, b.printed_qty)})</span></Td>
                <Td className="tabular-nums">{num(b.identified)}</Td>
                <Td className="tabular-nums">{num(b.matched)}</Td>
              </tr>
            ))}
          </Table>
        </Card>
        <Card title="Phễu Mini App (người, theo bước)">
          {funnel.length === 0 ? <p className="text-sm text-stone-400">Chưa có lượt quét nào. Mini App đang dựng (phiên “Mini app Zalo OA”).</p> : (
            <ul className="space-y-2 text-sm">{funnel.map(f => <li key={`${f.step}-${f.name}`}><div className="flex justify-between"><span>{f.step}. {f.name}</span><span className="tabular-nums">{num(f.people)}</span></div><Bar value={f.people as number} max={maxF} /></li>)}</ul>
          )}
        </Card>
      </div>
      {manage && <div className="mt-4"><NewBatch /></div>}
      {manage && (
        <Card className="mt-4" title={`Ghép đơn chờ duyệt (${claims.length})`} pad={false}>
          <Table head={['Gửi lúc', 'Mã khách gõ', 'Kết quả tra', 'SĐT phiên', 'Đơn tìm thấy', 'Thao tác']} empty="Không có yêu cầu chờ duyệt.">
            {claims.map(c => (
              <tr key={c.id}>
                <Td>{dateTime(c.created_at)}<div className="text-xs text-stone-400">lô {c.batch_code ?? '—'}</div></Td>
                <Td className="font-mono text-xs">{c.order_ref_raw}</Td>
                <Td><Badge tone={c.lookup_result === 'sai_sdt' ? 'red' : 'amber'}>{LOOKUP[c.lookup_result as keyof typeof LOOKUP]}</Badge></Td>
                <Td className="tabular-nums">{c.session_phone ? (showPhone ? c.session_phone : maskPhone(c.session_phone)) : '—'}{!c.session_verified && <div className="text-xs text-amber-700">chưa xác minh</div>}</Td>
                <Td>{c.matched_pancake_order_id ? <><div className="font-mono text-xs">{c.matched_pancake_order_id}</div><div className="text-xs text-stone-500">{c.order_name} · {money(c.order_total)} · {c.order_status}</div></> : '—'}</Td>
                <Td><ClaimActions id={c.id} sessionId={c.mini_session_id} hasOrder={!!c.matched_pancake_order_id} /></Td>
              </tr>
            ))}
          </Table>
        </Card>
      )}
      <Card className="mt-4" title={`Đơn đặt trong Mini App (${miniOrders.length})`} pad={false}>
        <Table head={['Đặt lúc', 'Mã đơn', 'Khách', 'Hàng', 'Khách trả', 'Thanh toán', 'POScake', ...(manage ? ['Thao tác'] : [])]} empty="Chưa có đơn đặt trong Mini App.">
          {miniOrders.map(o => (
            <tr key={o.id}>
              <Td>{dateTime(o.created_at)}</Td>
              <Td className="font-mono text-xs">{o.ref_code}</Td>
              <Td>{o.name}<div className="text-xs tabular-nums text-stone-500">{showPhone ? o.phone : maskPhone(o.phone)}{!o.session_verified && ' · chưa xác minh'}</div></Td>
              <Td className="max-w-xs text-xs">{(o.items as { label: string; qty: number }[]).map(l => `${l.label} × ${l.qty}`).join(', ')}</Td>
              <Td className="tabular-nums">{money(o.total)}{(Number(o.voucher_amount) > 0 || Number(o.points_amount) > 0) && <div className="text-xs text-stone-500">giảm {money(Number(o.voucher_amount) + Number(o.points_amount))}</div>}</Td>
              <Td><Badge tone={o.payment_status === 'da_tra' ? 'green' : o.payment === 'cod' ? 'gray' : 'amber'}>{o.payment === 'cod' ? 'COD' : o.payment_status === 'da_tra' ? 'Đã chuyển khoản' : 'Chờ chuyển khoản'}</Badge></Td>
              <Td>{o.pos_status === 'da_tao' ? <><div className="font-mono text-xs">{o.pos_order_id}</div><div className="text-xs text-stone-500">{o.pos_status_name ?? 'chưa đồng bộ'}</div></>
                : o.pos_status === 'loi' ? <Badge tone="red" title={o.pos_error ?? ''}>Lỗi — tạo tay</Badge> : <Badge tone="amber">Đang tạo</Badge>}</Td>
              {manage && <Td><CancelMiniOrder id={o.id} refCode={o.ref_code} /></Td>}
            </tr>
          ))}
        </Table>
      </Card>
      <Card className="mt-4" title="Chỉ số giữ khách (B4 Z01)">
        <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div><div className="text-xs text-stone-500">Mua lại trong 30 ngày</div><div className="text-xl font-semibold">{pct(ret.rep30, ret.cohort30)}</div><div className="text-xs text-stone-400">nhóm {num(ret.cohort30)} khách</div></div>
          <div><div className="text-xs text-stone-500">Giá trị đơn TB (90 ngày)</div><div className="text-xl font-semibold">{money(ret.aov90)}</div></div>
          <div><div className="text-xs text-stone-500">Giá trị 1 khách / 12 tháng</div><div className="text-xl font-semibold">{money(ret.ltv12)}</div></div>
          <div><div className="text-xs text-stone-500">Khách ngủ đông (&gt;120 ngày)</div><div className="text-xl font-semibold">{num(ret.dormant)}</div></div>
        </div>
      </Card>
    </>
  )
}
