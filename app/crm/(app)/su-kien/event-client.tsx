'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, useAction, btnClass, inputClass, labelClass, Feedback } from '../../_components/client'

const KINDS = { livestream: 'Livestream', workshop: 'Workshop', thu_thach: 'Thử thách', uu_dai: 'Ưu đãi', le_tet: 'Lễ Tết', khac: 'Khác' }

export interface EventFormValue {
  id?: number; title: string; slug: string; kind: string; starts_at: string; ends_at: string; location: string
  capacity: string; image: string; join_url: string; summary: string; body: string
}

export const EMPTY_EVENT: EventFormValue = { title: '', slug: '', kind: 'livestream', starts_at: '', ends_at: '', location: '', capacity: '', image: '', join_url: '', summary: '', body: '' }

export function EventForm({ initial, published }: { initial: EventFormValue; published?: boolean }) {
  const router = useRouter()
  const { run, pending, error, message } = useAction()
  const [f, setF] = useState(initial)
  const set = (k: keyof EventFormValue) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })
  return (
    <form className="grid gap-3 sm:grid-cols-4" onSubmit={async e => {
      e.preventDefault()
      const r = await run(() => api<{ id?: number }>('/api/crm/events', f.id ? 'PATCH' : 'POST', f), f.id ? 'Đã lưu' : 'Đã tạo bản nháp')
      if (r && !f.id && r.id) router.push(`/crm/su-kien/${r.id}`)
    }}>
      <div className="sm:col-span-2"><label className={labelClass}>Tên sự kiện</label><input required className={inputClass} value={f.title} onChange={set('title')} placeholder="Livestream gói bánh chưng cùng Cô Hạ" /></div>
      <div><label className={labelClass}>Loại</label><select className={inputClass} value={f.kind} onChange={set('kind')}>{Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
      <div><label className={labelClass}>Đường dẫn (để trống = tự tạo)</label><input className={inputClass} value={f.slug} onChange={set('slug')} disabled={published} placeholder="banh-chung-tet" /></div>
      <div><label className={labelClass}>Bắt đầu</label><input required type="datetime-local" className={inputClass} value={f.starts_at} onChange={set('starts_at')} /></div>
      <div><label className={labelClass}>Kết thúc (tuỳ chọn)</label><input type="datetime-local" className={inputClass} value={f.ends_at} onChange={set('ends_at')} /></div>
      <div><label className={labelClass}>Địa điểm (trống = online)</label><input className={inputClass} value={f.location} onChange={set('location')} /></div>
      <div><label className={labelClass}>Số chỗ (trống = không giữ chỗ)</label><input inputMode="numeric" className={inputClass} value={f.capacity} onChange={e => setF({ ...f, capacity: e.target.value.replace(/\D/g, '') })} /></div>
      <div className="sm:col-span-2"><label className={labelClass}>Ảnh (/images/... hoặc https://)</label><input className={inputClass} value={f.image} onChange={set('image')} /></div>
      <div className="sm:col-span-2"><label className={labelClass}>Link tham gia (https://)</label><input className={inputClass} value={f.join_url} onChange={set('join_url')} placeholder="https://zalo.me/…" />
        {f.join_url && !/^https:\/\/zalo\.me\//.test(f.join_url) && <p className="mt-1 text-xs text-amber-700">Bản Zalo Mini App chỉ nên dẫn tới link zalo.me (chính sách Zalo 4.1).</p>}</div>
      <div className="sm:col-span-4"><label className={labelClass}>Tóm tắt (hiện trên thẻ và trong thông báo)</label><input className={inputClass} maxLength={500} value={f.summary} onChange={set('summary')} /></div>
      <div className="sm:col-span-4"><label className={labelClass}>Nội dung</label><textarea rows={6} className={inputClass} value={f.body} onChange={set('body')} /></div>
      <div className="flex items-center gap-2 sm:col-span-4"><button disabled={pending} className={btnClass('primary', 'sm')}>{f.id ? 'Lưu thay đổi' : 'Tạo bản nháp'}</button><Feedback error={error} message={message} /></div>
    </form>
  )
}

export function EventStatusActions({ id, status, hasNotification }: { id: number; status: string; hasNotification: boolean }) {
  const { run, pending, error, message } = useAction()
  const [notify, setNotify] = useState(!hasNotification)
  const go = (body: Record<string, unknown>, done: string) => run(() => api('/api/crm/events', 'PATCH', { id, action: 'status', ...body }), done)
  return (
    <div className="flex flex-wrap items-center gap-2">
      {status !== 'cong_bo' && <>
        {!hasNotification && <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={notify} onChange={e => setNotify(e.target.checked)} />Gửi thông báo cho mọi người</label>}
        <button disabled={pending} className={btnClass('primary', 'sm')} onClick={() => go({ status: 'cong_bo', notify }, 'Đã công bố')}>Công bố</button>
      </>}
      {status === 'cong_bo' && <button disabled={pending} className={btnClass('secondary', 'sm')} onClick={() => go({ status: 'nhap' }, 'Đã chuyển về nháp')}>Ẩn (về nháp)</button>}
      {status !== 'huy' && <button disabled={pending} className={btnClass('danger', 'sm')} onClick={() => {
        const reason = prompt('Huỷ sự kiện. Khách đã giữ chỗ cần được báo. Lý do:'); if (reason) go({ status: 'huy', reason }, 'Đã huỷ')
      }}>Huỷ sự kiện</button>}
      <Feedback error={error} message={message} />
    </div>
  )
}
