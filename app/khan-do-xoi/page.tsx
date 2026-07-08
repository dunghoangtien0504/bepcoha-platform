'use client'

import { useState, useRef, useEffect } from 'react'

// ─── Brand colors (HaCo Food — deep forest green) ─────────────────────────────
// Primary:  #0D3B22 (dark hero)  #155C34 (brand)  #1E7A43 (mid)  #27AE60 (bright)
// CTA gold: #F0B429 (contrasts max vs green)
// Light bg: #F4FCF7  Border: #C8E6D0

// ─── Assets ───────────────────────────────────────────────────────────────────
const IMG = {
  luoi:   '/images/khan-do-xoi/san-pham/724597989_1683075906108439_2952143396022032152_n.jpg',
  gapgon: '/images/khan-do-xoi/san-pham/706035495_1627795419070070_876115190267151157_n.jpg',
  xoicho: '/images/khan-do-xoi/thanh-pham/724485203_2296217747574178_5800612475932619747_n.jpg',
  review: '/images/khan-do-xoi/thanh-pham/724613553_990229680459328_6428958116600383338_n.jpg',
  phu:    '/images/khan-do-xoi/thanh-pham/722995300_1362690915719266_3411856794429446282_n.jpg',
}

const PRICE = 49000
const fmt = (n: number) => n.toLocaleString('vi-VN') + 'đ'

// ─── Types ────────────────────────────────────────────────────────────────────
interface QR { bankAccount: string; bankCode: string; accountName: string; amount: number; content: string; qrUrl: string }
interface PaymentData { refCode: string; totalPrice: number; productLabel: string; qr: QR }

// ─── Countdown ────────────────────────────────────────────────────────────────
function Countdown({ seconds }: { seconds: number }) {
  const [left, setLeft] = useState(seconds)
  useEffect(() => {
    if (left <= 0) return
    const t = setTimeout(() => setLeft(l => l - 1), 1000)
    return () => clearTimeout(t)
  }, [left])
  const m = Math.floor(left / 60).toString().padStart(2, '0')
  const s = (left % 60).toString().padStart(2, '0')
  const urgent = left < 120
  return (
    <span style={{ fontVariantNumeric: 'tabular-nums' }}
      className={urgent ? 'text-red-500 font-extrabold animate-pulse' : 'font-extrabold text-[#0D3B22]'}>
      {m}:{s}
    </span>
  )
}

// ─── Payment Step ─────────────────────────────────────────────────────────────
function PaymentStep({ data, name, qty }: { data: PaymentData; name: string; qty: number }) {
  const [copied, setCopied] = useState<'ref' | 'amt' | null>(null)
  const copy = (text: string, k: 'ref' | 'amt') => {
    navigator.clipboard.writeText(text).then(() => { setCopied(k); setTimeout(() => setCopied(null), 2500) })
  }

  return (
    <div className="min-h-screen bg-[#F4FCF7]">
      {/* Header */}
      <div className="bg-[#0D3B22] text-white text-center py-4 px-4">
        <p className="text-green-300 text-sm font-semibold">Đơn của bạn đã được ghi nhận!</p>
        <p className="font-extrabold text-lg mt-0.5">Hoàn tất chuyển khoản để xác nhận giao hàng</p>
      </div>

      <div className="max-w-sm mx-auto w-full px-4 py-6 space-y-5">
        {/* Timer */}
        <div className="bg-white border border-[#C8E6D0] rounded-2xl py-3 px-4 text-center shadow-sm">
          <p className="text-sm text-gray-500">QR thanh toán hết hạn sau</p>
          <p className="text-4xl mt-1"><Countdown seconds={30 * 60} /></p>
          <p className="text-xs text-gray-400 mt-0.5">Vui lòng chuyển khoản trước khi hết giờ</p>
        </div>

        {/* QR */}
        <div className="bg-white rounded-3xl p-5 shadow-md text-center border border-[#C8E6D0]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={data.qr.qrUrl} alt="QR chuyển khoản"
            className="w-48 h-48 mx-auto rounded-xl border-2 border-[#C8E6D0] object-contain" />
          <p className="text-xs text-gray-400 mt-2">Quét bằng app ngân hàng bất kỳ</p>
        </div>

        {/* Bank info */}
        <div className="bg-white rounded-2xl border border-[#C8E6D0] divide-y divide-[#E8F5EC] overflow-hidden shadow-sm">
          <div className="flex justify-between items-center px-4 py-3 text-sm">
            <span className="text-gray-500">Ngân hàng</span>
            <span className="font-bold">{data.qr.bankCode} · {data.qr.accountName}</span>
          </div>
          <div className="flex justify-between items-center px-4 py-3 text-sm">
            <span className="text-gray-500">Số tài khoản</span>
            <span className="font-mono font-bold">{data.qr.bankAccount}</span>
          </div>
          <div className="flex justify-between items-center px-4 py-3">
            <span className="text-sm text-gray-500">Số tiền</span>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-[#155C34]">{fmt(data.totalPrice)}</span>
              <button onClick={() => copy(String(data.totalPrice), 'amt')} aria-label="Copy số tiền"
                className="min-w-[44px] min-h-[44px] text-xs bg-green-50 text-green-700 px-2 rounded-lg font-medium flex items-center justify-center">
                {copied === 'amt' ? '✓' : 'Copy'}
              </button>
            </div>
          </div>
          <div className="flex justify-between items-center px-4 py-3 bg-green-50">
            <div>
              <span className="text-sm text-gray-500">Nội dung CK</span>
              <span className="text-red-500 text-xs font-bold ml-1">(bắt buộc)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold font-mono text-[#155C34]">{data.refCode}</span>
              <button onClick={() => copy(data.refCode, 'ref')} aria-label="Copy mã chuyển khoản"
                className="min-w-[44px] min-h-[44px] text-xs bg-green-100 text-green-800 px-2 rounded-lg font-bold flex items-center justify-center">
                {copied === 'ref' ? '✓ Đã copy' : 'Copy'}
              </button>
            </div>
          </div>
        </div>

        {/* Note */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
          Nhập <strong>đúng nội dung</strong> <code className="bg-amber-100 px-1 rounded">{data.refCode}</code> khi chuyển — hệ thống tự xác nhận, Cô Hạ nhận thông báo và chuẩn bị giao hàng ngay.
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
          Giá <strong>{fmt(data.totalPrice)}</strong> chưa bao gồm phí vận chuyển — phí ship tính riêng khi giao hàng.
        </div>

        {/* Summary */}
        <div className="text-center text-sm text-gray-500 pb-8">
          <p>Đơn của <strong className="text-gray-700">{name}</strong> · Khăn 1m×1m × {qty}</p>
          <p className="mt-1 text-xs">Sau khi chuyển khoản, đơn tự động xác nhận — không cần báo lại.</p>
        </div>
      </div>
    </div>
  )
}

// ─── Mini Order Form ──────────────────────────────────────────────────────────
function OrderForm() {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [qty, setQty] = useState(1)
  const [note, setNote] = useState('')
  const [step, setStep] = useState<'idle' | 'loading' | 'done' | 'err'>('idle')
  const [error, setError] = useState('')
  const [payment, setPayment] = useState<PaymentData | null>(null)
  const total = PRICE * qty

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !phone.trim() || !address.trim()) {
      setError('Vui lòng điền đủ họ tên, số điện thoại và địa chỉ')
      return
    }
    setStep('loading'); setError('')
    try {
      const res = await fetch('/api/khan-do-xoi-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, address, quantity: qty, note }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Lỗi')
      setPayment(data); setStep('done')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Có lỗi, thử lại nhé')
      setStep('err')
    }
  }

  if (step === 'done' && payment) return <PaymentStep data={payment} name={name} qty={qty} />

  return (
    <form onSubmit={submit} className="space-y-4">
      {/* Product pill */}
      <div className="flex items-center justify-between bg-green-50 rounded-xl px-4 py-3 border border-[#C8E6D0]">
        <div>
          <p className="font-bold text-[#0D3B22]">Khăn Đồ Xôi 1m×1m</p>
          <p className="text-xs text-gray-500 mt-0.5">Vải lưới hấp xôi · Bếp Cô Hạ</p>
        </div>
        <div className="text-right">
          <p className="font-extrabold text-xl text-[#155C34]">{fmt(PRICE)}</p>
          <p className="text-xs text-gray-400">chưa gồm ship</p>
        </div>
      </div>

      {/* Qty */}
      <div>
        <label className="block text-sm font-bold text-gray-700 mb-2">Số lượng</label>
        <div className="flex items-center gap-3">
          <button type="button" aria-label="Giảm" onClick={() => setQty(q => Math.max(1, q - 1))}
            className="w-11 h-11 rounded-full border-2 border-gray-200 text-xl font-bold flex items-center justify-center hover:border-[#1E7A43] transition-colors">
            −
          </button>
          <span className="w-8 text-center font-extrabold text-xl text-[#155C34]">{qty}</span>
          <button type="button" aria-label="Tăng" onClick={() => setQty(q => Math.min(20, q + 1))}
            className="w-11 h-11 rounded-full border-2 border-gray-200 text-xl font-bold flex items-center justify-center hover:border-[#1E7A43] transition-colors">
            +
          </button>
          {qty > 1 && <span className="text-sm font-bold text-[#155C34]">= {fmt(total)}</span>}
        </div>
        {qty >= 3 && <p className="text-xs text-[#1E7A43] mt-1.5 font-medium">Mua nhiều — dùng thay nhau, không lo mất khăn khi một cái đang giặt</p>}
      </div>

      {/* Fields */}
      {[
        { id: 'name', label: 'Họ và tên *', val: name, set: setName, type: 'text', ph: 'Nguyễn Thị Lan' },
        { id: 'phone', label: 'Số điện thoại *', val: phone, set: setPhone, type: 'tel', ph: '0912 345 678' },
      ].map(f => (
        <div key={f.id}>
          <label htmlFor={f.id} className="block text-sm font-bold text-gray-700 mb-2">{f.label}</label>
          <input id={f.id} type={f.type} inputMode={f.type === 'tel' ? 'numeric' : 'text'}
            value={f.val} onChange={e => { f.set(e.target.value); setError('') }}
            placeholder={f.ph}
            className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-[#1E7A43] focus:outline-none transition-colors" />
        </div>
      ))}
      <div>
        <label htmlFor="address" className="block text-sm font-bold text-gray-700 mb-2">Địa chỉ giao hàng *</label>
        <textarea id="address" value={address} onChange={e => { setAddress(e.target.value); setError('') }}
          placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành phố"
          rows={3} className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-[#1E7A43] focus:outline-none transition-colors resize-none" />
      </div>
      <div>
        <label htmlFor="note" className="block text-sm text-gray-500 mb-1.5">Ghi chú <span className="text-gray-400">(không bắt buộc)</span></label>
        <input id="note" type="text" value={note} onChange={e => setNote(e.target.value)}
          placeholder="Giao giờ nào, yêu cầu đặc biệt..."
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 focus:border-[#C8E6D0] focus:outline-none transition-colors text-sm" />
      </div>

      {error && <p className="text-red-500 text-sm bg-red-50 rounded-xl py-2.5 px-4 text-center">{error}</p>}

      <button type="submit" disabled={step === 'loading'}
        className="w-full min-h-[52px] rounded-2xl font-extrabold text-[#0D3B22] text-lg bg-[#F0B429] hover:bg-[#e8a820] transition-all active:scale-95 disabled:opacity-60 shadow-lg">
        {step === 'loading'
          ? <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>Đang gửi đơn...
            </span>
          : `ĐẶT HÀNG NGAY · ${fmt(total)}`}
      </button>

      <div className="flex justify-center gap-5 text-xs text-gray-400 pt-1">
        <span>Bảo mật 100%</span>
        <span>·</span>
        <span>Ship toàn quốc</span>
        <span>·</span>
        <span>Đổi trả nếu lỗi</span>
      </div>
    </form>
  )
}

// ─── FAQ Accordion ────────────────────────────────────────────────────────────
function Faq({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-[#C8E6D0] rounded-2xl overflow-hidden">
      <button onClick={() => setOpen(o => !o)} aria-expanded={open}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-[#F4FCF7] transition-colors min-h-[52px]">
        <span className="font-bold text-[#0D3B22] text-sm pr-4 leading-snug">{q}</span>
        <svg className={`flex-shrink-0 w-5 h-5 text-[#155C34] transition-transform duration-200 ${open ? 'rotate-45' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>
      {open && (
        <div className="px-5 pb-4 text-gray-600 text-sm leading-relaxed border-t border-[#E8F5EC] pt-3">
          {a}
        </div>
      )}
    </div>
  )
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function KhanDoXoi() {
  const orderRef = useRef<HTMLDivElement>(null)
  const [showSticky, setShowSticky] = useState(false)

  useEffect(() => {
    const fn = () => setShowSticky(window.scrollY > 600)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  const scrollToOrder = () => orderRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <div className="min-h-screen bg-white font-sans">

      {/* ── [0] ANNOUNCEMENT BAR (Scarcity thật) ──────────────────────────────── */}
      <div className="bg-[#155C34] text-white text-center py-2.5 px-4 text-sm font-semibold">
        <span className="text-yellow-300">Kho hàng có hạn</span>
        {' '}— Đặt hàng hôm nay, giao trong 2–4 ngày toàn quốc
      </div>

      {/* ── [1] HERO / ABOVE FOLD ─────────────────────────────────────────────── */}
      <section className="bg-gradient-to-b from-[#0D3B22] to-[#155C34] text-white overflow-hidden">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-7 pb-0">

          {/* Brand */}
          <div className="flex items-center gap-3 mb-5">
            <div className="bg-white/10 border border-white/20 rounded-xl px-4 py-2 inline-flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/logo-bep-co-ha.png" alt="Bếp Cô Hạ"
                className="h-8 w-8 object-contain"
                onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
              <span className="font-bold text-sm">Bếp Cô Hạ · Hacofood.vn</span>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-8 items-end">
            {/* Left copy */}
            <div className="pb-10 md:pb-14">
              {/* Hook — max 2 dòng per UI-UX skill */}
              <h1 className="text-3xl sm:text-4xl font-extrabold leading-tight mb-3">
                Xôi Chín Đều, Ráo Hạt,<br />
                <span className="text-[#F0B429]">Không Dính — Không Nhão.</span>
              </h1>
              <p className="text-green-100 text-base sm:text-lg leading-relaxed mb-6 max-w-md">
                Khăn vải lưới 1m×1m chuyên dụng — hơi nước thoát đều khắp bề mặt, xôi ngon từng hạt. Dùng được <strong className="text-white">1000+ lần</strong>, giặt sạch dùng lại.
              </p>

              {/* Price + CTA — ABOVE FOLD */}
              <div className="flex items-center gap-4 mb-4">
                <div>
                  <p className="text-green-300 text-xs font-semibold uppercase tracking-wide">Chỉ</p>
                  <p className="text-4xl font-extrabold text-white leading-none">{fmt(PRICE)}</p>
                  <p className="text-green-300 text-xs mt-0.5">chưa bao gồm phí vận chuyển</p>
                </div>
                <button onClick={scrollToOrder}
                  className="bg-[#F0B429] hover:bg-[#e8a820] text-[#0D3B22] font-extrabold text-lg px-7 py-3.5 rounded-2xl min-h-[52px] transition-all active:scale-95 shadow-lg flex-shrink-0">
                  Đặt Hàng Ngay →
                </button>
              </div>

              {/* Mini trust */}
              <div className="flex flex-wrap gap-3">
                {['Vải lưới thực phẩm', 'May viền 4 cạnh', 'Ship toàn quốc'].map(t => (
                  <div key={t} className="flex items-center gap-1.5 text-sm text-green-200">
                    <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                    </svg>
                    {t}
                  </div>
                ))}
              </div>
            </div>

            {/* Right — product image flush bottom */}
            <div className="flex justify-center md:justify-end">
              <div className="relative w-full max-w-xs md:max-w-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={IMG.luoi} alt="Khăn Đồ Xôi Bếp Cô Hạ 1m×1m"
                  className="w-full object-contain" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── [2] TRUST BAR ─────────────────────────────────────────────────────── */}
      <section className="bg-[#0D3B22] text-white border-t border-white/10">
        <div className="max-w-4xl mx-auto px-4 py-4 grid grid-cols-3 gap-0">
          {[
            { n: '1000+', l: 'Lần dùng được' },
            { n: '1m×1m', l: 'Kích thước chuẩn' },
            { n: '49k', l: 'Giá tốt nhất' },
          ].map((s, i) => (
            <div key={s.l} className={`text-center px-3 py-2 ${i < 2 ? 'border-r border-white/20' : ''}`}>
              <p className="text-xl font-extrabold text-[#F0B429]">{s.n}</p>
              <p className="text-green-300 text-xs mt-0.5">{s.l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── [3] PAIN — 3 lớp (Symptom · Consequence · Identity) ─────────────── */}
      <section className="py-14 px-4 sm:px-6 bg-white">
        <div className="max-w-2xl mx-auto">
          <p className="text-xs font-bold text-red-500 uppercase tracking-widest mb-3">Bạn có đang gặp điều này?</p>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0D3B22] mb-8">
            Mỗi Lần Đồ Xôi Là Một Lần<br />
            <span className="text-red-500">Hồi Hộp Không Biết Ra Sao</span>
          </h2>

          <div className="space-y-4">
            {[
              {
                sym: 'Xôi dính chảo, lấy ra bị nát',
                con: 'Phải gỡ từng miếng, mất 10–15 phút dọn dẹp sau. Xôi trông xấu, mang ra không được.',
                ide: 'Người quen nấu xôi mà sao khó thế... chắc mình không có khiếu?',
              },
              {
                sym: 'Dùng khăn màn mỏng — hơi ngưng tụ, xôi ướt nhão',
                con: 'Hạt gạo vỡ, nát bét. Nếu nấu để bán thì khách chê ngay lần đầu.',
                ide: 'Đồ đi đồ lại 3 lần vẫn không ổn — mất thêm 30 phút gas + thời gian.',
              },
              {
                sym: 'Hơi không thoát đều — chỗ sống chỗ chín',
                con: 'Lật ra phần dưới chín nhưng phần trên còn cứng. Phải đổ vào đồ lại.',
                ide: 'Mua bao nhiêu khăn màn rồi mà vẫn không cái nào đúng chuẩn.',
              },
            ].map((item, i) => (
              <div key={i} className="border border-red-100 rounded-2xl overflow-hidden">
                <div className="bg-red-50 px-5 py-3">
                  <p className="font-bold text-gray-800 text-sm">{item.sym}</p>
                </div>
                <div className="px-5 py-3 space-y-1.5">
                  <p className="text-gray-600 text-sm">{item.con}</p>
                  <p className="text-red-400 text-xs italic">{item.ide}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-7 text-gray-600 text-base text-center">
            Không phải lỗi kỹ thuật. Không phải do gạo. <strong className="text-[#155C34]">Chỉ vì thiếu đúng một chiếc khăn.</strong>
          </p>
        </div>
      </section>

      {/* ── [4] SOLUTION BRIDGE ───────────────────────────────────────────────── */}
      <section className="py-14 px-4 sm:px-6 bg-[#F4FCF7]">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            {/* Image grid — NOT 3 equal cards (anti-slop rule) */}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 rounded-2xl overflow-hidden shadow-md" style={{ aspectRatio: '16/9' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={IMG.xoicho} alt="Xôi chín đều ráo hạt trong chõ"
                  className="w-full h-full object-cover" />
              </div>
              <div className="rounded-xl overflow-hidden shadow-sm" style={{ aspectRatio: '1' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={IMG.phu} alt="Phủ khăn giữ nhiệt" className="w-full h-full object-cover" />
              </div>
              <div className="rounded-xl overflow-hidden shadow-sm" style={{ aspectRatio: '1' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={IMG.gapgon} alt="Khăn gấp gọn" className="w-full h-full object-cover" />
              </div>
            </div>

            {/* Copy */}
            <div>
              <p className="text-xs font-bold text-[#27AE60] uppercase tracking-widest mb-3">Giải pháp</p>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0D3B22] mb-4 leading-snug">
                Cô Hạ Thử Nhiều Loại Vải<br />
                Trước Khi Tìm Ra Đúng Cái Này
              </h2>
              <p className="text-gray-600 leading-relaxed mb-6">
                Sau nhiều năm nấu xôi và dạy học trò, Cô Hạ nhận ra sự khác biệt không nằm ở kỹ thuật — mà ở <strong className="text-[#155C34]">loại vải lót và phủ</strong>. Mắt lưới vừa thưa để hơi thoát đều, vừa đủ dày để giữ hạt. May viền 4 cạnh chắc chắn.
              </p>

              <div className="space-y-3">
                {[
                  { t: 'Hơi nước thoát đều từ dưới lên', d: 'Mắt lưới chuẩn — hơi đi qua đều khắp bề mặt. Không còn chỗ sống chỗ chín.' },
                  { t: 'Phủ trên hút ẩm — xôi không nhão', d: 'Hơi ngưng tụ vào vải thay vì rơi xuống xôi. Hạt bóng, ráo, thơm.' },
                  { t: 'Chống dính hoàn toàn — lấy ra nguyên miếng', d: 'Xôi không bám vải, không bám chảo. Đẹp như mua ngoài hàng.' },
                  { t: '1m×1m đủ cho chõ lớn — dùng 1000+ lần', d: 'Giặt sạch, phơi khô, dùng tiếp. Không mua lại nhiều lần nữa.' },
                ].map(item => (
                  <div key={item.t} className="flex gap-3 items-start">
                    <svg className="w-5 h-5 text-[#27AE60] flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                    </svg>
                    <div>
                      <p className="font-bold text-[#0D3B22] text-sm">{item.t}</p>
                      <p className="text-gray-500 text-sm leading-relaxed">{item.d}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── [5] HOW IT WORKS — Clarity 5 phần ───────────────────────────────── */}
      <section className="py-14 px-4 sm:px-6 bg-white">
        <div className="max-w-2xl mx-auto">
          <p className="text-xs font-bold text-[#27AE60] uppercase tracking-widest mb-3">Cách dùng</p>
          <h2 className="text-2xl font-extrabold text-[#0D3B22] mb-8">5 Bước — Không Cần Học Thêm Gì Cả</h2>

          <div className="space-y-3">
            {[
              { n: '01', t: 'Ngâm nếp 4–8 tiếng', d: 'Nếp nở đều → đồ nhanh hơn, chín đều hơn.' },
              { n: '02', t: 'Làm ẩm khăn, lót vào chõ', d: 'Khăn ẩm (không ướt đẫm) — hơi thấm qua đều, không đọng nước.' },
              { n: '03', t: 'Đổ nếp, phủ khăn lên trên', d: 'Khăn phủ hút hơi ngưng tụ, xôi không bị ướt từ trên xuống.' },
              { n: '04', t: 'Đồ 30–40 phút, lật đảo 1 lần', d: 'Lật ở phút 20 — phần trên xuống dưới, chín đều 100%.' },
              { n: '05', t: 'Ủ 5 phút rồi lấy ra', d: 'Xôi ráo, hạt bóng, lấy ra không dính khăn — đẹp như hàng.' },
            ].map((step, i) => (
              <div key={i} className="flex gap-4 items-start p-4 rounded-xl hover:bg-[#F4FCF7] transition-colors">
                <div className="bg-[#155C34] text-white rounded-xl w-11 h-11 flex items-center justify-center font-extrabold text-sm flex-shrink-0">
                  {step.n}
                </div>
                <div className="pt-0.5">
                  <p className="font-bold text-[#0D3B22]">{step.t}</p>
                  <p className="text-gray-500 text-sm mt-0.5">{step.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── [7] TESTIMONIALS (Social Proof sát CTA) ──────────────────────────── */}
      <section className="py-14 px-4 sm:px-6 bg-[#F4FCF7]">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-bold text-[#27AE60] uppercase tracking-widest mb-3">Khách hàng nói gì</p>
          <h2 className="text-2xl font-extrabold text-[#0D3B22] mb-8">
            Người Biết Nấu Xôi Ngon<br />
            Đều Biết Chọn Đúng Khăn
          </h2>

          {/* Review image */}
          <div className="rounded-2xl overflow-hidden shadow-md mb-8 max-w-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={IMG.review} alt="Review khách hàng thật" className="w-full object-contain" />
          </div>

          {/* Reviews — staggered layout, NOT 3 equal cards */}
          <div className="space-y-4">
            {[
              { name: 'Chị Lan · Hà Nội', stars: 5, text: '"Trước giờ đồ xôi hay bị dính chảo, gỡ ra mất công mà xôi nát. Từ hôm có khăn này là không bao giờ bị nữa. Xôi ráo đẹp, hạt bóng. Con bé khen ngon hơn hẳn mấy lần trước."' },
              { name: 'Chị Hương · TP.HCM', stars: 5, text: '"Mua 2 cái dùng thay nhau. Giặt xong vẫn thơm tho, không bị mùi. Size 1m×1m vừa đúng cho nồi nhà mình. Ship nhanh, hàng đẹp."' },
              { name: 'Cô Minh · Đà Nẵng', stars: 5, text: '"Nấu xôi bán hàng ngày nên cần khăn bền. Dùng được mấy tháng rồi vẫn tốt như mới. So với khăn màn trước thì khác xa — xôi ráo, không bị nhão từ trên xuống."' },
            ].map((r, i) => (
              <div key={i} className="bg-white rounded-2xl p-5 border border-[#C8E6D0] shadow-sm">
                <div className="flex gap-0.5 mb-2" aria-label={`${r.stars} sao`}>
                  {Array.from({ length: r.stars }).map((_, j) => (
                    <svg key={j} className="w-4 h-4 text-[#F0B429]" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                    </svg>
                  ))}
                </div>
                <p className="text-gray-700 text-sm leading-relaxed italic">{r.text}</p>
                <p className="text-gray-400 text-xs font-semibold mt-2">{r.name}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── [9] VALUE STACK + PRICE ANCHOR ───────────────────────────────────── */}
      <section className="py-12 px-4 sm:px-6 bg-[#0D3B22] text-white">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-xl sm:text-2xl font-extrabold mb-6">Tính Ra Chỉ...</h2>
          <div className="flex justify-center gap-4 mb-6">
            <div className="bg-white/10 rounded-2xl p-4 text-center flex-1 max-w-[140px]">
              <p className="text-2xl font-extrabold text-[#F0B429]">49k</p>
              <p className="text-green-300 text-xs mt-1">Giá 1 chiếc</p>
            </div>
            <div className="flex items-center text-green-300 text-2xl">÷</div>
            <div className="bg-white/10 rounded-2xl p-4 text-center flex-1 max-w-[140px]">
              <p className="text-2xl font-extrabold text-[#F0B429]">1000+</p>
              <p className="text-green-300 text-xs mt-1">Lần dùng</p>
            </div>
            <div className="flex items-center text-green-300 text-2xl">=</div>
            <div className="bg-[#F0B429] rounded-2xl p-4 text-center flex-1 max-w-[140px] ring-2 ring-yellow-300">
              <p className="text-2xl font-extrabold text-[#0D3B22]">~49đ</p>
              <p className="text-[#155C34] text-xs font-bold mt-1">Mỗi lần nấu</p>
            </div>
          </div>
          <p className="text-green-200 text-sm max-w-sm mx-auto">
            49.000đ — rẻ hơn một ly cà phê — mà mang lại hàng nghìn nồi xôi ngon cho gia đình.
          </p>
          <button onClick={scrollToOrder}
            className="mt-6 bg-[#F0B429] hover:bg-[#e8a820] text-[#0D3B22] font-extrabold px-10 min-h-[52px] rounded-2xl transition-all active:scale-95 text-lg">
            Đặt Hàng Ngay →
          </button>
        </div>
      </section>

      {/* ── [10] GUARANTEE — Risk Reversal ───────────────────────────────────── */}
      <section className="py-12 px-4 sm:px-6 bg-white">
        <div className="max-w-2xl mx-auto">
          <div className="border-2 border-[#C8E6D0] rounded-3xl p-6 sm:p-8 text-center">
            <div className="w-16 h-16 bg-[#F4FCF7] rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-[#27AE60]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
              </svg>
            </div>
            <h3 className="font-extrabold text-xl text-[#0D3B22] mb-2">Cam Kết Đổi Trả Nếu Lỗi</h3>
            <p className="text-gray-600 text-sm leading-relaxed max-w-md mx-auto">
              Nếu nhận hàng bị lỗi sản xuất — may viền sờn ngay từ đầu, vải bị lỗi — Cô Hạ đổi trả miễn phí. Gửi ảnh về inbox Facebook là giải quyết ngay trong ngày.
            </p>
            <p className="text-[#27AE60] font-bold text-sm mt-3">Bạn không có gì để mất cả.</p>
          </div>
        </div>
      </section>

      {/* ── [11] IS FOR / NOT FOR ─────────────────────────────────────────────── */}
      <section className="py-12 px-4 sm:px-6 bg-[#F4FCF7]">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-extrabold text-[#0D3B22] mb-6 text-center">Khăn Này Dành Cho Ai?</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl p-5 border border-[#C8E6D0]">
              <p className="font-bold text-[#155C34] mb-3 flex items-center gap-2">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                </svg>
                Phù hợp với bạn nếu...
              </p>
              <ul className="space-y-2 text-sm text-gray-600">
                {[
                  'Hay nấu xôi cho gia đình 3–5 người',
                  'Chuẩn bị tiệc, giỗ chạp, cúng lễ',
                  'Đang học nấu xôi lần đầu',
                  'Bán xôi — cần chất lượng ổn định mỗi ngày',
                  'Muốn dụng cụ bền, dùng lâu dài',
                ].map(t => (
                  <li key={t} className="flex gap-2 items-start">
                    <svg className="w-4 h-4 text-[#27AE60] flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                    </svg>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-gray-100">
              <p className="font-bold text-gray-400 mb-3 flex items-center gap-2">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
                </svg>
                Có thể chưa cần nếu...
              </p>
              <ul className="space-y-2 text-sm text-gray-400">
                {[
                  'Bạn chỉ nấu cơm, không nấu xôi',
                  'Đã có khăn chuyên dụng hoạt động tốt',
                  'Chỉ hấp thức ăn thông thường',
                ].map(t => (
                  <li key={t} className="flex gap-2 items-start">
                    <svg className="w-4 h-4 text-gray-300 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
                    </svg>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── [12] FAQ — 7 Objection + A.R.E.B ────────────────────────────────── */}
      <section className="py-14 px-4 sm:px-6 bg-white">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-extrabold text-[#0D3B22] mb-6 text-center">Câu Hỏi Thường Gặp</h2>
          <div className="space-y-3">
            {[
              { q: 'Size 1m×1m có quá to cho nồi nhỏ không?', a: 'Không. Kích thước 1m×1m đủ để gấp đôi lại khi dùng cho chõ nhỏ. Một chiếc dùng được nhiều kích cỡ nồi khác nhau — rất tiện.' },
              { q: 'Dùng xong giặt thế nào?', a: 'Giặt tay bằng xà phòng loãng, xả sạch, phơi nơi thoáng mát. Không cần máy sấy, không ngâm chất tẩy mạnh. Vải giữ được hình dạng qua rất nhiều lần giặt.' },
              { q: 'Vải có an toàn thực phẩm không?', a: 'Có. Cô Hạ chọn vải không mùi lạ, không ra màu khi hấp ở nhiệt độ cao. Được dùng trực tiếp cho nhà Cô Hạ trước khi đưa ra bán.' },
              { q: 'Tôi chưa bao giờ đồ xôi, dùng có dễ không?', a: 'Dùng được ngay. Khăn giúp người mới bắt đầu thành công hơn — không lo dính chảo, hơi đi đều tự nhiên. Cô Hạ có thể tư vấn thêm qua inbox nếu cần.' },
              { q: 'Ship đến bao lâu? Có theo dõi đơn không?', a: 'Nội thành: 2–4 ngày. Tỉnh xa: 3–5 ngày. Cô Hạ gửi mã vận đơn để bạn theo dõi trực tiếp sau khi đơn được xác nhận.' },
              { q: 'Giá 49.000đ đã bao gồm phí ship chưa?', a: 'Chưa. 49.000đ là giá sản phẩm. Phí vận chuyển tính riêng khi giao, tùy khu vực — thường từ 20.000đ–35.000đ.' },
              { q: 'Nếu hàng bị lỗi thì sao?', a: 'Cô Hạ đổi trả miễn phí nếu lỗi sản xuất (may viền sờn, vải lỗi). Gửi ảnh về Facebook Bếp Cô Hạ, xử lý trong ngày.' },
            ].map(item => <Faq key={item.q} q={item.q} a={item.a} />)}
          </div>
        </div>
      </section>

      {/* ── [13] ORDER FORM + CTA (Testimonial Sát CTA) ──────────────────────── */}
      <section ref={orderRef} id="dat-hang" className="py-16 px-4 sm:px-6 bg-[#F4FCF7]">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-8">
            <p className="text-xs font-bold text-[#27AE60] uppercase tracking-widest mb-2">Đặt hàng ngay</p>
            <h2 className="text-2xl font-extrabold text-[#0D3B22]">
              Mang Về Bếp Hôm Nay —<br />
              <span className="text-[#155C34]">Nồi Xôi Tới Ngon Hơn Liền</span>
            </h2>
            <p className="text-gray-500 text-sm mt-2">Giao tận nhà · Chuyển khoản · Hàng chính hãng</p>
          </div>

          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#C8E6D0] shadow-lg">
            <OrderForm />
          </div>

          {/* Final trust signals */}
          <div className="mt-6 flex flex-wrap justify-center gap-4 text-xs text-gray-400">
            <span>Bảo mật thông tin</span>
            <span>·</span>
            <span>Ship toàn quốc</span>
            <span>·</span>
            <span>Đổi trả nếu lỗi SX</span>
            <span>·</span>
            <span>Hỗ trợ qua Facebook</span>
          </div>
        </div>
      </section>

      {/* ── [14] FOOTER ──────────────────────────────────────────────────────── */}
      <footer className="bg-[#0D3B22] text-green-300 py-10 px-4 text-center text-sm">
        <div className="max-w-xl mx-auto space-y-3">
          <div className="flex justify-center">
            <div className="bg-white rounded-xl px-4 py-2 inline-flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/logo-bep-co-ha.png" alt="Bếp Cô Hạ"
                className="h-9 w-9 object-contain"
                onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
              <div className="text-left">
                <p className="text-[#0D3B22] font-extrabold text-sm leading-tight">Bếp Cô Hạ</p>
                <p className="text-gray-400 text-xs">Hacofood.vn</p>
              </div>
            </div>
          </div>
          <p className="text-green-400 font-semibold">Khăn Đồ Xôi 1m×1m — Vải lưới hấp xôi chuyên dụng</p>
          <p>Liên hệ: <strong className="text-white">Facebook Bếp Cô Hạ</strong></p>
          <p className="text-green-600 text-xs pt-2">© 2025 Hacofood.vn · Bếp Cô Hạ. All rights reserved.</p>
        </div>
      </footer>

      {/* ── STICKY CTA — bottom bar (UI-UX: min 44px, thumb zone) ─────────────── */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 p-3 pb-4 bg-white/90 backdrop-blur-sm border-t border-[#C8E6D0] transition-all duration-300 ${showSticky ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-full pointer-events-none'}`}
        aria-hidden={!showSticky}>
        <button onClick={scrollToOrder}
          className="w-full min-h-[52px] rounded-2xl font-extrabold text-[#0D3B22] text-lg bg-[#F0B429] hover:bg-[#e8a820] shadow-lg active:scale-95 transition-all">
          ĐẶT HÀNG NGAY — {fmt(PRICE)} →
        </button>
      </div>

      {/* ══ MESSENGER FLOAT ══ */}
      <a href="https://www.facebook.com/messages/t/hacasau1987" target="_blank" rel="noopener noreferrer"
        className="fixed bottom-24 right-4 z-50 w-14 h-14 bg-gradient-to-br from-[#00B2FF] to-[#006AFF] hover:brightness-110 rounded-full flex items-center justify-center shadow-xl shadow-blue-500/30 transition-all hover:scale-110"
        aria-label="Nhắn tin qua Messenger">
        <svg viewBox="0 0 24 24" className="w-8 h-8" fill="white">
          <path d="M12 0C5.373 0 0 4.974 0 11.111c0 3.498 1.744 6.614 4.469 8.652V24l4.088-2.242c1.092.301 2.246.464 3.443.464 6.627 0 12-4.974 12-11.111C24 4.974 18.627 0 12 0zm1.191 14.963l-3.055-3.26-5.963 3.26L10.75 8l3.13 3.259L19.777 8l-6.586 6.963z" />
        </svg>
      </a>

    </div>
  )
}
