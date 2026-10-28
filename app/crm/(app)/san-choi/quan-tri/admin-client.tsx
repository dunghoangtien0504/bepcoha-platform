'use client'
import { useState } from 'react'
import { api, useAction, btnClass, Feedback, inputClass, labelClass } from '../../../_components/client'

const URL = '/api/crm/san-choi/quan-tri'

export function ReviewButtons({ id, self }: { id: number; self: boolean }) {
  const { run, pending, error } = useAction()
  if (self) return <span className="text-xs text-stone-400">Người khác duyệt</span>
  return (
    <span className="inline-flex flex-col gap-1">
      <span className="flex gap-1">
        <button disabled={pending} className={btnClass('primary', 'sm')} onClick={() => run(() => api(URL, 'POST', { action: 'duyet_doi', id, approve: true }))}>Duyệt</button>
        <button disabled={pending} className={btnClass('danger', 'sm')} onClick={() => {
          const note = prompt('Lý do từ chối?')
          if (note) run(() => api(URL, 'POST', { action: 'duyet_doi', id, approve: false, note }))
        }}>Từ chối</button>
      </span>
      {error && <span className="text-xs text-rose-600">{error}</span>}
    </span>
  )
}

interface Settings { monthly_budget: number; weekly_budget: number; departments: string[]; kudos_per_manager_month: number; kudos_per_receiver_month: number }

export function SettingsForm({ settings, departments }: { settings: Settings; departments: { key: string; label: string }[] }) {
  const { run, pending, error, message } = useAction()
  const [f, setF] = useState(settings)
  const num = (k: keyof Settings, label: string) => (
    <div><label className={labelClass}>{label}</label>
      <input inputMode="numeric" className={inputClass} value={String(f[k])} onChange={e => setF({ ...f, [k]: Number(e.target.value.replace(/\D/g, '')) || 0 })} /></div>
  )
  return (
    <form className="space-y-3" onSubmit={e => { e.preventDefault(); run(() => api(URL, 'POST', { action: 'cai_dat', ...f }), 'Đã lưu') }}>
      <div className="grid gap-3 sm:grid-cols-2">
        {num('monthly_budget', 'Trần tiền thưởng / tháng (đ)')}
        {num('weekly_budget', 'Mở mỗi tuần (đ)')}
        {num('kudos_per_manager_month', 'Lượt thưởng nóng / quản lý / tháng')}
        {num('kudos_per_receiver_month', 'Lượt thưởng nóng / người nhận / tháng')}
      </div>
      <div>
        <div className={labelClass}>Bộ phận đang chơi</div>
        <div className="flex flex-wrap gap-2">
          {departments.map(d => {
            const on = f.departments.includes(d.key)
            return (
              <button type="button" key={d.key} onClick={() => setF({ ...f, departments: on ? f.departments.filter(x => x !== d.key) : [...f.departments, d.key] })}
                className={`rounded-full px-3 py-1 text-sm ${on ? 'bg-emerald-700 text-white' : 'bg-white ring-1 ring-stone-300'}`}>{d.label}</button>
            )
          })}
        </div>
      </div>
      <button disabled={pending} className={btnClass('primary')}>Lưu</button>
      <Feedback error={error} message={message} />
    </form>
  )
}

export function PrizeRow({ prize, total }: { prize: { id: number; label: string; weight: number; active: boolean }; total: number }) {
  const { run, pending, error } = useAction()
  const [w, setW] = useState(String(prize.weight))
  const [on, setOn] = useState(prize.active)
  const dirty = w !== String(prize.weight) || on !== prize.active
  return (
    <tr>
      <td className="px-3 py-2 text-sm font-medium">{prize.label}</td>
      <td className="px-3 py-2 text-sm">
        <input inputMode="numeric" className="w-16 rounded border border-stone-300 px-2 py-1 text-sm" value={w} onChange={e => setW(e.target.value.replace(/\D/g, ''))} />
        <span className="ml-2 text-xs text-stone-500">{prize.active && total ? (prize.weight / total * 100).toFixed(1) + '%' : '—'}</span>
      </td>
      <td className="px-3 py-2"><input type="checkbox" checked={on} onChange={e => setOn(e.target.checked)} /></td>
      <td className="px-3 py-2">
        {dirty && <button disabled={pending} className={btnClass('primary', 'sm')} onClick={() => run(() => api(URL, 'POST', { action: 'o_qua', id: prize.id, weight: Number(w), active: on }))}>Lưu</button>}
        {error && <div className="text-xs text-rose-600">{error}</div>}
      </td>
    </tr>
  )
}
