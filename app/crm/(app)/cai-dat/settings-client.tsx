'use client'
import { useState } from 'react'
import { api, useAction, btnClass, inputClass, labelClass, Feedback } from '../../_components/client'

const put = (body: object) => api('/api/crm/settings', 'PUT', body)

export function SiteForm({ site }: { site: { id: number; name: string; address: string; lat: number | null; lng: number | null; radius_m: number; allowed_ips: string } }) {
  const { run, pending, error, message } = useAction()
  const [f, setF] = useState({ ...site, lat: String(site.lat ?? ''), lng: String(site.lng ?? ''), radius_m: String(site.radius_m) })
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <div className="sm:col-span-2"><label className={labelClass}>Tên</label><input className={inputClass} value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></div>
      <div className="sm:col-span-2"><label className={labelClass}>Địa chỉ</label><input className={inputClass} value={f.address} onChange={e => setF({ ...f, address: e.target.value })} /></div>
      <div><label className={labelClass}>Vĩ độ</label><input className={inputClass} value={f.lat} onChange={e => setF({ ...f, lat: e.target.value })} /></div>
      <div><label className={labelClass}>Kinh độ</label><input className={inputClass} value={f.lng} onChange={e => setF({ ...f, lng: e.target.value })} /></div>
      <div><label className={labelClass}>Bán kính (m)</label><input inputMode="numeric" className={inputClass} value={f.radius_m} onChange={e => setF({ ...f, radius_m: e.target.value })} /></div>
      <div><label className={labelClass}>IP Wi-Fi bếp</label><input className={inputClass} value={f.allowed_ips} onChange={e => setF({ ...f, allowed_ips: e.target.value })} placeholder="VD: 113.190.x.x" /></div>
      <div className="flex items-center gap-2 sm:col-span-2">
        <button disabled={pending} className={btnClass('primary', 'sm')} onClick={() => run(() => put({ kind: 'site', ...f, lat: Number(f.lat), lng: Number(f.lng), radius_m: Number(f.radius_m) }), 'Đã lưu')}>Lưu</button>
        <button className={btnClass('ghost', 'sm')} onClick={() => navigator.geolocation?.getCurrentPosition(p => setF({ ...f, lat: p.coords.latitude.toFixed(6), lng: p.coords.longitude.toFixed(6) }))}>Lấy vị trí máy này</button>
        <Feedback error={error} message={message} />
      </div>
    </div>
  )
}

export function TargetRow({ department, label, hours }: { department: string; label: string; hours: number[] }) {
  const { run, pending, error, message } = useAction()
  const [h, setH] = useState(hours.map(String))
  return (
    <div className="flex flex-wrap items-center gap-1 text-sm">
      <span className="w-32 shrink-0">{label}</span>
      {h.map((v, i) => <input key={i} aria-label={`Ngày ${i + 1}`} className="w-12 rounded border border-stone-300 px-1 py-1 text-center text-xs tabular-nums" value={v} onChange={e => setH(h.map((x, j) => j === i ? e.target.value : x))} />)}
      <button disabled={pending} className={btnClass('secondary', 'sm')} onClick={() => run(() => put({ kind: 'target', department, hours: h.map(Number) }), 'Đã lưu')}>Lưu</button>
      <Feedback error={error} message={message} />
    </div>
  )
}

export function ShiftForm({ departments }: { departments: Record<string, string> }) {
  const { run, pending, error, message } = useAction()
  const [f, setF] = useState({ code: '', name: '', department: '', start_time: '08:00', end_time: '17:00', break_minutes: '60', late_grace_minutes: '5', shift_kind: 'toan_ca', color: '#0f766e' })
  return (
    <div className="grid gap-2 sm:grid-cols-9">
      <div><label className={labelClass}>Mã</label><input className={inputClass} value={f.code} onChange={e => setF({ ...f, code: e.target.value.toUpperCase() })} /></div>
      <div className="sm:col-span-2"><label className={labelClass}>Tên</label><input className={inputClass} value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></div>
      <div className="sm:col-span-2"><label className={labelClass}>Bộ phận</label><select className={inputClass} value={f.department} onChange={e => setF({ ...f, department: e.target.value })}><option value="">Mọi bộ phận</option>{Object.entries(departments).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
      <div><label className={labelClass}>Bắt đầu</label><input type="time" className={inputClass} value={f.start_time} onChange={e => setF({ ...f, start_time: e.target.value })} /></div>
      <div><label className={labelClass}>Kết thúc</label><input type="time" className={inputClass} value={f.end_time} onChange={e => setF({ ...f, end_time: e.target.value })} /></div>
      <div><label className={labelClass}>Nghỉ (phút)</label><input className={inputClass} value={f.break_minutes} onChange={e => setF({ ...f, break_minutes: e.target.value })} /></div>
      <div><label className={labelClass}>Màu</label><input type="color" className="h-9 w-full rounded border border-stone-300" value={f.color} onChange={e => setF({ ...f, color: e.target.value })} /></div>
      <div className="flex items-center gap-2 sm:col-span-9">
        <button disabled={pending || !f.code} className={btnClass('primary', 'sm')} onClick={() => run(() => put({ kind: 'shift', ...f }), 'Đã lưu ca')}>Thêm / sửa ca theo mã</button>
        <Feedback error={error} message={message} />
      </div>
    </div>
  )
}

export function ProductRow({ p }: { p: { id: number; rank: number | null; name: string; line: string; price: string; ws: string; use_up_days: number | string; private_channel_only: boolean; next_offer: string } }) {
  const { run, pending, error, message } = useAction()
  const [f, setF] = useState({ use_up_days: String(p.use_up_days), private_channel_only: p.private_channel_only, next_offer: p.next_offer })
  return (
    <tr>
      <td className="px-3 py-2 text-xs text-stone-400">{p.rank}</td>
      <td className="px-3 py-2">{p.name}</td>
      <td className="px-3 py-2 text-xs">{p.line}</td>
      <td className="px-3 py-2 tabular-nums">{p.price}</td>
      <td className="max-w-[200px] px-3 py-2 text-xs text-stone-500">{p.ws}</td>
      <td className="px-3 py-2"><input className="w-16 rounded border border-stone-300 px-1 py-1 text-xs" value={f.use_up_days} onChange={e => setF({ ...f, use_up_days: e.target.value.replace(/\D/g, '') })} /></td>
      <td className="px-3 py-2"><input type="checkbox" checked={f.private_channel_only} onChange={e => setF({ ...f, private_channel_only: e.target.checked })} /></td>
      <td className="px-3 py-2"><input className="w-48 rounded border border-stone-300 px-1 py-1 text-xs" value={f.next_offer} onChange={e => setF({ ...f, next_offer: e.target.value })} /></td>
      <td className="px-3 py-2"><button disabled={pending} className={btnClass('secondary', 'sm')} onClick={() => run(() => put({ kind: 'product', id: p.id, ...f }), 'Đã lưu')}>Lưu</button>{(error || message) && <div className="text-[10px]"><Feedback error={error} message={message} /></div>}</td>
    </tr>
  )
}

export function VoucherForm({ current }: { current: { program: string; amount: number; valid_days: number } | null }) {
  const { run, pending, error, message } = useAction()
  const [f, setF] = useState({ program: current?.program ?? 'mini-dot-a-2610', amount: current ? String(current.amount) : '', valid_days: current ? String(current.valid_days) : '' })
  return (
    <div className="grid gap-2 sm:grid-cols-4">
      <div><label className={labelClass}>Mã chương trình</label><input className={inputClass} value={f.program} onChange={e => setF({ ...f, program: e.target.value.toLowerCase() })} /></div>
      <div><label className={labelClass}>Số tiền giảm (đ)</label><input inputMode="numeric" className={inputClass} value={f.amount} onChange={e => setF({ ...f, amount: e.target.value.replace(/\D/g, '') })} placeholder="Cô Hạ chốt" /></div>
      <div><label className={labelClass}>Hạn dùng (ngày)</label><input inputMode="numeric" className={inputClass} value={f.valid_days} onChange={e => setF({ ...f, valid_days: e.target.value.replace(/\D/g, '') })} placeholder="VD: 14" /></div>
      <div className="flex items-end gap-2">
        <button disabled={pending} className={btnClass('primary', 'sm')} onClick={() => run(() => put({ kind: 'mini_voucher', program: f.program, amount: Number(f.amount), valid_days: Number(f.valid_days) }), 'Đã lưu — Mini App bắt đầu cấp voucher')}>Lưu</button>
        {current && <button disabled={pending} className={btnClass('danger', 'sm')} onClick={() => confirm('Ngừng cấp voucher mới?') && run(() => put({ kind: 'mini_voucher', clear: true }), 'Đã ngừng cấp')}>Ngừng cấp</button>}
      </div>
      <div className="sm:col-span-4">{current ? <p className="text-xs text-emerald-700">Đang cấp: {current.amount.toLocaleString('vi-VN')}đ, hạn {current.valid_days} ngày ({current.program})</p> : <p className="text-xs text-amber-700">Chưa cài — Mini App chưa cấp voucher.</p>}<Feedback error={error} message={message} /></div>
    </div>
  )
}

export function PointsForm({ current }: { current: { checkin: number; milestones: Record<string, number> } | null }) {
  const { run, pending, error, message } = useAction()
  const base = current ?? { checkin: 5, milestones: { '3': 10, '7': 30, '14': 60, '30': 150 } }
  const [checkin, setCheckin] = useState(String(base.checkin))
  const [rows, setRows] = useState(Object.entries(base.milestones).map(([d, p]) => ({ d, p: String(p) })))
  const save = () => run(() => put({ kind: 'mini_points', checkin: Number(checkin),
    milestones: Object.fromEntries(rows.filter(r => r.d && r.p).map(r => [r.d, Number(r.p)])) }), 'Đã lưu mức điểm')
  return (
    <div className="space-y-2 text-sm">
      <div className="flex items-center gap-2"><span className="w-40">Mỗi lần điểm danh</span>
        <input inputMode="numeric" className="w-20 rounded border border-stone-300 px-2 py-1" value={checkin} onChange={e => setCheckin(e.target.value.replace(/\D/g, ''))} /> hạt</div>
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-2"><span className="w-40">Chuỗi đủ</span>
          <input inputMode="numeric" aria-label="Số ngày" className="w-16 rounded border border-stone-300 px-2 py-1" value={r.d} onChange={e => setRows(rows.map((x, j) => j === i ? { ...x, d: e.target.value.replace(/\D/g, '') } : x))} /> ngày →
          <input inputMode="numeric" aria-label="Điểm" className="w-20 rounded border border-stone-300 px-2 py-1" value={r.p} onChange={e => setRows(rows.map((x, j) => j === i ? { ...x, p: e.target.value.replace(/\D/g, '') } : x))} /> hạt
          <button className={btnClass('ghost', 'sm')} onClick={() => setRows(rows.filter((_, j) => j !== i))}>Bỏ</button></div>
      ))}
      <div className="flex flex-wrap items-center gap-2">
        <button className={btnClass('secondary', 'sm')} onClick={() => setRows([...rows, { d: '', p: '' }])}>+ Mốc</button>
        <button disabled={pending} className={btnClass('primary', 'sm')} onClick={save}>Lưu</button>
        {current && <button disabled={pending} className={btnClass('ghost', 'sm')} onClick={() => run(() => put({ kind: 'mini_points', clear: true }), 'Đã về mức mặc định')}>Về mặc định</button>}
        <span className="text-xs text-stone-500">{current ? 'Đang dùng mức đã cài' : 'Đang dùng mức mặc định'}</span>
        <Feedback error={error} message={message} />
      </div>
    </div>
  )
}
