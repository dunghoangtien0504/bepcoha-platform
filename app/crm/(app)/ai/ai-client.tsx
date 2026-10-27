'use client'
import { useState } from 'react'
import { api, useAction, btnClass, inputClass, Feedback } from '../../_components/client'

const post = (body: Record<string, unknown>) => api<{ ok: boolean; zalo?: { ok: boolean; detail: string } | null; status?: string; error?: string | null }>('/api/crm/ai', 'POST', body)

export function StopButton({ stopped, canResume }: { stopped: boolean; canResume: boolean }) {
  const { run, pending, error, message } = useAction()
  if (!stopped) return (
    <span className="inline-flex flex-col items-end gap-1">
      <button disabled={pending} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-rose-700"
        onClick={() => {
          const reason = prompt('DỪNG KHẨN CẤP toàn bộ AI và tự động (CRM HACO + Zalo CRM). Lý do (có thể để trống):')
          if (reason === null) return
          run(() => post({ action: 'stop', reason: reason || 'Dừng khẩn cấp' }), r => r.zalo?.ok ? 'Đã dừng cả CRM HACO và Zalo CRM' : `Đã dừng CRM HACO. Zalo CRM: ${r.zalo?.detail ?? 'chưa rõ'}`)
        }}>■ Dừng khẩn cấp</button>
      <Feedback error={error} message={message} />
    </span>
  )
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button disabled={pending || !canResume} title={canResume ? '' : 'Cần quyền quản lý AI'} className={btnClass('primary')}
        onClick={() => {
          const reason = prompt('Cho chạy lại. Đã kiểm tra nguyên nhân dừng chưa? Ghi lý do:')
          if (reason) run(() => post({ action: 'resume', reason }), r => r.zalo?.ok ? 'Đã chạy lại cả hai hệ thống' : `CRM HACO đã chạy lại. Zalo CRM: ${r.zalo?.detail ?? 'chưa rõ'}`)
        }}>▶ Cho chạy lại</button>
      <Feedback error={error} message={message} />
    </span>
  )
}

export function SimulationToggle({ on }: { on: boolean }) {
  const { run, pending, error } = useAction()
  return (
    <span className="inline-flex flex-col gap-1">
      <button disabled={pending} className={btnClass(on ? 'primary' : 'secondary', 'sm')}
        onClick={() => { if (confirm(on ? 'Tắt mô phỏng: agent L2 sẽ tự làm lại, việc L1 cần duyệt như thường.' : 'Bật mô phỏng: mọi agent chỉ ghi lại việc sẽ làm, không làm gì thật.')) run(() => post({ action: 'simulation', on: !on })) }}>
        {on ? 'Đang mô phỏng · Tắt' : 'Chế độ mô phỏng'}
      </button>
      {error && <span className="text-xs text-rose-600">{error}</span>}
    </span>
  )
}

export function AgentControls({ code, level, maxLevel, enabled, canRun }: { code: string; level: string; maxLevel: string; enabled: boolean; canRun: boolean }) {
  const { run, pending, error, message } = useAction()
  const levels = ['L0', 'L1', 'L2'].filter(l => l <= maxLevel)
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-stone-100 pt-3">
      <select disabled={pending} value={level} className="rounded-lg border border-stone-300 px-2 py-1 text-xs"
        onChange={e => {
          const next = e.target.value
          if (next === 'L2' && !confirm('L2 = agent tự làm không cần duyệt (trong trần mỗi ngày). Chỉ mở khi ≥ 90% việc được duyệt không sửa trên ≥ 100 mẫu. Tiếp tục?')) return
          run(() => post({ action: 'agent', code, level: next }), `Đã chuyển ${next}`)
        }}>
        {levels.map(l => <option key={l} value={l}>{l}</option>)}
      </select>
      <button disabled={pending} className={btnClass(enabled ? 'secondary' : 'primary', 'sm')}
        onClick={() => run(() => post({ action: 'agent', code, enabled: !enabled }), enabled ? 'Đã tắt' : 'Đã bật')}>{enabled ? 'Tắt' : 'Bật'}</button>
      {canRun && enabled && <button disabled={pending} className={btnClass('ghost', 'sm')} onClick={() => run(() => post({ action: 'run', agent: code }), 'Đã chạy')}>Chạy ngay</button>}
      <Feedback error={error} message={message} />
    </div>
  )
}

export function ActionControls({ id, status, body, editable, executedRecently }: { id: number; status: string; body: string; editable: boolean; executedRecently: boolean }) {
  const { run, pending, error, message } = useAction()
  const [text, setText] = useState(body)
  if (status === 'mo_phong') return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-stone-500">Người sẽ làm giống vậy không?</span>
      <button disabled={pending} className={btnClass('secondary', 'sm')} onClick={() => run(() => post({ action: 'sim_verdict', id, verdict: 'dong_y' }), 'Đã chấm')}>Giống</button>
      <button disabled={pending} className={btnClass('secondary', 'sm')} onClick={() => run(() => post({ action: 'sim_verdict', id, verdict: 'khac' }), 'Đã chấm')}>Khác</button>
      <Feedback error={error} message={message} />
    </div>
  )
  if (status === 'da_thuc_hien') return executedRecently ? (
    <div><button disabled={pending} className={btnClass('ghost', 'sm')}
      onClick={() => { const reason = prompt('Hoàn tác việc này. Lý do:'); if (reason) run(() => post({ action: 'undo', id, reason }), 'Đã hoàn tác') }}>Hoàn tác</button>
      <Feedback error={error} message={message} /></div>
  ) : null
  if (status !== 'cho_duyet' && status !== 'de_xuat') return null
  return (
    <div className="space-y-2">
      {editable && <textarea rows={Math.min(8, Math.max(3, text.split('\n').length + 1))} className={inputClass} value={text} onChange={e => setText(e.target.value)} />}
      <div className="flex flex-wrap items-center gap-2">
        <button disabled={pending} className={btnClass('primary', 'sm')}
          onClick={() => run(() => post({ action: 'approve', id, body: editable ? text : undefined }), r => r.ok ? (text !== body ? 'Đã duyệt (có sửa)' : 'Đã duyệt') : `Lỗi khi thực hiện: ${r.error ?? ''}`)}>
          {status === 'de_xuat' ? 'Làm theo đề xuất' : text !== body ? 'Duyệt bản đã sửa' : 'Duyệt'}
        </button>
        <button disabled={pending} className={btnClass('danger', 'sm')}
          onClick={() => { const note = prompt('Từ chối. Lý do (để agent học):'); if (note) run(() => post({ action: 'reject', id, note }), 'Đã từ chối') }}>Từ chối</button>
        <Feedback error={error} message={message} />
      </div>
    </div>
  )
}
