'use client'
import { useState } from 'react'
import { api, useAction, btnClass, Feedback } from '../../_components/client'

interface Shift { id: number; name: string; start: string; end: string; inAt: string | null; outAt: string | null }

function deviceId(): string {
  try {
    let id = localStorage.getItem('haco_device')
    if (!id) { id = crypto.randomUUID(); localStorage.setItem('haco_device', id) }
    return id
  } catch { return '' }
}

function getPosition(): Promise<GeolocationPosition | null> {
  return new Promise(resolve => {
    if (!('geolocation' in navigator)) return resolve(null)
    navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 })
  })
}

export function PunchPanel({ shifts, siteName }: { shifts: Shift[]; siteName: string | null }) {
  const { run, pending, error, message } = useAction()
  const [locating, setLocating] = useState(false)
  const current = shifts[0]
  const nextKind: 'vao' | 'ra' = current?.inAt && !current?.outAt ? 'ra' : 'vao'

  async function doPunch(kind: 'vao' | 'ra') {
    setLocating(true)
    const pos = await getPosition()
    setLocating(false)
    await run(() => api<{ message: string }>('/api/crm/attendance', 'POST', {
      kind, lat: pos?.coords.latitude, lng: pos?.coords.longitude, accuracy: pos?.coords.accuracy, device_id: deviceId(),
    }), r => r.message)
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 text-center shadow-sm">
      <div className="text-xs text-stone-500">{siteName ?? 'Điểm làm việc'}</div>
      {current ? (
        <div className="mt-1 text-sm"><b>{current.name}</b> · {current.start}–{current.end}</div>
      ) : <div className="mt-1 text-sm text-stone-500">Hôm nay bạn không có ca (vẫn chấm được nếu đi làm bù/tăng ca).</div>}
      <div className="my-4 text-4xl font-semibold tabular-nums text-stone-800" suppressHydrationWarning>
        {new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' })}
      </div>
      <div className="flex justify-center gap-2">
        <button disabled={pending || locating} onClick={() => doPunch('vao')}
          className={`${btnClass(nextKind === 'vao' ? 'primary' : 'secondary')} min-w-28 py-3 text-base`}>Vào ca</button>
        <button disabled={pending || locating} onClick={() => doPunch('ra')}
          className={`${btnClass(nextKind === 'ra' ? 'primary' : 'secondary')} min-w-28 py-3 text-base`}>Ra ca</button>
      </div>
      {locating && <p className="mt-3 text-sm text-stone-500">Đang lấy vị trí…</p>}
      {current && <p className="mt-3 text-xs text-stone-500">Vào: {current.inAt ?? '—'} · Ra: {current.outAt ?? '—'}</p>}
      <div className="mt-3"><Feedback error={error} message={message} /></div>
    </div>
  )
}
