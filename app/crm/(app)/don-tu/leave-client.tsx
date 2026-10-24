'use client'
import { useState } from 'react'
import { api, useAction, btnClass, inputClass, labelClass, Feedback } from '../../_components/client'
import { todayVN } from '@/lib/crm/format'

export function LeaveForm({ kinds }: { kinds: Record<string, string> }) {
  const { run, pending, error, message } = useAction()
  const empty = { kind: 'nghi_phep', from_date: todayVN(), to_date: todayVN(), minutes: '', reason: '' }
  const [f, setF] = useState(empty)
  const needMinutes = f.kind === 'di_muon_ve_som' || f.kind === 'tang_ca'
  return (
    <form className="space-y-3" onSubmit={async e => {
      e.preventDefault()
      if (await run(() => api('/api/crm/leave', 'POST', { ...f, minutes: needMinutes ? Number(f.minutes) || null : null }), 'Đã gửi đơn')) setF(empty)
    }}>
      <div><label className={labelClass}>Loại đơn</label>
        <select className={inputClass} value={f.kind} onChange={e => setF({ ...f, kind: e.target.value })}>{Object.entries(kinds).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
      <div className="grid grid-cols-2 gap-2">
        <div><label className={labelClass}>Từ ngày</label><input type="date" className={inputClass} value={f.from_date} onChange={e => setF({ ...f, from_date: e.target.value, to_date: e.target.value > f.to_date ? e.target.value : f.to_date })} /></div>
        <div><label className={labelClass}>Đến ngày</label><input type="date" className={inputClass} value={f.to_date} min={f.from_date} onChange={e => setF({ ...f, to_date: e.target.value })} /></div>
      </div>
      {needMinutes && <div><label className={labelClass}>Số phút</label><input inputMode="numeric" className={inputClass} value={f.minutes} onChange={e => setF({ ...f, minutes: e.target.value.replace(/\D/g, '') })} /></div>}
      <div><label className={labelClass}>Lý do</label><textarea required rows={3} className={inputClass} value={f.reason} onChange={e => setF({ ...f, reason: e.target.value })} /></div>
      <button disabled={pending} className={btnClass('primary')}>Gửi đơn</button>
      <Feedback error={error} message={message} />
    </form>
  )
}

export function LeaveActions({ id, mode }: { id: number; mode: 'review' | 'cancel' }) {
  const { run, pending, error } = useAction()
  if (mode === 'cancel') return <button disabled={pending} className={btnClass('ghost', 'sm')} onClick={() => run(() => api('/api/crm/leave', 'PATCH', { id, action: 'cancel' }))}>Huỷ đơn</button>
  return (
    <span className="flex flex-col gap-1">
      <span className="flex gap-1">
        <button disabled={pending} className={btnClass('primary', 'sm')} onClick={() => run(() => api('/api/crm/leave', 'PATCH', { id, action: 'approve' }))}>Duyệt</button>
        <button disabled={pending} className={btnClass('danger', 'sm')} onClick={() => { const note = prompt('Lý do từ chối:'); if (note) run(() => api('/api/crm/leave', 'PATCH', { id, action: 'reject', note })) }}>Từ chối</button>
      </span>
      <Feedback error={error} />
    </span>
  )
}
