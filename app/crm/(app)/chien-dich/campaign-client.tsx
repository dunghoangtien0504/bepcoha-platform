'use client'
import { useState } from 'react'
import { api, useAction, btnClass, inputClass, labelClass, Feedback } from '../../_components/client'

const FIELDS: [string, string][] = [
  ['minDaysSinceLastOrder', 'Im lặng ít nhất (ngày)'], ['maxDaysSinceLastOrder', 'Nhưng chưa quá (ngày)'],
  ['minOrders', 'Số lần mua từ'], ['maxOrders', 'đến'], ['holdoutPct', '% nhóm đối chứng (10–50)'], ['cap', 'Tối đa số khách'],
]

export function NewCampaign() {
  const { run, pending, error, message } = useAction()
  const [name, setName] = useState('')
  const [goal, setGoal] = useState('repeat')
  const [c, setC] = useState<Record<string, string>>({ minDaysSinceLastOrder: '120', maxDaysSinceLastOrder: '365', minOrders: '1', maxOrders: '3', holdoutPct: '20', cap: '500' })
  const [preview, setPreview] = useState<{ count: number; expectedHoldout: number } | null>(null)
  const criteria = { goal, ...Object.fromEntries(Object.entries(c).map(([k, v]) => [k, Number(v)])) }
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold">Tạo chiến dịch mới</h2>
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="sm:col-span-2"><label className={labelClass}>Tên</label><input className={inputClass} value={name} onChange={e => setName(e.target.value)} placeholder="VD: Đánh thức khách Tết trước 1/12" /></div>
        <div className="sm:col-span-2"><label className={labelClass}>Mục tiêu</label>
          <select className={inputClass} value={goal} onChange={e => setGoal(e.target.value)}><option value="repeat">Mua lại sản phẩm</option><option value="course">Mời sang khoá học</option></select></div>
        {FIELDS.map(([k, l]) => (
          <div key={k}><label className={labelClass}>{l}</label><input inputMode="numeric" className={inputClass} value={c[k]} onChange={e => { setPreview(null); setC({ ...c, [k]: e.target.value.replace(/\D/g, '') }) }} /></div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button disabled={pending} className={btnClass('secondary', 'sm')}
          onClick={async () => { const r = await run(() => api<{ count: number; expectedHoldout: number }>('/api/crm/campaigns', 'POST', { action: 'preview', criteria })); if (r) setPreview(r) }}>Xem trước</button>
        {preview && <span className="text-sm">{preview.count} khách khớp → khoảng {preview.expectedHoldout} vào nhóm đối chứng</span>}
        <button disabled={pending || !preview || !preview.count || !name} className={btnClass('primary', 'sm')}
          onClick={() => run(() => api<{ treatment: number; holdout: number }>('/api/crm/campaigns', 'POST', { action: 'create', name, criteria }), r => `Đã tạo: ${r.treatment} liên hệ, ${r.holdout} đối chứng`)}>Tạo chiến dịch</button>
      </div>
      <div className="mt-2"><Feedback error={error} message={message} /></div>
    </div>
  )
}

export function CampaignActions({ id, canCreate, canExport }: { id: number; canCreate: boolean; canExport: boolean }) {
  const { run, pending, error, message } = useAction()
  const [suggestion, setSuggestion] = useState('')
  return (
    <div className="mt-3 space-y-2 border-t border-stone-100 pt-3">
      {canCreate && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <input className={inputClass} placeholder="Gợi ý cho nhân viên: ưu đãi, câu mở đầu…" value={suggestion} onChange={e => setSuggestion(e.target.value)} />
          <button disabled={pending || !suggestion} className={btnClass('primary', 'sm')}
            onClick={() => run(() => api<{ created: number }>(`/api/crm/campaigns/${id}`, 'POST', { suggestion }), r => `Đã tạo ${r.created} việc`)}>Giao việc</button>
        </div>
      )}
      {canExport && <a className={btnClass('secondary', 'sm')} href={`/api/crm/campaigns/${id}`}>Xuất CSV nhóm liên hệ</a>}
      <Feedback error={error} message={message} />
    </div>
  )
}
