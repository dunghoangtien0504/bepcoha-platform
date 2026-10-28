'use client'
import { useState } from 'react'
import Link from 'next/link'
import { api, useAction, btnClass, Feedback } from '../../_components/client'
import { ComSays, type ComMood } from '../san-choi/mascot'

interface Mascot { mood: ComMood; line: string; newTokens: number; streak: number; level: string; levelIcon: string; playing: boolean }

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

export function PunchPanel({ shifts, siteName, openTasks = 0, streak = 0 }: { shifts: Shift[]; siteName: string | null; openTasks?: number; streak?: number }) {
  const { run, pending, error, message } = useAction()
  const [locating, setLocating] = useState(false)
  const [mascot, setMascot] = useState<Mascot | null>(null)
  const current = shifts[0]
  const nextKind: 'vao' | 'ra' = current?.inAt && !current?.outAt ? 'ra' : 'vao'

  async function doPunch(kind: 'vao' | 'ra') {
    // Ra ca mà còn việc dở thì nhắc (Buổi 2 · linh vật "mắng" khi check-out còn việc)
    if (kind === 'ra' && openTasks > 0 && !confirm(`Bạn còn ${openTasks} việc hôm nay chưa xong. Vẫn ra ca?`)) return
    setLocating(true)
    const pos = await getPosition()
    setLocating(false)
    setMascot(null)
    const ok = await run(() => api<{ message: string }>('/api/crm/attendance', 'POST', {
      kind, lat: pos?.coords.latitude, lng: pos?.coords.longitude, accuracy: pos?.coords.accuracy, device_id: deviceId(),
    }), r => r.message)
    // Sân chơi: linh vật Cốm khen/nhắc ngay sau khi chấm (B2 K17). Lỗi ở đây không ảnh hưởng lượt chấm.
    if (ok) api<Mascot>('/api/crm/san-choi/sau-cham', 'POST', { kind, streak_before: streak }).then(setMascot).catch(() => {})
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
      {mascot && (
        <div className="mt-4 text-left">
          <ComSays mood={mascot.mood} line={mascot.line} size={64}>
            {mascot.playing && (
              <span className="mt-1 block text-xs font-normal text-lime-900/80">
                {mascot.levelIcon} {mascot.level} · chuỗi {mascot.streak} ca
                {mascot.newTokens > 0 && <> · <Link href="/crm/san-choi" className="font-semibold text-emerald-800 underline">+{mascot.newTokens} lượt quay — quay ngay</Link></>}
              </span>
            )}
          </ComSays>
        </div>
      )}
    </div>
  )
}
