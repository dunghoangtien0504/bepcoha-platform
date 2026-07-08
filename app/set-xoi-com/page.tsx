'use client'

import { useState, useRef, useEffect } from 'react'

// ─── Image paths ──────────────────────────────────────────────────────────────
const SP  = '/images/set-xoi-com/san-pham/'
const FB  = '/images/set-xoi-com/feedback/'
const UT  = '/images/set-xoi-com/uy-tin/'
const TP  = '/images/set-xoi-com/thanh-pham/'
const CHA = '/images/set-xoi-com/co-ha/'

const HERO_IMG = SP + 'z7728489506719_b50b067d25c4d1ac0ef7f35b9a862580.jpg'
const COHA_IMG = CHA + '678418190_1596512612198351_7005610236792647800_n.jpg'

const SAN_PHAM = [
  { src: SP + 'z7728489506719_b50b067d25c4d1ac0ef7f35b9a862580.jpg', label: 'Sét Xôi Cốm Sen Dừa đầy đủ' },
  { src: SP + 'IMG_0197.JPG',                                         label: 'Nguyên liệu chọn sẵn, đủ bộ' },
  { src: SP + '617872378_1514279540421659_2701416559612899466_n.jpg', label: 'Cốm khô + hạt sen + đậu xanh' },
  { src: SP + '622855087_1523645659485047_4399047496853641822_n.jpg', label: 'Đóng gói gọn gàng, giao tận tay' },
  { src: SP + '722705000_1642171887632423_3979564310912375133_n.jpg', label: 'Thành phẩm xôi cốm tươi ngon' },
  { src: SP + 'IMG_1068 (1).PNG',                                     label: 'Sét hoàn chỉnh từ Bếp Cô Hạ' },
]

const THANH_PHAM = [
  TP + '683001864_1603557288160550_4578162109876841916_n.jpg',
  TP + '683857846_1603496338166645_1897870805706251761_n.jpg',
  TP + '683880223_1603496328166646_56426883383329099_n.jpg',
  TP + '685028674_1603496341499978_5151800373429419092_n.jpg',
  TP + '686183015_1603496348166644_1341723979862020979_n.jpg',
  TP + '696254634_1613807827135496_8307914350075278890_n.jpg',
  TP + '709756548_1629737672209178_5868275026604335103_n.jpg',
]

const FEEDBACKS = [
  FB + 'z7730335364567_8d674d48fd66cc3792b6cd5dd512ac95.jpg',
  FB + 'z7730335370751_df22a8c555a02a9a8cfafbd9ed35294c.jpg',
  FB + 'z7730335376276_86e6d248c2574b44963ccacb9bf79d9c.jpg',
  FB + 'z7730335379270_5abaa2023af63abe18029c03fb0fa0fd.jpg',
  FB + 'z7730335387606_b3cbbe82373ae5d74c0efde5d445f98b.jpg',
  FB + 'z7730335393135_a8cf877dffa056d049b6c1bd7ffc0bc6.jpg',
  FB + 'z7730335402764_f2a3a3fe8394df70bd971a592d9a27de.jpg',
  FB + 'z7730335404328_21071e204a4e6326842543eb7e15ef02.jpg',
  FB + 'z7730335422085_4ee6a58b529dbb55e16faaa1530c9e5f.jpg',
  FB + 'z7730335431987_5c21fb601b078752332c3665a63a0d74.jpg',
]

const UY_TIN = [
  { src: UT + 'z7730296537408_96f9db97736016c93f9a740985d04d41.jpg', label: 'Cộng đồng Hacofood' },
  { src: UT + 'z7730296545695_e2cd4f391ad3a8ae76f1e8d8d6651042.jpg', label: 'TikTok & YouTube viral' },
  { src: UT + 'z7730387539278_d0ddcc6f279597ec3196aeae9a0af2ec.jpg', label: 'Hàng triệu lượt xem' },
]

const PRICE = 139000
function fmt(n: number) { return n.toLocaleString('vi-VN') + 'đ' }

// ─── Types ────────────────────────────────────────────────────────────────────
interface FormState {
  name: string; phone: string; email: string; address: string
  quantity: number; note: string
}
interface PaymentData {
  refCode: string; totalPrice: number; productLabel: string
  qr: { bankAccount: string; bankCode: string; accountName: string; amount: number; content: string; qrUrl: string }
}

// ─── Fade-in on scroll ───────────────────────────────────────────────────────
function useFadeIn() {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect() } },
      { threshold: 0.08 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return { ref, className: `transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}` }
}

function FadeSection({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const fade = useFadeIn()
  return <div ref={fade.ref} className={`${fade.className} ${className}`}>{children}</div>
}

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
  return <span className={left < 120 ? 'text-red-600 font-bold' : 'font-bold text-emerald-700'}>{m}:{s}</span>
}

// ─── Payment Step ─────────────────────────────────────────────────────────────
function PaymentStep({ data, form }: { data: PaymentData; form: FormState }) {
  const [copied, setCopied] = useState<'ref' | 'amount' | null>(null)
  function copy(text: string, type: 'ref' | 'amount') {
    navigator.clipboard.writeText(text).then(() => { setCopied(type); setTimeout(() => setCopied(null), 2000) })
  }
  return (
    <div className="space-y-5">
      <div className="text-center">
        <p className="text-emerald-700 font-extrabold text-lg mb-0.5">Bước 2: Chuyển khoản xác nhận đơn</p>
        <p className="text-gray-500 text-sm">Quét QR hoặc chuyển thủ công trong <Countdown seconds={30 * 60} /></p>
      </div>
      <div className="flex justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={data.qr.qrUrl} alt="QR chuyển khoản"
          className="w-52 h-52 rounded-2xl border-4 border-emerald-500 shadow-lg shadow-emerald-500/20 object-contain bg-white" />
      </div>
      <div className="bg-white/80 border border-gray-200 rounded-2xl p-4 space-y-2.5 text-sm">
        <div className="flex justify-between items-center">
          <span className="text-gray-500">Ngân hàng</span>
          <span className="font-bold text-gray-900">{data.qr.bankCode} – {data.qr.accountName}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-500">Số tài khoản</span>
          <span className="font-bold font-mono text-gray-900">{data.qr.bankAccount}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-500">Số tiền</span>
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-amber-600 text-base">{fmt(data.totalPrice)}</span>
            <button onClick={() => copy(String(data.totalPrice), 'amount')}
              className="text-xs bg-amber-500/20 hover:bg-amber-500/30 text-amber-600 px-2 py-0.5 rounded-lg transition-colors">
              {copied === 'amount' ? '✓ Đã copy' : 'Copy'}
            </button>
          </div>
        </div>
        <div className="flex justify-between items-center border-t border-gray-200 pt-2.5">
          <span className="text-gray-500">Nội dung CK <span className="text-red-600 font-bold">(bắt buộc)</span></span>
          <div className="flex items-center gap-2">
            <span className="font-extrabold font-mono text-emerald-700">{data.refCode}</span>
            <button onClick={() => copy(data.refCode, 'ref')}
              className="text-xs bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-600 px-2 py-0.5 rounded-lg transition-colors">
              {copied === 'ref' ? '✓ Đã copy' : 'Copy'}
            </button>
          </div>
        </div>
      </div>
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-600">
        Nhập <strong>đúng nội dung</strong> <code className="bg-amber-500/20 px-1 rounded">{data.refCode}</code> khi chuyển khoản – hệ thống tự động xác nhận và đơn chuyển sang <strong>Chờ chuyển hàng</strong>.
      </div>
      <div className="text-center text-sm text-gray-400 pt-1">
        <p>Đơn của <strong className="text-gray-700">{form.name}</strong> · {data.productLabel} x {form.quantity}</p>
        <p className="mt-1">Sau khi chuyển khoản, đơn xử lý tự động – không cần chờ xác nhận.</p>
      </div>
    </div>
  )
}

// ─── Order Form ───────────────────────────────────────────────────────────────
function OrderForm({ compact = false }: { compact?: boolean }) {
  const [form, setForm] = useState<FormState>({ name: '', phone: '', email: '', address: '', quantity: 1, note: '' })
  const [step, setStep] = useState<'idle' | 'loading' | 'payment' | 'error'>('idle')
  const [error, setError] = useState('')
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null)
  const total = PRICE * form.quantity

  function set<K extends keyof FormState>(k: K, v: FormState[K]) { setForm(f => ({ ...f, [k]: v })); setError('') }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.phone.trim() || !form.address.trim()) {
      setError('Vui lòng điền đủ: Họ tên, Số điện thoại, Địa chỉ')
      return
    }
    setStep('loading')
    try {
      const res = await fetch('/api/set-xoi-com-order', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Lỗi')
      setPaymentData(data); setStep('payment')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Có lỗi xảy ra'); setStep('error')
    }
  }

  if (step === 'payment' && paymentData) return <PaymentStep data={paymentData} form={form} />

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Giá nổi bật */}
      <div className="bg-gradient-to-r from-emerald-600 to-emerald-800 rounded-2xl p-4 text-white text-center mb-2 border border-emerald-500/30">
        <p className="text-emerald-200 text-xs font-semibold mb-0.5 uppercase tracking-wider">Sét Nguyên Liệu Xôi Cốm Sen Dừa</p>
        <p className="text-4xl font-extrabold">{fmt(PRICE)}<span className="text-lg font-normal opacity-70">/sét</span></p>
        <p className="text-emerald-200/80 text-xs mt-1">Kèm công thức bí quyết · Giao toàn quốc · COD</p>
        <p className="mt-2 bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full inline-block">Chưa bao gồm phí vận chuyển</p>
      </div>

      {/* Quantity */}
      <div>
        <label className="font-bold text-gray-700 mb-2 block text-sm">Số lượng sét *</label>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => set('quantity', Math.max(1, form.quantity - 1))}
            className="w-10 h-10 rounded-full border-2 border-gray-300 text-xl font-bold hover:border-emerald-500 hover:text-emerald-700 transition-colors flex items-center justify-center text-gray-700">&minus;</button>
          <span className="w-10 text-center font-bold text-xl text-emerald-700">{form.quantity}</span>
          <button type="button" onClick={() => set('quantity', Math.min(20, form.quantity + 1))}
            className="w-10 h-10 rounded-full border-2 border-gray-300 text-xl font-bold hover:border-emerald-500 hover:text-emerald-700 transition-colors flex items-center justify-center text-gray-700">+</button>
          <span className="ml-2 text-sm text-gray-500">Tổng: <strong className="text-amber-600 text-lg">{fmt(total)}</strong></span>
        </div>
      </div>

      <div>
        <label className="font-bold text-gray-700 mb-2 block text-sm">Họ và tên *</label>
        <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ví dụ: Nguyễn Thị Lan"
          className="w-full bg-white border-2 border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none transition-colors" />
      </div>
      <div>
        <label className="font-bold text-gray-700 mb-2 block text-sm">Số điện thoại *</label>
        <input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="0912 345 678" type="tel"
          className="w-full bg-white border-2 border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none transition-colors" />
      </div>
      {!compact && (
        <div>
          <label className="font-bold text-gray-700 mb-2 block text-sm">Email <span className="text-gray-400 font-normal">(không bắt buộc)</span></label>
          <input value={form.email} onChange={e => set('email', e.target.value)} placeholder="email@gmail.com" type="email"
            className="w-full bg-white border-2 border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none transition-colors" />
        </div>
      )}
      <div>
        <label className="font-bold text-gray-700 mb-2 block text-sm">Địa chỉ giao hàng *</label>
        <textarea value={form.address} onChange={e => set('address', e.target.value)} rows={3}
          placeholder="Số nhà, ngõ/hẻm, đường, phường/xã, quận/huyện, tỉnh/thành phố"
          className="w-full bg-white border-2 border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none transition-colors resize-none" />
      </div>
      <div>
        <label className="font-bold text-gray-700 mb-2 block text-sm">Ghi chú <span className="text-gray-400 font-normal">(không bắt buộc)</span></label>
        <input value={form.note} onChange={e => set('note', e.target.value)} placeholder="Giao giờ nào, yêu cầu đặc biệt..."
          className="w-full bg-white border-2 border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none transition-colors" />
      </div>

      {error && <p className="text-red-600 text-sm bg-red-500/10 border border-red-500/20 rounded-xl py-2.5 px-4 text-center">{error}</p>}

      <button type="submit" disabled={step === 'loading'}
        className="w-full py-4 rounded-2xl font-extrabold text-white text-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-500 transition-all active:scale-[0.98] disabled:opacity-60 shadow-xl shadow-amber-500/30">
        {step === 'loading'
          ? <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>Đang gửi đơn...
            </span>
          : 'Gửi Đơn & Nhận Sét Nguyên Liệu →'}
      </button>
      <p className="text-xs text-gray-400 text-center">Hoàn tiền 100% nếu không hài lòng · COD toàn quốc · Bảo mật thông tin</p>
    </form>
  )
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function SetXoiCom() {
  const orderRef = useRef<HTMLDivElement>(null)
  const [showStickyBar, setShowStickyBar] = useState(false)

  const scrollToOrder = () => orderRef.current?.scrollIntoView({ behavior: 'smooth' })

  useEffect(() => {
    const sentinel = document.getElementById('sticky-sentinel')
    if (!sentinel) { setShowStickyBar(true); return }
    const obs = new IntersectionObserver(
      ([entry]) => setShowStickyBar(!entry.isIntersecting),
      { threshold: 0 }
    )
    obs.observe(sentinel)
    return () => obs.disconnect()
  }, [])

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans antialiased">

      {/* ══ STICKY BOTTOM BAR ══ */}
      <div className={`fixed bottom-0 left-0 right-0 z-50 transition-transform duration-300 ${showStickyBar ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className="bg-white/95 backdrop-blur-xl border-t border-gray-200 px-4 py-3 flex items-center gap-3 max-w-5xl mx-auto">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500 truncate">Đóng gói mỗi ngày -- luôn tươi mới</p>
            <p className="font-extrabold text-amber-600 text-lg leading-tight">{fmt(PRICE)}<span className="text-xs font-normal text-gray-400">/sét</span></p>
          </div>
          <button onClick={scrollToOrder}
            className="flex-shrink-0 bg-gradient-to-r from-amber-500 to-amber-600 text-white font-extrabold px-6 py-3 rounded-xl text-sm active:scale-[0.98] transition-all shadow-lg shadow-amber-500/30">
            Cho Tôi Sét Này →
          </button>
        </div>
      </div>

      {/* ══ ANNOUNCEMENT BAR ══ */}
      <div className="bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 text-white text-center py-2.5 px-4">
        <p className="text-sm font-bold tracking-wide">
          Nguyên liệu nhập &amp; đóng gói mỗi ngày -- giao trong ngày, luôn tươi mới
        </p>
      </div>
      <div id="sticky-sentinel" className="h-0" />

      {/* ══ HERO ══ */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-50/60 via-white to-white" />
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'radial-gradient(circle at 30% 50%, rgba(255,255,255,0.8) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 pt-10 pb-16">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <div className="bg-gray-50 backdrop-blur rounded-2xl px-5 py-3 border border-gray-200 inline-flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/logo-bep-co-ha.png" alt="Bếp Cô Hạ" className="h-12 w-12 object-contain"
                onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
              <div>
                <p className="text-emerald-700 font-extrabold text-xl leading-tight tracking-tight">Bếp Cô Hạ</p>
                <p className="text-gray-400 text-xs">Hacofood.vn</p>
              </div>
            </div>
          </div>

          {/* Headline */}
          <div className="text-center mb-8 max-w-3xl mx-auto">
            <p className="text-amber-600 text-sm font-bold uppercase tracking-widest mb-4">Sét nguyên liệu -- Đóng gói mới mỗi ngày</p>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.1] mb-5">
              Mở Ra, Làm Theo<br />
              <span className="bg-gradient-to-r from-emerald-700 to-emerald-600 bg-clip-text text-transparent">Thành Công Ngay</span>
            </h1>
            <p className="text-gray-500 text-lg sm:text-xl max-w-xl mx-auto leading-relaxed">
              Cô Hạ chọn sẵn 8 nguyên liệu, đóng thành bộ, kèm công thức bí quyết.
              Bạn chỉ cần nhận về và làm theo -- ra ngay đĩa xôi cốm dẻo thơm, đẹp mắt.
            </p>
          </div>

          {/* Mini social proof ngay Hero */}
          <div className="flex justify-center mb-6">
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-full px-5 py-2 text-sm text-emerald-700 font-semibold">
              Hàng trăm khách đã đặt & gửi ảnh thành phẩm cho Cô Hạ
            </div>
          </div>

          {/* Hero image */}
          <div className="flex justify-center mb-10">
            <div className="relative rounded-3xl overflow-hidden shadow-2xl shadow-emerald-500/10 border border-gray-200 w-full max-w-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={HERO_IMG} alt="Sét Nguyên Liệu Xôi Cốm Sen Dừa Bếp Cô Hạ"
                className="w-full h-auto object-contain" />
              <div className="absolute top-4 right-4 bg-amber-500 text-white text-sm font-extrabold px-4 py-2 rounded-full shadow-lg">
                {fmt(PRICE)}/sét
              </div>
            </div>
          </div>

          {/* Trust pills */}
          <div className="flex flex-wrap justify-center gap-3 mb-10">
            {[
              'Nguyên liệu chọn sẵn đủ bộ',
              'Kèm công thức bí quyết',
              'Không ngon -- hoàn tiền 100%',
              'Giao toàn quốc -- COD',
            ].map(text => (
              <div key={text} className="flex items-center gap-2 bg-white/60 backdrop-blur border border-gray-200 rounded-full px-4 py-2 text-sm text-gray-700">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full flex-shrink-0" />
                <span>{text}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row justify-center gap-3">
            <button onClick={scrollToOrder}
              className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-white font-extrabold text-xl px-10 py-4 rounded-2xl shadow-xl shadow-amber-500/30 transition-all active:scale-[0.98]">
              Cho Tôi Sét Nguyên Liệu →
            </button>
            <a href="#san-pham"
              className="bg-white/60 border border-gray-200 text-gray-700 font-bold text-base px-8 py-4 rounded-2xl hover:bg-gray-100 transition-colors text-center">
              Xem Trong Sét Có Gì
            </a>
          </div>
        </div>
      </section>

      {/* ══ TRUST BAR ══ */}
      <section className="bg-gray-50 border-y border-gray-200 py-4 px-4">
        <div className="max-w-4xl mx-auto flex flex-wrap justify-center gap-x-8 gap-y-2">
          {[
            'Video triệu view trên TikTok',
            'Kèm công thức bí quyết',
            'COD -- trả tiền khi nhận',
            'Không ngon hoàn tiền 100%',
          ].map(text => (
            <div key={text} className="flex items-center gap-2 text-gray-500 text-sm font-medium">
              <span className="text-emerald-700">&#10003;</span><span>{text}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ══ PAIN SECTION ══ */}
      <section className="py-16 px-4 sm:px-6">
        <FadeSection className="max-w-3xl mx-auto text-center">
          <p className="inline-block border border-red-500/30 bg-red-500/10 text-red-600 font-bold text-xs px-4 py-1.5 rounded-full tracking-widest mb-5 uppercase">
            Bạn có đang gặp tình huống này?
          </p>
          <h2 className="text-3xl sm:text-4xl font-extrabold mb-3 leading-tight">
            Muốn Tự Tay Làm Xôi Cốm<br />
            <span className="text-red-600">Nhưng Không Biết Bắt Đầu Từ Đâu?</span>
          </h2>
          <p className="text-gray-500 mb-10 max-w-xl mx-auto">
            Bạn đã từng tìm nguyên liệu khắp nơi, thử theo công thức trên mạng, mà kết quả vẫn không như ý.
            Xôi bị nhão, cốm không dẻo, hương vị nhạt nhẽo. Tốn tiền, tốn công, mà vẫn thất bại.
          </p>
          <div className="grid sm:grid-cols-2 gap-4 text-left">
            {[
              { t: 'Tìm nguyên liệu chuẩn quá khó', d: 'Cốm khô ngon, hạt sen sạch, bột cốt dừa chất lượng -- ngoài chợ không có, mua online sợ hàng kém. Sai nguyên liệu là hỏng cả mẻ xôi, mất công vô ích.' },
              { t: 'Làm mấy lần rồi mà vẫn không ngon', d: 'Xôi bị nhão, cốm cứng, thiếu hương lá dứa -- làm đi làm lại mà vẫn không được như ngoài hàng. Chán nản, muốn bỏ cuộc.' },
              { t: 'Mua lẻ thì thừa thiếu, tốn kém', d: 'Chạy 3-4 chỗ, mua về thừa hạt sen, thiếu lá dứa, đường mua nhiều không dùng hết. Tính ra còn đắt hơn mua ngoài hàng.' },
              { t: 'Công thức mỗi người nói một kiểu', d: 'Tra Google 10 bài 10 tỷ lệ khác nhau. Lúc nhạt lúc ngọt -- không bao giờ chắc chắn mình đang làm đúng hay sai.' },
            ].map(item => (
              <div key={item.t} className="bg-gray-50 border border-gray-200 rounded-2xl p-5">
                <p className="font-bold text-gray-900 mb-2">{item.t}</p>
                <p className="text-gray-500 text-sm leading-relaxed">{item.d}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-6 max-w-xl mx-auto">
            <p className="text-gray-700 text-base leading-relaxed">
              Tất cả những vấn đề trên đều có chung một nguyên nhân: <strong className="text-emerald-700">thiếu đúng nguyên liệu và đúng công thức từ người đã làm thành công</strong>.
              Cô Hạ đã gom hết vào một sét duy nhất -- để bạn không phải loay hoay nữa.
            </p>
          </div>
        </FadeSection>
      </section>

      {/* ══ SOLUTION BRIDGE – CÔ HẠ ══ */}
      <section className="py-16 px-4 sm:px-6">
        <FadeSection className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div className="relative flex justify-center">
              <div className="relative rounded-3xl overflow-hidden shadow-2xl shadow-emerald-500/10 border border-gray-200 max-w-xs w-full" style={{ aspectRatio: '3/4' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={COHA_IMG} alt="Cô Hạ – Bếp Cô Hạ" className="w-full h-full object-cover object-top" />
              </div>
              <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-amber-500 text-white font-extrabold text-sm px-5 py-2.5 rounded-full shadow-lg whitespace-nowrap">
                Video triệu view trên TikTok
              </div>
            </div>
            <div>
              <p className="inline-block border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 font-bold text-xs px-4 py-1.5 rounded-full tracking-widest mb-5 uppercase">
                Người đứng sau sét nguyên liệu
              </p>
              <h2 className="text-3xl sm:text-4xl font-extrabold mb-5 leading-tight">
                Cô Hạ Đã Chọn Sẵn<br />
                <span className="text-amber-600">Từng Nguyên Liệu Cho Bạn</span>
              </h2>
              <p className="text-gray-500 leading-relaxed mb-4">
                Sau nhiều năm nấu nướng và hàng chục video viral về xôi cốm, Cô Hạ đã tỉ mỉ chọn đúng từng loại nguyên liệu -- cốm khô, hạt sen, đậu xanh, bột cốt dừa, lá dứa...
              </p>
              <p className="text-gray-500 leading-relaxed mb-6">
                Tất cả được đóng sẵn thành một sét, kèm theo công thức bí quyết chi tiết từng bước.
                <strong className="text-gray-800"> Bạn chỉ cần mở ra và làm theo -- thành công ngay lần đầu, không cần kinh nghiệm.</strong>
              </p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  '8 nguyên liệu đủ bộ, đúng loại',
                  'Công thức bí quyết từng bước',
                  'Hàng trăm khách đã thành công',
                  'Không ngon -- hoàn tiền 100%',
                ].map(t => (
                  <div key={t} className="flex items-center gap-2 bg-white/60 border border-gray-200 rounded-xl p-3">
                    <span className="text-emerald-700 font-bold flex-shrink-0">&#10003;</span>
                    <span className="text-sm text-gray-700">{t}</span>
                  </div>
                ))}
              </div>
              <button onClick={scrollToOrder} className="mt-6 bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold px-8 py-3.5 rounded-2xl shadow-lg shadow-amber-500/20 transition-all active:scale-[0.98]">
                Cho Tôi Sét Nguyên Liệu →
              </button>
            </div>
          </div>
        </FadeSection>
      </section>

      {/* ══ GALLERY SẢN PHẨM ══ */}
      <section id="san-pham" className="py-16 px-4 sm:px-6">
        <FadeSection className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <p className="inline-block border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 font-bold text-xs px-5 py-1.5 rounded-full tracking-widest mb-4 uppercase">Trong sét có gì</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold">
              Mở Hộp Ra Là Có Đủ<br />
              <span className="text-amber-600">Không Cần Đi Chợ, Không Cần Tìm Kiếm</span>
            </h2>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-2 sm:mb-3 h-52 sm:h-72">
            {SAN_PHAM.slice(0, 3).map(item => (
              <div key={item.label} className="relative rounded-xl sm:rounded-2xl overflow-hidden group border border-gray-200 h-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.src} alt={item.label} className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3 h-44 sm:h-56">
            {SAN_PHAM.slice(3, 6).map(item => (
              <div key={item.label} className="relative rounded-xl sm:rounded-2xl overflow-hidden group border border-gray-200 h-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.src} alt={item.label} className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <button onClick={scrollToOrder} className="bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold px-8 py-3.5 rounded-2xl shadow-lg shadow-amber-500/20 hover:shadow-amber-500/40 transition-all active:scale-[0.98]">
              Đặt Sét Này Về Nhà →
            </button>
          </div>
        </FadeSection>
      </section>

      {/* ══ VIDEO ══ */}
      <section className="py-16 px-4 sm:px-6 bg-gray-50/50">
        <FadeSection className="max-w-3xl mx-auto text-center">
          <p className="inline-block border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 font-bold text-xs px-4 py-1.5 rounded-full tracking-widest mb-4 uppercase">Xem thực tế</p>
          <h2 className="text-3xl sm:text-4xl font-extrabold mb-2">
            Xem Cô Hạ Làm Trực Tiếp<br />
            <span className="text-amber-600">Thấy Rõ Từng Bước -- Tin Là Đặt</span>
          </h2>
          <p className="text-gray-500 text-sm mb-10">Video thực tế từ Bếp Cô Hạ -- thấy nguyên liệu, thấy thành phẩm, thấy kết quả thật</p>
          <div className="flex justify-center">
            <div className="relative rounded-3xl overflow-hidden shadow-2xl shadow-emerald-500/10 border border-gray-200 w-full max-w-xs" style={{ aspectRatio: '9/16' }}>
              <iframe
                src="https://www.youtube.com/embed/_jXu55_QWng?rel=0&modestbranding=1"
                title="Xôi Cốm Sen Dừa – Bếp Cô Hạ"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                loading="lazy"
                className="absolute inset-0 w-full h-full"
              />
            </div>
          </div>
          <div className="mt-10">
            <button onClick={scrollToOrder} className="bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold px-8 py-3.5 rounded-2xl shadow-lg shadow-amber-500/20 transition-all active:scale-[0.98]">
              Tôi Muốn Thử -- Đặt Ngay →
            </button>
          </div>
        </FadeSection>
      </section>

      {/* ══ THÀNH PHẦN SÉT ══ */}
      <section className="py-16 px-4 sm:px-6">
        <FadeSection className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <p className="inline-block border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 font-bold text-xs px-4 py-1.5 rounded-full tracking-widest mb-4 uppercase">Thành phần sét</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold">
              Cô Hạ Chọn Sẵn 8 Nguyên Liệu<br />
              <span className="text-amber-600">Bạn Chỉ Cần Nhận &amp; Làm Theo</span>
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-gray-50 border border-gray-200 rounded-3xl p-6">
              <h3 className="font-extrabold text-xl text-emerald-700 mb-5">Nguyên Liệu Trong Sét</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  'Cốm khô',
                  'Đậu xanh đã cà vỏ',
                  'Hạt sen khô',
                  'Bột cốt dừa',
                  'Đường kính trắng',
                  'Muối tinh',
                  'Bột nghệ',
                  'Lá dứa',
                ].map(name => (
                  <div key={name} className="flex items-center gap-2 bg-white/60 border border-gray-200 rounded-xl px-3 py-2.5">
                    <span className="w-2 h-2 bg-emerald-400 rounded-full flex-shrink-0" />
                    <span className="text-gray-700 font-medium text-sm">{name}</span>
                  </div>
                ))}
              </div>
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 mt-4">
                <p className="text-emerald-700 font-bold text-sm">+ Công thức bí quyết của Bếp Cô Hạ tặng kèm</p>
                <p className="text-emerald-600 text-xs mt-0.5">Tỷ lệ &amp; kỹ thuật chi tiết -- ghi rõ từng bước</p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="bg-gray-50 border border-gray-200 rounded-3xl p-6">
                <h3 className="font-extrabold text-xl text-emerald-700 mb-4">Thành Phẩm Bạn Sẽ Có</h3>
                <ul className="space-y-3 text-gray-500 text-sm">
                  <li className="flex gap-2.5"><span className="text-emerald-700 font-bold flex-shrink-0">&#10003;</span><span>Xôi tơi, hạt cốm <strong className="text-gray-800">dẻo mềm</strong>, không dính nhão</span></li>
                  <li className="flex gap-2.5"><span className="text-emerald-700 font-bold flex-shrink-0">&#10003;</span><span>Hạt sen <strong className="text-gray-800">bùi</strong>, đậu xanh vàng tươi đẹp mắt</span></li>
                  <li className="flex gap-2.5"><span className="text-emerald-700 font-bold flex-shrink-0">&#10003;</span><span>Hương <strong className="text-gray-800">lá dứa và cốt dừa</strong> quyện nhẹ, thơm tự nhiên</span></li>
                  <li className="flex gap-2.5"><span className="text-emerald-700 font-bold flex-shrink-0">&#10003;</span><span>Đủ cho <strong className="text-gray-800">4-6 người ăn</strong> -- bữa sáng, cỗ chay, quà quê</span></li>
                </ul>
              </div>
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-3xl p-6">
                <h3 className="font-extrabold text-lg text-amber-600 mb-3">Lưu Ý Quan Trọng</h3>
                <ul className="space-y-2 text-gray-500 text-sm">
                  <li className="flex gap-2"><span className="text-amber-600">&#8226;</span> <span>Đây là <strong className="text-gray-800">sét nguyên liệu</strong> -- bạn tự làm tại nhà theo công thức tặng kèm</span></li>
                  <li className="flex gap-2"><span className="text-amber-600">&#8226;</span> <span>Thời gian làm: khoảng <strong className="text-gray-800">1--1,5 tiếng</strong> (ngâm + hấp)</span></li>
                  <li className="flex gap-2"><span className="text-amber-600">&#8226;</span> <span>Cần có <strong className="text-gray-800">xửng hấp</strong> hoặc nồi cơm điện chế độ hấp</span></li>
                </ul>
              </div>
            </div>
          </div>
        </FadeSection>
      </section>

      {/* ══ DÀNH CHO AI / KHÔNG DÀNH CHO AI ══ */}
      <section className="py-14 px-4 sm:px-6 bg-gray-50/50">
        <FadeSection className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-3xl sm:text-4xl font-extrabold">Sét Này Có Phù Hợp Với Bạn?</h2>
            <p className="text-gray-500 mt-2">Đọc xong là biết ngay -- không cần phân vân</p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-3xl p-6">
              <h3 className="font-extrabold text-xl text-emerald-700 mb-4">Dành cho bạn nếu:</h3>
              <ul className="space-y-3 text-gray-700 text-sm">
                {[
                  'Muốn tự tay làm xôi cốm ngon tại nhà nhưng chưa biết bắt đầu từ đâu',
                  'Không có thời gian đi chợ tìm từng loại nguyên liệu',
                  'Muốn món quà ý nghĩa, tự tay làm, tặng người thân dịp lễ Tết',
                  'Thích nấu nướng nhưng cần công thức chuẩn từ người có kinh nghiệm',
                ].map(t => (
                  <li key={t} className="flex gap-2.5"><span className="text-emerald-700 flex-shrink-0">&#10003;</span> {t}</li>
                ))}
              </ul>
            </div>
            <div className="bg-red-500/5 border border-red-500/20 rounded-3xl p-6">
              <h3 className="font-extrabold text-xl text-red-600 mb-4">KHÔNG phù hợp nếu:</h3>
              <ul className="space-y-3 text-gray-700 text-sm">
                {[
                  'Bạn muốn mua xôi cốm đã nấu sẵn, ăn liền',
                  'Bạn không có xửng hấp hoặc nồi cơm điện có chế độ hấp',
                  'Bạn không muốn bỏ 1--1,5 tiếng để làm',
                  'Bạn cần giao trong ngày (sét giao COD cần 2-4 ngày)',
                ].map(t => (
                  <li key={t} className="flex gap-2.5"><span className="text-red-600 flex-shrink-0">&#10007;</span> {t}</li>
                ))}
              </ul>
            </div>
          </div>
        </FadeSection>
      </section>

      {/* ══ USE CASES ══ */}
      <section className="py-14 px-4 sm:px-6">
        <FadeSection className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold mb-2">Một Sét -- Vô Vàn Dịp Để Làm</h2>
          <p className="text-gray-500 mb-10">Dù bữa sáng hay mâm cỗ, xôi cốm luôn là lựa chọn ý nghĩa</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { name: 'Bữa sáng gia đình', sub: 'Ngon, bổ dưỡng, đơn giản' },
              { name: 'Cỗ chay, mâm cúng', sub: 'Truyền thống, trang nghiêm' },
              { name: 'Quà quê tặng người thân', sub: 'Đặc sản Hà Nội chính gốc' },
              { name: 'Tết, lễ, giỗ chạp', sub: 'Ý nghĩa, thơm thảo' },
              { name: 'Cưới hỏi, sinh nhật', sub: 'Khác biệt, đáng nhớ' },
              { name: 'Tân gia, họp mặt', sub: 'Ấm cúng, sum vầy' },
            ].map(item => (
              <div key={item.name} className="bg-white/60 border border-gray-200 rounded-2xl p-5 text-center">
                <p className="font-bold text-gray-900 mt-1">{item.name}</p>
                <p className="text-sm text-emerald-700/80 mt-1">{item.sub}</p>
              </div>
            ))}
          </div>
        </FadeSection>
      </section>

      {/* ══ THÀNH PHẨM KHÁCH HÀNG + SOCIAL PROOF ══ */}
      <section className="py-16 px-4 sm:px-6 bg-gray-50/50">
        <FadeSection className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <p className="inline-block border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 font-bold text-xs px-5 py-1.5 rounded-full tracking-widest mb-4 uppercase">Bằng chứng thật</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold">
              Khách Hàng Gửi Ảnh Thành Phẩm<br />
              <span className="text-amber-600">Lần Đầu Làm -- Đẹp Và Ngon Như Ngoài Hàng</span>
            </h2>
            <p className="text-gray-500 mt-3">Tất cả đều lần đầu làm xôi cốm, chỉ dùng sét nguyên liệu + công thức của Cô Hạ</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {THANH_PHAM.map((src, i) => (
              <div key={i} className="rounded-2xl overflow-hidden border border-gray-200 group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`Thành phẩm khách hàng ${i + 1}`}
                  className="w-full h-44 object-cover object-center group-hover:scale-105 transition-transform duration-500" loading="lazy" />
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <button onClick={scrollToOrder} className="bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold px-8 py-3.5 rounded-2xl shadow-lg shadow-amber-500/20 transition-all active:scale-[0.98]">
              Tôi Cũng Muốn Làm Được Như Vậy →
            </button>
          </div>
        </FadeSection>
      </section>

      {/* ══ UY TÍN ══ */}
      <section className="py-16 px-4 sm:px-6">
        <FadeSection className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <p className="inline-block border border-amber-500/30 bg-amber-500/10 text-amber-600 font-bold text-xs px-4 py-1.5 rounded-full tracking-widest mb-4 uppercase">Thương hiệu uy tín</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold">
              Bếp Cô Hạ -- Triệu Lượt Xem<br />
              <span className="text-amber-600">Trên TikTok, YouTube, Facebook</span>
            </h2>
            <p className="text-gray-500 mt-3">Không phải thương hiệu mới -- Cô Hạ đã chia sẻ hàng trăm video nấu ăn được triệu người theo dõi</p>
          </div>
          <div className="grid grid-cols-3 gap-4 mb-10 max-w-3xl mx-auto">
            {UY_TIN.map(img => (
              <div key={img.label} className="rounded-2xl overflow-hidden border border-gray-200 bg-gray-50 flex flex-col">
                <div className="h-52 sm:h-64 flex items-center justify-center bg-gray-50 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.src} alt={img.label} className="w-full h-full object-contain" />
                </div>
                <p className="text-center text-xs font-semibold text-gray-400 py-2.5 px-2 leading-tight">{img.label}</p>
              </div>
            ))}
          </div>
          <div className="bg-white/60 border border-gray-200 rounded-3xl p-6 text-center max-w-2xl mx-auto">
            <p className="text-gray-700 font-bold text-lg mb-2 italic">&quot;Cô Hạ làm từ tâm -- công thức chia sẻ thật sự, nguyên liệu chọn thật sự, kết quả thật sự.&quot;</p>
            <p className="text-emerald-700/80 text-sm">-- Bếp Cô Hạ, Hacofood.vn</p>
          </div>
        </FadeSection>
      </section>

      {/* ══ GUARANTEE ══ */}
      <section className="py-14 px-4 sm:px-6 bg-gray-50/50">
        <FadeSection className="max-w-2xl mx-auto">
          <div className="bg-gradient-to-br from-emerald-50 to-white border border-emerald-500/20 rounded-3xl p-8 text-center">
            <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-5">
              <span className="text-3xl text-emerald-700 font-bold">100%</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold mb-3">
              Không Hài Lòng?<br /><span className="text-emerald-700">Hoàn Tiền 100% -- Không Hỏi Lý Do</span>
            </h2>
            <p className="text-gray-500 leading-relaxed max-w-lg mx-auto mb-4">
              Nhận sét nguyên liệu, kiểm tra chất lượng. Nếu bạn thấy nguyên liệu không đạt chuẩn -- liên hệ Cô Hạ, hoàn tiền 100% ngay lập tức, không hỏi thêm bất cứ điều gì.
            </p>
            <p className="text-gray-700 text-sm font-semibold">
              Bạn không mất gì cả. Chỉ có đĩa xôi cốm thơm dẻo đang chờ bạn.
            </p>
          </div>
        </FadeSection>
      </section>

      {/* ══ FEEDBACK KHÁCH HÀNG ══ */}
      <section className="py-16 px-4 sm:px-6">
        <FadeSection className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <p className="inline-block border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 font-bold text-xs px-4 py-1.5 rounded-full tracking-widest mb-4 uppercase">Phản hồi thật từ khách hàng</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold">
              Đặt Xong, Làm Xong, Khoe Ngay<br />
              <span className="text-amber-600">Nhiều Khách Đặt Lại Lần 2, Lần 3</span>
            </h2>
          </div>
          <div className="columns-2 sm:columns-3 gap-3 space-y-3">
            {FEEDBACKS.map((src, i) => (
              <div key={i} className="break-inside-avoid rounded-2xl overflow-hidden border border-gray-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`Phản hồi khách hàng ${i + 1}`} className="w-full h-auto object-cover" loading="lazy" />
              </div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <button onClick={scrollToOrder} className="bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold px-8 py-3.5 rounded-2xl shadow-lg shadow-amber-500/20 transition-all active:scale-[0.98]">
              Tôi Cũng Muốn Đặt →
            </button>
          </div>
        </FadeSection>
      </section>

      {/* ══ FAQ ══ */}
      <section className="py-14 px-4 sm:px-6 bg-gray-50/50">
        <FadeSection className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-extrabold">Còn Thắc Mắc? Đọc Ngay</h2>
            <p className="text-gray-500 mt-2">Những câu hỏi khách thường hỏi trước khi đặt</p>
          </div>
          <div className="space-y-3">
            {[
              { q: 'Sét này có phải xôi nấu sẵn không?', a: 'Không. Đây là sét NGUYÊN LIỆU -- bạn nhận về và tự làm tại nhà theo công thức tặng kèm. Thời gian làm khoảng 1--1,5 tiếng. Nhiều khách nói quá trình làm cũng rất vui và thư giãn.' },
              { q: 'Một sét làm được bao nhiêu phần?', a: 'Một sét làm được khoảng 1 đĩa xôi cốm lớn, đủ cho 4-6 người ăn no. Nếu cần cho mâm cỗ lớn hoặc tặng nhiều người, đặt thêm sét -- nhiều khách đặt 3-5 sét một lần.' },
              { q: 'Ship bao lâu thì nhận? Phí ship bao nhiêu?', a: 'Giao toàn quốc qua các đơn vị vận chuyển. Thời gian nhận hàng 2-4 ngày tùy khu vực. Phí ship tính theo đơn vị vận chuyển (thường 20-40k). Có thể nhận hàng và trả tiền khi nhận (COD) -- không cần thanh toán trước.' },
              { q: 'Tôi chưa bao giờ làm xôi cốm, có làm được không?', a: 'Được. Đây chính là lý do sét này tồn tại. Công thức ghi chi tiết từng bước, có hình minh họa. Hàng trăm người lần đầu làm đã thành công -- bạn xem ảnh thành phẩm ở trên là thấy.' },
              { q: 'Nếu làm không ngon thì sao?', a: 'Cô Hạ cam kết hoàn tiền 100% nếu bạn không hài lòng với chất lượng nguyên liệu, không hỏi lý do. Nhưng thành thật mà nói, chưa có ai đòi hoàn tiền cả -- vì làm theo công thức là ngon.' },
              { q: 'Nguyên liệu có bảo quản được lâu không?', a: 'Có. Nguyên liệu khô (cốm khô, đậu xanh, hạt sen...) bảo quản ở nơi khô mát được vài tháng. Lá dứa nên dùng sớm sau khi nhận để giữ độ tươi và hương thơm tốt nhất.' },
              { q: 'Tại sao không bán xôi nấu sẵn cho nhanh?', a: 'Vì xôi cốm ngon nhất là khi vừa hấp xong -- dẻo, thơm, nóng hổi. Ship xôi nấu sẵn sẽ bị khô, mất vị. Cô Hạ muốn bạn được ăn đĩa xôi ngon NHẤT có thể, nên gửi nguyên liệu kèm công thức để bạn tự làm tại nhà.' },
            ].map(({ q, a }) => (
              <details key={q} className="group bg-gray-50 border border-gray-200 rounded-2xl">
                <summary className="flex items-center justify-between px-5 py-4 cursor-pointer list-none">
                  <span className="font-bold text-gray-800 text-sm pr-4">{q}</span>
                  <span className="text-gray-400 group-open:rotate-45 transition-transform text-xl flex-shrink-0">+</span>
                </summary>
                <div className="px-5 pb-4 text-gray-500 text-sm leading-relaxed border-t border-gray-200 pt-3">
                  {a}
                </div>
              </details>
            ))}
          </div>
        </FadeSection>
      </section>

      {/* ══ PRICING + ORDER FORM ══ */}
      <section ref={orderRef} id="dat-hang" className="py-20 px-4 sm:px-6">
        <FadeSection className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="inline-block border border-amber-500/30 bg-amber-500/10 text-amber-600 font-bold text-xs px-5 py-1.5 rounded-full tracking-widest mb-4 uppercase">Đặt hàng ngay</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold mb-3">
              Chỉ {fmt(PRICE)}/Sét -- Rẻ Hơn<br />
              <span className="text-amber-600">Một Lần Đi Chợ Mua Lẻ Nguyên Liệu</span>
            </h2>
            <p className="text-gray-500 max-w-md mx-auto">Giao tận nhà toàn quốc · COD trả khi nhận · Kèm công thức bí quyết · Hoàn tiền 100%</p>
          </div>

          <div className="grid md:grid-cols-2 gap-10 items-start">
            {/* Left: Value stack */}
            <div>
              <div className="bg-gradient-to-br from-emerald-50 to-white rounded-3xl p-6 border border-emerald-500/20 mb-6">
                <p className="text-emerald-700 text-sm font-semibold mb-3 uppercase tracking-wider">Bạn nhận được tất cả:</p>
                <ul className="space-y-3 mb-6">
                  {[
                    { item: '8 nguyên liệu chọn sẵn, đủ bộ, đúng loại', value: 'Tiết kiệm 3-4 tiếng đi chợ' },
                    { item: 'Công thức bí quyết của Cô Hạ', value: 'Tỷ lệ chính xác, không đoán mò' },
                    { item: 'Hướng dẫn từng bước có hình minh họa', value: 'Lần đầu cũng thành công' },
                    { item: 'Đóng gói cẩn thận, giao toàn quốc COD', value: 'Nhận hàng mới trả tiền' },
                    { item: 'Cam kết hoàn tiền 100%', value: 'Không hài lòng = hoàn tiền ngay' },
                  ].map(({ item, value }) => (
                    <li key={item} className="flex items-start gap-3 text-sm">
                      <span className="text-emerald-700 font-bold mt-0.5 flex-shrink-0">&#10003;</span>
                      <div>
                        <span className="text-gray-800 font-medium">{item}</span>
                        <span className="block text-gray-400 text-xs mt-0.5">{value}</span>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="border-t border-gray-200 pt-5 flex items-end justify-between">
                  <div>
                    <p className="text-gray-500 text-sm">Tất cả chỉ</p>
                    <p className="text-4xl font-extrabold text-amber-600">{fmt(PRICE)}</p>
                    <p className="text-gray-500 text-xs">/sét nguyên liệu</p>
                    <p className="mt-2 bg-red-500/10 text-red-600 text-xs font-bold px-2.5 py-1 rounded-full inline-block border border-red-500/20">Chưa bao gồm phí ship</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">COD -- trả khi nhận</p>
                    <p className="text-xs text-gray-500 mt-0.5">Miễn phí đổi trả</p>
                  </div>
                </div>
              </div>

              {/* Social proof mini near form */}
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 mb-4">
                <p className="text-amber-700 text-sm font-semibold text-center">
                  Hàng trăm khách đã đặt sét này -- nhiều người đặt lại lần 2, lần 3 và giới thiệu cho người thân.
                </p>
              </div>

              <div className="space-y-3">
                {[
                  { t: 'Giao hàng toàn quốc', d: 'Ship tận nhà 2-4 ngày, đóng gói cẩn thận' },
                  { t: 'COD -- Thanh toán khi nhận', d: 'Nhận hàng, kiểm tra ổn mới trả tiền' },
                  { t: 'Kèm công thức bí quyết', d: 'Từng bước chi tiết, lần đầu cũng thành công' },
                  { t: 'Không ngon -- hoàn tiền 100%', d: 'Cam kết chất lượng, không hỏi lý do' },
                ].map(item => (
                  <div key={item.t} className="flex gap-3 items-start">
                    <span className="w-2 h-2 bg-emerald-400 rounded-full flex-shrink-0 mt-1.5" />
                    <div>
                      <p className="font-bold text-gray-800 text-sm">{item.t}</p>
                      <p className="text-gray-400 text-xs">{item.d}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* Right: Form */}
            <div className="bg-gray-50 rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-2xl shadow-emerald-500/5">
              <h3 className="font-extrabold text-xl text-emerald-700 mb-1 text-center">Điền Thông Tin Nhận Hàng</h3>
              <p className="text-gray-400 text-xs text-center mb-5">Chỉ mất 30 giây -- nhận hàng trong 2-4 ngày</p>
              <OrderForm />
            </div>
          </div>
        </FadeSection>
      </section>

      {/* ══ FINAL PUSH / P.S. ══ */}
      <section className="py-12 px-4 sm:px-6">
        <FadeSection className="max-w-2xl mx-auto text-center">
          <div className="bg-gradient-to-br from-amber-500/10 to-emerald-500/10 border border-gray-200 rounded-3xl p-8">
            <p className="text-amber-600 text-sm font-semibold mb-3">P.S.</p>
            <p className="text-lg leading-relaxed text-gray-700 mb-2">
              Sét nguyên liệu <strong className="text-gray-900">nhập và đóng gói mỗi ngày</strong> -- đặt hôm nào, nhận hàng tươi mới hôm đó.
            </p>
            <p className="text-base leading-relaxed text-gray-500 mb-4">
              Nếu bạn đang đọc đến đây, nghĩa là bạn thật sự muốn làm xôi cốm ngon.
              Đặt ngay, nhận sét về, và gửi ảnh thành phẩm cho Cô Hạ xem nhé!
            </p>
            <button onClick={scrollToOrder}
              className="mt-2 bg-gradient-to-r from-amber-500 to-amber-600 text-white font-extrabold px-10 py-4 rounded-2xl transition-all active:scale-[0.98] text-xl shadow-xl shadow-amber-500/30">
              Đặt Sét Nguyên Liệu Ngay →
            </button>
          </div>
        </FadeSection>
      </section>

      {/* ══ FOOTER ══ */}
      <footer className="bg-gray-100 border-t border-gray-200 text-gray-400 py-10 px-4 sm:px-6 text-center text-sm pb-24 md:pb-10">
        <div className="max-w-3xl mx-auto space-y-3">
          <div className="flex justify-center">
            <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 inline-flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/logo-bep-co-ha.png" alt="Bếp Cô Hạ" className="h-9 w-9 object-contain"
                onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
              <div className="text-left">
                <p className="text-emerald-700 font-extrabold text-base leading-tight">Bếp Cô Hạ</p>
                <p className="text-gray-400 text-xs">Hacofood.vn</p>
              </div>
            </div>
          </div>
          <p className="text-gray-400">Sét Nguyên Liệu Xôi Cốm Sen Dừa -- Kèm công thức bí quyết độc quyền của Bếp Cô Hạ</p>
          <p className="text-gray-400">Zalo: <strong className="text-gray-500">0965 240 587</strong> · Facebook/TikTok: <strong className="text-gray-500">Cô Hạ dạy nấu ăn</strong></p>
          <p className="text-gray-400 text-xs">Địa chỉ: Dịch Vụ 02, LK 74-75, Đìa Lão, Mậu Lương, Hà Đông, Hà Nội</p>
          <p className="text-gray-300 text-xs">&copy; 2025 Hacofood.vn · Bếp Cô Hạ. All rights reserved.</p>
        </div>
      </footer>

      {/* ══ MESSENGER FLOAT ══ */}
      <a href="https://www.facebook.com/messages/t/hacasau1987" target="_blank" rel="noopener noreferrer"
        className="fixed bottom-36 md:bottom-24 right-4 z-50 w-14 h-14 bg-gradient-to-br from-[#00B2FF] to-[#006AFF] hover:brightness-110 rounded-full flex items-center justify-center shadow-xl shadow-blue-500/30 transition-all hover:scale-110"
        aria-label="Nhắn tin qua Messenger">
        <svg viewBox="0 0 24 24" className="w-8 h-8" fill="white">
          <path d="M12 0C5.373 0 0 4.974 0 11.111c0 3.498 1.744 6.614 4.469 8.652V24l4.088-2.242c1.092.301 2.246.464 3.443.464 6.627 0 12-4.974 12-11.111C24 4.974 18.627 0 12 0zm1.191 14.963l-3.055-3.26-5.963 3.26L10.75 8l3.13 3.259L19.777 8l-6.586 6.963z" />
        </svg>
      </a>

      {/* ══ ZALO FLOAT ══ */}
      <a href="https://zalo.me/0965240587" target="_blank" rel="noopener noreferrer"
        className="fixed bottom-20 md:bottom-6 right-4 z-50 w-14 h-14 bg-blue-500 hover:bg-blue-600 rounded-full flex items-center justify-center shadow-xl shadow-blue-500/30 transition-all hover:scale-110"
        aria-label="Liên hệ qua Zalo">
        <svg viewBox="0 0 48 48" className="w-8 h-8" fill="white">
          <path d="M24 4C12.95 4 4 12.95 4 24s8.95 20 20 20 20-8.95 20-20S35.05 4 24 4zm8.95 28.47c-.18.52-.95.95-1.52 1.08-.38.08-1.18.15-1.18.15s-5.38.68-8.95-2.08c-3.28-2.53-5.48-7.15-5.7-7.53-.22-.38-1.78-2.48-1.78-4.68 0-2.2 1.08-3.3 1.52-3.78.38-.42.95-.58 1.35-.58.15 0 .28.02.42.02.42 0 .62.02.88.68.35.82 1.15 2.88 1.25 3.08.1.22.18.48.02.78-.15.28-.22.48-.42.72-.22.25-.45.55-.62.72-.22.22-.42.48-.18.88.25.42 1.08 1.78 2.35 2.88 1.62 1.42 2.98 1.88 3.42 2.08.38.18.62.15.85-.08.25-.28 1.02-1.18 1.28-1.58.28-.42.55-.35.92-.22.38.15 2.38 1.12 2.78 1.32.42.22.68.32.78.48.12.22.12 1.15-.08 1.68z"/>
        </svg>
      </a>

    </div>
  )
}
