'use client'
import { useState } from 'react'
import { api, useAction, btnClass, inputClass, labelClass, Feedback } from '../../_components/client'
import { DEPARTMENT_LABEL, ROLE_LABEL, PERMISSION_LABEL, PERMISSIONS } from '@/lib/crm/permissions'

export function NewStaff({ isAdmin }: { isAdmin: boolean }) {
  const { run, pending, error } = useAction()
  const [open, setOpen] = useState(false)
  const [created, setCreated] = useState<{ email: string; pw: string } | null>(null)
  const empty = { name: '', email: '', role: 'staff', department: 'sale_cskh', title: '', phone: '', employment: 'toan_thoi_gian' }
  const [f, setF] = useState(empty)
  if (created) return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm">
      <p className="font-medium">Đã tạo tài khoản {created.email}</p>
      <p className="mt-1">Mật khẩu tạm (chỉ hiện 1 lần, chuyển riêng cho nhân viên và nhắc đổi): <code className="rounded bg-white px-2 py-0.5 font-mono">{created.pw}</code></p>
      <button className={`${btnClass('secondary', 'sm')} mt-2`} onClick={() => setCreated(null)}>Đã chuyển, đóng lại</button>
    </div>
  )
  if (!open) return <button className={btnClass('primary')} onClick={() => setOpen(true)}>+ Thêm nhân viên</button>
  return (
    <form className="grid gap-3 rounded-xl border border-stone-200 bg-white p-4 sm:grid-cols-4" onSubmit={async e => {
      e.preventDefault()
      const r = await run(() => api<{ temp_password: string }>('/api/crm/staff', 'POST', f))
      if (r) { setCreated({ email: f.email, pw: r.temp_password }); setF(empty); setOpen(false) }
    }}>
      <div><label className={labelClass}>Tên</label><input required className={inputClass} value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></div>
      <div><label className={labelClass}>Email đăng nhập</label><input required type="email" className={inputClass} value={f.email} onChange={e => setF({ ...f, email: e.target.value })} /></div>
      <div><label className={labelClass}>Bộ phận</label><select className={inputClass} value={f.department} onChange={e => setF({ ...f, department: e.target.value })}>{Object.entries(DEPARTMENT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
      <div><label className={labelClass}>Vai trò</label><select className={inputClass} value={f.role} onChange={e => setF({ ...f, role: e.target.value })}>{Object.entries(ROLE_LABEL).filter(([k]) => isAdmin || k !== 'admin').map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
      <div><label className={labelClass}>Chức danh</label><input className={inputClass} value={f.title} onChange={e => setF({ ...f, title: e.target.value })} /></div>
      <div><label className={labelClass}>SĐT</label><input className={inputClass} value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} /></div>
      <div><label className={labelClass}>Hình thức</label><select className={inputClass} value={f.employment} onChange={e => setF({ ...f, employment: e.target.value })}><option value="toan_thoi_gian">Toàn thời gian</option><option value="ban_thoi_gian">Bán thời gian</option></select></div>
      <div className="flex items-end gap-2"><button disabled={pending} className={btnClass('primary', 'sm')}>Tạo</button><button type="button" className={btnClass('ghost', 'sm')} onClick={() => setOpen(false)}>Huỷ</button></div>
      <div className="sm:col-span-4"><Feedback error={error} /></div>
    </form>
  )
}

interface S { id: number; role: string; department: string | null; title: string; status: string; extra: string[] }

export function StaffRow({ staff, self, isAdmin }: { staff: S; self: boolean; isAdmin: boolean }) {
  const { run, pending, error, message } = useAction()
  const [f, setF] = useState({ role: staff.role, department: staff.department ?? 'sale_cskh', extra: staff.extra ?? [] })
  const [pw, setPw] = useState<string | null>(null)
  const locked = staff.role === 'admin' && !isAdmin
  return (
    <div className="space-y-2 text-sm">
      <div className="grid gap-2 sm:grid-cols-3">
        <select disabled={self || locked} className={inputClass} value={f.role} onChange={e => setF({ ...f, role: e.target.value })}>
          {Object.entries(ROLE_LABEL).filter(([k]) => isAdmin || k !== 'admin').map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <select disabled={locked} className={inputClass} value={f.department} onChange={e => setF({ ...f, department: e.target.value })}>
          {Object.entries(DEPARTMENT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <button disabled={pending || locked} className={btnClass('primary', 'sm')}
          onClick={() => run(() => api('/api/crm/staff', 'PATCH', { id: staff.id, role: self ? undefined : f.role, department: f.department, extra_permissions: f.extra }), 'Đã lưu')}>Lưu quyền</button>
      </div>
      <details>
        <summary className="cursor-pointer text-xs text-stone-500">Cấp thêm quyền riêng ({f.extra.length})</summary>
        <div className="mt-2 grid grid-cols-2 gap-1 sm:grid-cols-3">
          {PERMISSIONS.map(p => <label key={p} className="flex items-center gap-1 text-xs"><input type="checkbox" disabled={locked} checked={f.extra.includes(p)}
            onChange={e => setF({ ...f, extra: e.target.checked ? [...f.extra, p] : f.extra.filter(x => x !== p) })} />{PERMISSION_LABEL[p]}</label>)}
        </div>
      </details>
      {!self && !locked && (
        <div className="flex flex-wrap gap-2">
          <button disabled={pending} className={btnClass('secondary', 'sm')} onClick={async () => {
            if (!confirm('Đặt lại mật khẩu? Nhân viên bị đăng xuất khỏi mọi máy.')) return
            const r = await run(() => api<{ temp_password: string }>('/api/crm/staff', 'PATCH', { id: staff.id, action: 'reset_password' }))
            if (r) setPw(r.temp_password)
          }}>Đặt lại mật khẩu</button>
          <button disabled={pending} className={btnClass('secondary', 'sm')} onClick={() => run(() => api('/api/crm/staff', 'PATCH', { id: staff.id, action: 'unlock' }), 'Đã mở khoá')}>Mở khoá đăng nhập</button>
          {staff.status === 'active'
            ? <button disabled={pending} className={btnClass('danger', 'sm')} onClick={() => confirm('Khoá tài khoản này? (dữ liệu vẫn giữ nguyên)') && run(() => api('/api/crm/staff', 'PATCH', { id: staff.id, status: 'inactive' }), 'Đã khoá')}>Khoá tài khoản</button>
            : <button disabled={pending} className={btnClass('secondary', 'sm')} onClick={() => run(() => api('/api/crm/staff', 'PATCH', { id: staff.id, status: 'active' }), 'Đã mở lại')}>Mở lại tài khoản</button>}
        </div>
      )}
      {pw && <p className="rounded bg-amber-50 px-2 py-1 text-xs">Mật khẩu tạm (chỉ hiện 1 lần): <code className="font-mono">{pw}</code></p>}
      <Feedback error={error} message={message} />
    </div>
  )
}
