'use client'
import { api, useAction, btnClass, Feedback } from '../../_components/client'

export function AddShift({ staffId, day, templates }: { staffId: number; day: string; templates: { id: number; label: string }[] }) {
  const { run, pending, error } = useAction()
  return (
    <>
      <select disabled={pending} value="" aria-label="Thêm ca"
        className="w-full rounded border border-dashed border-stone-300 bg-transparent px-1 py-0.5 text-xs text-stone-400 hover:border-emerald-500"
        onChange={e => e.target.value && run(() => api('/api/crm/shifts', 'POST', { staff_id: staffId, work_date: day, template_id: Number(e.target.value) }))}>
        <option value="">+ ca</option>
        {templates.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
      </select>
      {error && <span className="text-[10px] text-rose-600">{error}</span>}
    </>
  )
}

export function RemoveShift({ id }: { id: number }) {
  const { run, pending } = useAction()
  return <button disabled={pending} title="Bỏ ca" className="ml-1 text-white/80 hover:text-white" onClick={() => run(() => api('/api/crm/shifts', 'DELETE', { id }))}>×</button>
}

export function CopyWeek({ from, to }: { from: string; to: string }) {
  const { run, pending, error, message } = useAction()
  return (
    <span className="flex flex-col items-end">
      <button disabled={pending} className={btnClass('primary')}
        onClick={() => confirm('Chép toàn bộ lịch tuần trước sang tuần này? Ca đã có sẽ giữ nguyên.') && run(() => api<{ created: number }>('/api/crm/shifts', 'POST', { action: 'copy_week', from, to }), r => `Đã chép ${r.created} ca`)}>
        Chép lịch tuần trước</button>
      <Feedback error={error} message={message} />
    </span>
  )
}
