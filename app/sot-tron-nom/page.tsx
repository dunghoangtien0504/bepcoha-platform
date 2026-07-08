'use client'

import { useState, useRef, useEffect } from 'react'

// ─── Image paths ──────────────────────────────────────────────────────────────
const TP = '/images/sot-tron-nom/thanh-pham/'
const SP = '/images/sot-tron-nom/san-pham/'

const THANH_PHAM = [
  { src: TP + '671299716_1589635609552718_738029760491872038_n.jpg',  label: 'Nộm tai heo giòn sần sật' },
  { src: TP + '671637717_1589635616219384_4262068307483531995_n.jpg',  label: 'Gỏi sứa trộn đậm vị' },
  { src: TP + '671942824_1589635642886048_1414265597271821342_n.jpg',  label: 'Gỏi bò thập cẩm' },
  { src: TP + '700499489_1617972563385689_2850552707033278554_n.jpg',  label: 'Nộm đu đủ cà rốt' },
  { src: TP + '709226382_1629084295607849_3557552685294265308_n.jpg',  label: 'Gỏi thập cẩm tươi ngon' },
  { src: TP + '709821489_1629084328941179_3825976979159012711_n.jpg',  label: 'Nộm rau củ đầy màu sắc' },
  { src: TP + '710125751_1632698565246422_3160895450575285956_n.jpg',  label: 'Gỏi gà xé phay' },
  { src: TP + '710404276_1632696998579912_4738224190452480535_n.jpg',  label: 'Gỏi bò lá lốt' },
  { src: TP + '714931363_1632696995246579_5643613255198374783_n.jpg',  label: 'Nộm vạn năng mâm cỗ' },
]

const SAN_PHAM = [
  { src: SP + '76fcdf41-07da-4dbb-be19-f307061e418c.png',  label: 'Sốt Trộn Nộm Bếp Cô Hạ' },
  { src: SP + '341915de-b59c-4791-b5ed-abb0c84ce760.png', label: 'Sốt cô đặc bám chắc nguyên liệu' },
]

// Ảnh hero poster (dùng riêng trong hero section)
const HERO_IMG = SP + '710331986_1632696845246594_3341255585345294524_n.jpg'

const PRICES = { '500g': 65000, '1kg': 105000 }

function fmt(n: number) { return n.toLocaleString('vi-VN') + 'đ' }

// ─── Order Form ───────────────────────────────────────────────────────────────
interface FormState {
  name: string; phone: string; email: string; address: string
  product: '500g' | '1kg'; quantity: number; note: string
}

interface PaymentData {
  refCode: string
  totalPrice: number
  productLabel: string
  qr: { bankAccount: string; bankCode: string; accountName: string; amount: number; content: string; qrUrl: string }
}

function Countdown({ seconds }: { seconds: number }) {
  const [left, setLeft] = useState(seconds)
  useEffect(() => {
    if (left <= 0) return
    const t = setTimeout(() => setLeft(l => l - 1), 1000)
    return () => clearTimeout(t)
  }, [left])
  const m = Math.floor(left / 60).toString().padStart(2, '0')
  const s = (left % 60).toString().padStart(2, '0')
  return <span className={left < 120 ? 'text-red-500 font-bold' : 'font-bold text-[#006400]'}>{m}:{s}</span>
}

function PaymentStep({ data, form }: { data: PaymentData; form: FormState }) {
  const [copied, setCopied] = useState<'ref' | 'amount' | null>(null)
  function copy(text: string, type: 'ref' | 'amount') {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(type)
      setTimeout(() => setCopied(null), 2000)
    })
  }
  return (
    <div className="space-y-5">
      <div className="text-center">
        <p className="text-[#006400] font-extrabold text-lg mb-0.5">Bước 2: Chuyển khoản để xác nhận đơn</p>
        <p className="text-gray-500 text-sm">Quét QR hoặc chuyển khoản thủ công trong <Countdown seconds={30 * 60} /></p>
      </div>

      {/* QR code */}
      <div className="flex justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={data.qr.qrUrl} alt="QR chuyển khoản"
          className="w-52 h-52 rounded-2xl border-4 border-[#006400] shadow-lg object-contain bg-white" />
      </div>

      {/* Bank info */}
      <div className="bg-[#f0fff4] border border-green-200 rounded-2xl p-4 space-y-2.5 text-sm">
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
            <span className="font-extrabold text-[#D97706] text-base">{fmt(data.totalPrice)}</span>
            <button onClick={() => copy(String(data.totalPrice), 'amount')}
              className="text-xs bg-amber-100 hover:bg-amber-200 text-amber-700 px-2 py-0.5 rounded-lg transition-colors">
              {copied === 'amount' ? '✓ Đã copy' : 'Copy'}
            </button>
          </div>
        </div>
        <div className="flex justify-between items-center border-t border-green-100 pt-2.5">
          <span className="text-gray-500">Nội dung CK <span className="text-red-500 font-bold">(bắt buộc)</span></span>
          <div className="flex items-center gap-2">
            <span className="font-extrabold font-mono text-[#006400]">{data.refCode}</span>
            <button onClick={() => copy(data.refCode, 'ref')}
              className="text-xs bg-green-100 hover:bg-green-200 text-green-700 px-2 py-0.5 rounded-lg transition-colors">
              {copied === 'ref' ? '✓ Đã copy' : 'Copy'}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
        ⚠️ Nhập <strong>đúng nội dung</strong> <code className="bg-amber-100 px-1 rounded">{data.refCode}</code> khi chuyển khoản — hệ thống tự động xác nhận và đơn hàng chuyển ngay sang trạng thái <strong>Chờ chuyển hàng</strong>.
      </div>

      <div className="text-center text-sm text-gray-400 pt-1">
        <p>Đơn của <strong>{form.name}</strong> · {data.productLabel} × {form.quantity}</p>
        <p className="mt-1">Sau khi chuyển khoản, đơn được xử lý tự động — không cần chờ xác nhận.</p>
      </div>
    </div>
  )
}

function OrderForm() {
  const [form, setForm] = useState<FormState>({
    name: '', phone: '', email: '', address: '',
    product: '500g', quantity: 1, note: '',
  })
  const [step, setStep] = useState<'idle' | 'loading' | 'payment' | 'error'>('idle')
  const [error, setError] = useState('')
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null)

  const total = PRICES[form.product] * form.quantity

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm(f => ({ ...f, [k]: v }))
    setError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.phone.trim() || !form.address.trim()) {
      setError('Vui lòng điền đủ: Họ tên, Số điện thoại, Địa chỉ')
      return
    }
    setStep('loading')
    try {
      const res = await fetch('/api/sot-tron-nom-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Lỗi')
      setPaymentData(data)
      setStep('payment')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Có lỗi xảy ra')
      setStep('error')
    }
  }

  if (step === 'payment' && paymentData) {
    return <PaymentStep data={paymentData} form={form} />
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Product Selection */}
      <div>
        <p className="font-bold text-gray-700 mb-2">Chọn loại sản phẩm *</p>
        <div className="grid grid-cols-2 gap-3">
          {(['500g', '1kg'] as const).map(p => (
            <button type="button" key={p}
              onClick={() => set('product', p)}
              className={`border-2 rounded-xl p-4 text-center transition-all ${
                form.product === p
                  ? 'border-[#006400] bg-[#f0fff4]'
                  : 'border-gray-200 hover:border-amber-300'
              }`}>
              <p className="font-extrabold text-lg text-[#006400]">{p}</p>
              <p className="text-[#D97706] font-bold text-base">{fmt(PRICES[p])}</p>
              {p === '1kg' && (
                <p className="text-xs text-green-600 font-semibold mt-0.5">Tiết kiệm hơn 12%</p>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Quantity */}
      <div>
        <label className="font-bold text-gray-700 mb-2 block">Số lượng *</label>
        <div className="flex items-center gap-3">
          <button type="button"
            onClick={() => set('quantity', Math.max(1, form.quantity - 1))}
            className="w-10 h-10 rounded-full border-2 border-gray-200 text-xl font-bold hover:border-amber-400 transition-colors flex items-center justify-center">
            −
          </button>
          <span className="w-10 text-center font-bold text-xl text-[#006400]">{form.quantity}</span>
          <button type="button"
            onClick={() => set('quantity', Math.min(20, form.quantity + 1))}
            className="w-10 h-10 rounded-full border-2 border-gray-200 text-xl font-bold hover:border-amber-400 transition-colors flex items-center justify-center">
            +
          </button>
          <span className="ml-2 text-sm text-gray-500">Tổng: <strong className="text-[#D97706] text-base">{fmt(total)}</strong></span>
        </div>
      </div>

      {/* Personal Info */}
      <div>
        <label className="font-bold text-gray-700 mb-2 block">Họ và tên *</label>
        <input value={form.name} onChange={e => set('name', e.target.value)}
          placeholder="Ví dụ: Nguyễn Thị Lan"
          className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-[#006400] focus:outline-none transition-colors" />
      </div>
      <div>
        <label className="font-bold text-gray-700 mb-2 block">Số điện thoại *</label>
        <input value={form.phone} onChange={e => set('phone', e.target.value)}
          placeholder="0912 345 678" type="tel"
          className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-[#006400] focus:outline-none transition-colors" />
      </div>
      <div>
        <label className="font-bold text-gray-700 mb-2 block">Email <span className="text-gray-400 font-normal">(không bắt buộc)</span></label>
        <input value={form.email} onChange={e => set('email', e.target.value)}
          placeholder="email@gmail.com" type="email"
          className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-[#006400] focus:outline-none transition-colors" />
      </div>
      <div>
        <label className="font-bold text-gray-700 mb-2 block">Địa chỉ giao hàng chi tiết *</label>
        <textarea value={form.address} onChange={e => set('address', e.target.value)}
          placeholder="Số nhà, ngõ/hẻm, đường, phường/xã, quận/huyện, tỉnh/thành phố"
          rows={3}
          className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-[#006400] focus:outline-none transition-colors resize-none" />
      </div>
      <div>
        <label className="font-bold text-gray-700 mb-2 block">Ghi chú <span className="text-gray-400 font-normal">(không bắt buộc)</span></label>
        <input value={form.note} onChange={e => set('note', e.target.value)}
          placeholder="Giao giờ nào, yêu cầu đặc biệt..."
          className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-[#006400] focus:outline-none transition-colors" />
      </div>

      {error && (
        <p className="text-red-500 text-sm bg-red-50 rounded-xl py-2.5 px-4 text-center">{error}</p>
      )}

      <button type="submit" disabled={step === 'loading'}
        className="w-full py-4 rounded-2xl font-extrabold text-white text-lg bg-gradient-to-r from-[#D97706] to-[#B45309] hover:from-[#B45309] hover:to-[#D97706] transition-all active:scale-95 disabled:opacity-60 shadow-lg shadow-amber-200">
        {step === 'loading'
          ? <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>Đang gửi đơn...
            </span>
          : '🛒 ĐẶT HÀNG NGAY – NHẬN QR CHUYỂN KHOẢN'}
      </button>
      <p className="text-xs text-gray-400 text-center">🔒 Thông tin bảo mật tuyệt đối · Xác nhận đơn qua chuyển khoản</p>
    </form>
  )
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function SotTronNom() {
  const orderRef = useRef<HTMLDivElement>(null)
  const scrollToOrder = () => orderRef.current?.scrollIntoView({ behavior: 'smooth' })

  return (
    <div className="min-h-screen bg-[#F4FAF6] font-sans">

      {/* ══ HERO ══ */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#003200] via-[#006400] to-[#003200] text-white">
        <div className="absolute inset-0 opacity-5"
          style={{ backgroundImage: 'radial-gradient(circle at 30% 50%, white 1px, transparent 1px)', backgroundSize: '28px 28px' }} />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 pt-10 pb-14">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <div className="bg-white rounded-2xl px-5 py-3 shadow-xl inline-flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/logo-bep-co-ha.png" alt="Bếp Cô Hạ"
                className="h-12 w-12 object-contain"
                onError={e => { (e.currentTarget as HTMLImageElement).style.display='none' }} />
              <div>
                <p className="text-[#006400] font-extrabold text-xl leading-tight tracking-tight">Bếp Cô Hạ</p>
                <p className="text-gray-400 text-xs">Hacofood.vn</p>
              </div>
            </div>
          </div>

          {/* Viral badge */}
          <div className="flex justify-center mb-5">
            <span className="bg-red-500 text-white text-sm font-bold px-5 py-1.5 rounded-full animate-bounce shadow">
              🔥 Video viral – Triệu lượt xem
            </span>
          </div>

          {/* Headline */}
          <div className="text-center mb-6 max-w-3xl mx-auto">
            <p className="text-green-300 font-semibold text-base mb-2 italic">
              "Có cái món nộm mà làm không giòn thì làm được gì cho đời." – Mẹ em nói đấy.
            </p>
            <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight">
              Trộn Nộm 5 Phút,<br />
              <span className="text-[#90EE90]">Giòn Sần Sật, Đậm Vị Đúng Chuẩn</span>
            </h1>
            <p className="mt-4 text-green-100 text-lg max-w-2xl mx-auto leading-relaxed">
              Sốt Trộn Nộm Bếp Cô Hạ — đã nấu cô đặc, cân bằng vị sẵn.<br className="hidden sm:block" />
              Không cần đau đầu tra công thức. Không lo mặn nhạt không đều.
            </p>
          </div>

          {/* Product hero image */}
          <div className="flex justify-center mb-8">
            <div className="relative rounded-2xl overflow-hidden shadow-2xl border-4 border-white/20 w-full max-w-sm sm:max-w-md">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={HERO_IMG} alt="Sốt Trộn Nộm Bếp Cô Hạ"
                className="w-full h-auto object-contain" />
            </div>
          </div>

          {/* Stats */}
          <div className="flex flex-wrap justify-center gap-3 mb-8">
            {[
              { icon: '🎬', text: 'Video triệu lượt xem' },
              { icon: '🏆', text: 'Công thức độc quyền' },
              { icon: '🌿', text: 'Nguyên liệu tự nhiên' },
              { icon: '⚡', text: 'Trộn 5 phút là xong' },
            ].map(s => (
              <div key={s.text} className="flex items-center gap-2 bg-white/10 backdrop-blur rounded-full px-4 py-2 text-sm border border-white/10">
                <span>{s.icon}</span><span className="font-medium">{s.text}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row justify-center gap-3">
            <button onClick={scrollToOrder}
              className="bg-gradient-to-r from-[#D97706] to-[#B45309] hover:from-[#B45309] hover:to-[#D97706] text-white font-extrabold text-lg px-10 py-4 rounded-2xl shadow-lg transition-all active:scale-95">
              Đặt Hàng Ngay →
            </button>
            <a href="#thanh-pham"
              className="bg-white/10 border border-white/20 text-white font-bold text-base px-8 py-4 rounded-2xl hover:bg-white/20 transition-colors text-center">
              Xem Thành Phẩm
            </a>
          </div>
        </div>
      </section>

      {/* ══ UY TÍN ══ */}
      <section className="py-14 px-4 sm:px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-8">
            <span className="inline-block border border-amber-300 bg-amber-50 text-amber-700 font-bold text-xs px-4 py-1.5 rounded-full tracking-widest mb-3">THƯƠNG HIỆU UY TÍN</span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-800">
              Bếp Cô Hạ — Triệu Lượt Xem<br />
              <span className="text-amber-600">Trên TikTok, YouTube, Facebook</span>
            </h2>
            <p className="text-gray-500 mt-2 text-sm max-w-lg mx-auto">Không phải thương hiệu mới — Cô Hạ đã chia sẻ hàng trăm video nấu ăn được triệu người theo dõi</p>
          </div>
          <div className="grid grid-cols-3 gap-5 mb-8 max-w-3xl mx-auto">
            {[
              { src: '/images/set-xoi-com/uy-tin/z7730296537408_96f9db97736016c93f9a740985d04d41.jpg', label: 'Cộng đồng Hacofood' },
              { src: '/images/set-xoi-com/uy-tin/z7730296545695_e2cd4f391ad3a8ae76f1e8d8d6651042.jpg', label: 'TikTok & YouTube viral' },
              { src: '/images/set-xoi-com/uy-tin/z7730387539278_d0ddcc6f279597ec3196aeae9a0af2ec.jpg', label: 'Hàng triệu lượt xem' },
            ].map(img => (
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
            <p className="text-[#3F6B2E] font-bold text-lg mb-2">&ldquo;Cô Hạ làm từ tâm – công thức chia sẻ thật sự, nguyên liệu chọn thật sự, kết quả thật sự.&rdquo;</p>
            <p className="text-green-700 text-sm italic">– Bếp Cô Hạ, Hacofood.vn</p>
          </div>
        </div>
      </section>

      {/* ══ PAIN AGITATION ══ */}
      <section className="py-14 px-4 sm:px-6 bg-white">
        <div className="max-w-3xl mx-auto text-center">
          <span className="inline-block border border-red-200 bg-red-50 text-red-600 font-bold text-xs px-4 py-1.5 rounded-full tracking-widest mb-4">
            BẠN CÓ ĐANG MẮC NHỮNG LỖI NÀY?
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-800 mb-8">
            Tại Sao Đĩa Nộm Nhà Bạn<br />
            <span className="text-red-500">Lúc Mặn, Lúc Nhạt, Lúc Xẹp Xẹp?</span>
          </h2>

          <div className="grid sm:grid-cols-2 gap-4 text-left">
            {[
              { icon: '😩', t: 'Tra gia vị theo cảm giác', d: 'Mỗi lần một kiểu. Không bao giờ ra đúng vị cũ. Khách khen một hôm, hôm sau lại bảo nhạt.' },
              { icon: '💧', t: 'Nước trộn loãng, chảy hết', d: 'Bỏ công trộn xong, nước trộn chảy xuống đáy đĩa. Nguyên liệu không ngấm gia vị. Ăn vào nhạt thếch.' },
              { icon: '🥀', t: 'Rau xẹp, nộm không đẹp', d: 'Bóp muối xong vắt khô — rau teo lại, đĩa nộm trông xỉn xịn. Dọn lên mâm ngại ngùng với khách.' },
              { icon: '⏰', t: 'Mất cả tiếng đồng hồ', d: 'Tính toán từng gia vị, nêm thử đi thử lại nhiều lần. Kết quả vẫn không bằng ngoài hàng.' },
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
            Không phải lỗi của bạn. Công thức trộn nộm chuẩn cần nhiều năm kinh nghiệm để cân bằng đúng.
            <strong className="text-[#006400]"> Cho đến khi có chai sốt này.</strong>
          </p>
        </div>
      </section>

      {/* ══ GALLERY THÀNH PHẨM ══ */}
      <section id="thanh-pham" className="py-14 px-4 sm:px-6 bg-[#F4FAF6]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-8">
            <span className="inline-block border border-[#90EE90] bg-[#f0fff4] text-[#006400] font-bold text-xs px-5 py-1.5 rounded-full tracking-widest mb-3">
              THÀNH PHẨM
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-800">
              Chỉ 5 Phút — Ra Ngay Đĩa Nộm<br />
              <span className="text-[#D97706]">Đẹp Như Nhà Hàng, Giòn Như Ngoài Quán</span>
            </h2>
          </div>

          {/* Row 1: 3 images tall */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-2 sm:mb-3 h-52 sm:h-72">
            {THANH_PHAM.slice(0, 3).map(item => (
              <div key={item.label} className="relative rounded-xl sm:rounded-2xl overflow-hidden group shadow-md h-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.src} alt={item.label}
                  className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <p className="absolute bottom-2 left-2 text-white text-xs sm:text-sm font-semibold drop-shadow leading-tight">{item.label}</p>
              </div>
            ))}
          </div>

          {/* Row 2: 3 images medium */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-2 sm:mb-3 h-44 sm:h-56">
            {THANH_PHAM.slice(3, 6).map(item => (
              <div key={item.label} className="relative rounded-xl sm:rounded-2xl overflow-hidden group shadow-sm h-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.src} alt={item.label}
                  className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <p className="absolute bottom-2 left-2 text-white text-xs font-semibold drop-shadow leading-tight">{item.label}</p>
              </div>
            ))}
          </div>

          {/* Row 3: 3 images */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3 h-44 sm:h-56">
            {THANH_PHAM.slice(6, 9).map(item => (
              <div key={item.label} className="relative rounded-xl sm:rounded-2xl overflow-hidden group shadow-sm h-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.src} alt={item.label}
                  className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <p className="absolute bottom-2 left-2 text-white text-xs font-semibold drop-shadow leading-tight">{item.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 text-center">
            <button onClick={scrollToOrder}
              className="bg-gradient-to-r from-[#D97706] to-[#B45309] text-white font-bold px-8 py-3.5 rounded-2xl shadow-md hover:shadow-lg transition-all active:scale-95">
              Tôi Muốn Thử Ngay →
            </button>
          </div>
        </div>
      </section>

      {/* ══ SOLUTION / MECHANISM ══ */}
      <section className="py-14 px-4 sm:px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            {/* Left: Product image */}
            <div className="relative flex justify-center">
              <div className="relative rounded-3xl overflow-hidden shadow-2xl max-w-xs w-full" style={{ aspectRatio: '3/4' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/images/co-ha-portrait.png" alt="Cô Hạ – Bếp Cô Hạ"
                  className="w-full h-full object-cover object-top" />
              </div>
              <div className="absolute -top-3 -right-3 bg-[#D97706] text-white font-extrabold text-sm px-4 py-2 rounded-full shadow-lg rotate-6">
                Công thức<br />độc quyền
              </div>
            </div>

            {/* Right: Copy */}
            <div>
              <span className="inline-block border border-[#90EE90] bg-[#f0fff4] text-[#006400] font-bold text-xs px-4 py-1.5 rounded-full tracking-widest mb-4">
                GIẢI PHÁP
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-800 mb-4">
                Gặp Cô Hạ.<br />
                <span className="text-[#D97706]">Sốt Trộn Nộm Vạn Năng</span><br />
                Đã Nấu Cô Đặc Sẵn Cho Bạn.
              </h2>
              <p className="text-gray-600 leading-relaxed mb-6">
                Sau nhiều năm nấu nướng và hàng chục video viral về nộm gỏi,
                Cô Hạ đã chiết xuất toàn bộ bí quyết gia vị vào một chai sốt duy nhất.
                <strong className="text-gray-800"> Bạn chỉ cần đổ vào, trộn đều — là xong.</strong>
              </p>

              <div className="space-y-3">
                {[
                  { icon: '🔑', t: 'Nấu cô đặc — bám chắc nguyên liệu', d: 'Không như nước trộn thông thường. Sốt sệt, bám vào từng sợi rau, từng miếng thịt. Không bị chảy loãng xuống đáy đĩa.' },
                  { icon: '⚖️', t: 'Cân bằng vị sẵn — không cần tra thêm', d: 'Chua, mặn, ngọt, cay đã được tính toán chuẩn xác. Chỉ cần 50–80ml cho 500g nguyên liệu là đủ.' },
                  { icon: '🥗', t: 'Vạn năng — dùng cho mọi loại gỏi', d: 'Tai heo, sứa, bò, gà, rau củ, thập cẩm. Gỏi chay lẫn mặn đều dùng được tốt.' },
                  { icon: '⚡', t: '5 phút là có đĩa nộm đãi khách', d: 'Không cần đau đầu tính công thức. Không sợ sai vị. Có khách bất ngờ cũng tự tin làm ngay.' },
                ].map(item => (
                  <div key={item.t} className="flex gap-3">
                    <span className="text-2xl flex-shrink-0">{item.icon}</span>
                    <div>
                      <p className="font-bold text-gray-800 text-sm">{item.t}</p>
                      <p className="text-gray-500 text-sm leading-relaxed">{item.d}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ USE CASES ══ */}
      <section className="py-12 px-4 sm:px-6 bg-[#F4FAF6]">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-800 mb-2">
            Dùng Được Cho Tất Cả Các Loại Gỏi
          </h2>
          <p className="text-gray-500 mb-8">Một chai sốt — trăm món ngon</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { icon: '🐷', name: 'Gỏi tai heo', sub: 'Giòn sần sật' },
              { icon: '🦑', name: 'Gỏi sứa', sub: 'Đậm đà hơn' },
              { icon: '🥩', name: 'Gỏi bò', sub: 'Thấm vị nhanh' },
              { icon: '🐔', name: 'Gỏi gà xé', sub: 'Chuẩn vị quán' },
              { icon: '🥕', name: 'Nộm đu đủ', sub: 'Màu sắc tươi ngon' },
              { icon: '🌿', name: 'Gỏi chay', sub: 'Thanh nhẹ, đủ vị' },
            ].map(item => (
              <div key={item.name} className="bg-white rounded-2xl p-5 shadow-sm text-center">
                <span className="text-4xl">{item.icon}</span>
                <p className="font-bold text-gray-800 mt-2">{item.name}</p>
                <p className="text-sm text-[#006400]">{item.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ INGREDIENTS & USAGE ══ */}
      <section className="py-14 px-4 sm:px-6 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8">
            {/* Thành phần */}
            <div className="bg-[#F4FAF6] rounded-3xl p-6 border border-green-100">
              <h3 className="font-extrabold text-xl text-[#006400] mb-4">🌿 Thành Phần</h3>
              <p className="text-gray-600 leading-relaxed mb-3">
                Nước mắm ngon · Đường kính · Quất (chanh) · Tỏi · Ớt · Giấm · Muối · Gia vị tổng hợp
              </p>
              <div className="bg-green-100 rounded-xl px-4 py-3">
                <p className="text-[#006400] font-bold text-sm">+ Công thức bí mật của Bếp Cô Hạ</p>
                <p className="text-green-800 text-xs mt-0.5">Chỉ có 1 nơi sản xuất, không nơi nào khác</p>
              </div>
            </div>

            {/* Hướng dẫn */}
            <div className="bg-[#F0FFF4] rounded-3xl p-6 border border-green-100">
              <h3 className="font-extrabold text-xl text-[#006400] mb-4">📋 Hướng Dẫn Sử Dụng</h3>
              <ol className="space-y-2.5 text-gray-600 text-sm">
                <li className="flex gap-2.5"><span className="bg-[#006400] text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">1</span><span>Ngâm rau củ trong nước đá + muối + giấm 15–20 phút để giòn (bí quyết từ video viral của Cô Hạ!)</span></li>
                <li className="flex gap-2.5"><span className="bg-[#006400] text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">2</span><span>Vớt rau ra, để ráo nước</span></li>
                <li className="flex gap-2.5"><span className="bg-[#006400] text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">3</span><span>Cho <strong>50–80ml sốt / 500g nguyên liệu</strong> vào trộn đều</span></li>
                <li className="flex gap-2.5"><span className="bg-[#006400] text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">4</span><span>Để ngấm 10–15 phút trước khi ăn</span></li>
                <li className="flex gap-2.5"><span className="bg-[#006400] text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">5</span><span>Rắc đậu phộng rang, hành phi, rau thơm, ớt sợi lên trên. Hoàn thành!</span></li>
              </ol>
            </div>

            {/* Mẹo */}
            <div className="bg-blue-50 rounded-3xl p-6 border border-blue-100">
              <h3 className="font-extrabold text-xl text-blue-700 mb-4">💡 Bí Quyết Ngon Hơn</h3>
              <ul className="space-y-2 text-gray-600 text-sm">
                <li className="flex gap-2">✅ <span>Sốt đã cân bằng vị — <strong>không cần thêm gia vị</strong></span></li>
                <li className="flex gap-2">🌶️ <span>Muốn cay hơn: thêm ớt băm tươi</span></li>
                <li className="flex gap-2">🥬 <span>Rau, thịt phải <strong>ráo hết nước</strong> trước khi trộn để gỏi không bị nhão</span></li>
                <li className="flex gap-2">👅 <span>Trộn lượng nhỏ trước, nếm thử rồi điều chỉnh theo khẩu vị gia đình</span></li>
              </ul>
            </div>

            {/* Bảo quản */}
            <div className="bg-purple-50 rounded-3xl p-6 border border-purple-100">
              <h3 className="font-extrabold text-xl text-purple-700 mb-4">🧊 Bảo Quản</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">❄️</span>
                  <div>
                    <p className="font-bold text-gray-800">Ngăn đông</p>
                    <p className="text-gray-500 text-sm">Dùng được <strong>6 tháng</strong></p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-3xl">🌡️</span>
                  <div>
                    <p className="font-bold text-gray-800">Ngăn mát</p>
                    <p className="text-gray-500 text-sm">Dùng được <strong>1 tháng</strong></p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ PRODUCT IMAGES (Social Proof từ video) ══ */}
      <section className="py-14 px-4 sm:px-6 bg-[#F4FAF6]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-8">
            <span className="inline-block border border-amber-300 bg-green-100 text-[#006400] font-bold text-xs px-4 py-1.5 rounded-full tracking-widest mb-3">
              VIRAL TRÊN MẠNG XÃ HỘI
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-800">
              Hàng Triệu Người Xem Video Cô Hạ<br />
              <span className="text-[#D97706]">Đã Biết Bí Quyết Này</span>
            </h2>
            <p className="text-gray-500 mt-2 max-w-xl mx-auto">
              Chai sốt trộn nộm xuất hiện trong các video triệu view — bây giờ bạn có thể mua về dùng ngay tại nhà
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {SAN_PHAM.map(img => (
              <div key={img.label} className="rounded-3xl overflow-hidden shadow-lg bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.src} alt={img.label}
                  className="w-full h-auto object-contain" />
                <p className="text-center text-sm font-semibold text-gray-700 py-3 px-4">{img.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 bg-green-100 rounded-3xl p-6 text-center max-w-2xl mx-auto">
            <p className="text-[#006400] font-bold text-lg mb-2">
              "Chỉ cần một chai nhỏ thế này thôi là gia đình đã ăn được mấy bữa rồi."
            </p>
            <p className="text-green-800 text-sm italic">— Cô Hạ, trong video viral triệu lượt xem</p>
          </div>
        </div>
      </section>

      {/* ══ PRICING + ORDER FORM ══ */}
      <section ref={orderRef} id="dat-hang" className="py-16 px-4 sm:px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <span className="inline-block border border-[#90EE90] bg-[#f0fff4] text-[#006400] font-bold text-xs px-5 py-1.5 rounded-full tracking-widest mb-3">
              ĐẶT HÀNG
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-800 mb-2">
              Mang Sốt Trộn Nộm Bếp Cô Hạ<br />
              <span className="text-[#D97706]">Về Tủ Lạnh Nhà Bạn Hôm Nay</span>
            </h2>
            <p className="text-gray-500 max-w-md mx-auto">
              Giao tận nhà toàn quốc · Thanh toán khi nhận hàng · Đảm bảo hàng chính hãng từ Bếp Cô Hạ
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-10 items-start">
            {/* Left: Value & Pricing */}
            <div>
              <div className="space-y-4 mb-8">
                {[
                  { size: '500g', price: 65000, sub: 'Phù hợp gia đình 3–4 người', icon: '🍶', popular: false },
                  { size: '1kg',  price: 105000, sub: 'Tiết kiệm 12% · Dùng cho tiệc, đặt nhiều', icon: '🏺', popular: true },
                ].map(item => (
                  <div key={item.size} className={`relative rounded-2xl p-5 border-2 ${
                    item.popular ? 'border-[#006400] bg-[#f0fff4]' : 'border-gray-200 bg-gray-50'
                  }`}>
                    {item.popular && (
                      <span className="absolute -top-3 left-4 bg-[#006400] text-white text-xs font-bold px-3 py-1 rounded-full">
                        Phổ biến nhất
                      </span>
                    )}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">{item.icon}</span>
                        <div>
                          <p className="font-extrabold text-gray-800 text-lg">Chai {item.size}</p>
                          <p className="text-gray-500 text-sm">{item.sub}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-extrabold text-2xl text-[#D97706]">{fmt(item.price)}</p>
                        <p className="text-gray-400 text-xs">/chai</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Guarantees */}
              <div className="space-y-3">
                {[
                  { icon: '🚚', t: 'Giao hàng toàn quốc', d: 'Ship tận nhà, đóng gói chắc chắn' },
                  { icon: '💳', t: 'COD – Thanh toán khi nhận hàng', d: 'Nhận hàng, kiểm tra ổn mới trả tiền' },
                  { icon: '✅', t: 'Hàng chính hãng Bếp Cô Hạ', d: 'Sản xuất theo công thức độc quyền' },
                  { icon: '🧊', t: 'Giao hàng đảm bảo chất lượng', d: 'Đóng gói cẩn thận, không bị vỡ, rò' },
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

            {/* Right: Order Form */}
            <div className="bg-[#F4FAF6] rounded-3xl p-6 sm:p-8 border border-green-200 shadow-lg">
              <h3 className="font-extrabold text-xl text-[#006400] mb-6 text-center">
                Điền Thông Tin Đặt Hàng
              </h3>
              <OrderForm />
            </div>
          </div>
        </div>
      </section>

      {/* ══ P.S. / URGENCY ══ */}
      <section className="py-10 px-4 sm:px-6 bg-gradient-to-r from-[#003200] to-[#006400] text-white text-center">
        <div className="max-w-2xl mx-auto">
          <p className="text-green-200 text-sm font-semibold mb-2">P.S.</p>
          <p className="text-lg leading-relaxed">
            Mỗi mâm cỗ, mỗi bữa tiệc đều xứng đáng có một đĩa nộm <strong>giòn sần sật, đậm vị chuẩn</strong>.
            Đừng để khách khen bếp nhà hàng trong khi bạn đang có bí quyết trong tay.
          </p>
          <button onClick={scrollToOrder}
            className="mt-6 bg-[#D97706] hover:bg-[#B45309] text-white font-extrabold px-10 py-4 rounded-2xl transition-colors active:scale-95 text-lg">
            Đặt Hàng Ngay →
          </button>
        </div>
      </section>

      {/* ══ FOOTER ══ */}
      <footer className="bg-gray-900 text-gray-400 py-10 px-4 sm:px-6 text-center text-sm">
        <div className="max-w-3xl mx-auto space-y-3">
          <div className="flex justify-center">
            <div className="bg-white rounded-xl px-4 py-2 inline-flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/logo-bep-co-ha.png" alt="Bếp Cô Hạ"
                className="h-9 w-9 object-contain"
                onError={e => { (e.currentTarget as HTMLImageElement).style.display='none' }} />
              <div className="text-left">
                <p className="text-[#006400] font-extrabold text-base leading-tight">Bếp Cô Hạ</p>
                <p className="text-gray-400 text-xs">Hacofood.vn</p>
              </div>
            </div>
          </div>
          <p>Sốt Trộn Nộm Bếp Cô Hạ — Sản xuất theo công thức độc quyền</p>
          <p>Mọi thắc mắc liên hệ qua: <strong className="text-gray-300">Facebook: Bếp Cô Hạ</strong> hoặc số điện thoại trên bao bì</p>
          <p className="text-gray-600 text-xs">© 2025 Hacofood.vn · Bếp Cô Hạ. All rights reserved.</p>
        </div>
      </footer>

      {/* ══ MESSENGER FLOAT ══ */}
      <a href="https://www.facebook.com/messages/t/hacasau1987" target="_blank" rel="noopener noreferrer"
        className="fixed bottom-6 right-4 z-50 w-14 h-14 bg-gradient-to-br from-[#00B2FF] to-[#006AFF] hover:brightness-110 rounded-full flex items-center justify-center shadow-xl shadow-blue-500/30 transition-all hover:scale-110"
        aria-label="Nhắn tin qua Messenger">
        <svg viewBox="0 0 24 24" className="w-8 h-8" fill="white">
          <path d="M12 0C5.373 0 0 4.974 0 11.111c0 3.498 1.744 6.614 4.469 8.652V24l4.088-2.242c1.092.301 2.246.464 3.443.464 6.627 0 12-4.974 12-11.111C24 4.974 18.627 0 12 0zm1.191 14.963l-3.055-3.26-5.963 3.26L10.75 8l3.13 3.259L19.777 8l-6.586 6.963z" />
        </svg>
      </a>

    </div>
  )
}
