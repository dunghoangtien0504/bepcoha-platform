'use client'
// Màn quản trị Sân chơi: thủ kho quét voucher (camera điện thoại hoặc gõ mã), Cấp / Bỏ lượt có chốt chặn.
import { useEffect, useRef, useState } from 'react'
import { api, useAction, btnClass, Feedback, inputClass, labelClass } from '../../_components/client'
import { useClientValue } from '../../_components/use-stored'

interface Used { code: string; amount: number; staff_name: string }

/** Quét mã vạch bằng camera (BarcodeDetector có trên Chrome Android/máy tính); máy không hỗ trợ thì gõ mã. */
export function KhoScanner({ inWindow, window: win, boss }: { inWindow: boolean; window: string; boss: boolean }) {
  const { run, pending, error, message, setError } = useAction()
  const [code, setCode] = useState('')
  const [note, setNote] = useState('')
  const [cam, setCam] = useState(false)
  const [last, setLast] = useState<Used | null>(null)
  const video = useRef<HTMLVideoElement>(null)
  const supported = useClientValue(() => 'BarcodeDetector' in window, false)

  useEffect(() => {
    if (!cam) return
    let stream: MediaStream | null = null, stop = false
    ;(async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        if (!video.current) return
        video.current.srcObject = stream; await video.current.play()
        // @ts-expect-error BarcodeDetector chưa có trong kiểu DOM chuẩn
        const det = new window.BarcodeDetector({ formats: ['code_128', 'qr_code'] })
        while (!stop) {
          const found = await det.detect(video.current).catch(() => [])
          if (found[0]?.rawValue) { setCode(String(found[0].rawValue)); setCam(false); break }
          await new Promise(r => setTimeout(r, 250))
        }
      } catch { setError('Không mở được camera. Gõ mã voucher bên dưới.'); setCam(false) }
    })()
    return () => { stop = true; stream?.getTracks().forEach(t => t.stop()) }
  }, [cam, setError])

  return (
    <div className="space-y-3">
      {!inWindow && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">Ngoài giờ nhận voucher ({win}).{boss ? ' Bạn là quản trị nên vẫn nhận được.' : ' Hẹn người đổi quay lại trong khung giờ.'}</p>}
      {cam && <video ref={video} className="aspect-video w-full rounded-xl bg-black object-cover" muted playsInline />}
      {supported && <button type="button" onClick={() => setCam(!cam)} className={`${btnClass(cam ? 'secondary' : 'primary')} w-full py-3 text-base`}>{cam ? 'Tắt camera' : '📷 Quét mã bằng camera'}</button>}
      <div><label className={labelClass}>Mã voucher</label>
        <input className={`${inputClass} py-3 font-mono text-lg uppercase tracking-widest`} value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="HV20K-XXXXX" /></div>
      <div><label className={labelClass}>Hàng đã xuất (ghi ngắn)</label>
        <input className={inputClass} value={note} onChange={e => setNote(e.target.value)} placeholder="VD: 1 hộp cốm 200g" /></div>
      <button type="button" disabled={pending || !code.trim()} className={`${btnClass('primary')} w-full py-3 text-base`}
        onClick={() => run(() => api<Used>('/api/crm/san-choi/kho', 'POST', { code, note })).then(r => { if (r) { setLast(r); setCode(''); setNote('') } })}>Nhận voucher</button>
      <Feedback error={error} message={message} />
      {last && <div className="rounded-xl border-2 border-emerald-300 bg-emerald-50 p-3 text-center"><div className="text-sm text-emerald-800">Đã nhận voucher của <b>{last.staff_name}</b></div>
        <div className="text-2xl font-extrabold text-emerald-800">{last.amount.toLocaleString('vi-VN')}đ</div><div className="font-mono text-xs text-emerald-700">{last.code}</div></div>}
    </div>
  )
}

export function GrantForm({ staff, reasons, mode }: { staff: { id: number; name: string }[]; reasons: Record<string, string>; mode: 'cap' | 'bo' }) {
  const { run, pending, error, message } = useAction()
  const keys = Object.keys(reasons).filter(k => (mode === 'bo') === (k === 'thu_hoi_sai' || k === 'vi_pham'))
  const [f, setF] = useState({ staff_id: '', tokens: '1', reason: keys[0], note: '' })
  return (
    <form className="space-y-3" onSubmit={e => { e.preventDefault(); run(() => api('/api/crm/san-choi/cap-luot', 'POST', { action: mode, ...f, tokens: Number(f.tokens) }), mode === 'cap' ? 'Đã ghi nhận' : 'Đã thu hồi').then(r => { if (r) setF({ ...f, note: '' }) }) }}>
      <div className="grid gap-3 sm:grid-cols-3">
        <div><label className={labelClass}>Người nhận</label>
          <select required className={inputClass} value={f.staff_id} onChange={e => setF({ ...f, staff_id: e.target.value })}>
            <option value="">— Chọn —</option>{staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
        <div><label className={labelClass}>Số lượt</label><input inputMode="numeric" className={inputClass} value={f.tokens} onChange={e => setF({ ...f, tokens: e.target.value.replace(/\D/g, '') })} /></div>
        <div><label className={labelClass}>Lý do</label>
          <select className={inputClass} value={f.reason} onChange={e => setF({ ...f, reason: e.target.value })}>{keys.map(k => <option key={k} value={k}>{reasons[k]}</option>)}</select></div>
      </div>
      <div><label className={labelClass}>Ghi chú cụ thể (bắt buộc)</label><input required className={inputClass} value={f.note} onChange={e => setF({ ...f, note: e.target.value })}
        placeholder={mode === 'cap' ? 'VD: bù ca 25/10, máy chấm công lỗi' : 'VD: tick khống checklist ca 26/10'} /></div>
      <button disabled={pending || !f.staff_id} className={btnClass(mode === 'cap' ? 'primary' : 'danger')}>{mode === 'cap' ? 'Cấp lượt' : 'Thu hồi lượt chưa quay'}</button>
      <Feedback error={error} message={message} />
    </form>
  )
}

export function GrantReview({ id }: { id: number }) {
  const { run, pending, error } = useAction()
  return (
    <span className="inline-flex flex-col gap-1">
      <span className="flex gap-1">
        <button disabled={pending} className={btnClass('primary', 'sm')} onClick={() => run(() => api('/api/crm/san-choi/cap-luot', 'POST', { action: 'duyet', id }))}>Duyệt</button>
        <button disabled={pending} className={btnClass('danger', 'sm')} onClick={() => run(() => api('/api/crm/san-choi/cap-luot', 'POST', { action: 'tu_choi', id }))}>Từ chối</button>
      </span>
      {error && <span className="text-xs text-rose-600">{error}</span>}
    </span>
  )
}
