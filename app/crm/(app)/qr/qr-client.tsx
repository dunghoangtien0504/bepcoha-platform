'use client'
import { useState } from 'react'
import { api, useAction, btnClass, inputClass, labelClass, Feedback } from '../../_components/client'

export function NewBatch() {
  const { run, pending, error, message } = useAction()
  const empty = { code: '', channel: 'facebook', sku: '', cta: '', printed_qty: '', note: '' }
  const [f, setF] = useState(empty)
  return (
    <form className="grid gap-3 rounded-xl border border-stone-200 bg-white p-4 shadow-sm sm:grid-cols-6" onSubmit={async e => {
      e.preventDefault()
      if (await run(() => api('/api/crm/qr', 'POST', { ...f, printed_qty: Number(f.printed_qty) || 0 }), 'Đã tạo lô')) setF(empty)
    }}>
      <h2 className="text-sm font-semibold sm:col-span-6">Tạo lô QR mới</h2>
      <div><label className={labelClass}>Mã lô</label><input required className={inputClass} placeholder="SXC-FB-2611" value={f.code} onChange={e => setF({ ...f, code: e.target.value.toUpperCase() })} /></div>
      <div><label className={labelClass}>Kênh</label><select className={inputClass} value={f.channel} onChange={e => setF({ ...f, channel: e.target.value })}><option value="facebook">Facebook</option><option value="tiktok">TikTok</option><option value="shopee">Shopee</option><option value="bep">Tại bếp</option></select></div>
      <div><label className={labelClass}>Mã SP</label><input className={inputClass} placeholder="SXC" value={f.sku} onChange={e => setF({ ...f, sku: e.target.value })} /></div>
      <div><label className={labelClass}>Số thẻ in</label><input inputMode="numeric" className={inputClass} value={f.printed_qty} onChange={e => setF({ ...f, printed_qty: e.target.value.replace(/\D/g, '') })} /></div>
      <div className="sm:col-span-2"><label className={labelClass}>Lời kêu gọi (1 câu)</label><input required className={inputClass} placeholder="Quét mã — Cô Hạ tặng 21 món ăn gia đình" value={f.cta} onChange={e => setF({ ...f, cta: e.target.value })} /></div>
      <div className="flex items-center gap-2 sm:col-span-6"><button disabled={pending} className={btnClass('primary', 'sm')}>Tạo lô</button><Feedback error={error} message={message} /></div>
    </form>
  )
}

export function ClaimActions({ id, sessionId, hasOrder }: { id: number; sessionId: number; hasOrder: boolean }) {
  const { run, pending, error, message } = useAction()
  const [orderId, setOrderId] = useState('')
  return (
    <div className="flex flex-col gap-1">
      {!hasOrder && <input className="rounded border border-stone-300 px-2 py-1 text-xs" placeholder="Mã đơn Pancake để ghép" value={orderId} onChange={e => setOrderId(e.target.value)} />}
      <div className="flex flex-wrap gap-1">
        <button disabled={pending || (!hasOrder && !orderId)} className={btnClass('primary', 'sm')}
          onClick={() => run(() => api('/api/crm/qr', 'PATCH', { id, action: 'approve', order_id: orderId || undefined }), 'Đã ghép')}>Ghép đơn</button>
        <button disabled={pending} className={btnClass('danger', 'sm')}
          onClick={() => { const note = prompt('Lý do từ chối:'); if (note) run(() => api('/api/crm/qr', 'PATCH', { id, action: 'reject', note }), 'Đã từ chối') }}>Từ chối</button>
        <button disabled={pending} className={btnClass('ghost', 'sm')} title="Đã gọi đúng số, khách xác nhận"
          onClick={() => { const reason = prompt('Xác minh cả phiên (gắn mọi dữ liệu vào hồ sơ khách). Lý do:'); if (reason) run(() => api('/api/crm/qr', 'PATCH', { action: 'verify_session', session_id: sessionId, reason }), 'Đã xác minh phiên') }}>Xác minh phiên</button>
      </div>
      <Feedback error={error} message={message} />
    </div>
  )
}

export function CancelMiniOrder({ id, refCode }: { id: number; refCode: string }) {
  const { run, pending, error, message } = useAction()
  return (
    <div className="flex flex-col items-start gap-1">
      <button disabled={pending} className={btnClass('danger', 'sm')}
        onClick={() => {
          const reason = prompt(`Huỷ đơn ${refCode}? Voucher và Hạt Cốm sẽ được trả lại cho khách. Lý do:`)
          if (!reason) return
          // Dòng đơn biến mất sau khi tải lại trang, nên lời nhắc việc tay phải hiện bằng hộp thông báo
          run(async () => {
            const r = await api<{ pos_order_id: string | null; paid: boolean; voucher_restored: boolean; points_restored: number }>('/api/crm/qr', 'PATCH', { action: 'cancel_order', order_id: id, reason })
            alert([`Đã huỷ đơn ${refCode}.`,
              r.voucher_restored ? 'Đã trả voucher cho khách.' : '', r.points_restored ? `Đã trả ${r.points_restored} Hạt Cốm.` : '',
              r.pos_order_id ? `VIỆC TAY: huỷ đơn ${r.pos_order_id} trên POScake.` : 'Đơn chưa lên POScake, không cần huỷ bên đó.',
              r.paid ? 'VIỆC TAY: khách đã chuyển khoản, cần hoàn tiền.' : ''].filter(Boolean).join('\n'))
            return r
          })
        }}>Huỷ đơn</button>
      <Feedback error={error} message={message} />
    </div>
  )
}
