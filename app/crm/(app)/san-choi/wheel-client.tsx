'use client'
// Thành phần tương tác Sân chơi, dựng theo khung hình EasyERP (B2 bài 12 · 2:53–4:49): bánh xe cầu vồng pastel kim bên trái,
// nút giữa "QUAY NGAY", chấm đèn quanh vành; ví 3 ngăn; đổi voucher theo mệnh giá; voucher có mã vạch; thông báo xanh đáy màn.
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { api, useAction, btnClass, Feedback, inputClass, labelClass } from '../../_components/client'
import { Icon } from '../../_components/icons'
import { Barcode } from '../../_components/barcode'
import { useStored, readStored } from '../../_components/use-stored'
import { Com } from './mascot'

const money = (n: number) => n.toLocaleString('vi-VN') + 'đ'

// ───────── Âm thanh (Easymart có nút "Âm thanh"): tiếng tách khi kim lướt qua ô, chuông khi trúng ─────────
let ctx: AudioContext | null = null
function beep(freq: number, ms: number, vol = 0.06) {
  if (readStored('haco_sound') === '"off"' || readStored('haco_sound') === 'off') return
  try {
    ctx ??= new AudioContext()
    const o = ctx.createOscillator(), g = ctx.createGain()
    o.frequency.value = freq; o.type = 'triangle'; g.gain.value = vol
    o.connect(g).connect(ctx.destination); o.start()
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + ms / 1000); o.stop(ctx.currentTime + ms / 1000)
  } catch { /* máy không hỗ trợ âm thanh */ }
}
function fanfare() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, 220, 0.08), i * 120)) }

export function SoundToggle() {
  const [sound, setSound] = useStored<string>('haco_sound', 'on')
  const on = sound !== 'off'
  return (
    <button type="button" onClick={() => { setSound(on ? 'off' : 'on'); if (!on) setTimeout(() => beep(880, 120), 0) }}
      className="flex items-center gap-1.5 rounded-full border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50">
      <Icon name={on ? 'sound' : 'mute'} size={15} />Âm thanh
    </button>
  )
}

/** Thanh tab Sân chơi. Điện thoại: 3 tab chính + "Thêm" (phản biện CEO vòng 2). */
export function PlayTabs() {
  const path = usePathname()
  const [more, setMore] = useState(false)
  const tabs = [
    { href: '/crm/san-choi', label: 'Vòng quay' }, { href: '/crm/san-choi/vi', label: 'Ví của tôi' }, { href: '/crm/san-choi/chuoi', label: 'Chuỗi của tôi' },
    { href: '/crm/san-choi/bang-tin', label: 'Bảng tin' }, { href: '/crm/san-choi/bang-vang', label: 'Bảng Vàng' }, { href: '/crm/san-choi/to-doi', label: 'Tổ đội' },
    { href: '/crm/san-choi/luat', label: 'Luật chơi' },
  ]
  const cls = (href: string) => `whitespace-nowrap border-b-2 px-2.5 py-2 text-[14px] ${path === href ? 'border-amber-500 font-semibold text-amber-800' : 'border-transparent text-stone-500 hover:text-stone-800'}`
  return (
    <div className="relative mb-4 border-b border-stone-200">
      <div className="hidden flex-wrap gap-x-1 sm:flex">{tabs.map(t => <Link key={t.href} href={t.href} className={cls(t.href)}>{t.label}</Link>)}</div>
      <div className="flex sm:hidden">
        {tabs.slice(0, 3).map(t => <Link key={t.href} href={t.href} className={cls(t.href)}>{t.label}</Link>)}
        <button type="button" onClick={() => setMore(!more)} className={`ml-auto px-2.5 py-2 text-[14px] ${tabs.slice(3).some(t => t.href === path) ? 'font-semibold text-amber-800' : 'text-stone-500'}`}>Thêm ▾</button>
        {more && (
          <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-xl border border-stone-200 bg-white p-1 shadow-lg">
            {tabs.slice(3).map(t => <Link key={t.href} href={t.href} onClick={() => setMore(false)} className="block rounded-lg px-3 py-2.5 text-[15px] text-stone-700 hover:bg-amber-50">{t.label}</Link>)}
          </div>
        )}
      </div>
    </div>
  )
}

// ───────── Bánh xe ─────────
interface Prize { id: number; label: string; short: string; kind: string }
interface SpinResult { prizeId: number; label: string; kind: string; value: number; capped: boolean; letter: string | null }

/** Màu cầu vồng pastel theo vị trí ô (giống vòng quay Easymart). */
const hue = (i: number, n: number) => `hsl(${Math.round(i * 360 / n)} 85% 82%)`

export function SpinWheel({ prizes, tokens, playing }: { prizes: Prize[]; tokens: number; playing: boolean }) {
  const router = useRouter()
  const [angle, setAngle] = useState(0)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<SpinResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [left, setLeft] = useState(tokens)
  // Số lượt mới từ máy chủ (sau router.refresh) thì đồng bộ lại ngay trong lúc vẽ
  const [seen, setSeen] = useState(tokens)
  if (tokens !== seen) { setSeen(tokens); setLeft(tokens) }
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => () => { if (timer.current) clearInterval(timer.current) }, [])
  const n = prizes.length
  const slice = 360 / n

  async function go() {
    setError(null); setResult(null); setBusy(true)
    try {
      const r = await api<SpinResult>('/api/crm/san-choi', 'POST', { action: 'quay' })
      const idx = Math.max(0, prizes.findIndex(p => p.id === r.prizeId))
      // Kim bên TRÁI (270° tính theo chiều kim đồng hồ từ đỉnh): quay 6 vòng rồi dừng giữa ô trúng, lệch nhẹ cho tự nhiên
      const jitter = (Math.random() - 0.5) * slice * 0.6
      const target = ((270 - (idx * slice + slice / 2) + jitter) % 360 + 360) % 360
      const base = angle - (angle % 360)
      setAngle(base + 360 * 6 + target)
      // Tiếng tách thưa dần theo tốc độ bánh xe
      let k = 0
      timer.current = setInterval(() => { k++; if (k % Math.max(1, Math.floor(k / 12)) === 0) beep(1200, 25, 0.03) }, 60)
      setTimeout(() => {
        if (timer.current) clearInterval(timer.current)
        fanfare(); setResult(r); setLeft(x => Math.max(0, x - 1)); setBusy(false); router.refresh()
      }, 4600)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e)); setBusy(false)
    }
  }

  const R = 140, C = 160
  // Làm tròn 2 số lẻ: máy chủ và trình duyệt tính sin/cos lệch ở số lẻ thứ 15 làm vỡ hydrate
  const pt = (deg: number, r: number) => [C + r * Math.sin(deg * Math.PI / 180), C - r * Math.cos(deg * Math.PI / 180)].map(v => Math.round(v * 100) / 100)
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-full max-w-[340px]">
        <svg viewBox="0 0 320 320" className="w-full">
          <defs><filter id="sh" x="-10%" y="-10%" width="120%" height="120%"><feDropShadow dx="0" dy="3" stdDeviation="4" floodOpacity=".15" /></filter></defs>
          <circle cx={C} cy={C} r={R + 12} fill="#fff" filter="url(#sh)" />
          {Array.from({ length: 24 }, (_, i) => { const [x, y] = pt(i * 15, R + 6); return <circle key={i} cx={x} cy={y} r={2.6} fill={busy && i % 2 ? '#fbbf24' : '#e7c27a'} /> })}
          <g style={{ transform: `rotate(${angle}deg)`, transformOrigin: `${C}px ${C}px`, transition: busy ? 'transform 4.5s cubic-bezier(.12,.8,.2,1)' : 'none' }}>
            {prizes.map((p, i) => {
              const [x1, y1] = pt(i * slice, R), [x2, y2] = pt((i + 1) * slice, R)
              const mid = i * slice + slice / 2
              const [tx, ty] = pt(mid, R * 0.66)
              const letter = p.kind === 'chu'
              const words = p.short.split(' ')
              return (
                <g key={p.id}>
                  <path d={`M${C} ${C} L${x1} ${y1} A${R} ${R} 0 0 1 ${x2} ${y2} Z`} fill={hue(i, n)} stroke="#fff" strokeWidth="1.5" />
                  <text x={tx} y={ty} textAnchor="middle" dominantBaseline="middle" transform={`rotate(${mid > 180 ? mid + 90 : mid - 90} ${tx} ${ty})`}
                    fontSize={letter ? 20 : p.short.length > 6 ? 10 : 13} fontWeight={letter ? 800 : 700} fill="#3f2a14">
                    {words.length > 1 && p.short.length > 8 ? words.map((w, k) => <tspan key={k} x={tx} dy={k === 0 ? -(words.length - 1) * 5.5 : 11}>{w}</tspan>) : p.short}
                  </text>
                </g>
              )
            })}
          </g>
          {/* Kim bên trái như Easymart */}
          <polygon points={`${C - R - 16},${C - 11} ${C - R - 16},${C + 11} ${C - R + 10},${C}`} fill="#334155" stroke="#fff" strokeWidth="2" />
        </svg>
        <button type="button" onClick={go} disabled={busy || left < 1 || !playing}
          className="absolute left-1/2 top-1/2 flex h-[76px] w-[76px] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border-4 border-white bg-gradient-to-b from-amber-300 to-amber-500 text-[13px] font-extrabold leading-tight text-amber-950 shadow-lg transition active:scale-95 disabled:from-stone-200 disabled:to-stone-300 disabled:text-stone-500">
          {busy ? '…' : <>QUAY<br />NGAY</>}
        </button>
      </div>
      <p className="mt-2 text-center text-sm text-stone-500">Mỗi lượt quay chắc chắn có quà.</p>
      {!playing && <p className="mt-2 text-center text-sm text-stone-500">Bộ phận bạn chưa vào Sân chơi đợt này.</p>}
      {playing && left < 1 && !result && !busy && <p className="mt-1 text-center text-sm text-stone-500">Hết lượt. Làm một <b>ca hoàn hảo</b> để có lượt mới.</p>}
      {error && <p className="mt-2 text-center text-sm text-rose-600">{error}</p>}
      {result && (
        <div className="mt-4 flex w-full items-center gap-3 rounded-2xl border-2 border-amber-300 bg-amber-50 p-3">
          <Com mood="tu_hao" size={60} />
          <div className="min-w-0">
            <div className="text-xs text-amber-800">Bạn trúng</div>
            <div className="text-xl font-extrabold text-amber-900">{result.label}</div>
            <div className="text-xs text-amber-800">
              {result.kind === 'tien' ? 'Đã vào Ví tiền thưởng.' : result.kind === 'chu' ? `Đã vào Ví chữ. Gom đủ HACO hoặc FOOD để đổi thưởng!` : result.kind === 'khien' ? 'Khiên tự đỡ 1 lần đi muộn.' : 'Đã vào túi quà — vào Ví để dùng.'}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ───────── Thông báo xanh đáy màn (như EasyERP) ─────────
function Toast({ text, onDone }: { text: string; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 5000); return () => clearTimeout(t) }, [onDone])
  return <div className="fixed bottom-24 left-1/2 z-[70] w-[min(92vw,420px)] -translate-x-1/2 rounded-xl bg-emerald-600 px-4 py-3 text-center text-sm font-medium text-white shadow-xl lg:bottom-8">{text}</div>
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center bg-stone-900/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl" onClick={e => e.stopPropagation()}>{children}</div>
    </div>
  )
}

interface Voucher { id: number; code: string; amount: number; status: string; expires_at: string; used_at: string | null }

function VoucherCard({ v, onClose }: { v: Voucher; onClose: () => void }) {
  const st = { con_han: ['Còn hạn', 'bg-emerald-50 text-emerald-700'], da_dung: ['Đã dùng', 'bg-stone-100 text-stone-600'], het_han_hoan: ['Hết hạn · đã hoàn tiền', 'bg-sky-50 text-sky-700'] }[v.status] ?? ['?', '']
  return (
    <Modal onClose={onClose}>
      <div className="text-center text-[11px] font-semibold uppercase tracking-widest text-amber-700">Voucher mua hàng nội bộ</div>
      <div className="mt-1 text-center text-3xl font-extrabold text-[#2f6f5e]">{money(v.amount)}</div>
      <div className="mx-auto mt-3 rounded-xl border border-stone-200 bg-white px-3 pt-3">
        <Barcode value={v.code} className="h-20 w-full" />
        <div className="py-1.5 text-center font-mono text-sm tracking-widest text-stone-700">{v.code}</div>
      </div>
      <p className="mt-3 text-center text-xs text-stone-500">Chỉ lấy hàng HACO theo giá nội bộ, không thối tiền thừa, không chuyển cho người khác.</p>
      <dl className="mt-3 space-y-1.5 text-sm">
        <div className="flex justify-between"><dt className="text-stone-500">Hạn dùng</dt><dd className="font-semibold">{new Date(v.expires_at).toLocaleDateString('vi-VN')}</dd></div>
        <div className="flex justify-between"><dt className="text-stone-500">Trạng thái</dt><dd><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${st[1]}`}>{st[0]}</span></dd></div>
      </dl>
      <p className="mt-3 text-center text-sm text-stone-600">Đưa mã này cho <b>thủ kho</b> quét khi lấy hàng.</p>
      <button onClick={onClose} className="mt-4 w-full rounded-xl bg-[#2f6f5e] py-3 text-base font-semibold text-white hover:bg-[#275c4e]">Đóng</button>
    </Modal>
  )
}

/** Ngăn "Ví tiền thưởng": số dư to + Đổi voucher (mệnh giá) + Cộng lương. */
export function MoneyWallet({ balance, perWeek, days }: { balance: number; perWeek: number; days: number }) {
  const router = useRouter()
  const [open, setOpen] = useState<'' | 'voucher' | 'luong'>('')
  const [toast, setToast] = useState('')
  const [card, setCard] = useState<Voucher | null>(null)
  const { run, pending, error } = useAction()
  const [amount, setAmount] = useState('')
  return (
    <>
      <div className="text-xs font-medium text-stone-500">Số dư tiền thưởng</div>
      <div className="mt-1 text-4xl font-extrabold tabular-nums text-[#8a5a12]">{money(balance)}</div>
      <button type="button" onClick={() => setOpen('voucher')} className="mt-3 w-full rounded-xl bg-amber-400 py-3 text-base font-bold text-amber-950 shadow-sm hover:bg-amber-500">Đổi voucher</button>
      <button type="button" onClick={() => setOpen('luong')} className="mt-2 w-full py-1.5 text-sm font-medium text-stone-500 underline">Hoặc cộng vào lương tháng (từ 100.000đ)</button>
      {open === 'voucher' && (
        <Modal onClose={() => setOpen('')}>
          <div className="text-lg font-bold">Đổi voucher</div>
          <div className="text-sm text-stone-500">Số dư: <b className="text-stone-800">{money(balance)}</b></div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[20000, 50000, 100000].map(a => (
              <button key={a} type="button" disabled={pending || a > balance}
                onClick={() => run(() => api<Voucher>('/api/crm/san-choi', 'POST', { action: 'doi_voucher', amount: a })).then(v => {
                  if (!v) return
                  setOpen(''); setCard(v); setToast(`Đã đổi voucher ${money(v.amount)} — mã ${v.code}, hạn ${days} ngày`); router.refresh()
                })}
                className="rounded-xl border border-amber-200 bg-amber-50 py-3 text-center hover:border-amber-400 disabled:opacity-40">
                <div className="text-base font-extrabold text-amber-900">{a / 1000}K</div><div className="text-[11px] text-amber-700">Hạn {days} ngày</div>
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-stone-500">⏳ Hạn tính từ ngày đổi. Tối đa {perWeek} voucher/tuần. Hết hạn chưa dùng thì tiền tự hoàn về ví (1 lần; sau đó chờ 7 ngày mới đổi tiếp).</p>
          <div className="mt-2"><Feedback error={error} /></div>
          <button onClick={() => setOpen('')} className="mt-3 w-full rounded-xl border border-stone-200 py-2.5 text-sm font-medium">Đóng</button>
        </Modal>
      )}
      {open === 'luong' && (
        <Modal onClose={() => setOpen('')}>
          <div className="text-lg font-bold">Cộng vào lương tháng</div>
          <p className="mt-1 text-sm text-stone-500">Từ 100.000đ, tối đa 300.000đ/tháng. Kế toán duyệt, chốt ngày 25.</p>
          <label className={`${labelClass} mt-3`}>Số tiền</label>
          <input inputMode="numeric" className={`${inputClass} text-base`} value={amount} onChange={e => setAmount(e.target.value.replace(/\D/g, ''))} placeholder="100000" />
          <div className="mt-2"><Feedback error={error} /></div>
          <button disabled={pending || Number(amount) < 100000 || Number(amount) > balance} className={`${btnClass('primary')} mt-3 w-full py-3 text-base`}
            onClick={() => run(() => api('/api/crm/san-choi', 'POST', { action: 'doi', kind: 'luong', amount: Number(amount) })).then(r => { if (r) { setOpen(''); setAmount(''); setToast('Đã gửi yêu cầu cộng lương, chờ kế toán duyệt') } })}>Gửi yêu cầu</button>
        </Modal>
      )}
      {card && <VoucherCard v={card} onClose={() => setCard(null)} />}
      {toast && <Toast text={toast} onDone={() => setToast('')} />}
    </>
  )
}

/** Ngăn "Ví Voucher/Coupon": bấm vào dòng để hiện mã vạch cho thủ kho quét. */
export function VoucherList({ vouchers, gifts }: { vouchers: Voucher[]; gifts: { id: number; label: string; status: string }[] }) {
  const [card, setCard] = useState<Voucher | null>(null)
  const { run, pending, error, message } = useAction()
  const tag = (s: string) => ({ con_han: ['Còn hạn', 'border-emerald-300 text-emerald-700'], da_dung: ['Đã dùng', 'border-stone-300 text-stone-500'], het_han_hoan: ['Đã hoàn tiền', 'border-sky-300 text-sky-700'] }[s] ?? ['?', ''])
  return (
    <>
      <p className="mb-3 text-xs text-stone-500">Bấm vào dòng để hiện mã vạch cho thủ kho quét.</p>
      {vouchers.length === 0 && gifts.length === 0 && <p className="py-6 text-center text-sm text-stone-400">Chưa có voucher hay quà nào.</p>}
      <ul className="divide-y divide-stone-100">
        {gifts.map(g => (
          <li key={'g' + g.id} className="flex items-center gap-2 py-3">
            <span className="rounded-md bg-orange-500 px-2 py-0.5 text-[11px] font-bold text-white">Quà</span>
            <span className="min-w-0 flex-1 text-[15px] font-semibold text-orange-700">🎁 {g.label}</span>
            {g.status === 'cho_duyet' ? <span className="rounded-full border border-amber-300 px-2 py-0.5 text-xs text-amber-700">Chờ duyệt</span> : (
              <button type="button" disabled={pending} className={btnClass('secondary', 'sm')} onClick={() => {
                const note = g.label.includes('ngày nghỉ') ? prompt('Bạn muốn nghỉ ngày nào? (vd 15/11)') : ''
                if (note === null) return
                run(() => api('/api/crm/san-choi', 'POST', { action: 'doi', kind: 'vat_pham', item_id: g.id, note: note ? `${g.label}: ${note}` : '' }), 'Đã gửi, chờ quản lý duyệt')
              }}>Dùng</button>
            )}
          </li>
        ))}
        {vouchers.map(v => {
          const [label, cls] = tag(v.status)
          return (
            <li key={v.id}>
              <button type="button" onClick={() => setCard(v)} className="flex w-full items-center gap-2 py-3 text-left">
                <span className="rounded-md bg-[#2f6f5e] px-2 py-0.5 text-[11px] font-bold text-white">Voucher</span>
                <span className="min-w-0 flex-1"><span className="block text-[15px] font-bold text-[#2f6f5e]">{money(v.amount)}</span><span className="text-xs text-stone-400">Mã {v.code}</span></span>
                <span className="text-right"><span className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-medium ${cls}`}>{label}</span>
                  <span className="block text-[11px] text-stone-400">HSD {new Date(v.expires_at).toLocaleDateString('vi-VN')}</span></span>
              </button>
            </li>
          )
        })}
      </ul>
      <Feedback error={error} message={message} />
      {card && <VoucherCard v={card} onClose={() => setCard(null)} />}
    </>
  )
}

/** Quản lý khen / thưởng nóng tại chỗ (lý do chọn sẵn, hiện công khai). */
export function KudosForm({ staff, reasons }: { staff: { id: number; name: string }[]; reasons: Record<string, string> }) {
  const { run, pending, error, message } = useAction()
  const [f, setF] = useState({ to_staff: '', reason: Object.keys(reasons)[0], message: '', tokens: '1' })
  return (
    <form className="space-y-3" onSubmit={e => {
      e.preventDefault()
      run(() => api('/api/crm/san-choi', 'POST', { action: 'khen', ...f, tokens: Number(f.tokens) }), 'Đã khen, hiện trên bảng tin').then(r => { if (r) setF({ ...f, message: '' }) })
    }}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className={labelClass}>Khen ai</label>
          <select className={inputClass} value={f.to_staff} onChange={e => setF({ ...f, to_staff: e.target.value })} required>
            <option value="">— Chọn người —</option>
            {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select></div>
        <div><label className={labelClass}>Vì sao</label>
          <select className={inputClass} value={f.reason} onChange={e => setF({ ...f, reason: e.target.value })}>
            {Object.entries(reasons).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select></div>
      </div>
      <div><label className={labelClass}>Lời khen (không bắt buộc)</label>
        <input className={inputClass} maxLength={200} value={f.message} onChange={e => setF({ ...f, message: e.target.value })} placeholder="VD: Ở lại gói 40 đơn cứu ca chiều" /></div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-stone-600">Thưởng lượt quay:</span>
        {['0', '1', '2'].map(t => (
          <button type="button" key={t} onClick={() => setF({ ...f, tokens: t })}
            className={`rounded-full px-3 py-1 text-sm ${f.tokens === t ? 'bg-amber-500 font-semibold text-white' : 'bg-white ring-1 ring-stone-300'}`}>{t}</button>
        ))}
        <button disabled={pending || !f.to_staff} className={`${btnClass('primary')} ml-auto`}>Khen</button>
      </div>
      <Feedback error={error} message={message} />
    </form>
  )
}
