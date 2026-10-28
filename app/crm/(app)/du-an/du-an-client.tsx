'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, useAction, btnClass, Feedback, inputClass, labelClass } from '../../_components/client'

type Opt = { key: string; label: string }

export function NewProjectForm({ boss, myDept, staff, departments, templates }:
  { boss: boolean; myDept: string | null; staff: { id: number; name: string }[]; departments: Opt[]; templates: { key: string; name: string; hint: string; count: number }[] }) {
  const router = useRouter()
  const { run, pending, error } = useAction()
  const [f, setF] = useState({ template: '', name: '', goal: '', deadline: '', department: myDept ?? '', owner_id: '' })
  const tpl = templates.find(t => t.key === f.template)
  return (
    <form className="space-y-3" onSubmit={async e => {
      e.preventDefault()
      const r = await run(() => api<{ project: { id: number } }>('/api/crm/du-an', 'POST', { ...f, owner_id: f.owner_id || undefined, template: f.template || undefined }))
      if (r) router.push(`/crm/du-an/${r.project.id}`)
    }}>
      {boss && templates.length > 0 && (
        <div>
          <div className={labelClass}>Bắt đầu từ</div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setF({ ...f, template: '' })} className={`rounded-xl border-2 px-3 py-2 text-sm ${!f.template ? 'border-emerald-600 bg-emerald-50' : 'border-stone-200'}`}>Dự án trống</button>
            {templates.map(t => (
              <button type="button" key={t.key} onClick={() => setF({ ...f, template: t.key, name: f.name || t.name + ' ' + (new Date().getFullYear() + 1) })}
                className={`rounded-xl border-2 px-3 py-2 text-left text-sm ${f.template === t.key ? 'border-emerald-600 bg-emerald-50' : 'border-stone-200'}`}>
                <b>Mẫu: {t.name}</b><span className="block text-xs text-stone-500">{t.count} việc sẵn cho mọi bộ phận</span>
              </button>
            ))}
          </div>
          {tpl && <p className="mt-1 text-xs text-stone-500">{tpl.hint} Mỗi việc được giao sẵn cho quản lý bộ phận; hạn = hạn chót trừ số ngày chuẩn bị.</p>}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className={labelClass}>Tên dự án</label><input className={inputClass} required maxLength={150} value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></div>
        <div><label className={labelClass}>Hạn chót</label><input type="date" className={inputClass} required value={f.deadline} onChange={e => setF({ ...f, deadline: e.target.value })} /></div>
        {boss && (
          <div><label className={labelClass}>Bộ phận chủ trì</label>
            <select className={inputClass} value={f.department} onChange={e => setF({ ...f, department: e.target.value })}>
              {departments.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
            </select></div>
        )}
        <div><label className={labelClass}>Người chủ trì</label>
          <select className={inputClass} value={f.owner_id} onChange={e => setF({ ...f, owner_id: e.target.value })}>
            <option value="">Tôi</option>{staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select></div>
      </div>
      <div><label className={labelClass}>Mục tiêu (một câu, đo được)</label><input className={inputClass} maxLength={500} value={f.goal} onChange={e => setF({ ...f, goal: e.target.value })} placeholder={tpl ? 'Để trống dùng mục tiêu của mẫu' : 'VD: 300 sét quà Tết, giao xong trước 28/01'} /></div>
      <button disabled={pending} className={btnClass('primary')}>{pending ? 'Đang tạo…' : tpl ? `Tạo dự án + ${tpl.count} việc` : 'Tạo dự án'}</button>
      <Feedback error={error} />
    </form>
  )
}

export function AddTaskForm({ projectId, deadline, myDept, boss, departments, staff }:
  { projectId: number; deadline: string; myDept: string | null; boss: boolean; departments: Opt[]; staff: { id: number; name: string; department: string | null }[] }) {
  const { run, pending, error, message } = useAction()
  const empty = { title: '', department: myDept ?? departments[0].key, assigned_staff_id: '', due_date: '', checklist: '' }
  const [f, setF] = useState(empty)
  const people = staff.filter(s => s.department === f.department)
  return (
    <form className="space-y-3" onSubmit={async e => {
      e.preventDefault()
      const r = await run(() => api(`/api/crm/du-an/${projectId}`, 'POST', f), 'Đã thêm việc')
      if (r) setF({ ...empty, department: f.department })
    }}>
      <div><label className={labelClass}>Việc cần làm (bắt đầu bằng động từ)</label>
        <input className={inputClass} required maxLength={300} value={f.title} onChange={e => setF({ ...f, title: e.target.value })} placeholder="VD: Chụp ảnh 5 sét quà Tết trên nền đỏ" /></div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div><label className={labelClass}>Bộ phận</label>
          <select className={inputClass} value={f.department} disabled={!boss} onChange={e => setF({ ...f, department: e.target.value, assigned_staff_id: '' })}>
            {departments.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
          </select></div>
        <div><label className={labelClass}>Ai làm</label>
          <select className={inputClass} value={f.assigned_staff_id} onChange={e => setF({ ...f, assigned_staff_id: e.target.value })}>
            <option value="">— Chưa giao —</option>{people.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select></div>
        <div><label className={labelClass}>Hạn (17:00)</label>
          <input type="date" className={inputClass} required max={deadline} value={f.due_date} onChange={e => setF({ ...f, due_date: e.target.value })} /></div>
      </div>
      <div><label className={labelClass}>Các bước (mỗi dòng một bước, không bắt buộc)</label>
        <textarea rows={3} className={inputClass} value={f.checklist} onChange={e => setF({ ...f, checklist: e.target.value })} /></div>
      <button disabled={pending} className={btnClass('primary')}>Thêm việc</button>
      <Feedback error={error} message={message} />
    </form>
  )
}

export function ProjectControls({ id, status, deadline, boss }: { id: number; status: string; deadline: string; boss: boolean }) {
  const { run, pending, error, message } = useAction()
  const [d, setD] = useState(deadline)
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-xl border border-stone-200 bg-white p-3 text-sm">
      {boss && (
        <>
          <div><label className={labelClass}>Hạn chót (chỉ ban giám đốc dời)</label>
            <input type="date" className={inputClass} value={d} onChange={e => setD(e.target.value)} /></div>
          {d !== deadline && <button disabled={pending} className={btnClass('secondary')} onClick={() => {
            const reason = prompt('Lý do dời hạn chót?')
            if (reason) run(() => api(`/api/crm/du-an/${id}`, 'PATCH', { deadline: d, reason }), 'Đã dời hạn')
          }}>Dời hạn</button>}
        </>
      )}
      <div className="ml-auto flex gap-2">
        {status !== 'xong' && <button disabled={pending} className={btnClass('primary')} onClick={() => run(() => api(`/api/crm/du-an/${id}`, 'PATCH', { status: 'xong' }), 'Đã đóng dự án')}>Đánh dấu xong</button>}
        {status === 'dang_chay' && <button disabled={pending} className={btnClass('secondary')} onClick={() => run(() => api(`/api/crm/du-an/${id}`, 'PATCH', { status: 'tam_dung' }), 'Đã tạm dừng')}>Tạm dừng</button>}
        {status !== 'dang_chay' && <button disabled={pending} className={btnClass('secondary')} onClick={() => run(() => api(`/api/crm/du-an/${id}`, 'PATCH', { status: 'dang_chay' }), 'Đã mở lại')}>Mở lại</button>}
      </div>
      <div className="w-full"><Feedback error={error} message={message} /></div>
    </div>
  )
}
