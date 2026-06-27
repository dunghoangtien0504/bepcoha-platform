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
  return <span className={left < 120 ? 'text-red-500 font-bold' : 'font-bold text-[#3F6B2E]'}>{m}:{s}</span>
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
        <p className="text-[#3F6B2E] font-extrabold text-lg mb-0.5">Bước 2: Chuyển khoản xác nhận đơn</p>
        <p className="text-gray-500 text-sm">Quét QR hoặc chuyển thủ công trong <Countdown seconds={30 * 60} /></p>
      </div>
      <div className="flex justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={data.qr.qrUrl} alt="QR chuyển khoản"
          className="w-52 h-52 rounded-2xl border-4 border-[#3F6B2E] shadow-lg object-contain bg-white" />
      </div>
      <div className="bg-[#F4FAF0] border border-green-200 rounded-2xl p-4 space-y-2.5 text-sm">
        <div className="flex justify-between items-center">
          <span className="text-gray-500">Ngân hàng</span>
          <span className="font-bold">{data.qr.bankCode} – {data.qr.accountName}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-500">Số tài khoản</span>
          <span className="font-bold font-mono">{data.qr.bankAccount}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-500">Số tiền</span>
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-[#C9832E] text-base">{fmt(data.totalPrice)}</span>
            <button onClick={() => copy(String(data.totalPrice), 'amount')}
              className="text-xs bg-amber-100 hover:bg-amber-200 text-amber-700 px-2 py-0.5 rounded-lg transition-colors">
              {copied === 'amount' ? '✓ Đã copy' : 'Copy'}
            </button>
          </div>
        </div>
        <div className="flex justify-between items-center border-t border-green-100 pt-2.5">
          <span className="text-gray-500">Nội dung CK <span className="text-red-500 font-bold">(bắt buộc)</span></span>
          <div className="flex items-center gap-2">
            <span className="font-extrabold font-mono text-[#3F6B2E]">{data.refCode}</span>
            <button onClick={() => copy(data.refCode, 'ref')}
              className="text-xs bg-green-100 hover:bg-green-200 text-green-700 px-2 py-0.5 rounded-lg transition-colors">
              {copied === 'ref' ? '✓ Đã copy' : 'Copy'}
            </button>
          </div>
        </div>
      </div>
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
        ⚠️ Nhập <strong>đúng nội dung</strong> <code className="bg-amber-100 px-1 rounded">{data.refCode}</code> khi chuyển khoản – hệ thống tự động xác nhận và đơn chuyển sang <strong>Chờ chuyển hàng</strong>.
      </div>
      <div className="text-center text-sm text-gray-400 pt-1">
        <p>Đơn của <strong>{form.name}</strong> · {data.productLabel} × {form.quantity}</p>
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
      <div className="bg-gradient-to-r from-[#3F6B2E] to-[#1E3A0F] rounded-2xl p-4 text-white text-center mb-2">
        <p className="text-green-200 text-xs font-semibold mb-0.5">Sét Nguyên Liệu Xôi Cốm Sen Dừa</p>
        <p className="text-4xl font-extrabold">{fmt(PRICE)}<span className="text-lg font-normal">/sét</span></p>
        <p className="text-green-300 text-xs mt-1">✓ Kèm công thức bí quyết · ✓ Giao toàn quốc · ✓ COD</p>
        <p className="mt-2 bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full inline-block">⚠️ Chưa bao gồm phí vận chuyển</p>
      </div>

      {/* Quantity */}
      <div>
        <label className="font-bold text-gray-700 mb-2 block">Số lượng sét *</label>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => set('quantity', Math.max(1, form.quantity - 1))}
            className="w-10 h-10 rounded-full border-2 border-gray-200 text-xl font-bold hover:border-[#7BA05B] transition-colors flex items-center justify-center">−</button>
          <span className="w-10 text-center font-bold text-xl text-[#3F6B2E]">{form.quantity}</span>
          <button type="button" onClick={() => set('quantity', Math.min(20, form.quantity + 1))}
            className="w-10 h-10 rounded-full border-2 border-gray-200 text-xl font-bold hover:border-[#7BA05B] transition-colors flex items-center justify-center">+</button>
          <span className="ml-2 text-sm text-gray-500">Tổng: <strong className="text-[#C9832E] text-lg">{fmt(total)}</strong></span>
        </div>
      </div>

      <div>
        <label className="font-bold text-gray-700 mb-2 block">Họ và tên *</label>
        <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ví dụ: Nguyễn Thị Lan"
          className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-[#3F6B2E] focus:outline-none transition-colors" />
      </div>
      <div>
        <label className="font-bold text-gray-700 mb-2 block">Số điện thoại *</label>
        <input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="0912 345 678" type="tel"
          className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-[#3F6B2E] focus:outline-none transition-colors" />
      </div>
      {!compact && (
        <div>
          <label className="font-bold text-gray-700 mb-2 block">Email <span className="text-gray-400 font-normal">(không bắt buộc)</span></label>
          <input value={form.email} onChange={e => set('email', e.target.value)} placeholder="email@gmail.com" type="email"
            className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-[#3F6B2E] focus:outline-none transition-colors" />
        </div>
      )}
      <div>
        <label className="font-bold text-gray-700 mb-2 block">Địa chỉ giao hàng *</label>
        <textarea value={form.address} onChange={e => set('address', e.target.value)} rows={3}
          placeholder="Số nhà, ngõ/hẻm, đường, phường/xã, quận/huyện, tỉnh/thành phố"
          className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-[#3F6B2E] focus:outline-none transition-colors resize-none" />
      </div>
      <div>
        <label className="font-bold text-gray-700 mb-2 block">Ghi chú <span className="text-gray-400 font-normal">(không bắt buộc)</span></label>
        <input value={form.note} onChange={e => set('note', e.target.value)} placeholder="Giao giờ nào, yêu cầu đặc biệt..."
          className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-[#3F6B2E] focus:outline-none transition-colors" />
      </div>

      {error && <p className="text-red-500 text-sm bg-red-50 rounded-xl py-2.5 px-4 text-center">{error}</p>}

      <button type="submit" disabled={step === 'loading'}
        className="w-full py-4 rounded-2xl font-extrabold text-white text-xl bg-gradient-to-r from-[#C9832E] to-[#A0601A] hover:from-[#A0601A] hover:to-[#C9832E] transition-all active:scale-95 disabled:opacity-60 shadow-xl shadow-amber-200/60">
        {step === 'loading'
          ? <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>Đang gửi đơn...
            </span>
          : '🛒 ĐẶT HÀNG – NHẬN QR CHUYỂN KHOẢN'}
      </button>
      <p className="text-xs text-gray-400 text-center">🔒 Thông tin bảo mật · Xác nhận qua chuyển khoản · COD toàn quốc</p>
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
    <div className="min-h-screen bg-[#FAF7EE] font-sans">

      {/* ══ STICKY BOTTOM BAR (mobile) ══ */}
      <div className={`fixed bottom-0 left-0 right-0 z-50 md:hidden transition-transform duration-300 ${showStickyBar ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className="bg-white border-t border-gray-200 shadow-2xl px-4 py-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500 truncate">Sét Nguyên Liệu Xôi Cốm Sen Dừa</p>
            <p className="font-extrabold text-[#C9832E] text-lg leading-tight">{fmt(PRICE)}<span className="text-xs font-normal text-gray-400">/sét</span></p>
          </div>
          <button onClick={scrollToOrder}
            className="flex-shrink-0 bg-gradient-to-r from-[#C9832E] to-[#A0601A] text-white font-extrabold px-6 py-3 rounded-xl text-sm active:scale-95 transition-all shadow-lg">
            🛒 ĐẶT NGAY
          </button>
        </div>
      </div>

      {/* ══ HERO ══ */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#1E3A0F] via-[#3F6B2E] to-[#1E3A0F] text-white">
        <div className="absolute inset-0 opacity-5"
          style={{ backgroundImage: 'radial-gradient(circle at 30% 50%, white 1px, transparent 1px)', backgroundSize: '28px 28px' }} />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 pt-10 pb-14">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <div className="bg-white rounded-2xl px-5 py-3 shadow-xl inline-flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/logo-bep-co-ha.png" alt="Bếp Cô Hạ" className="h-12 w-12 object-contain"
                onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
              <div>
                <p className="text-[#3F6B2E] font-extrabold text-xl leading-tight tracking-tight">Bếp Cô Hạ</p>
                <p className="text-gray-400 text-xs">Hacofood.vn</p>
              </div>
            </div>
          </div>

          {/* Badge */}
          <div className="flex justify-center mb-5">
            <span className="bg-red-500 text-white text-sm font-bold px-5 py-1.5 rounded-full animate-bounce shadow">
              🎁 Tặng kèm công thức bí quyết của Cô Hạ
            </span>
          </div>

          {/* Headline */}
          <div className="text-center mb-6 max-w-3xl mx-auto">
            <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight mb-3">
              Sét Nguyên Liệu<br />
              <span className="text-[#B8E08A]">Xôi Cốm Sen Dừa</span>
            </h1>
            <p className="text-xl sm:text-2xl font-semibold text-green-200 mb-4">
              Cô Hạ Chọn Sẵn – Mua Về Làm Là Thành Công
            </p>
            <p className="text-green-100 text-base max-w-xl mx-auto leading-relaxed">
              Toàn bộ nguyên liệu đã chọn lọc, sơ chế sẵn. Kèm công thức bí quyết.<br className="hidden sm:block" />
              Làm theo từng bước là ra ngay đĩa xôi cốm chuẩn vị – đảm bảo thành công.
            </p>
          </div>

          {/* Hero image */}
          <div className="flex justify-center mb-8">
            <div className="relative rounded-2xl overflow-hidden shadow-2xl border-4 border-white/20 w-full max-w-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={HERO_IMG} alt="Sét Nguyên Liệu Xôi Cốm Sen Dừa Bếp Cô Hạ"
                className="w-full h-auto object-contain" />
              <div className="absolute top-3 right-3 bg-[#C9832E] text-white text-xs font-extrabold px-3 py-1.5 rounded-full shadow">
                {fmt(PRICE)}/sét
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="flex flex-wrap justify-center gap-3 mb-8">
            {[
              { icon: '🌿', text: 'Nguyên liệu chọn sẵn đủ bộ' },
              { icon: '📋', text: 'Kèm công thức bí quyết' },
              { icon: '✅', text: 'Làm theo là thành công' },
              { icon: '🚚', text: 'Giao toàn quốc – COD' },
            ].map(s => (
              <div key={s.text} className="flex items-center gap-2 bg-white/10 backdrop-blur rounded-full px-4 py-2 text-sm border border-white/10">
                <span>{s.icon}</span><span className="font-medium">{s.text}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row justify-center gap-3">
            <button onClick={scrollToOrder}
              className="bg-gradient-to-r from-[#C9832E] to-[#A0601A] hover:from-[#A0601A] hover:to-[#C9832E] text-white font-extrabold text-xl px-10 py-4 rounded-2xl shadow-xl transition-all active:scale-95">
              🛒 Đặt Hàng Ngay – {fmt(PRICE)}
            </button>
            <a href="#san-pham"
              className="bg-white/10 border border-white/20 text-white font-bold text-base px-8 py-4 rounded-2xl hover:bg-white/20 transition-colors text-center">
              Xem Sét Nguyên Liệu ↓
            </a>
          </div>
        </div>
      </section>

      {/* ══ TRUST BAR ══ */}
      <section className="bg-[#3F6B2E] py-4 px-4">
        <div className="max-w-4xl mx-auto flex flex-wrap justify-center gap-x-8 gap-y-2">
          {[
            { icon: '⭐', text: 'Hàng trăm đơn thành công' },
            { icon: '📋', text: 'Kèm công thức chi tiết' },
            { icon: '🚚', text: 'COD – trả tiền khi nhận' },
            { icon: '💯', text: 'Không ngon hoàn tiền 100%' },
          ].map(item => (
            <div key={item.text} className="flex items-center gap-2 text-white text-sm font-medium">
              <span>{item.icon}</span><span>{item.text}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ══ PAIN AGITATION ══ */}
      <section className="py-14 px-4 sm:px-6 bg-white">
        <div className="max-w-3xl mx-auto text-center">
          <span className="inline-block border border-red-200 bg-red-50 text-red-600 font-bold text-xs px-4 py-1.5 rounded-full tracking-widest mb-4">
            BẠN CÓ ĐANG GẶP TÌNH HUỐNG NÀY?
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-800 mb-8">
            Muốn Làm Xôi Cốm Ngon<br />
            <span className="text-red-500">Mà Cứ Mãi Không Ra Được?</span>
          </h2>
          <div className="grid sm:grid-cols-2 gap-4 text-left">
            {[
              { icon: '😩', t: 'Không biết mua nguyên liệu ở đâu', d: 'Cốm khô ngon, hạt sen sạch, bột cốt dừa chuẩn – tìm ngoài chợ không dễ, mua online không rõ chất lượng.' },
              { icon: '🤔', t: 'Không biết tỷ lệ pha trộn đúng', d: 'Bao nhiêu cốm, bao nhiêu đậu xanh, bao nhiêu đường? Lúc nhạt lúc ngọt quá – không bao giờ ra đúng vị.' },
              { icon: '🛒', t: 'Mua lẻ từng thứ phức tạp, thừa thiếu', d: 'Đi nhiều chỗ, mua về thừa hạt sen, thiếu lá dứa, hoặc mua nhiều không dùng hết bị hỏng.' },
              { icon: '😓', t: 'Làm hoài vẫn không ra vị chuẩn', d: 'Xôi bị nhão, hạt cốm không dẻo, thiếu hương lá dứa – làm nhiều lần mà vẫn không bằng hàng quán.' },
            ].map(item => (
              <div key={item.t} className="flex gap-4 bg-red-50 rounded-2xl p-5">
                <span className="text-3xl flex-shrink-0 mt-0.5">{item.icon}</span>
                <div>
                  <p className="font-bold text-gray-800 mb-1">{item.t}</p>
                  <p className="text-gray-500 text-sm leading-relaxed">{item.d}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-8 text-gray-600 text-base max-w-xl mx-auto">
            Không phải lỗi của bạn. Xôi cốm ngon cần đúng nguyên liệu, đúng tỷ lệ, đúng kỹ thuật.
            <strong className="text-[#3F6B2E]"> Và Cô Hạ đã giải quyết hết cho bạn rồi.</strong>
          </p>
        </div>
      </section>

      {/* ══ GALLERY SẢN PHẨM ══ */}
      <section id="san-pham" className="py-14 px-4 sm:px-6 bg-[#FAF7EE]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-8">
            <span className="inline-block border border-[#B8E08A] bg-[#F0FBE8] text-[#3F6B2E] font-bold text-xs px-5 py-1.5 rounded-full tracking-widest mb-3">SẢN PHẨM</span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-800">
              Sét Nguyên Liệu Xôi Cốm Sen Dừa<br />
              <span className="text-[#C9832E]">Đầy Đủ – Chọn Lọc – Giao Tận Tay</span>
            </h2>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-2 sm:mb-3 h-52 sm:h-72">
            {SAN_PHAM.slice(0, 3).map(item => (
              <div key={item.label} className="relative rounded-xl sm:rounded-2xl overflow-hidden group shadow-md h-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.src} alt={item.label} className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <p className="absolute bottom-2 left-2 text-white text-xs sm:text-sm font-semibold drop-shadow leading-tight">{item.label}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3 h-44 sm:h-56">
            {SAN_PHAM.slice(3, 6).map(item => (
              <div key={item.label} className="relative rounded-xl sm:rounded-2xl overflow-hidden group shadow-sm h-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.src} alt={item.label} className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <p className="absolute bottom-2 left-2 text-white text-xs font-semibold drop-shadow leading-tight">{item.label}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 text-center">
            <button onClick={scrollToOrder} className="bg-gradient-to-r from-[#C9832E] to-[#A0601A] text-white font-bold px-8 py-3.5 rounded-2xl shadow-md hover:shadow-lg transition-all active:scale-95">
              Tôi Muốn Đặt Ngay →
            </button>
          </div>
        </div>
      </section>

      {/* ══ VIDEO XEM THỰC TẾ ══ */}
      <section className="py-14 px-4 sm:px-6 bg-white">
        <div className="max-w-3xl mx-auto text-center">
          <span className="inline-block border border-[#B8E08A] bg-[#F0FBE8] text-[#3F6B2E] font-bold text-xs px-4 py-1.5 rounded-full tracking-widest mb-3">XEM THỰC TẾ</span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-800 mb-2">
            Cô Hạ Hướng Dẫn Trực Tiếp<br />
            <span className="text-[#C9832E]">Xem Ngay – Làm Là Biết</span>
          </h2>
          <p className="text-gray-500 text-sm mb-8">Video thực tế từ Bếp Cô Hạ – thấy nguyên liệu, thấy thành phẩm, thấy luôn cách làm</p>
          <div className="flex justify-center">
            <div className="relative rounded-3xl overflow-hidden shadow-2xl border-4 border-[#3F6B2E]/20 w-full max-w-xs" style={{ aspectRatio: '9/16' }}>
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
          <div className="mt-8">
            <button onClick={scrollToOrder} className="bg-gradient-to-r from-[#C9832E] to-[#A0601A] text-white font-bold px-8 py-3.5 rounded-2xl shadow-md hover:shadow-lg transition-all active:scale-95">
              Đặt Sét Nguyên Liệu Ngay →
            </button>
          </div>
        </div>
      </section>

      {/* ══ CÔ HẠ – NGƯỜI ĐỨNG SAU SẾT ══ */}
      <section className="py-14 px-4 sm:px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div className="relative flex justify-center">
              <div className="relative rounded-3xl overflow-hidden shadow-2xl max-w-xs w-full" style={{ aspectRatio: '3/4' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={COHA_IMG} alt="Cô Hạ – Bếp Cô Hạ" className="w-full h-full object-cover object-top" />
              </div>
              <div className="absolute -top-3 -right-3 bg-[#C9832E] text-white font-extrabold text-sm px-4 py-2 rounded-full shadow-lg rotate-6">
                Kèm công thức<br />bí quyết
              </div>
            </div>
            <div>
              <span className="inline-block border border-[#B8E08A] bg-[#F0FBE8] text-[#3F6B2E] font-bold text-xs px-4 py-1.5 rounded-full tracking-widest mb-4">NGƯỜI ĐỨC SAU SẾT</span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-800 mb-4">
                Gặp Cô Hạ –<br />
                <span className="text-[#C9832E]">Người Chọn Từng Nguyên Liệu</span><br />
                Và Truyền Công Thức Bí Quyết Cho Bạn.
              </h2>
              <p className="text-gray-600 leading-relaxed mb-6">
                Sau nhiều năm nấu nướng và hàng chục video viral về xôi cốm, Cô Hạ đã tỉ mỉ chọn đúng từng loại nguyên liệu – cốm khô, hạt sen, đậu xanh, bột cốt dừa, lá dứa...
                Tất cả được đóng sẵn thành một sét, kèm theo công thức chi tiết từng bước.
                <strong className="text-gray-800"> Bạn chỉ cần mở ra và làm theo – là thành công ngay lần đầu.</strong>
              </p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: '🌿', t: 'Nguyên liệu đủ bộ, đúng loại' },
                  { icon: '📋', t: 'Công thức từng bước rõ ràng' },
                  { icon: '✅', t: 'Hàng trăm người đã thành công' },
                  { icon: '💯', t: 'Đảm bảo – không ngon hoàn tiền' },
                ].map(item => (
                  <div key={item.t} className="flex items-center gap-2 bg-[#F0FBE8] rounded-xl p-3">
                    <span className="text-xl">{item.icon}</span>
                    <span className="text-sm font-semibold text-gray-700">{item.t}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ THÀNH PHẨM CỦA HỌC VIÊN ══ */}
      <section className="py-14 px-4 sm:px-6 bg-[#FAF7EE]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-8">
            <span className="inline-block border border-[#B8E08A] bg-[#F0FBE8] text-[#3F6B2E] font-bold text-xs px-5 py-1.5 rounded-full tracking-widest mb-3">THÀNH PHẨM HỌC VIÊN</span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-800">
              Họ Đã Làm Thành Công<br />
              <span className="text-[#C9832E]">Đây Là Thành Phẩm Thật Của Khách Hàng</span>
            </h2>
            <p className="text-gray-500 mt-2">Tất cả đều làm theo đúng công thức trong sét nguyên liệu của Cô Hạ</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {THANH_PHAM.map((src, i) => (
              <div key={i} className="rounded-2xl overflow-hidden shadow-md group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`Thành phẩm học viên ${i + 1}`}
                  className="w-full h-44 object-cover object-center group-hover:scale-105 transition-transform duration-500" loading="lazy" />
              </div>
            ))}
          </div>
          <div className="mt-6 text-center">
            <button onClick={scrollToOrder} className="bg-gradient-to-r from-[#C9832E] to-[#A0601A] text-white font-bold px-8 py-3.5 rounded-2xl shadow-md hover:shadow-lg transition-all active:scale-95">
              Tôi Cũng Muốn Thử Ngay →
            </button>
          </div>
        </div>
      </section>

      {/* ══ USE CASES ══ */}
      <section className="py-12 px-4 sm:px-6 bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-800 mb-2">Phù Hợp Với Mọi Dịp</h2>
          <p className="text-gray-500 mb-8">Một sét nguyên liệu – vô vàn lý do để làm</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { icon: '🌅', name: 'Bữa sáng gia đình', sub: 'Ngon, bổ dưỡng, đơn giản' },
              { icon: '🙏', name: 'Cỗ chay, mâm cúng', sub: 'Truyền thống, trang nghiêm' },
              { icon: '🎁', name: 'Quà quê tặng người thân', sub: 'Đặc sản Hà Nội địa phương' },
              { icon: '🎊', name: 'Tết, lễ, giỗ chạp', sub: 'Ý nghĩa, thơm thảo' },
              { icon: '💒', name: 'Cưới hỏi, sinh nhật', sub: 'Khác biệt, đáng nhớ' },
              { icon: '🏠', name: 'Tân gia, họp mặt', sub: 'Ấm cúng, sum vầy' },
            ].map(item => (
              <div key={item.name} className="bg-[#FAF7EE] rounded-2xl p-5 shadow-sm text-center">
                <span className="text-4xl">{item.icon}</span>
                <p className="font-bold text-gray-800 mt-2">{item.name}</p>
                <p className="text-sm text-[#3F6B2E]">{item.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ THÀNH PHẦN SÉT ══ */}
      <section className="py-14 px-4 sm:px-6 bg-[#FAF7EE]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <span className="inline-block border border-[#B8E08A] bg-[#F0FBE8] text-[#3F6B2E] font-bold text-xs px-4 py-1.5 rounded-full tracking-widest mb-3">THÀNH PHẦN SÉT</span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-800">
              Cô Hạ Chọn Sẵn 8 Nguyên Liệu<br />
              <span className="text-[#C9832E]">Bạn Chỉ Cần Nhận & Làm Theo</span>
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white rounded-3xl p-6 border border-amber-100 shadow-sm">
              <h3 className="font-extrabold text-xl text-[#3F6B2E] mb-5">🌿 Nguyên Liệu Trong Sét</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: '🌾', name: 'Cốm khô' },
                  { icon: '🫛', name: 'Đậu xanh đã cà vỏ' },
                  { icon: '🪷', name: 'Hạt sen khô' },
                  { icon: '🥥', name: 'Bột cốt dừa' },
                  { icon: '🍬', name: 'Đường kính trắng' },
                  { icon: '🧂', name: 'Muối tinh' },
                  { icon: '🌿', name: 'Bột nghệ' },
                  { icon: '🍃', name: 'Lá dứa' },
                ].map(item => (
                  <div key={item.name} className="flex items-center gap-2 bg-[#FAF7EE] rounded-xl px-3 py-2.5">
                    <span className="text-xl">{item.icon}</span>
                    <span className="text-gray-700 font-medium text-sm">{item.name}</span>
                  </div>
                ))}
              </div>
              <div className="bg-green-100 rounded-xl px-4 py-3 mt-4">
                <p className="text-[#3F6B2E] font-bold text-sm">+ Công thức bí quyết của Bếp Cô Hạ tặng kèm</p>
                <p className="text-green-800 text-xs mt-0.5">Tỷ lệ & kỹ thuật chi tiết – ghi rõ từng bước</p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="bg-[#F0FBE8] rounded-3xl p-6 border border-green-100">
                <h3 className="font-extrabold text-xl text-[#3F6B2E] mb-4">🍚 Thành Phẩm Bạn Sẽ Có</h3>
                <ul className="space-y-2.5 text-gray-600 text-sm">
                  <li className="flex gap-2.5"><span className="text-green-500 font-bold flex-shrink-0">✓</span><span>Xôi tơi, hạt cốm <strong>dẻo mềm</strong>, không dính nhão</span></li>
                  <li className="flex gap-2.5"><span className="text-green-500 font-bold flex-shrink-0">✓</span><span>Hạt sen <strong>bùi</strong>, đậu xanh vàng tươi đẹp mắt</span></li>
                  <li className="flex gap-2.5"><span className="text-green-500 font-bold flex-shrink-0">✓</span><span>Hương <strong>lá dứa và cốt dừa</strong> quyện nhẹ, thơm tự nhiên</span></li>
                  <li className="flex gap-2.5"><span className="text-green-500 font-bold flex-shrink-0">✓</span><span>Ăn nóng hoặc nguội đều ngon – phù hợp bữa sáng, cỗ chay, quà quê</span></li>
                </ul>
              </div>
              <div className="bg-amber-50 rounded-3xl p-6 border border-amber-100">
                <h3 className="font-extrabold text-lg text-amber-700 mb-3">💡 Lưu Ý</h3>
                <ul className="space-y-2 text-gray-600 text-sm">
                  <li className="flex gap-2">📦 <span>Đây là <strong>sét nguyên liệu</strong> – bạn tự làm tại nhà theo công thức tặng kèm</span></li>
                  <li className="flex gap-2">⏱️ <span>Thời gian làm: khoảng <strong>1–1,5 tiếng</strong> (ngâm + hấp)</span></li>
                  <li className="flex gap-2">🔥 <span>Cần có <strong>xửng hấp</strong> hoặc nồi cơm điện chế độ hấp</span></li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ UY TÍN ══ */}
      <section className="py-14 px-4 sm:px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-8">
            <span className="inline-block border border-amber-300 bg-amber-50 text-amber-700 font-bold text-xs px-4 py-1.5 rounded-full tracking-widest mb-3">THƯƠNG HIỆU UY TÍN</span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-800">
              Bếp Cô Hạ – Triệu Người Tin Tưởng<br />
              <span className="text-[#C9832E]">Trên Khắp Các Nền Tảng</span>
            </h2>
          </div>
          <div className="grid grid-cols-3 gap-5 mb-8 max-w-3xl mx-auto">
            {UY_TIN.map(img => (
              <div key={img.label} className="rounded-2xl overflow-hidden shadow-md bg-white border border-gray-100 flex flex-col">
                <div className="h-52 sm:h-64 flex items-center justify-center bg-gray-50 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.src} alt={img.label} className="w-full h-full object-contain" />
                </div>
                <p className="text-center text-xs font-semibold text-gray-600 py-2.5 px-2 leading-tight">{img.label}</p>
              </div>
            ))}
          </div>
          <div className="bg-[#F0FBE8] rounded-3xl p-6 text-center max-w-2xl mx-auto border border-green-100">
            <p className="text-[#3F6B2E] font-bold text-lg mb-2">&quot;Cô Hạ làm từ tâm – công thức chia sẻ thật sự, nguyên liệu chọn thật sự, kết quả thật sự.&quot;</p>
            <p className="text-green-700 text-sm italic">– Bếp Cô Hạ, Hacofood.vn</p>
          </div>
        </div>
      </section>

      {/* ══ FEEDBACK KHÁCH HÀNG ══ */}
      <section className="py-14 px-4 sm:px-6 bg-[#FAF7EE]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-8">
            <span className="inline-block border border-green-200 bg-[#F0FBE8] text-[#3F6B2E] font-bold text-xs px-4 py-1.5 rounded-full tracking-widest mb-3">KHÁCH ĐÃ NÓI GÌ</span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-800">
              Hàng Trăm Khách Hài Lòng<br />
              <span className="text-[#C9832E]">Đặt Lại Nhiều Lần, Giới Thiệu Người Thân</span>
            </h2>
          </div>
          <div className="columns-2 sm:columns-3 gap-3 space-y-3">
            {FEEDBACKS.map((src, i) => (
              <div key={i} className="break-inside-avoid rounded-2xl overflow-hidden shadow-sm border border-gray-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`Phản hồi khách hàng ${i + 1}`} className="w-full h-auto object-cover" loading="lazy" />
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <button onClick={scrollToOrder} className="bg-gradient-to-r from-[#C9832E] to-[#A0601A] text-white font-bold px-8 py-3.5 rounded-2xl shadow-md hover:shadow-lg transition-all active:scale-95">
              Tôi Muốn Đặt Ngay →
            </button>
          </div>
        </div>
      </section>

      {/* ══ PRICING + ORDER FORM ══ */}
      <section ref={orderRef} id="dat-hang" className="py-16 px-4 sm:px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <span className="inline-block border border-[#B8E08A] bg-[#F0FBE8] text-[#3F6B2E] font-bold text-xs px-5 py-1.5 rounded-full tracking-widest mb-3">ĐẶT HÀNG</span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-800 mb-2">
              Nhận Sét Nguyên Liệu Về Nhà<br />
              <span className="text-[#C9832E]">Làm Ngay – Thành Công Ngay Lần Đầu</span>
            </h2>
            <p className="text-gray-500 max-w-md mx-auto">Giao tận nhà toàn quốc · COD trả khi nhận · Kèm công thức bí quyết</p>
          </div>

          <div className="grid md:grid-cols-2 gap-10 items-start">
            {/* Left: Value stack */}
            <div>
              <div className="bg-gradient-to-br from-[#1E3A0F] to-[#3F6B2E] rounded-3xl p-6 text-white mb-6">
                <p className="text-green-300 text-sm font-semibold mb-1">Bạn nhận được:</p>
                <ul className="space-y-2 mb-5">
                  {[
                    '8 nguyên liệu chọn sẵn, đủ bộ, đúng loại',
                    'Công thức bí quyết của Cô Hạ tặng kèm',
                    'Hướng dẫn từng bước – làm là thành công',
                    'Đóng gói cẩn thận, giao toàn quốc',
                    'Bảo hành: không ngon hoàn tiền 100%',
                  ].map(item => (
                    <li key={item} className="flex items-start gap-2 text-sm">
                      <span className="text-[#B8E08A] font-bold mt-0.5 flex-shrink-0">✓</span>
                      <span className="text-green-100">{item}</span>
                    </li>
                  ))}
                </ul>
                <div className="border-t border-white/20 pt-4 flex items-end justify-between">
                  <div>
                    <p className="text-green-300 text-sm">Giá chỉ</p>
                    <p className="text-4xl font-extrabold">{fmt(PRICE)}</p>
                    <p className="text-green-300 text-xs">/sét nguyên liệu</p>
                    <p className="mt-2 bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full inline-block">⚠️ Chưa bao gồm phí ship</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-green-300">COD – trả khi nhận</p>
                    <p className="text-xs text-green-300 mt-0.5">Miễn phí đổi trả</p>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                {[
                  { icon: '🚚', t: 'Giao hàng toàn quốc', d: 'Ship tận nhà, đóng gói cẩn thận' },
                  { icon: '💳', t: 'COD – Thanh toán khi nhận', d: 'Nhận hàng, kiểm tra ổn mới trả tiền' },
                  { icon: '📋', t: 'Kèm công thức bí quyết', d: 'Tỷ lệ & kỹ thuật chi tiết, làm là thành công' },
                  { icon: '💯', t: 'Không ngon – hoàn tiền 100%', d: 'Cam kết chất lượng tuyệt đối' },
                ].map(item => (
                  <div key={item.t} className="flex gap-3 items-start">
                    <span className="text-xl flex-shrink-0">{item.icon}</span>
                    <div>
                      <p className="font-bold text-gray-800 text-sm">{item.t}</p>
                      <p className="text-gray-500 text-xs">{item.d}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* Right: Form */}
            <div className="bg-[#FAF7EE] rounded-3xl p-6 sm:p-8 border border-green-100 shadow-lg">
              <h3 className="font-extrabold text-xl text-[#3F6B2E] mb-5 text-center">Điền Thông Tin Đặt Hàng</h3>
              <OrderForm />
            </div>
          </div>
        </div>
      </section>

      {/* ══ P.S. / URGENCY ══ */}
      <section className="py-10 px-4 sm:px-6 bg-gradient-to-r from-[#1E3A0F] to-[#3F6B2E] text-white text-center">
        <div className="max-w-2xl mx-auto">
          <p className="text-green-200 text-sm font-semibold mb-2">P.S.</p>
          <p className="text-lg leading-relaxed">
            Cốm ngon nhất chỉ có <strong>vài tháng trong năm</strong>. Khi Cô Hạ còn hàng – đặt ngay.
            Nhận sét về, làm theo công thức, rồi chia sẻ thành phẩm cho Cô Hạ xem nhé!
          </p>
          <button onClick={scrollToOrder}
            className="mt-6 bg-[#C9832E] hover:bg-[#A0601A] text-white font-extrabold px-10 py-4 rounded-2xl transition-colors active:scale-95 text-xl shadow-lg">
            🛒 Đặt Hàng Ngay – {fmt(PRICE)}
          </button>
        </div>
      </section>

      {/* ══ FOOTER ══ */}
      <footer className="bg-gray-900 text-gray-400 py-10 px-4 sm:px-6 text-center text-sm pb-20 md:pb-10">
        <div className="max-w-3xl mx-auto space-y-3">
          <div className="flex justify-center">
            <div className="bg-white rounded-xl px-4 py-2 inline-flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/logo-bep-co-ha.png" alt="Bếp Cô Hạ" className="h-9 w-9 object-contain"
                onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
              <div className="text-left">
                <p className="text-[#3F6B2E] font-extrabold text-base leading-tight">Bếp Cô Hạ</p>
                <p className="text-gray-400 text-xs">Hacofood.vn</p>
              </div>
            </div>
          </div>
          <p>Sét Nguyên Liệu Xôi Cốm Sen Dừa – Kèm công thức bí quyết độc quyền của Bếp Cô Hạ</p>
          <p>Zalo: <strong className="text-gray-300">0965 240 587</strong> · Facebook/TikTok: <strong className="text-gray-300">Cô Hạ dạy nấu ăn</strong></p>
          <p className="text-gray-500 text-xs">Địa chỉ: Bếp Cô Hạ, Số 20 phố Cầu Am, Phường Hà Đông, TP Hà Nội</p>
          <p className="text-gray-600 text-xs">© 2025 Hacofood.vn · Bếp Cô Hạ. All rights reserved.</p>
        </div>
      </footer>

    </div>
  )
}
