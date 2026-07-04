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
  return <span className={left < 120 ? 'text-red-400 font-bold' : 'font-bold text-emerald-400'}>{m}:{s}</span>
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
        <p className="text-emerald-400 font-extrabold text-lg mb-0.5">Bước 2: Chuyển khoản xác nhận đơn</p>
        <p className="text-zinc-400 text-sm">Quét QR hoặc chuyển thủ công trong <Countdown seconds={30 * 60} /></p>
      </div>
      <div className="flex justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={data.qr.qrUrl} alt="QR chuyển khoản"
          className="w-52 h-52 rounded-2xl border-4 border-emerald-500 shadow-lg shadow-emerald-500/20 object-contain bg-white" />
      </div>
      <div className="bg-zinc-800/80 border border-zinc-700 rounded-2xl p-4 space-y-2.5 text-sm">
        <div className="flex justify-between items-center">
          <span className="text-zinc-400">Ngân hàng</span>
          <span className="font-bold text-zinc-100">{data.qr.bankCode} – {data.qr.accountName}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-zinc-400">Số tài khoản</span>
          <span className="font-bold font-mono text-zinc-100">{data.qr.bankAccount}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-zinc-400">Số tiền</span>
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-amber-400 text-base">{fmt(data.totalPrice)}</span>
            <button onClick={() => copy(String(data.totalPrice), 'amount')}
              className="text-xs bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 px-2 py-0.5 rounded-lg transition-colors">
              {copied === 'amount' ? '✓ Đã copy' : 'Copy'}
            </button>
          </div>
        </div>
        <div className="flex justify-between items-center border-t border-zinc-700 pt-2.5">
          <span className="text-zinc-400">Nội dung CK <span className="text-red-400 font-bold">(bắt buộc)</span></span>
          <div className="flex items-center gap-2">
            <span className="font-extrabold font-mono text-emerald-400">{data.refCode}</span>
            <button onClick={() => copy(data.refCode, 'ref')}
              className="text-xs bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 px-2 py-0.5 rounded-lg transition-colors">
              {copied === 'ref' ? '✓ Đã copy' : 'Copy'}
            </button>
          </div>
        </div>
      </div>
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-300">
        Nhập <strong>đúng nội dung</strong> <code className="bg-amber-500/20 px-1 rounded">{data.refCode}</code> khi chuyển khoản – hệ thống tự động xác nhận và đơn chuyển sang <strong>Chờ chuyển hàng</strong>.
      </div>
      <div className="text-center text-sm text-zinc-500 pt-1">
        <p>Đơn của <strong className="text-zinc-300">{form.name}</strong> · {data.productLabel} x {form.quantity}</p>
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
        <label className="font-bold text-zinc-300 mb-2 block text-sm">Số lượng sét *</label>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => set('quantity', Math.max(1, form.quantity - 1))}
            className="w-10 h-10 rounded-full border-2 border-zinc-600 text-xl font-bold hover:border-emerald-500 hover:text-emerald-400 transition-colors flex items-center justify-center text-zinc-300">&minus;</button>
          <span className="w-10 text-center font-bold text-xl text-emerald-400">{form.quantity}</span>
          <button type="button" onClick={() => set('quantity', Math.min(20, form.quantity + 1))}
            className="w-10 h-10 rounded-full border-2 border-zinc-600 text-xl font-bold hover:border-emerald-500 hover:text-emerald-400 transition-colors flex items-center justify-center text-zinc-300">+</button>
          <span className="ml-2 text-sm text-zinc-400">Tổng: <strong className="text-amber-400 text-lg">{fmt(total)}</strong></span>
        </div>
      </div>

      <div>
        <label className="font-bold text-zinc-300 mb-2 block text-sm">Họ và tên *</label>
        <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ví dụ: Nguyễn Thị Lan"
          className="w-full bg-zinc-800 border-2 border-zinc-700 rounded-xl px-4 py-3 text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none transition-colors" />
      </div>
      <div>
        <label className="font-bold text-zinc-300 mb-2 block text-sm">Số điện thoại *</label>
        <input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="0912 345 678" type="tel"
          className="w-full bg-zinc-800 border-2 border-zinc-700 rounded-xl px-4 py-3 text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none transition-colors" />
      </div>
      {!compact && (
        <div>
          <label className="font-bold text-zinc-300 mb-2 block text-sm">Email <span className="text-zinc-500 font-normal">(không bắt buộc)</span></label>
          <input value={form.email} onChange={e => set('email', e.target.value)} placeholder="email@gmail.com" type="email"
            className="w-full bg-zinc-800 border-2 border-zinc-700 rounded-xl px-4 py-3 text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none transition-colors" />
        </div>
      )}
      <div>
        <label className="font-bold text-zinc-300 mb-2 block text-sm">Địa chỉ giao hàng *</label>
        <textarea value={form.address} onChange={e => set('address', e.target.value)} rows={3}
          placeholder="Số nhà, ngõ/hẻm, đường, phường/xã, quận/huyện, tỉnh/thành phố"
          className="w-full bg-zinc-800 border-2 border-zinc-700 rounded-xl px-4 py-3 text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none transition-colors resize-none" />
      </div>
      <div>
        <label className="font-bold text-zinc-300 mb-2 block text-sm">Ghi chú <span className="text-zinc-500 font-normal">(không bắt buộc)</span></label>
        <input value={form.note} onChange={e => set('note', e.target.value)} placeholder="Giao giờ nào, yêu cầu đặc biệt..."
          className="w-full bg-zinc-800 border-2 border-zinc-700 rounded-xl px-4 py-3 text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none transition-colors" />
      </div>

      {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl py-2.5 px-4 text-center">{error}</p>}

      <button type="submit" disabled={step === 'loading'}
        className="w-full py-4 rounded-2xl font-extrabold text-white text-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-500 transition-all active:scale-[0.98] disabled:opacity-60 shadow-xl shadow-amber-500/30">
        {step === 'loading'
          ? <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>Đang gửi đơn...
            </span>
          : 'Cho Tôi Sét Nguyên Liệu →'}
      </button>
      <p className="text-xs text-zinc-500 text-center">Thông tin bảo mật · Xác nhận qua chuyển khoản · COD toàn quốc</p>
    </form>
  )
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function SetXoiCom() {
  const orderRef = useRef<HTMLDivElement>(null)
  const [showStickyBar, setShowStickyBar] = useState(false)

  const scrollToOrder = () => orderRef.current?.scrollIntoView({ behavior: 'smooth' })

  useEffect(() => {
    const onScroll = () => setShowStickyBar(window.scrollY > 400)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-zinc-100 font-sans antialiased">

      {/* ══ STICKY BOTTOM BAR ══ */}
      <div className={`fixed bottom-0 left-0 right-0 z-50 transition-transform duration-300 ${showStickyBar ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className="bg-zinc-900/95 backdrop-blur-xl border-t border-zinc-800 px-4 py-3 flex items-center gap-3 max-w-5xl mx-auto">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-zinc-400 truncate">Sét Nguyên Liệu Xôi Cốm Sen Dừa</p>
            <p className="font-extrabold text-amber-400 text-lg leading-tight">{fmt(PRICE)}<span className="text-xs font-normal text-zinc-500">/sét</span></p>
          </div>
          <button onClick={scrollToOrder}
            className="flex-shrink-0 bg-gradient-to-r from-amber-500 to-amber-600 text-white font-extrabold px-6 py-3 rounded-xl text-sm active:scale-[0.98] transition-all shadow-lg shadow-amber-500/30">
            Đặt Ngay →
          </button>
        </div>
      </div>

      {/* ══ ANNOUNCEMENT BAR ══ */}
      <div className="bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 text-white text-center py-2.5 px-4">
        <p className="text-sm font-bold tracking-wide">
          Cốm khô chính vụ – số lượng có hạn, hết hàng không báo trước
        </p>
      </div>

      {/* ══ HERO ══ */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-950/40 via-[#0a0a0f] to-[#0a0a0f]" />
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'radial-gradient(circle at 30% 50%, rgba(255,255,255,0.8) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 pt-10 pb-16">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <div className="bg-zinc-900/80 backdrop-blur rounded-2xl px-5 py-3 border border-zinc-800 inline-flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/logo-bep-co-ha.png" alt="Bếp Cô Hạ" className="h-12 w-12 object-contain"
                onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
              <div>
                <p className="text-emerald-400 font-extrabold text-xl leading-tight tracking-tight">Bếp Cô Hạ</p>
                <p className="text-zinc-500 text-xs">Hacofood.vn</p>
              </div>
            </div>
          </div>

          {/* Headline */}
          <div className="text-center mb-8 max-w-3xl mx-auto">
            <p className="text-amber-400 text-sm font-bold uppercase tracking-widest mb-4">Sét nguyên liệu từ Bếp Cô Hạ</p>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.1] mb-5">
              Lần Đầu Làm Xôi Cốm<br />
              <span className="bg-gradient-to-r from-emerald-400 to-emerald-300 bg-clip-text text-transparent">Cũng Thành Công</span>
            </h1>
            <p className="text-zinc-400 text-lg sm:text-xl max-w-xl mx-auto leading-relaxed">
              8 nguyên liệu chọn sẵn, đóng bộ đầy đủ.
              Kèm công thức bí quyết của Cô Hạ.
              Nhận về, làm theo từng bước, ra ngay đĩa xôi cốm chuẩn vị.
            </p>
          </div>

          {/* Hero image */}
          <div className="flex justify-center mb-10">
            <div className="relative rounded-3xl overflow-hidden shadow-2xl shadow-emerald-500/10 border border-zinc-800 w-full max-w-sm">
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
              'Làm theo là thành công',
              'Giao toàn quốc – COD',
            ].map(text => (
              <div key={text} className="flex items-center gap-2 bg-zinc-800/60 backdrop-blur border border-zinc-700/50 rounded-full px-4 py-2 text-sm text-zinc-300">
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
              className="bg-zinc-800/60 border border-zinc-700 text-zinc-300 font-bold text-base px-8 py-4 rounded-2xl hover:bg-zinc-800 transition-colors text-center">
              Xem Chi Tiết
            </a>
          </div>
        </div>
      </section>

      {/* ══ TRUST BAR ══ */}
      <section className="bg-zinc-900/80 border-y border-zinc-800 py-4 px-4">
        <div className="max-w-4xl mx-auto flex flex-wrap justify-center gap-x-8 gap-y-2">
          {[
            'Hàng trăm đơn thành công',
            'Kèm công thức chi tiết',
            'COD – trả tiền khi nhận',
            'Không ngon hoàn tiền 100%',
          ].map(text => (
            <div key={text} className="flex items-center gap-2 text-zinc-400 text-sm font-medium">
              <span className="text-emerald-400">&#10003;</span><span>{text}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ══ PAIN SECTION ══ */}
      <section className="py-16 px-4 sm:px-6">
        <FadeSection className="max-w-3xl mx-auto text-center">
          <p className="inline-block border border-red-500/30 bg-red-500/10 text-red-400 font-bold text-xs px-4 py-1.5 rounded-full tracking-widest mb-5 uppercase">
            Bạn có đang gặp tình huống này?
          </p>
          <h2 className="text-3xl sm:text-4xl font-extrabold mb-3 leading-tight">
            Muốn Làm Xôi Cốm Ngon<br />
            <span className="text-red-400">Mà Cứ Mãi Không Ra Được?</span>
          </h2>
          <p className="text-zinc-500 mb-10 max-w-xl mx-auto">
            Nhiều người đã thử đi chợ, lên mạng, hỏi công thức – nhưng kết quả vẫn không như mong đợi.
            Không phải lỗi của bạn. Vấn đề nằm ở nguyên liệu và tỷ lệ.
          </p>
          <div className="grid sm:grid-cols-2 gap-4 text-left">
            {[
              { t: 'Không biết mua nguyên liệu ở đâu cho đúng', d: 'Cốm khô ngon, hạt sen sạch, bột cốt dừa chuẩn – tìm ngoài chợ khó, mua online không rõ chất lượng. Mua phải đồ kém là hỏng cả mẻ xôi.' },
              { t: 'Làm hoài vẫn không ra vị chuẩn', d: 'Xôi bị nhão, hạt cốm không dẻo, thiếu hương lá dứa – làm nhiều lần mà vẫn không bằng hàng quán. Tốn nguyên liệu, mất thời gian, chán nản.' },
              { t: 'Mua lẻ từng thứ phức tạp, thừa thiếu', d: 'Đi nhiều chỗ, mua về thừa hạt sen, thiếu lá dứa, hoặc mua nhiều không dùng hết bị hỏng. Tính ra đắt hơn mua sẵn.' },
              { t: 'Không có ai chỉ cho tỷ lệ đúng', d: 'Công thức trên mạng mỗi người nói một kiểu. Lúc nhạt lúc ngọt quá – không bao giờ chắc chắn mình làm đúng.' },
            ].map(item => (
              <div key={item.t} className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5">
                <p className="font-bold text-zinc-100 mb-2">{item.t}</p>
                <p className="text-zinc-500 text-sm leading-relaxed">{item.d}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-6 max-w-xl mx-auto">
            <p className="text-zinc-300 text-base leading-relaxed">
              Xôi cốm ngon cần <strong className="text-emerald-400">đúng nguyên liệu, đúng tỷ lệ, đúng kỹ thuật</strong>.
              Và Cô Hạ đã giải quyết hết cho bạn rồi – gom vào một sét duy nhất.
            </p>
          </div>
        </FadeSection>
      </section>

      {/* ══ SOLUTION BRIDGE – CÔ HẠ ══ */}
      <section className="py-16 px-4 sm:px-6">
        <FadeSection className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div className="relative flex justify-center">
              <div className="relative rounded-3xl overflow-hidden shadow-2xl shadow-emerald-500/10 border border-zinc-800 max-w-xs w-full" style={{ aspectRatio: '3/4' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={COHA_IMG} alt="Cô Hạ – Bếp Cô Hạ" className="w-full h-full object-cover object-top" />
              </div>
              <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-amber-500 text-white font-extrabold text-sm px-5 py-2.5 rounded-full shadow-lg whitespace-nowrap">
                Kèm công thức bí quyết
              </div>
            </div>
            <div>
              <p className="inline-block border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 font-bold text-xs px-4 py-1.5 rounded-full tracking-widest mb-5 uppercase">
                Người đứng sau sét
              </p>
              <h2 className="text-3xl sm:text-4xl font-extrabold mb-5 leading-tight">
                Gặp Cô Hạ –<br />
                <span className="text-amber-400">Người Chọn Từng Nguyên Liệu</span><br />
                Và Truyền Công Thức<br />Bí Quyết Cho Bạn.
              </h2>
              <p className="text-zinc-400 leading-relaxed mb-6">
                Sau nhiều năm nấu nướng và hàng chục video viral về xôi cốm, Cô Hạ đã tỉ mỉ chọn đúng từng loại nguyên liệu – cốm khô, hạt sen, đậu xanh, bột cốt dừa, lá dứa...
                Tất cả được đóng sẵn thành một sét, kèm theo công thức chi tiết từng bước.
                <strong className="text-zinc-200"> Bạn chỉ cần mở ra và làm theo – là thành công ngay lần đầu.</strong>
              </p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  'Nguyên liệu đủ bộ, đúng loại',
                  'Công thức từng bước rõ ràng',
                  'Hàng trăm người đã thành công',
                  'Đảm bảo – không ngon hoàn tiền',
                ].map(t => (
                  <div key={t} className="flex items-center gap-2 bg-zinc-800/60 border border-zinc-700/50 rounded-xl p-3">
                    <span className="text-emerald-400 font-bold flex-shrink-0">&#10003;</span>
                    <span className="text-sm text-zinc-300">{t}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </FadeSection>
      </section>

      {/* ══ GALLERY SẢN PHẨM ══ */}
      <section id="san-pham" className="py-16 px-4 sm:px-6">
        <FadeSection className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <p className="inline-block border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 font-bold text-xs px-5 py-1.5 rounded-full tracking-widest mb-4 uppercase">Sản phẩm</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold">
              Sét Nguyên Liệu Xôi Cốm Sen Dừa<br />
              <span className="text-amber-400">Đầy Đủ – Chọn Lọc – Giao Tận Tay</span>
            </h2>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-2 sm:mb-3 h-52 sm:h-72">
            {SAN_PHAM.slice(0, 3).map(item => (
              <div key={item.label} className="relative rounded-xl sm:rounded-2xl overflow-hidden group border border-zinc-800 h-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.src} alt={item.label} className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3 h-44 sm:h-56">
            {SAN_PHAM.slice(3, 6).map(item => (
              <div key={item.label} className="relative rounded-xl sm:rounded-2xl overflow-hidden group border border-zinc-800 h-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.src} alt={item.label} className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <button onClick={scrollToOrder} className="bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold px-8 py-3.5 rounded-2xl shadow-lg shadow-amber-500/20 hover:shadow-amber-500/40 transition-all active:scale-[0.98]">
              Cho Tôi Sét Này →
            </button>
          </div>
        </FadeSection>
      </section>

      {/* ══ VIDEO ══ */}
      <section className="py-16 px-4 sm:px-6 bg-zinc-900/50">
        <FadeSection className="max-w-3xl mx-auto text-center">
          <p className="inline-block border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 font-bold text-xs px-4 py-1.5 rounded-full tracking-widest mb-4 uppercase">Xem thực tế</p>
          <h2 className="text-3xl sm:text-4xl font-extrabold mb-2">
            Cô Hạ Hướng Dẫn Trực Tiếp<br />
            <span className="text-amber-400">Xem Ngay – Làm Là Biết</span>
          </h2>
          <p className="text-zinc-500 text-sm mb-10">Video thực tế từ Bếp Cô Hạ – thấy nguyên liệu, thấy thành phẩm, thấy luôn cách làm</p>
          <div className="flex justify-center">
            <div className="relative rounded-3xl overflow-hidden shadow-2xl shadow-emerald-500/10 border border-zinc-800 w-full max-w-xs" style={{ aspectRatio: '9/16' }}>
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
              Đặt Sét Nguyên Liệu Ngay →
            </button>
          </div>
        </FadeSection>
      </section>

      {/* ══ THÀNH PHẦN SÉT ══ */}
      <section className="py-16 px-4 sm:px-6">
        <FadeSection className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <p className="inline-block border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 font-bold text-xs px-4 py-1.5 rounded-full tracking-widest mb-4 uppercase">Thành phần sét</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold">
              Cô Hạ Chọn Sẵn 8 Nguyên Liệu<br />
              <span className="text-amber-400">Bạn Chỉ Cần Nhận &amp; Làm Theo</span>
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-3xl p-6">
              <h3 className="font-extrabold text-xl text-emerald-400 mb-5">Nguyên Liệu Trong Sét</h3>
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
                  <div key={name} className="flex items-center gap-2 bg-zinc-800/60 border border-zinc-700/50 rounded-xl px-3 py-2.5">
                    <span className="w-2 h-2 bg-emerald-400 rounded-full flex-shrink-0" />
                    <span className="text-zinc-300 font-medium text-sm">{name}</span>
                  </div>
                ))}
              </div>
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 mt-4">
                <p className="text-emerald-400 font-bold text-sm">+ Công thức bí quyết của Bếp Cô Hạ tặng kèm</p>
                <p className="text-emerald-500/70 text-xs mt-0.5">Tỷ lệ &amp; kỹ thuật chi tiết – ghi rõ từng bước</p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="bg-zinc-900/80 border border-zinc-800 rounded-3xl p-6">
                <h3 className="font-extrabold text-xl text-emerald-400 mb-4">Thành Phẩm Bạn Sẽ Có</h3>
                <ul className="space-y-3 text-zinc-400 text-sm">
                  <li className="flex gap-2.5"><span className="text-emerald-400 font-bold flex-shrink-0">&#10003;</span><span>Xôi tơi, hạt cốm <strong className="text-zinc-200">dẻo mềm</strong>, không dính nhão</span></li>
                  <li className="flex gap-2.5"><span className="text-emerald-400 font-bold flex-shrink-0">&#10003;</span><span>Hạt sen <strong className="text-zinc-200">bùi</strong>, đậu xanh vàng tươi đẹp mắt</span></li>
                  <li className="flex gap-2.5"><span className="text-emerald-400 font-bold flex-shrink-0">&#10003;</span><span>Hương <strong className="text-zinc-200">lá dứa và cốt dừa</strong> quyện nhẹ, thơm tự nhiên</span></li>
                  <li className="flex gap-2.5"><span className="text-emerald-400 font-bold flex-shrink-0">&#10003;</span><span>Ăn nóng hoặc nguội đều ngon – phù hợp bữa sáng, cỗ chay, quà quê</span></li>
                </ul>
              </div>
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-3xl p-6">
                <h3 className="font-extrabold text-lg text-amber-400 mb-3">Lưu Ý</h3>
                <ul className="space-y-2 text-zinc-400 text-sm">
                  <li className="flex gap-2"><span className="text-amber-400">&#8226;</span> <span>Đây là <strong className="text-zinc-200">sét nguyên liệu</strong> – bạn tự làm tại nhà theo công thức tặng kèm</span></li>
                  <li className="flex gap-2"><span className="text-amber-400">&#8226;</span> <span>Thời gian làm: khoảng <strong className="text-zinc-200">1–1,5 tiếng</strong> (ngâm + hấp)</span></li>
                  <li className="flex gap-2"><span className="text-amber-400">&#8226;</span> <span>Cần có <strong className="text-zinc-200">xửng hấp</strong> hoặc nồi cơm điện chế độ hấp</span></li>
                </ul>
              </div>
            </div>
          </div>
        </FadeSection>
      </section>

      {/* ══ USE CASES ══ */}
      <section className="py-14 px-4 sm:px-6 bg-zinc-900/50">
        <FadeSection className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold mb-2">Phù Hợp Với Mọi Dịp</h2>
          <p className="text-zinc-500 mb-10">Một sét nguyên liệu – vô vàn lý do để làm</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { name: 'Bữa sáng gia đình', sub: 'Ngon, bổ dưỡng, đơn giản' },
              { name: 'Cỗ chay, mâm cúng', sub: 'Truyền thống, trang nghiêm' },
              { name: 'Quà quê tặng người thân', sub: 'Đặc sản Hà Nội địa phương' },
              { name: 'Tết, lễ, giỗ chạp', sub: 'Ý nghĩa, thơm thảo' },
              { name: 'Cưới hỏi, sinh nhật', sub: 'Khác biệt, đáng nhớ' },
              { name: 'Tân gia, họp mặt', sub: 'Ấm cúng, sum vầy' },
            ].map(item => (
              <div key={item.name} className="bg-zinc-800/60 border border-zinc-700/50 rounded-2xl p-5 text-center">
                <p className="font-bold text-zinc-100 mt-1">{item.name}</p>
                <p className="text-sm text-emerald-400/80 mt-1">{item.sub}</p>
              </div>
            ))}
          </div>
        </FadeSection>
      </section>

      {/* ══ THÀNH PHẨM HỌC VIÊN ══ */}
      <section className="py-16 px-4 sm:px-6">
        <FadeSection className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <p className="inline-block border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 font-bold text-xs px-5 py-1.5 rounded-full tracking-widest mb-4 uppercase">Thành phẩm học viên</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold">
              Họ Đã Làm Thành Công<br />
              <span className="text-amber-400">Đây Là Thành Phẩm Thật Của Khách Hàng</span>
            </h2>
            <p className="text-zinc-500 mt-3">Tất cả đều làm theo đúng công thức trong sét nguyên liệu của Cô Hạ</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {THANH_PHAM.map((src, i) => (
              <div key={i} className="rounded-2xl overflow-hidden border border-zinc-800 group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`Thành phẩm học viên ${i + 1}`}
                  className="w-full h-44 object-cover object-center group-hover:scale-105 transition-transform duration-500" loading="lazy" />
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <button onClick={scrollToOrder} className="bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold px-8 py-3.5 rounded-2xl shadow-lg shadow-amber-500/20 transition-all active:scale-[0.98]">
              Tôi Cũng Muốn Thử Ngay →
            </button>
          </div>
        </FadeSection>
      </section>

      {/* ══ UY TÍN ══ */}
      <section className="py-16 px-4 sm:px-6 bg-zinc-900/50">
        <FadeSection className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <p className="inline-block border border-amber-500/30 bg-amber-500/10 text-amber-400 font-bold text-xs px-4 py-1.5 rounded-full tracking-widest mb-4 uppercase">Thương hiệu uy tín</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold">
              Bếp Cô Hạ – Triệu Người Tin Tưởng<br />
              <span className="text-amber-400">Trên Khắp Các Nền Tảng</span>
            </h2>
          </div>
          <div className="grid grid-cols-3 gap-4 mb-10 max-w-3xl mx-auto">
            {UY_TIN.map(img => (
              <div key={img.label} className="rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-900/80 flex flex-col">
                <div className="h-52 sm:h-64 flex items-center justify-center bg-zinc-900 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.src} alt={img.label} className="w-full h-full object-contain" />
                </div>
                <p className="text-center text-xs font-semibold text-zinc-500 py-2.5 px-2 leading-tight">{img.label}</p>
              </div>
            ))}
          </div>
          <div className="bg-zinc-800/60 border border-zinc-700/50 rounded-3xl p-6 text-center max-w-2xl mx-auto">
            <p className="text-zinc-300 font-bold text-lg mb-2 italic">&quot;Cô Hạ làm từ tâm – công thức chia sẻ thật sự, nguyên liệu chọn thật sự, kết quả thật sự.&quot;</p>
            <p className="text-emerald-400/80 text-sm">– Bếp Cô Hạ, Hacofood.vn</p>
          </div>
        </FadeSection>
      </section>

      {/* ══ GUARANTEE ══ */}
      <section className="py-14 px-4 sm:px-6">
        <FadeSection className="max-w-2xl mx-auto">
          <div className="bg-gradient-to-br from-emerald-950/50 to-zinc-900/80 border border-emerald-500/20 rounded-3xl p-8 text-center">
            <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-5">
              <span className="text-3xl text-emerald-400 font-bold">100%</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold mb-3">
              Cam Kết <span className="text-emerald-400">Hoàn Tiền 100%</span>
            </h2>
            <p className="text-zinc-400 leading-relaxed max-w-lg mx-auto mb-4">
              Nhận sét nguyên liệu, làm theo công thức, nếu bạn không hài lòng với chất lượng nguyên liệu – Cô Hạ hoàn tiền 100%, không hỏi lý do.
            </p>
            <p className="text-zinc-500 text-sm">
              Bạn không có gì để mất. Chỉ có đĩa xôi cốm ngon đang chờ.
            </p>
          </div>
        </FadeSection>
      </section>

      {/* ══ DÀNH CHO AI / KHÔNG DÀNH CHO AI ══ */}
      <section className="py-14 px-4 sm:px-6 bg-zinc-900/50">
        <FadeSection className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-3xl p-6">
              <h3 className="font-extrabold text-xl text-emerald-400 mb-4">Sét này dành cho bạn nếu:</h3>
              <ul className="space-y-3 text-zinc-300 text-sm">
                {[
                  'Bạn muốn làm xôi cốm ngon tại nhà nhưng chưa biết bắt đầu từ đâu',
                  'Bạn không có thời gian đi chợ tìm từng loại nguyên liệu',
                  'Bạn muốn món quà ý nghĩa từ bếp nhà mình cho người thân',
                  'Bạn thích tự tay làm nhưng cần người dẫn đường đúng cách',
                ].map(t => (
                  <li key={t} className="flex gap-2.5"><span className="text-emerald-400 flex-shrink-0">&#10003;</span> {t}</li>
                ))}
              </ul>
            </div>
            <div className="bg-red-500/5 border border-red-500/20 rounded-3xl p-6">
              <h3 className="font-extrabold text-xl text-red-400 mb-4">Sét này KHÔNG phù hợp nếu:</h3>
              <ul className="space-y-3 text-zinc-300 text-sm">
                {[
                  'Bạn muốn mua xôi cốm đã nấu sẵn, ăn liền',
                  'Bạn không có xửng hấp hoặc nồi cơm điện có chế độ hấp',
                  'Bạn không muốn bỏ 1–1,5 tiếng để làm',
                  'Bạn muốn sản phẩm giao trong ngày (sét giao COD cần 2-4 ngày)',
                ].map(t => (
                  <li key={t} className="flex gap-2.5"><span className="text-red-400 flex-shrink-0">&#10007;</span> {t}</li>
                ))}
              </ul>
            </div>
          </div>
        </FadeSection>
      </section>

      {/* ══ FEEDBACK KHÁCH HÀNG ══ */}
      <section className="py-16 px-4 sm:px-6">
        <FadeSection className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <p className="inline-block border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 font-bold text-xs px-4 py-1.5 rounded-full tracking-widest mb-4 uppercase">Khách đã nói gì</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold">
              Hàng Trăm Khách Hài Lòng<br />
              <span className="text-amber-400">Đặt Lại Nhiều Lần, Giới Thiệu Người Thân</span>
            </h2>
          </div>
          <div className="columns-2 sm:columns-3 gap-3 space-y-3">
            {FEEDBACKS.map((src, i) => (
              <div key={i} className="break-inside-avoid rounded-2xl overflow-hidden border border-zinc-800">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`Phản hồi khách hàng ${i + 1}`} className="w-full h-auto object-cover" loading="lazy" />
              </div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <button onClick={scrollToOrder} className="bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold px-8 py-3.5 rounded-2xl shadow-lg shadow-amber-500/20 transition-all active:scale-[0.98]">
              Cho Tôi Đặt Ngay →
            </button>
          </div>
        </FadeSection>
      </section>

      {/* ══ FAQ ══ */}
      <section className="py-14 px-4 sm:px-6 bg-zinc-900/50">
        <FadeSection className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-extrabold">Câu Hỏi Thường Gặp</h2>
          </div>
          <div className="space-y-3">
            {[
              { q: 'Sét này có phải xôi nấu sẵn không?', a: 'Không. Đây là sét NGUYÊN LIỆU – bạn nhận về và tự làm tại nhà theo công thức tặng kèm. Thời gian làm khoảng 1–1,5 tiếng.' },
              { q: 'Một sét làm được bao nhiêu?', a: 'Một sét làm được khoảng 1 đĩa xôi cốm lớn, đủ cho 4-6 người ăn. Nếu cần nhiều hơn, đặt thêm sét.' },
              { q: 'Ship bao lâu thì nhận?', a: 'Giao toàn quốc qua các đơn vị vận chuyển. Thời gian nhận hàng 2-4 ngày tùy khu vực. Có thể nhận hàng và trả tiền khi nhận (COD).' },
              { q: 'Nếu làm không ngon thì sao?', a: 'Cô Hạ cam kết hoàn tiền 100% nếu bạn không hài lòng với chất lượng nguyên liệu. Bạn không có gì để mất.' },
              { q: 'Tôi chưa bao giờ làm xôi cốm, có làm được không?', a: 'Được. Công thức ghi chi tiết từng bước, có hình minh họa. Hàng trăm người lần đầu làm đã thành công với sét này.' },
              { q: 'Nguyên liệu có bảo quản được lâu không?', a: 'Có. Nguyên liệu khô (cốm khô, đậu xanh, hạt sen...) bảo quản ở nơi khô mát được vài tháng. Lá dứa nên dùng sớm sau khi nhận.' },
            ].map(({ q, a }) => (
              <details key={q} className="group bg-zinc-900/80 border border-zinc-800 rounded-2xl">
                <summary className="flex items-center justify-between px-5 py-4 cursor-pointer list-none">
                  <span className="font-bold text-zinc-200 text-sm pr-4">{q}</span>
                  <span className="text-zinc-500 group-open:rotate-45 transition-transform text-xl flex-shrink-0">+</span>
                </summary>
                <div className="px-5 pb-4 text-zinc-400 text-sm leading-relaxed border-t border-zinc-800 pt-3">
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
            <p className="inline-block border border-amber-500/30 bg-amber-500/10 text-amber-400 font-bold text-xs px-5 py-1.5 rounded-full tracking-widest mb-4 uppercase">Đặt hàng</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold mb-3">
              Nhận Sét Nguyên Liệu Về Nhà<br />
              <span className="text-amber-400">Làm Ngay – Thành Công Ngay Lần Đầu</span>
            </h2>
            <p className="text-zinc-500 max-w-md mx-auto">Giao tận nhà toàn quốc · COD trả khi nhận · Kèm công thức bí quyết</p>
          </div>

          <div className="grid md:grid-cols-2 gap-10 items-start">
            {/* Left: Value stack */}
            <div>
              <div className="bg-gradient-to-br from-emerald-950/60 to-zinc-900 rounded-3xl p-6 border border-emerald-500/20 mb-6">
                <p className="text-emerald-400 text-sm font-semibold mb-3 uppercase tracking-wider">Bạn nhận được:</p>
                <ul className="space-y-3 mb-6">
                  {[
                    '8 nguyên liệu chọn sẵn, đủ bộ, đúng loại',
                    'Công thức bí quyết của Cô Hạ tặng kèm',
                    'Hướng dẫn từng bước – làm là thành công',
                    'Đóng gói cẩn thận, giao toàn quốc',
                    'Bảo hành: không ngon hoàn tiền 100%',
                  ].map(item => (
                    <li key={item} className="flex items-start gap-3 text-sm">
                      <span className="text-emerald-400 font-bold mt-0.5 flex-shrink-0">&#10003;</span>
                      <span className="text-zinc-300">{item}</span>
                    </li>
                  ))}
                </ul>
                <div className="border-t border-zinc-700 pt-5 flex items-end justify-between">
                  <div>
                    <p className="text-zinc-500 text-sm">Giá chỉ</p>
                    <p className="text-4xl font-extrabold text-white">{fmt(PRICE)}</p>
                    <p className="text-zinc-500 text-xs">/sét nguyên liệu</p>
                    <p className="mt-2 bg-red-500/20 text-red-400 text-xs font-bold px-2.5 py-1 rounded-full inline-block border border-red-500/30">Chưa bao gồm phí ship</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-zinc-500">COD – trả khi nhận</p>
                    <p className="text-xs text-zinc-500 mt-0.5">Miễn phí đổi trả</p>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                {[
                  { t: 'Giao hàng toàn quốc', d: 'Ship tận nhà, đóng gói cẩn thận' },
                  { t: 'COD – Thanh toán khi nhận', d: 'Nhận hàng, kiểm tra ổn mới trả tiền' },
                  { t: 'Kèm công thức bí quyết', d: 'Tỷ lệ & kỹ thuật chi tiết, làm là thành công' },
                  { t: 'Không ngon – hoàn tiền 100%', d: 'Cam kết chất lượng tuyệt đối' },
                ].map(item => (
                  <div key={item.t} className="flex gap-3 items-start">
                    <span className="w-2 h-2 bg-emerald-400 rounded-full flex-shrink-0 mt-1.5" />
                    <div>
                      <p className="font-bold text-zinc-200 text-sm">{item.t}</p>
                      <p className="text-zinc-500 text-xs">{item.d}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* Right: Form */}
            <div className="bg-zinc-900/80 rounded-3xl p-6 sm:p-8 border border-zinc-800 shadow-2xl shadow-emerald-500/5">
              <h3 className="font-extrabold text-xl text-emerald-400 mb-5 text-center">Điền Thông Tin Đặt Hàng</h3>
              <OrderForm />
            </div>
          </div>
        </FadeSection>
      </section>

      {/* ══ FINAL PUSH / P.S. ══ */}
      <section className="py-12 px-4 sm:px-6">
        <FadeSection className="max-w-2xl mx-auto text-center">
          <div className="bg-gradient-to-br from-amber-500/10 to-emerald-500/10 border border-zinc-800 rounded-3xl p-8">
            <p className="text-amber-400 text-sm font-semibold mb-3">P.S.</p>
            <p className="text-lg leading-relaxed text-zinc-300">
              Cốm ngon nhất chỉ có <strong className="text-white">vài tháng trong năm</strong>. Khi Cô Hạ còn hàng – đặt ngay.
              Nhận sét về, làm theo công thức, rồi chia sẻ thành phẩm cho Cô Hạ xem nhé!
            </p>
            <button onClick={scrollToOrder}
              className="mt-6 bg-gradient-to-r from-amber-500 to-amber-600 text-white font-extrabold px-10 py-4 rounded-2xl transition-all active:scale-[0.98] text-xl shadow-xl shadow-amber-500/30">
              Cho Tôi Sét Nguyên Liệu →
            </button>
          </div>
        </FadeSection>
      </section>

      {/* ══ FOOTER ══ */}
      <footer className="bg-zinc-950 border-t border-zinc-800 text-zinc-500 py-10 px-4 sm:px-6 text-center text-sm pb-24 md:pb-10">
        <div className="max-w-3xl mx-auto space-y-3">
          <div className="flex justify-center">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 inline-flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/logo-bep-co-ha.png" alt="Bếp Cô Hạ" className="h-9 w-9 object-contain"
                onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
              <div className="text-left">
                <p className="text-emerald-400 font-extrabold text-base leading-tight">Bếp Cô Hạ</p>
                <p className="text-zinc-600 text-xs">Hacofood.vn</p>
              </div>
            </div>
          </div>
          <p className="text-zinc-500">Sét Nguyên Liệu Xôi Cốm Sen Dừa – Kèm công thức bí quyết độc quyền của Bếp Cô Hạ</p>
          <p className="text-zinc-500">Zalo: <strong className="text-zinc-400">0965 240 587</strong> · Facebook/TikTok: <strong className="text-zinc-400">Cô Hạ dạy nấu ăn</strong></p>
          <p className="text-zinc-600 text-xs">Địa chỉ: Bếp Cô Hạ, Số 20 phố Cầu Am, Phường Hà Đông, TP Hà Nội</p>
          <p className="text-zinc-700 text-xs">&copy; 2025 Hacofood.vn · Bếp Cô Hạ. All rights reserved.</p>
        </div>
      </footer>

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
