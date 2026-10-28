'use client'
import Link from 'next/link'
import { useState } from 'react'
import { api, useAction, btnClass, inputClass, labelClass, Feedback } from '../../_components/client'
import { TASK_KINDS, TASK_RESULTS, type TaskKind } from '@/lib/crm/labels'
import { dateTime, relative } from '@/lib/crm/format'

interface Task {
  id: number; title: string; kind: string; source?: string; priority: number; status: string; due_at: string | null; done_at: string | null
  suggestion: string; description: string; result: string | null; result_note: string; edit_reason: string; checklist: { text: string; done: boolean }[]
  customer_id: number | null; customer_name: string | null; customer_phone: string | null; phone_verified_at: unknown
  assigned_staff_id: number | null; assignee_name: string | null; reviewer_name: string | null; review_note: string; reviewed_at: unknown
}

const PRIORITY = { 1: ['Gấp', 'bg-rose-50 text-rose-700'], 2: ['Bình thường', 'bg-stone-100 text-stone-600'], 3: ['Khi rảnh', 'bg-stone-50 text-stone-500'] } as const

export function TaskCard({ task, manager, staff, mine }: { task: Task; manager: boolean; staff: { id: number; name: string }[]; mine: boolean }) {
  const { run, pending, error, message } = useAction()
  const [open, setOpen] = useState(false)
  const [result, setResult] = useState('')
  const [note, setNote] = useState('')
  const [deviated, setDeviated] = useState(false)
  const [reason, setReason] = useState('')
  const [checklist, setChecklist] = useState(task.checklist || [])
  const [callbackAt, setCallbackAt] = useState('')
  const [copied, setCopied] = useState(false)
  // Việc trong ca (kho việc / nội bộ): không có "kết quả với khách", xong là xong (phản biện CEO/COO 27/10)
  const internal = task.source === 'kho_viec' || task.kind === 'noi_bo' || task.kind === 'duyet_don_tu'
  const missing = checklist.filter(c => !c.done).length
  const telHref = task.customer_phone && !task.customer_phone.includes('*') ? `tel:${task.customer_phone.replace(/[^\d+]/g, '')}` : null
  async function toggle(i: number, done: boolean) {
    const next = checklist.map((x, j) => j === i ? { ...x, done } : x)
    setChecklist(next)
    // Lưu ngay từng dấu tick (tải lại trang không mất)
    if (mine) await api(`/api/crm/tasks/${task.id}`, 'PATCH', { action: 'checklist', checklist: next }).catch(() => setChecklist(checklist))
  }
  const overdue = task.due_at && new Date(task.due_at) < new Date() && (task.status === 'can_lam' || task.status === 'dang_lam')
  const doneLike = task.status === 'xong' || task.status === 'bo_qua'
  const patch = (body: object, ok: string) => run(() => api(`/api/crm/tasks/${task.id}`, 'PATCH', body), ok)
  const pr = PRIORITY[(task.priority as 1 | 2 | 3) ?? 2] ?? PRIORITY[2]

  return (
    <article className={`rounded-xl border bg-white p-4 shadow-sm ${overdue ? 'border-rose-200' : 'border-stone-200'}`}>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-800">{TASK_KINDS[task.kind as TaskKind] ?? task.kind}</span>
        <span className={`rounded-full px-2 py-0.5 ${pr[1]}`}>{pr[0]}</span>
        {task.due_at && <span className={overdue ? 'font-medium text-rose-600' : 'text-stone-500'}>Hạn {relative(task.due_at)}</span>}
        {task.status === 'dang_lam' && <span className="text-sky-700">Đang làm</span>}
        {manager && !mine && <span className="text-stone-500">· {task.assignee_name ?? 'chưa giao'}</span>}
      </div>
      <h3 className="mt-2 font-medium text-stone-900">{task.title}</h3>
      {task.customer_id && (
        <div className="mt-1 text-sm">
          <Link href={`/crm/khach-hang/${task.customer_id}`} className="text-emerald-700 hover:underline">{task.customer_name || `Khách #${task.customer_id}`}</Link>
          {task.customer_phone && (telHref
            ? <a href={telHref} className="ml-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 tabular-nums text-emerald-800 ring-1 ring-emerald-200">☎ {task.customer_phone}</a>
            : <span className="ml-2 tabular-nums text-stone-600">{task.customer_phone}</span>)}
          {!task.phone_verified_at && <span className="ml-2 rounded bg-amber-50 px-1.5 text-xs text-amber-800">SĐT chưa xác minh</span>}
        </div>
      )}
      {task.suggestion && (
        <div className="mt-2 rounded-lg bg-stone-50 px-3 py-2 text-sm text-stone-700">
          <span className="font-medium">{task.kind === 'ai_gui_tin' ? 'Tin đã duyệt: ' : 'Gợi ý: '}</span><span className="whitespace-pre-wrap">{task.suggestion}</span>
          {task.kind === 'ai_gui_tin' && (
            <button type="button" className={`${btnClass('secondary', 'sm')} mt-2 block`}
              onClick={() => navigator.clipboard?.writeText(task.suggestion).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) })}>
              {copied ? 'Đã chép ✓' : 'Chép tin để dán vào Zalo'}</button>
          )}
        </div>
      )}
      {task.description && <p className="mt-2 text-sm text-stone-600">{task.description}</p>}

      {checklist.length > 0 && (
        <ul className="mt-2 space-y-1 text-sm">
          {checklist.map((c, i) => (
            <li key={i}><label className="flex min-h-9 items-center gap-3">
              <input type="checkbox" className="h-5 w-5 accent-emerald-700" checked={c.done} disabled={doneLike || pending} onChange={e => toggle(i, e.target.checked)} />
              <span className={c.done ? 'text-stone-400 line-through' : ''}>{c.text}</span></label></li>
          ))}
        </ul>
      )}

      {doneLike ? (
        <div className="mt-3 text-sm text-stone-600">
          <div>{task.status === 'bo_qua' ? 'Đã bỏ qua' : `Kết quả: ${TASK_RESULTS[task.result as keyof typeof TASK_RESULTS] ?? task.result}`} · {dateTime(task.done_at)}</div>
          {task.result_note && <div className="mt-1">Ghi chú: {task.result_note}</div>}
          {task.edit_reason && <div className="mt-1 text-amber-800">Lý do làm khác gợi ý: {task.edit_reason}</div>}
          {task.reviewed_at ? <div className="mt-1 text-emerald-700">Đã duyệt bởi {task.reviewer_name}{task.review_note ? `: ${task.review_note}` : ''}</div>
            : manager && <ReviewBox onReview={n => patch({ action: 'review', review_note: n }, 'Đã duyệt')} onReopen={() => patch({ action: 'reopen' }, 'Đã mở lại')} pending={pending} />}
        </div>
      ) : (
        <div className="mt-3">
          {internal && mine ? (
            <div className="space-y-2">
              {missing > 0 && <input className={inputClass} value={reason} onChange={e => setReason(e.target.value)} placeholder={`Còn ${missing} mục chưa đánh dấu: ghi lý do nếu vẫn báo xong`} />}
              <div className="flex flex-wrap gap-2">
                <button disabled={pending || (missing > 0 && !reason.trim())} className={`${btnClass('primary')} min-w-28 py-2.5`}
                  onClick={() => patch({ action: 'done', checklist, edit_reason: reason }, 'Đã xong')}>Xong</button>
                <button disabled={pending} className={btnClass('ghost')} onClick={() => { const r = prompt('Không làm được việc này vì sao?'); if (r) patch({ action: 'skip', edit_reason: r }, 'Đã báo không làm') }}>Không làm được</button>
              </div>
            </div>
          ) : !open ? (
            <div className="flex flex-wrap gap-2">
              {(mine || manager) && <button className={`${btnClass('primary')} py-2.5`} onClick={() => { setOpen(true); if (task.status === 'can_lam') patch({ action: 'start' }, '') }}>Làm việc này</button>}
              {manager && staff.length > 0 && (
                <select className="rounded-lg border border-stone-300 px-2 py-1 text-xs" defaultValue="" disabled={pending}
                  onChange={e => e.target.value && patch({ action: 'reassign', staff_id: Number(e.target.value) }, 'Đã giao lại')}>
                  <option value="">Giao cho…</option>
                  {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              )}
            </div>
          ) : (
            <div className="space-y-2 rounded-lg border border-stone-200 p-3">
              <div>
                <label className={labelClass}>Kết quả</label>
                <select className={inputClass} value={result} onChange={e => setResult(e.target.value)}>
                  <option value="">— chọn —</option>
                  {Object.entries(TASK_RESULTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                {result === 'tu_choi' && <p className="mt-1 text-xs text-amber-700">Khách sẽ được đánh dấu “không liên hệ” ở mọi luồng. Chỉ quản trị gỡ được.</p>}
                {result === 'hen_lai' && <div className="mt-2"><label className={labelClass}>Gọi lại lúc</label>
                  <input type="datetime-local" className={inputClass} value={callbackAt} onChange={e => setCallbackAt(e.target.value)} />
                  <p className="mt-1 text-xs text-stone-500">Máy tạo sẵn việc “Gọi lại” đúng giờ này cho bạn.</p></div>}
              </div>
              <div>
                <label className={labelClass}>Ghi chú (khách nói gì)</label>
                <textarea className={inputClass} rows={2} value={note} onChange={e => setNote(e.target.value)} />
              </div>
              {task.suggestion && (
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={deviated} onChange={e => setDeviated(e.target.checked)} /> Tôi làm khác gợi ý của máy</label>
              )}
              {(deviated || result === '') && (
                <div>
                  <label className={labelClass}>{deviated ? 'Vì sao làm khác? (để máy học lại)' : 'Lý do (bắt buộc nếu bỏ qua)'}</label>
                  <input className={inputClass} value={reason} onChange={e => setReason(e.target.value)} placeholder="VD: khách vừa mua hôm qua, gợi ý chưa đúng lúc" />
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <button disabled={pending || !result || (result === 'hen_lai' && !callbackAt)} className={`${btnClass('primary')} min-w-24 py-2.5`}
                  onClick={() => patch({ action: 'done', result, result_note: note, deviated, edit_reason: reason, checklist,
                    callback_at: result === 'hen_lai' && callbackAt ? new Date(callbackAt).toISOString() : undefined }, result === 'hen_lai' ? 'Đã hẹn, việc gọi lại đã tạo' : 'Đã ghi kết quả')}>Xong</button>
                <button disabled={pending} className={btnClass('secondary')} onClick={() => patch({ action: 'skip', edit_reason: reason, result_note: note }, 'Đã bỏ qua')}>Bỏ qua</button>
                <button className={btnClass('ghost')} onClick={() => setOpen(false)}>Đóng</button>
              </div>
            </div>
          )}
        </div>
      )}
      <div className="mt-2"><Feedback error={error} message={message} /></div>
    </article>
  )
}

function ReviewBox({ onReview, onReopen, pending }: { onReview: (n: string) => void; onReopen: () => void; pending: boolean }) {
  const [n, setN] = useState('')
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <input className={`${inputClass} max-w-xs`} placeholder="Nhận xét (tuỳ chọn)" value={n} onChange={e => setN(e.target.value)} />
      <button disabled={pending} className={btnClass('primary', 'sm')} onClick={() => onReview(n)}>Duyệt</button>
      <button disabled={pending} className={btnClass('secondary', 'sm')} onClick={onReopen}>Mở lại</button>
    </div>
  )
}

export function GenerateButton() {
  const { run, pending, error, message } = useAction()
  return (
    <span className="flex flex-col items-end gap-1">
      <button disabled={pending} className={btnClass('primary')}
        onClick={() => run(() => api<{ created: Record<string, number> }>('/api/crm/tasks', 'POST', { action: 'generate' }),
          r => 'Đã sinh ' + Object.values(r.created).reduce((a, b) => a + b, 0) + ' việc mới')}>
        {pending ? 'Đang sinh việc…' : 'Sinh việc hôm nay'}
      </button>
      <Feedback error={error} message={message} />
    </span>
  )
}

export function NewTaskForm({ staff }: { staff: { id: number; name: string }[] }) {
  const { run, pending, error, message } = useAction()
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ title: '', due_at: '', priority: '2', assigned_staff_id: '', description: '' })
  if (!open) return <button className={btnClass('secondary', 'sm')} onClick={() => setOpen(true)}>+ Thêm việc</button>
  return (
    <form className="grid gap-2 rounded-xl border border-stone-200 bg-white p-4 sm:grid-cols-4" onSubmit={async e => {
      e.preventDefault()
      const r = await run(() => api('/api/crm/tasks', 'POST', { ...f, assigned_staff_id: f.assigned_staff_id || undefined, due_at: f.due_at || undefined }), 'Đã thêm việc')
      if (r) setF({ title: '', due_at: '', priority: '2', assigned_staff_id: '', description: '' })
    }}>
      <div className="sm:col-span-2"><label className={labelClass}>Việc</label><input required className={inputClass} value={f.title} onChange={e => setF({ ...f, title: e.target.value })} /></div>
      <div><label className={labelClass}>Hạn</label><input type="datetime-local" className={inputClass} value={f.due_at} onChange={e => setF({ ...f, due_at: e.target.value })} /></div>
      <div><label className={labelClass}>Mức</label><select className={inputClass} value={f.priority} onChange={e => setF({ ...f, priority: e.target.value })}><option value="1">Gấp</option><option value="2">Bình thường</option><option value="3">Khi rảnh</option></select></div>
      {staff.length > 0 && <div><label className={labelClass}>Giao cho</label><select className={inputClass} value={f.assigned_staff_id} onChange={e => setF({ ...f, assigned_staff_id: e.target.value })}><option value="">Tôi</option>{staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>}
      <div className={staff.length ? 'sm:col-span-3' : 'sm:col-span-4'}><label className={labelClass}>Mô tả</label><input className={inputClass} value={f.description} onChange={e => setF({ ...f, description: e.target.value })} /></div>
      <div className="flex items-center gap-2 sm:col-span-4">
        <button disabled={pending} className={btnClass('primary', 'sm')}>Lưu</button>
        <button type="button" className={btnClass('ghost', 'sm')} onClick={() => setOpen(false)}>Huỷ</button>
        <Feedback error={error} message={message} />
      </div>
    </form>
  )
}
