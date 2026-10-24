'use client'
import { useState } from 'react'
import { api, useAction, btnClass, inputClass, labelClass, Feedback } from '../../../_components/client'
import { CUSTOMER_STAGE_LABEL, SEGMENT_LABEL } from '@/lib/crm/labels'

interface Editable { id: number; stage: string; segments: string[]; assigned_staff_id: number | null; internal_note: string; stars: number | null; birthday: string; opted_out: boolean }

export function CustomerEditor({ customer, staff, isAdmin }: { customer: Editable; staff: { id: number; name: string }[]; isAdmin: boolean }) {
  const { run, pending, error, message } = useAction()
  const [f, setF] = useState(customer)
  const save = () => run(() => api(`/api/crm/customers/${customer.id}`, 'PATCH', {
    stage: f.stage, segments: f.segments, assigned_staff_id: f.assigned_staff_id, internal_note: f.internal_note, stars: f.stars, birthday: f.birthday || null,
  }), 'Đã lưu')
  return (
    <div className="space-y-3 text-sm">
      <div><label className={labelClass}>Giai đoạn</label>
        <select className={inputClass} value={f.stage} onChange={e => setF({ ...f, stage: e.target.value })}>
          {Object.entries(CUSTOMER_STAGE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select></div>
      <div><label className={labelClass}>Nhóm (khách có thể nhiều nhóm)</label>
        <div className="flex flex-wrap gap-2">
          {Object.entries(SEGMENT_LABEL).map(([k, v]) => (
            <label key={k} className="flex items-center gap-1 text-xs"><input type="checkbox" checked={f.segments.includes(k)}
              onChange={e => setF({ ...f, segments: e.target.checked ? [...f.segments, k] : f.segments.filter(x => x !== k) })} />{v}</label>
          ))}
        </div></div>
      <div><label className={labelClass}>Người phụ trách</label>
        <select className={inputClass} value={f.assigned_staff_id ?? ''} onChange={e => setF({ ...f, assigned_staff_id: e.target.value ? Number(e.target.value) : null })}>
          <option value="">— chưa có —</option>{staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select></div>
      <div className="grid grid-cols-2 gap-2">
        <div><label className={labelClass}>Chấm sao (độ tiềm năng)</label>
          <select className={inputClass} value={f.stars ?? ''} onChange={e => setF({ ...f, stars: e.target.value ? Number(e.target.value) : null })}>
            <option value="">—</option>{[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{'★'.repeat(n)}</option>)}
          </select></div>
        <div><label className={labelClass}>Sinh nhật</label><input type="date" className={inputClass} value={f.birthday} onChange={e => setF({ ...f, birthday: e.target.value })} /></div>
      </div>
      <div><label className={labelClass}>Ghi chú nội bộ</label><textarea rows={3} className={inputClass} value={f.internal_note} onChange={e => setF({ ...f, internal_note: e.target.value })} /></div>
      <button disabled={pending} className={btnClass('primary', 'sm')} onClick={save}>Lưu</button>
      <div className="border-t border-stone-100 pt-3">
        {!customer.opted_out ? (
          <button disabled={pending} className={btnClass('danger', 'sm')}
            onClick={() => { if (confirm('Khách không muốn nhận tin nữa? Mọi luồng sẽ dừng liên hệ chủ động.')) run(() => api(`/api/crm/customers/${customer.id}`, 'PATCH', { opted_out: true }), 'Đã đánh dấu') }}>
            Khách từ chối nhận tin</button>
        ) : isAdmin ? (
          <button disabled={pending} className={btnClass('secondary', 'sm')}
            onClick={() => { const r = prompt('Lý do gỡ cờ (vd: khách chủ động nhắn lại xin nhận tin):'); if (r) run(() => api(`/api/crm/customers/${customer.id}`, 'PATCH', { opted_out: false, reason: r }), 'Đã gỡ cờ') }}>
            Gỡ cờ từ chối (quản trị)</button>
        ) : <p className="text-xs text-stone-500">Khách đã từ chối nhận tin. Chỉ quản trị gỡ được.</p>}
      </div>
      <Feedback error={error} message={message} />
    </div>
  )
}

export function ActivityForm({ customerId }: { customerId: number }) {
  const { run, pending, error } = useAction()
  const [kind, setKind] = useState('ghi_chu')
  const [content, setContent] = useState('')
  return (
    <form className="flex flex-col gap-2 sm:flex-row" onSubmit={async e => {
      e.preventDefault()
      if (await run(() => api(`/api/crm/customers/${customerId}`, 'POST', { kind, content }))) setContent('')
    }}>
      <select className="rounded-lg border border-stone-300 px-2 py-2 text-sm" value={kind} onChange={e => setKind(e.target.value)}>
        <option value="ghi_chu">Ghi chú</option><option value="goi_dien">Đã gọi điện</option><option value="nhan_tin">Đã nhắn tin</option><option value="gap_truc_tiep">Gặp trực tiếp</option>
      </select>
      <input className={inputClass} placeholder="Khách nói gì, hẹn gì…" value={content} onChange={e => setContent(e.target.value)} />
      <button disabled={pending || !content} className={btnClass('primary', 'sm')}>Ghi</button>
      <Feedback error={error} />
    </form>
  )
}

export function NewOpportunity({ customerId }: { customerId: number }) {
  const { run, pending, error } = useAction()
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ title: '', pipeline: 'khoa_offline', value: '' })
  if (!open) return <button className="text-sm font-medium text-emerald-700" onClick={() => setOpen(true)}>+ Thêm</button>
  return (
    <form className="mt-2 w-full space-y-2" onSubmit={async e => {
      e.preventDefault()
      if (await run(() => api('/api/crm/opportunities', 'POST', { customer_id: customerId, ...f, value: Number(f.value) || 0 }))) setOpen(false)
    }}>
      <input required className={inputClass} placeholder="VD: Khoá offline tháng 11" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} />
      <select className={inputClass} value={f.pipeline} onChange={e => setF({ ...f, pipeline: e.target.value })}>
        <option value="khoa_offline">Khoá offline</option><option value="khoa_online">Khoá online</option><option value="si">Khách sỉ</option><option value="setup_quan">Setup quán</option>
      </select>
      <input className={inputClass} inputMode="numeric" placeholder="Giá trị dự kiến (đ)" value={f.value} onChange={e => setF({ ...f, value: e.target.value.replace(/\D/g, '') })} />
      <div className="flex gap-2"><button disabled={pending} className={btnClass('primary', 'sm')}>Tạo</button><button type="button" className={btnClass('ghost', 'sm')} onClick={() => setOpen(false)}>Huỷ</button></div>
      <Feedback error={error} />
    </form>
  )
}
