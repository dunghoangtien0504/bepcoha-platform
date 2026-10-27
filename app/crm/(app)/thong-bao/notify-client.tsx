'use client'
import { useState } from 'react'
import { api, useAction, btnClass, inputClass, labelClass, Feedback } from '../../_components/client'

const KINDS = { cong_thuc: 'Công thức', uu_dai: 'Ưu đãi', su_kien: 'Sự kiện', khoe_mon: 'Khoe món', he_thong: 'Hệ thống' }
const AUDIENCES = { tat_ca: 'Mọi người dùng Mini App', da_xac_minh: 'Khách đã xác minh SĐT', khach: 'Một khách cụ thể' }

export function NotificationForm() {
  const { run, pending, error, message } = useAction()
  const empty = { title: '', body: '', link: '', image: '', kind: 'cong_thuc', audience: 'tat_ca', customer_id: '', publish_at: '', expires_at: '' }
  const [f, setF] = useState(empty)
  const set = (k: keyof typeof empty) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })
  return (
    <form className="grid gap-3 sm:grid-cols-4" onSubmit={async e => {
      e.preventDefault()
      const who = AUDIENCES[f.audience as keyof typeof AUDIENCES]
      if (!confirm(`Gửi “${f.title}” tới: ${who}${f.publish_at ? ' (hẹn giờ)' : ' ngay bây giờ'}?`)) return
      if (await run(() => api('/api/crm/notifications', 'POST', f), f.publish_at ? 'Đã hẹn giờ' : 'Đã gửi vào hộp thư')) setF(empty)
    }}>
      <div className="sm:col-span-2"><label className={labelClass}>Tiêu đề</label><input required maxLength={200} className={inputClass} value={f.title} onChange={set('title')} placeholder="Công thức mới: Xôi cốm hạt sen" /></div>
      <div><label className={labelClass}>Loại</label><select className={inputClass} value={f.kind} onChange={set('kind')}>{Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
      <div><label className={labelClass}>Gửi tới</label><select className={inputClass} value={f.audience} onChange={set('audience')}>{Object.entries(AUDIENCES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
      {f.audience === 'khach' && <div><label className={labelClass}>Mã khách (số trên link hồ sơ)</label><input required inputMode="numeric" className={inputClass} value={f.customer_id} onChange={e => setF({ ...f, customer_id: e.target.value.replace(/\D/g, '') })} /></div>}
      <div className="sm:col-span-4"><label className={labelClass}>Nội dung</label><textarea rows={3} maxLength={2000} className={inputClass} value={f.body} onChange={set('body')} /></div>
      <div><label className={labelClass}>Link trong app (VD /cong-thuc/xoi-com)</label><input className={inputClass} value={f.link} onChange={e => setF({ ...f, link: e.target.value.trim().toLowerCase() })} /></div>
      <div><label className={labelClass}>Ảnh (/images/... hoặc https://)</label><input className={inputClass} value={f.image} onChange={set('image')} /></div>
      <div><label className={labelClass}>Hẹn giờ gửi (trống = ngay)</label><input type="datetime-local" className={inputClass} value={f.publish_at} onChange={set('publish_at')} /></div>
      <div><label className={labelClass}>Hết hạn (tuỳ chọn)</label><input type="datetime-local" className={inputClass} value={f.expires_at} onChange={set('expires_at')} /></div>
      <div className="flex items-center gap-2 sm:col-span-4"><button disabled={pending} className={btnClass('primary', 'sm')}>Gửi</button><Feedback error={error} message={message} /></div>
    </form>
  )
}

export function ExpireButton({ id }: { id: number }) {
  const { run, pending, error } = useAction()
  return (
    <span className="inline-flex flex-col items-start">
      <button disabled={pending} className={btnClass('ghost', 'sm')} onClick={() => { if (confirm('Thu hồi thông báo này? Khách sẽ không thấy nữa.')) run(() => api('/api/crm/notifications', 'PATCH', { id, action: 'expire' })) }}>Thu hồi</button>
      {error && <span className="text-xs text-rose-600">{error}</span>}
    </span>
  )
}
