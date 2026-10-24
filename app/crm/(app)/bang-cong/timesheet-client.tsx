'use client'
import { useState } from 'react'
import { api, useAction, btnClass, inputClass, labelClass, Feedback } from '../../_components/client'

export function ManualPunch({ staffId, assignments }: { staffId: number; assignments: { id: number; label: string }[] }) {
  const { run, pending, error, message } = useAction()
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ assignment_id: '', kind: 'vao', at: '', reason: '' })
  if (!open) return (
    <span className="flex gap-2">
      <button className={btnClass('secondary', 'sm')} onClick={() => setOpen(true)}>Sửa công tay</button>
      <button className={btnClass('ghost', 'sm')} disabled={pending} onClick={() => {
        const reason = prompt('Lý do đặt lại máy chấm công (VD: nhân viên đổi điện thoại):')
        if (reason) run(() => api('/api/crm/attendance', 'PATCH', { action: 'reset_device', staff_id: staffId, reason }), 'Đã đặt lại — lần chấm tới sẽ đăng ký máy mới')
      }}>Đặt lại máy</button>
      <Feedback error={error} message={message} />
    </span>
  )
  return (
    <form className="grid w-full gap-2 sm:grid-cols-5" onSubmit={async e => {
      e.preventDefault()
      if (await run(() => api('/api/crm/attendance', 'PATCH', { staff_id: staffId, ...f, at: new Date(f.at).toISOString(), assignment_id: f.assignment_id || null }), 'Đã thêm lượt chấm')) setOpen(false)
    }}>
      <div><label className={labelClass}>Ca</label><select className={inputClass} value={f.assignment_id} onChange={e => setF({ ...f, assignment_id: e.target.value })}><option value="">—</option>{assignments.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}</select></div>
      <div><label className={labelClass}>Loại</label><select className={inputClass} value={f.kind} onChange={e => setF({ ...f, kind: e.target.value })}><option value="vao">Vào</option><option value="ra">Ra</option></select></div>
      <div><label className={labelClass}>Thời điểm</label><input required type="datetime-local" className={inputClass} value={f.at} onChange={e => setF({ ...f, at: e.target.value })} /></div>
      <div className="sm:col-span-2"><label className={labelClass}>Lý do (bắt buộc)</label><input required className={inputClass} value={f.reason} onChange={e => setF({ ...f, reason: e.target.value })} /></div>
      <div className="flex gap-2 sm:col-span-5"><button disabled={pending} className={btnClass('primary', 'sm')}>Lưu</button><button type="button" className={btnClass('ghost', 'sm')} onClick={() => setOpen(false)}>Huỷ</button><Feedback error={error} message={message} /></div>
    </form>
  )
}
