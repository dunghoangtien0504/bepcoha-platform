'use client'
import { useState } from 'react'
import { api, useAction, btnClass, inputClass, labelClass, Feedback } from '../../_components/client'

const DEPTS: Record<string, string> = { bep: 'Bếp sản xuất', kho_van: 'Kho & đóng gói', sale_cskh: 'Sale & CSKH', marketing: 'Marketing & Content', san_tmdt: 'Vận hành sàn', dao_tao: 'Đào tạo (khoá học)', ban_giam_doc: 'Ban giám đốc' }
const REPEAT: Record<string, string> = { moi_ca: 'Mỗi ca', hang_ngay: 'Mỗi ngày (1 lần)', hang_tuan: 'Mỗi tuần (1 lần)' }

export interface TemplateValue {
  id?: number; department: string; group_name: string; title: string; checklist: string; repeat: string; due_offset_min: string; shift_code: string; sort: string
}
export const EMPTY_TEMPLATE: TemplateValue = { department: 'bep', group_name: '', title: '', checklist: '', repeat: 'moi_ca', due_offset_min: '', shift_code: '', sort: '0' }

export function TemplateForm({ initial, shifts, onDone }: { initial: TemplateValue; shifts: { code: string; name: string }[]; onDone?: () => void }) {
  const { run, pending, error, message } = useAction()
  const [f, setF] = useState(initial)
  const set = (k: keyof TemplateValue) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })
  return (
    <form className="grid gap-3 sm:grid-cols-6" onSubmit={async e => {
      e.preventDefault()
      const body = { ...f, checklist: f.checklist.split('\n').map(x => x.trim()).filter(Boolean) }
      if (await run(() => api('/api/crm/kho-viec', f.id ? 'PATCH' : 'POST', body), f.id ? 'Đã lưu' : 'Đã thêm vào kho')) { if (!f.id) setF({ ...EMPTY_TEMPLATE, department: f.department, group_name: f.group_name }); onDone?.() }
    }}>
      <div className="sm:col-span-2"><label className={labelClass}>Bộ phận</label>
        <select className={inputClass} value={f.department} onChange={set('department')}>{Object.entries(DEPTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
      <div className="sm:col-span-2"><label className={labelClass}>Việc cha (nhóm)</label><input className={inputClass} value={f.group_name} onChange={set('group_name')} placeholder="Mở ca bếp" /></div>
      <div className="sm:col-span-2"><label className={labelClass}>Tần suất</label>
        <select className={inputClass} value={f.repeat} onChange={set('repeat')}>{Object.entries(REPEAT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
      <div className="sm:col-span-4"><label className={labelClass}>Tên việc</label><input required className={inputClass} value={f.title} onChange={set('title')} placeholder="Kiểm nhiệt độ tủ mát và ghi sổ" /></div>
      <div><label className={labelClass}>Xong sau (phút từ đầu ca)</label><input inputMode="numeric" className={inputClass} value={f.due_offset_min} onChange={e => setF({ ...f, due_offset_min: e.target.value.replace(/\D/g, '') })} placeholder="trống = hết ca" /></div>
      <div><label className={labelClass}>Chỉ ca</label>
        <select className={inputClass} value={f.shift_code} onChange={set('shift_code')}><option value="">Mọi ca</option>{shifts.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}</select></div>
      <div className="sm:col-span-6"><label className={labelClass}>Danh sách mục cần làm (mỗi dòng một mục; ghi “chụp ảnh” nếu cần ảnh)</label>
        <textarea rows={3} className={inputClass} value={f.checklist} onChange={set('checklist')} placeholder={'Tủ mát 0–5°C\nTủ đông ≤ −18°C\nGhi vào sổ nhiệt độ'} /></div>
      <div className="flex items-center gap-2 sm:col-span-6"><button disabled={pending} className={btnClass('primary', 'sm')}>{f.id ? 'Lưu' : 'Thêm vào kho'}</button>{onDone && f.id && <button type="button" className={btnClass('ghost', 'sm')} onClick={onDone}>Đóng</button>}<Feedback error={error} message={message} /></div>
    </form>
  )
}

export function TemplateRowActions({ value, active, proposed, shifts }: { value: TemplateValue; active: boolean; proposed: boolean; shifts: { code: string; name: string }[] }) {
  const { run, pending, error } = useAction()
  const [edit, setEdit] = useState(false)
  if (edit) return <div className="mt-3 rounded-lg border border-stone-200 p-3"><TemplateForm initial={value} shifts={shifts} onDone={() => setEdit(false)} /></div>
  return (
    <div className="flex flex-wrap items-center gap-2">
      {!active && <button disabled={pending} className={btnClass('primary', 'sm')} onClick={() => run(() => api('/api/crm/kho-viec', 'PATCH', { id: value.id, action: 'active', active: true }))}>{proposed ? 'Duyệt & bật' : 'Bật'}</button>}
      {active && <button disabled={pending} className={btnClass('secondary', 'sm')} onClick={() => run(() => api('/api/crm/kho-viec', 'PATCH', { id: value.id, action: 'active', active: false }))}>Tắt</button>}
      <button className={btnClass('ghost', 'sm')} onClick={() => setEdit(true)}>Sửa</button>
      {error && <span className="text-xs text-rose-600">{error}</span>}
    </div>
  )
}
