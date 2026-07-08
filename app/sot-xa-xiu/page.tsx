'use client'

import { useState, useRef, useEffect } from 'react'

const SP = '/images/sot-xa-xiu/san-pham/'

const HERO_IMG = SP + 'hero-sot-xa-xiu.jpg'
const TEXTURE_IMG = SP + 'muc-sot-dac.jpg'
const GROUP_IMG = SP + 'bo-san-pham.jpg'
const CO_HA_IMG = SP + 'co-ha-portrait.jpg'
const DISH_IMG = SP + 'xa-xiu-com-trang.jpg'
const LABEL_IMG = SP + 'nhan-huong-dan.jpg'

const SAN_PHAM = [
  { src: GROUP_IMG, label: 'Bộ Sốt Xá Xíu Bếp Cô Hạ – hũ 500g & chai 1kg' },
  { src: TEXTURE_IMG, label: 'Sốt sánh mịn, cô đặc, lên màu đỏ cánh gián' },
  { src: DISH_IMG, label: 'Xá xíu lên màu chuẩn, bóng đẹp như ngoài tiệm' },
]

const PRICES = { '500g': 100000, '1kg': 190000 }

function fmt(n: number) { return n.toLocaleString('vi-VN') + 'đ' }

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
  return <span className={left < 120 ? 'text-red-500 font-bold' : 'font-bold text-[#0F6B39]'}>{m}:{s}</span>
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
        <p className="text-[#0F6B39] font-extrabold text-lg mb-0.5">Bước 2: Chuyển khoản để xác nhận đơn</p>
        <p className="text-gray-500 text-sm">Quét QR hoặc chuyển khoản thủ công trong <Countdown seconds={30 * 60} /></p>
      </div>
      <div className="flex justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={data.qr.qrUrl} alt="QR chuyển khoản"
          className="w-52 h-52 rounded-2xl border-4 border-[#0F6B39] shadow-lg object-contain bg-white" />
      </div>
      <div className="bg-[#EAF7EF] border border-green-200 rounded-2xl p-4 space-y-2.5 text-sm">
        <div className="flex justify-between items-center">
          <span className="text-gray-500">Ngân hàng</span>
          <span className="font-bold">{data.qr.bankCode} – {data.qr.accountName}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-500">Số tài khoản</span>
          <span className="font-bold font-mono">{data.qr.bankAccount}</span>
        </div>
        <div className="flex justify-between items-start">
          <div>
            <span className="text-gray-500">Số tiền</span>
            <p className="text-red-500 text-sm font-semibold mt-0.5">⚠ Chưa gồm phí vận chuyển</p>
          </div>
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
            <span className="font-extrabold font-mono text-[#0F6B39]">{data.refCode}</span>
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
      const res = await fetch('/api/sot-xa-xiu-order', {
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
      <div>
        <p className="font-bold text-gray-700 mb-2">Chọn loại sản phẩm *</p>
        <div className="grid grid-cols-2 gap-3">
          {(['500g', '1kg'] as const).map(p => (
            <button type="button" key={p} onClick={() => set('product', p)}
              className={`border-2 rounded-xl p-4 text-center transition-all ${
                form.product === p ? 'border-[#0F6B39] bg-[#EAF7EF]' : 'border-gray-200 hover:border-amber-300'
              }`}>
              <p className="font-extrabold text-lg text-[#0F6B39]">{p}</p>
              <p className="text-[#D97706] font-bold text-base">{fmt(PRICES[p])}</p>
              {p === '1kg' && <p className="text-xs text-green-600 font-semibold mt-0.5">Tiết kiệm hơn</p>}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="font-bold text-gray-700 mb-2 block">Số lượng *</label>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => set('quantity', Math.max(1, form.quantity - 1))}
            className="w-10 h-10 rounded-full border-2 border-gray-200 text-xl font-bold hover:border-amber-400 transition-colors flex items-center justify-center">−</button>
          <span className="w-10 text-center font-bold text-xl text-[#0F6B39]">{form.quantity}</span>
          <button type="button" onClick={() => set('quantity', Math.min(20, form.quantity + 1))}
            className="w-10 h-10 rounded-full border-2 border-gray-200 text-xl font-bold hover:border-amber-400 transition-colors flex items-center justify-center">+</button>
          <span className="ml-2 text-sm text-gray-500">Tổng: <strong className="text-[#D97706] text-base">{fmt(total)}</strong> <span className="text-sm text-red-500 font-semibold">(chưa gồm phí ship)</span></span>
        </div>
      </div>

      <div>
        <label className="font-bold text-gray-700 mb-2 block">Họ và tên *</label>
        <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ví dụ: Nguyễn Thị Lan"
          className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-[#0F6B39] focus:outline-none transition-colors" />
      </div>
      <div>
        <label className="font-bold text-gray-700 mb-2 block">Số điện thoại *</label>
        <input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="0912 345 678" type="tel"
          className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-[#0F6B39] focus:outline-none transition-colors" />
      </div>
      <div>
        <label className="font-bold text-gray-700 mb-2 block">Email <span className="text-gray-400 font-normal">(không bắt buộc)</span></label>
        <input value={form.email} onChange={e => set('email', e.target.value)} placeholder="email@gmail.com" type="email"
          className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-[#0F6B39] focus:outline-none transition-colors" />
      </div>
      <div>
        <label className="font-bold text-gray-700 mb-2 block">Địa chỉ giao hàng chi tiết *</label>
        <textarea value={form.address} onChange={e => set('address', e.target.value)}
          placeholder="Số nhà, ngõ/hẻm, đường, phường/xã, quận/huyện, tỉnh/thành phố" rows={3}
          className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-[#0F6B39] focus:outline-none transition-colors resize-none" />
      </div>
      <div>
        <label className="font-bold text-gray-700 mb-2 block">Ghi chú <span className="text-gray-400 font-normal">(không bắt buộc)</span></label>
        <input value={form.note} onChange={e => set('note', e.target.value)} placeholder="Giao giờ nào, yêu cầu đặc biệt..."
          className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-[#0F6B39] focus:outline-none transition-colors" />
      </div>

      {error && <p className="text-red-500 text-sm bg-red-50 rounded-xl py-2.5 px-4 text-center">{error}</p>}

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

export default function SotXaXiu() {
  const orderRef = useRef<HTMLDivElement>(null)
  const scrollToOrder = () => orderRef.current?.scrollIntoView({ behavior: 'smooth' })

  return (
    <div className="min-h-screen bg-[#F4FAF6] font-sans">

      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#04150C] via-[#0F6B39] to-[#04150C] text-white">
        <div className="absolute inset-0 opacity-5"
          style={{ backgroundImage: 'radial-gradient(circle at 30% 50%, white 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 pt-10 pb-14">
          <div className="flex justify-center mb-6">
            <div className="bg-white rounded-2xl px-5 py-3 shadow-xl inline-flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/logo-bep-co-ha.png" alt="Bếp Cô Hạ" className="h-12 w-12 object-contain"
                onError={e => { (e.currentTarget as HTMLImageElement).style.display='none' }} />
              <div>
                <p className="text-[#0F6B39] font-extrabold text-xl leading-tight tracking-tight">Bếp Cô Hạ</p>
                <p className="text-gray-400 text-xs">Hacofood.vn</p>
              </div>
            </div>
          </div>
          <div className="flex justify-center mb-5">
            <span className="bg-red-500 text-white text-sm font-bold px-5 py-1.5 rounded-full animate-bounce shadow">
              🔥 Bí quyết lên màu xá xíu chuẩn tiệm
            </span>
          </div>
          <div className="text-center mb-6 max-w-3xl mx-auto">
            <p className="text-green-200 font-semibold text-base mb-2 italic">
              &quot;Xá xíu ngon là phải lên màu đỏ cánh gián, cắn vào ngọt đậm từ trong ra ngoài.&quot; – Cô Hạ
            </p>
            <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight">
              Ướp Xá Xíu 2 Phút,<br />
              <span className="text-[#8FE3B0]">Lên Màu Cực Chuẩn, Vị Ngon Đậm Sâu</span>
            </h1>
            <p className="mt-4 text-green-100 text-lg max-w-2xl mx-auto leading-relaxed">
              Sốt Xá Xíu Bếp Cô Hạ — đã nấu cô đặc, cân bằng vị sẵn.<br className="hidden sm:block" />
              Không cần pha 10 loại gia vị. Không lo lên màu loang lổ, nhạt thếch.
            </p>
          </div>
          <div className="flex justify-center mb-8">
            <div className="relative rounded-2xl overflow-hidden shadow-2xl border-4 border-white/20 w-full max-w-sm sm:max-w-md">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={HERO_IMG} alt="Sốt Xá Xíu Bếp Cô Hạ" className="w-full h-auto object-contain" />
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-3 mb-8">
            {[
              { icon: '🏆', text: 'Công thức độc quyền' },
              { icon: '🎨', text: 'Lên màu cánh gián chuẩn' },
              { icon: '🌿', text: 'An toàn thực phẩm' },
              { icon: '⚡', text: 'Ướp 1-2 tiếng là xong' },
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
            <a href="#san-pham"
              className="bg-white/10 border border-white/20 text-white font-bold text-base px-8 py-4 rounded-2xl hover:bg-white/20 transition-colors text-center">
              Xem Sản Phẩm
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

      {/* PAIN */}
      <section className="py-14 px-4 sm:px-6 bg-white">
        <div className="max-w-3xl mx-auto text-center">
          <span className="inline-block border border-red-200 bg-red-50 text-red-600 font-bold text-xs px-4 py-1.5 rounded-full tracking-widest mb-4">
            BẠN CÓ ĐANG MẮC NHỮNG LỖI NÀY?
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-800 mb-8">
            Tại Sao Xá Xíu Nhà Bạn<br />
            <span className="text-red-500">Lúc Nhạt Màu, Lúc Mặn Gắt, Khô Cứng?</span>
          </h2>
          <div className="grid sm:grid-cols-2 gap-4 text-left">
            {[
              { icon: '🎨', t: 'Lên màu không đều, chỗ đậm chỗ nhạt', d: 'Pha phẩm màu không chuẩn tỷ lệ. Thịt ra lò chỗ thì đỏ sậm, chỗ vẫn tai tái. Nhìn không hấp dẫn.' },
              { icon: '🧂', t: 'Ướp cả buổi mà thịt vẫn nhạt bên trong', d: 'Chỉ thấm ở ngoài, cắt ra bên trong nhạt thếch. Khách ăn miếng đầu ngon, miếng sau mất hứng.' },
              { icon: '🥄', t: 'Pha sai tỷ lệ gia vị, vị lợn cợn', d: 'Dầu hào, tương ớt, tương cà, ngũ vị hương — sai một chút là vị chua gắt hoặc mặn chát, hỏng cả mẻ thịt.' },
              { icon: '🍖', t: 'Áp chảo xong thịt khô, không bóng đẹp', d: 'Không biết cách giữ nước, thịt xá xíu khô cứng, không có độ bóng mượt như ngoài tiệm quay.' },
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
            Không phải lỗi của bạn. Công thức xá xíu chuẩn tiệm cần nhiều năm kinh nghiệm để cân bằng đúng màu và vị.
            <strong className="text-[#0F6B39]"> Cho đến khi có chai sốt này.</strong>
          </p>
        </div>
      </section>

      {/* VIDEO */}
      <section className="py-14 px-4 sm:px-6 bg-white">
        <div className="max-w-3xl mx-auto text-center">
          <span className="inline-block border border-green-200 bg-[#EAF7EF] text-[#0F6B39] font-bold text-xs px-4 py-1.5 rounded-full tracking-widest mb-4">
            XEM THỰC TẾ
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-800 mb-8">
            Cô Hạ Làm Xá Xíu<br />
            <span className="text-[#D97706]">Lên Màu Đẹp Ngay Trước Mắt Bạn</span>
          </h2>
          <div className="mx-auto rounded-3xl overflow-hidden shadow-2xl border-4 border-[#EAF7EF]" style={{ maxWidth: 360, aspectRatio: '9/16' }}>
            <iframe
              src="https://www.youtube.com/embed/yk3q83VX36M"
              title="Sốt Xá Xíu Bếp Cô Hạ"
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        </div>
      </section>

      {/* SOLUTION */}
      <section id="san-pham" className="py-14 px-4 sm:px-6 bg-[#F4FAF6]">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div className="relative flex justify-center">
              <div className="relative rounded-3xl overflow-hidden shadow-2xl max-w-xs w-full" style={{ aspectRatio: '3/4' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={CO_HA_IMG} alt="Cô Hạ – Bếp Cô Hạ" className="w-full h-full object-cover object-top" />
              </div>
              <div className="absolute -top-3 -right-3 bg-[#D97706] text-white font-extrabold text-sm px-4 py-2 rounded-full shadow-lg rotate-6">
                Công thức<br />độc quyền
              </div>
            </div>
            <div>
              <span className="inline-block border border-green-200 bg-[#EAF7EF] text-[#0F6B39] font-bold text-xs px-4 py-1.5 rounded-full tracking-widest mb-4">GIẢI PHÁP</span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-800 mb-4">
                Gặp Cô Hạ.<br />
                <span className="text-[#D97706]">Sốt Xá Xíu Cô Đặc Sẵn</span><br />
                Cho Bạn.
              </h2>
              <p className="text-gray-600 leading-relaxed mb-6">
                Cô Hạ đã nấu cô đặc toàn bộ bí quyết lên màu và cân bằng vị xá xíu vào một chai sốt duy nhất.
                <strong className="text-gray-800"> Bạn chỉ cần ướp, đun và áp chảo — là xong.</strong>
              </p>
              <div className="space-y-3">
                {[
                  { icon: '🎨', t: 'Nấu cô đặc — lên màu cánh gián chuẩn', d: 'Không cần phẩm màu. Chỉ 100g sốt cho 1kg thịt là lên màu đỏ đẹp, đều tăm tắp từ trong ra ngoài.' },
                  { icon: '⚖️', t: 'Cân bằng vị sẵn — không cần pha thêm', d: 'Dầu hào, xì dầu, tương ớt, tương cà, ngũ vị hương đã được tính toán đúng tỷ lệ. Không lo mặn nhạt không đều.' },
                  { icon: '🍖', t: 'Ướp 1-2 tiếng là ngấm đều', d: 'Không cần ướp qua đêm. Trộn đều, ướp 1-2 tiếng, đổ nước xâm xấp đun đến khi thịt mềm là chuẩn vị.' },
                  { icon: '⚡', t: 'Áp chảo lên là hoàn tất', d: 'Không cần lò nướng chuyên dụng. Áp chảo cho thơm là có ngay xá xíu bóng đẹp, đậm vị như ngoài tiệm.' },
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

      {/* USE CASES */}
      <section className="py-12 px-4 sm:px-6 bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-800 mb-2">Dùng Được Cho Rất Nhiều Món</h2>
          <p className="text-gray-500 mb-8">Một chai sốt — trăm món ngon</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { icon: '🐖', name: 'Xá xíu heo', sub: 'Lên màu cánh gián' },
              { icon: '🍖', name: 'Sườn nướng', sub: 'Đậm vị, bóng đẹp' },
              { icon: '🍗', name: 'Gà quay mật ong', sub: 'Vị ngọt đậm sâu' },
              { icon: '🍚', name: 'Cơm xá xíu', sub: 'Chuẩn vị quán cơm' },
              { icon: '🥟', name: 'Nhân bánh bao', sub: 'Thơm béo, đậm đà' },
              { icon: '🍜', name: 'Mì xá xíu', sub: 'Nước sốt sánh mịn' },
            ].map(item => (
              <div key={item.name} className="bg-[#F4FAF6] rounded-2xl p-5 shadow-sm text-center">
                <span className="text-4xl">{item.icon}</span>
                <p className="font-bold text-gray-800 mt-2">{item.name}</p>
                <p className="text-sm text-[#0F6B39]">{item.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* INGREDIENTS */}
      <section className="py-14 px-4 sm:px-6 bg-[#F4FAF6]">
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white rounded-3xl p-6 border border-green-100">
              <h3 className="font-extrabold text-xl text-[#0F6B39] mb-4">🌿 Thành Phần</h3>
              <p className="text-gray-600 leading-relaxed mb-3">Dầu hào · Xì dầu · Đường · Muối · Mì chính · Tương ớt · Tương cà · Hành · Tỏi · Hành tây · Ngũ vị hương...</p>
              <div className="bg-green-100 rounded-xl px-4 py-3 mb-3">
                <p className="text-[#0F6B39] font-bold text-sm">+ Công thức bí mật của Bếp Cô Hạ</p>
                <p className="text-green-800 text-xs mt-0.5">Chỉ có 1 nơi sản xuất, không nơi nào khác</p>
              </div>
              <div className="rounded-xl overflow-hidden border border-green-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={LABEL_IMG} alt="Nhãn thành phần Sốt Xá Xíu Bếp Cô Hạ" className="w-full h-auto object-cover" />
              </div>
            </div>
            <div className="bg-white rounded-3xl p-6 border border-green-100">
              <h3 className="font-extrabold text-xl text-[#0F6B39] mb-4">📋 Hướng Dẫn Sử Dụng</h3>
              <ol className="space-y-2.5 text-gray-600 text-sm">
                {['1kg thịt ướp cùng 100g sốt xá xíu','Trộn đều, ướp trong 1-2 giờ cho ngấm','Đổ nước xâm xấp mặt thịt, đun đến khi thịt mềm','Khi ăn, áp chảo cho thơm là hoàn tất'].map((s, i) => (
                  <li key={i} className="flex gap-2.5">
                    <span className="bg-[#0F6B39] text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">{i+1}</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
            </div>
            <div className="bg-blue-50 rounded-3xl p-6 border border-blue-100">
              <h3 className="font-extrabold text-xl text-blue-700 mb-4">💡 Bí Quyết Ngon Hơn</h3>
              <ul className="space-y-2 text-gray-600 text-sm">
                <li className="flex gap-2">✅ <span>Sốt đã cân bằng vị — <strong>không cần thêm gia vị</strong></span></li>
                <li className="flex gap-2">🎨 <span>Ướp đủ 1-2 tiếng để lên màu đều, đẹp mắt</span></li>
                <li className="flex gap-2">🍖 <span>Đun lửa nhỏ đến khi thịt mềm, không cần lửa lớn</span></li>
                <li className="flex gap-2">🔥 <span>Áp chảo lửa vừa cho thơm, tránh cháy khét</span></li>
              </ul>
            </div>
            <div className="bg-purple-50 rounded-3xl p-6 border border-purple-100">
              <h3 className="font-extrabold text-xl text-purple-700 mb-4">🧊 Bảo Quản</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3"><span className="text-3xl">❄️</span><div><p className="font-bold text-gray-800">Ngăn đông</p><p className="text-gray-500 text-sm">Dùng được <strong>6 tháng</strong></p></div></div>
                <div className="flex items-center gap-3"><span className="text-3xl">🌡️</span><div><p className="font-bold text-gray-800">Ngăn mát</p><p className="text-gray-500 text-sm">Dùng được <strong>1 tháng</strong></p></div></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SOCIAL PROOF */}
      <section className="py-14 px-4 sm:px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-8">
            <span className="inline-block border border-green-300 bg-green-100 text-[#0F6B39] font-bold text-xs px-4 py-1.5 rounded-full tracking-widest mb-3">CHẤT LƯỢNG ĐƯỢC KIỂM CHỨNG</span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-800">
              Sốt Cô Đặc, Sánh Mịn<br />
              <span className="text-[#D97706]">Bám Chắc Từng Miếng Thịt</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {SAN_PHAM.map(img => (
              <div key={img.label} className="rounded-3xl overflow-hidden shadow-lg bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.src} alt={img.label} className="w-full h-auto object-contain" />
                <p className="text-center text-sm font-semibold text-gray-700 py-3 px-4">{img.label}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 bg-green-100 rounded-3xl p-6 text-center max-w-2xl mx-auto">
            <p className="text-[#0F6B39] font-bold text-lg mb-2">&quot;Chỉ cần một chai sốt là lên màu, lên vị chuẩn như ngoài tiệm quay.&quot;</p>
            <p className="text-green-800 text-sm italic">— Cô Hạ, Bếp Cô Hạ dạy nấu ăn</p>
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            {[
              { icon: '🏅', text: 'CHẤT LƯỢNG CAO' },
              { icon: '🛡️', text: 'AN TOÀN THỰC PHẨM' },
              { icon: '✅', text: 'DỄ DÀNG TIỆN LỢI' },
            ].map(b => (
              <div key={b.text} className="flex items-center gap-2 bg-[#EAF7EF] border border-green-200 rounded-full px-5 py-2.5">
                <span className="text-xl">{b.icon}</span>
                <span className="font-bold text-[#0F6B39] text-sm">{b.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ORDER */}
      <section ref={orderRef} id="dat-hang" className="py-16 px-4 sm:px-6 bg-[#F4FAF6]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <span className="inline-block border border-green-200 bg-[#EAF7EF] text-[#0F6B39] font-bold text-xs px-5 py-1.5 rounded-full tracking-widest mb-3">ĐẶT HÀNG</span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-800 mb-2">
              Mang Sốt Xá Xíu Bếp Cô Hạ<br />
              <span className="text-[#D97706]">Về Bếp Nhà Bạn Hôm Nay</span>
            </h2>
            <p className="text-gray-500 max-w-md mx-auto">Giao tận nhà toàn quốc · Thanh toán khi nhận hàng · Đảm bảo hàng chính hãng từ Bếp Cô Hạ</p>
          </div>
          <div className="grid md:grid-cols-2 gap-10 items-start">
            <div>
              <div className="space-y-4 mb-8">
                {[
                  { size: '500g', price: 100000, sub: 'Phù hợp gia đình dùng thử', icon: '🍶', popular: false },
                  { size: '1kg', price: 190000, sub: 'Tiết kiệm hơn · Dùng cho quán, đặt nhiều', icon: '🏺', popular: true },
                ].map(item => (
                  <div key={item.size} className={`relative rounded-2xl p-5 border-2 ${item.popular ? 'border-[#0F6B39] bg-[#EAF7EF]' : 'border-gray-200 bg-gray-50'}`}>
                    {item.popular && <span className="absolute -top-3 left-4 bg-[#0F6B39] text-white text-xs font-bold px-3 py-1 rounded-full">Phổ biến nhất</span>}
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
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-green-200 shadow-lg">
              <h3 className="font-extrabold text-xl text-[#0F6B39] mb-6 text-center">Điền Thông Tin Đặt Hàng</h3>
              <OrderForm />
            </div>
          </div>
        </div>
      </section>

      {/* PS */}
      <section className="py-10 px-4 sm:px-6 bg-gradient-to-r from-[#04150C] to-[#0F6B39] text-white text-center">
        <div className="max-w-2xl mx-auto">
          <p className="text-green-200 text-sm font-semibold mb-2">P.S.</p>
          <p className="text-lg leading-relaxed">
            Mỗi mâm cơm, mỗi bữa tiệc đều xứng đáng có món xá xíu <strong>lên màu đẹp, đậm vị chuẩn tiệm</strong>.
            Đừng để khách khen nhà hàng trong khi bạn đang có bí quyết trong tay.
          </p>
          <button onClick={scrollToOrder}
            className="mt-6 bg-[#D97706] hover:bg-[#B45309] text-white font-extrabold px-10 py-4 rounded-2xl transition-colors active:scale-95 text-lg">
            Đặt Hàng Ngay →
          </button>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-gray-900 text-gray-400 py-10 px-4 sm:px-6 text-center text-sm">
        <div className="max-w-3xl mx-auto space-y-3">
          <div className="flex justify-center">
            <div className="bg-white rounded-xl px-4 py-2 inline-flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/logo-bep-co-ha.png" alt="Bếp Cô Hạ" className="h-9 w-9 object-contain"
                onError={e => { (e.currentTarget as HTMLImageElement).style.display='none' }} />
              <div className="text-left">
                <p className="text-[#0F6B39] font-extrabold text-base leading-tight">Bếp Cô Hạ</p>
                <p className="text-gray-400 text-xs">Hacofood.vn</p>
              </div>
            </div>
          </div>
          <p>Sốt Xá Xíu Bếp Cô Hạ — Sản xuất theo công thức độc quyền</p>
          <p>Mọi thắc mắc liên hệ qua: <strong className="text-gray-300">Zalo 0965 240 587</strong> · Fanpage &amp; TikTok: <strong className="text-gray-300">Cô Hạ dạy nấu ăn</strong></p>
          <p className="text-gray-600 text-xs">© 2026 Hacofood.vn · Bếp Cô Hạ. All rights reserved.</p>
        </div>
      </footer>

    </div>
  )
}
