'use client'

import { useState, useEffect, useRef } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────
interface FormData { name: string; email: string; phone: string }
interface QRData {
  qrUrl: string; bankAccount: string; bankCode: string
  accountName: string; amount: number; content: string; paymentRef: string
}
type Step = 'idle' | 'loading' | 'success' | 'error'

function formatPrice(n: number) { return n.toLocaleString('vi-VN') + 'đ' }

// ─── Brand colors ─────────────────────────────────────────────────────────────
// Darkgreen #006400 palette
const C = {
  hero: 'from-[#003200] via-[#006400] to-[#003200]',
  btn:  'from-[#006400] to-[#007a00] hover:from-[#007a00] hover:to-[#006400]',
  badge: 'bg-[#90EE90] text-[#003200]',
}

// ─── Countdown ────────────────────────────────────────────────────────────────
function useCountdown(hours = 24) {
  const [time, setTime] = useState({ h: hours, m: 0, s: 0 })
  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('haco_cd') : null
    let end = stored ? parseInt(stored) : Date.now() + hours * 3600000
    if (!stored) localStorage.setItem('haco_cd', String(end))
    const tick = () => {
      const d = Math.max(0, end - Date.now())
      setTime({ h: Math.floor(d / 3600000), m: Math.floor((d % 3600000) / 60000), s: Math.floor((d % 60000) / 1000) })
    }
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id)
  }, [hours])
  return time
}

// ─── YouTube Short embed ──────────────────────────────────────────────────────
function YTShort({ id, title, size = 'sm' }: { id: string; title: string; size?: 'sm' | 'lg' }) {
  return (
    <div
      className={`mx-auto w-full rounded-[2rem] border-[6px] border-gray-800 shadow-2xl overflow-hidden bg-black ${
        size === 'lg' ? 'max-w-[300px] sm:max-w-[360px] lg:max-w-[400px]' : 'max-w-[260px]'
      }`}
      style={{ aspectRatio: '9/16' }}
    >
      <iframe
        src={`https://www.youtube.com/embed/${id}?rel=0&modestbranding=1`}
        title={title}
        className="w-full h-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  )
}

// ─── Lead Form ────────────────────────────────────────────────────────────────
function LeadForm({ ctaText, ctaColor, onSuccess }: {
  ctaText: string
  ctaColor: 'green' | 'red'
  onSuccess: (data: FormData & Record<string, unknown>) => void
}) {
  const [form, setForm] = useState<FormData>({ name: '', email: '', phone: '' })
  const [step, setStep] = useState<Step>('idle')
  const [error, setError] = useState('')
  const endpoint = ctaColor === 'red' ? '/api/course-form' : '/api/gift-form'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.email.trim() || !form.phone.trim()) { setError('Vui lòng điền đầy đủ 3 thông tin'); return }
    setStep('loading')
    try {
      // Lấy mã khuyến mãi từ URL (?promo=199) khi đăng ký khóa học
      const promo = typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('promo')
        : null
      const payload = ctaColor === 'red' && promo ? { ...form, promo } : form
      const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Lỗi')
      setStep('success'); onSuccess({ ...form, ...data })
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Có lỗi xảy ra'); setStep('error') }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {(['name', 'email', 'phone'] as const).map(f => (
        <input key={f} name={f}
          type={f === 'email' ? 'email' : f === 'phone' ? 'tel' : 'text'}
          placeholder={f === 'name' ? '👤 Họ và tên *' : f === 'email' ? '📧 Email *' : '📞 Số điện thoại *'}
          value={form[f]}
          onChange={e => { setForm(v => ({ ...v, [e.target.name]: e.target.value })); setError('') }}
          required
          className="w-full border-2 border-gray-200 rounded-xl px-4 py-3.5 text-base focus:border-[#007a00] focus:outline-none transition-colors placeholder-gray-400 bg-white"
        />
      ))}
      {error && <p className="text-red-500 text-sm text-center bg-red-50 rounded-lg py-2 px-3">{error}</p>}
      <button type="submit" disabled={step === 'loading'}
        className={`w-full py-4 rounded-xl font-bold text-white text-lg transition-all active:scale-95 disabled:opacity-60 shadow-lg ${
          ctaColor === 'red'
            ? 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 shadow-red-200'
            : `bg-gradient-to-r ${C.btn} shadow-green-200`
        }`}>
        {step === 'loading'
          ? <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>Đang xử lý...
            </span>
          : ctaText}
      </button>
      <p className="text-xs text-gray-400 text-center">🔒 Thông tin được bảo mật tuyệt đối</p>
    </form>
  )
}

// ─── Payment Modal ────────────────────────────────────────────────────────────
function PaymentModal({ qr, onClose, onPaid }: { qr: QRData; onClose: () => void; onPaid: () => void }) {
  const [checking, setChecking] = useState(false)
  const [timeLeft, setTimeLeft] = useState(900)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => { const t = setInterval(() => setTimeLeft(v => Math.max(0, v - 1)), 1000); return () => clearInterval(t) }, [])
  useEffect(() => {
    pollRef.current = setInterval(async () => {
      try { const r = await fetch(`/api/check-payment?ref=${qr.paymentRef}`); if (r.ok && (await r.json()).paid) { clearInterval(pollRef.current!); onPaid() } } catch { /* silent */ }
    }, 5000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [qr.paymentRef, onPaid])

  const mm = Math.floor(timeLeft / 60).toString().padStart(2, '0')
  const ss = (timeLeft % 60).toString().padStart(2, '0')

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-[#006400] to-[#007a00] px-6 py-4 flex items-center justify-between">
          <div><h3 className="text-white font-bold text-lg">Thanh toán chuyển khoản</h3>
            <p className="text-green-200 text-sm">Quét mã QR hoặc chuyển khoản thủ công</p></div>
          <button onClick={onClose} className="text-white/80 hover:text-white text-2xl">&times;</button>
        </div>
        <div className="p-5">
          <div className="text-center mb-4">
            <span className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-full px-4 py-1.5 text-sm">
              <span className="text-amber-600">⏱ Hết hạn sau:</span>
              <span className="font-mono font-bold text-amber-700 text-lg">{mm}:{ss}</span>
            </span>
          </div>
          <div className="flex justify-center mb-4">
            <div className="p-2 rounded-xl border-2 border-gray-100 shadow-md bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr.qrUrl} alt="QR" className="w-44 h-44 object-contain"
                onError={e => { e.currentTarget.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`STK:${qr.bankAccount} NH:${qr.bankCode} ${formatPrice(qr.amount)} ND:${qr.content}`)}` }} />
            </div>
          </div>
          <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
            {[['Ngân hàng', qr.bankCode, false], ['Số tài khoản', qr.bankAccount, true], ['Chủ TK', qr.accountName.toUpperCase(), false], ['Số tiền', formatPrice(qr.amount), false]].map(([l, v, copy]) => (
              <div key={String(l)} className="flex justify-between">
                <span className="text-gray-500">{l}</span>
                {copy ? <button className="font-mono font-bold text-blue-600" onClick={() => navigator.clipboard?.writeText(String(v))}>{v} 📋</button>
                  : <span className="font-semibold text-gray-800">{v}</span>}
              </div>
            ))}
            <div className="flex justify-between items-center border-t pt-2">
              <span className="text-gray-500">Nội dung CK</span>
              <button className="font-mono font-bold text-red-600" onClick={() => navigator.clipboard?.writeText(qr.content)}>{qr.content} 📋</button>
            </div>
          </div>
          <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-xs text-yellow-800 text-center">
            ⚠️ <strong>Nhập đúng nội dung CK</strong> để hệ thống tự xác nhận
          </div>
          <button onClick={() => { setChecking(true); setTimeout(onPaid, 1000) }} disabled={checking}
            className="mt-4 w-full bg-[#006400] hover:bg-[#007a00] text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-60">
            {checking ? 'Đang kiểm tra...' : '✅ Tôi đã chuyển khoản xong'}
          </button>
          <p className="text-xs text-gray-400 text-center mt-2">Hệ thống tự xác nhận và gửi thông tin qua email trong vài phút</p>
        </div>
      </div>
    </div>
  )
}

// ─── Success Screen ───────────────────────────────────────────────────────────
function SuccessScreen({ type, name, onClose }: { type: 'gift' | 'course'; name: string; onClose: () => void }) {
  const courseGroupLink = process.env.NEXT_PUBLIC_COURSE_GROUP_LINK || '#'
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-sm w-full overflow-hidden shadow-2xl text-center">
        <div className={`px-6 py-8 bg-gradient-to-br ${type === 'course' ? 'from-[#006400] to-[#007a00]' : 'from-[#007a00] to-[#90EE90]'}`}>
          <div className="text-6xl mb-3">{type === 'course' ? '🎉' : '🎁'}</div>
          <h2 className="text-white text-2xl font-bold">{type === 'course' ? 'Thanh toán thành công!' : 'Đã gửi cho bạn!'}</h2>
          <p className="text-white/90 mt-1 text-sm">Xin chào {name} 👋</p>
        </div>
        <div className="p-6">
          {type === 'course' ? (
            <>
              <p className="text-gray-600 mb-5 leading-relaxed text-sm">Chúc mừng bạn đã tham gia <strong>Khóa học Dưa Cà Muối!</strong><br />Cô Hạ đã gửi thông tin chi tiết qua email.</p>
              <a href={courseGroupLink} target="_blank" rel="noopener noreferrer"
                className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl transition-colors">
                👥 Vào Group Học Viên Ngay
              </a>
              <p className="text-xs text-gray-400 mt-2">Video bài giảng đầy đủ trong group Facebook</p>
            </>
          ) : (
            <>
              <p className="text-gray-600 mb-4 leading-relaxed text-sm">
                Cô Hạ đã gửi <strong>Công Thức Cà Muối Mắm Giòn 7 Ngày</strong> vào email bạn.<br />
                Kiểm tra hộp thư nhé (kể cả spam)! 📬
              </p>
              <p className="text-gray-500 text-xs mb-3 font-semibold uppercase tracking-wide">Tham gia cộng đồng miễn phí của Cô Hạ:</p>
              <div className="space-y-2">
                {[
                  { icon: '👥', label: 'Nấu ăn cùng Cô Hạ', sub: 'Group tổng – chia sẻ & học hỏi', href: 'https://www.facebook.com/groups/nauancungcoha', color: 'bg-blue-600 hover:bg-blue-700' },
                  { icon: '📖', label: 'Công thức nấu ăn miễn phí', sub: 'Hàng trăm công thức từ Cô Hạ', href: 'https://www.facebook.com/groups/congthuccoha', color: 'bg-[#006400] hover:bg-[#007a00]' },
                  { icon: '📺', label: 'YouTube Cô Hạ Dạy Nấu Ăn', sub: 'Video hướng dẫn chi tiết', href: 'https://www.youtube.com/@Cohadaynauan8386/featured', color: 'bg-red-600 hover:bg-red-700' },
                  { icon: '🎵', label: 'TikTok Cô Hạ', sub: 'Clip ngắn, mẹo nấu ăn hay', href: 'https://www.tiktok.com/@hacasau', color: 'bg-gray-800 hover:bg-gray-900' },
                ].map(link => (
                  <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer"
                    className={`flex items-center gap-3 ${link.color} text-white px-4 py-2.5 rounded-xl transition-colors w-full text-left`}>
                    <span className="text-xl flex-shrink-0">{link.icon}</span>
                    <div>
                      <p className="font-bold text-sm leading-tight">{link.label}</p>
                      <p className="text-white/70 text-xs">{link.sub}</p>
                    </div>
                  </a>
                ))}
              </div>
            </>
          )}
          <button onClick={onClose} className="mt-4 text-gray-400 text-sm hover:text-gray-600 underline">Đóng</button>
        </div>
      </div>
    </div>
  )
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function KhoaHocDuaCaMuoi() {
  const countdown = useCountdown(24)
  const [giftSuccess, setGiftSuccess] = useState(false)
  const [giftName, setGiftName] = useState('')
  const [qrData, setQrData] = useState<QRData | null>(null)
  const [courseSuccess, setCourseSuccess] = useState(false)
  const [courseName, setCourseName] = useState('')
  const courseRef = useRef<HTMLDivElement>(null)
  const scrollToCourse = () => courseRef.current?.scrollIntoView({ behavior: 'smooth' })

  return (
    <div className="min-h-screen bg-[#F4FAF6] font-sans">

      {/* ══ HERO ══ */}
      <section className={`relative overflow-hidden bg-gradient-to-b ${C.hero} text-white`}>
        {/* subtle texture */}
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(circle at 25% 50%, white 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-10 pb-14">

          {/* Logo + ảnh Cô Hạ */}
          <div className="flex flex-col items-center mb-8 gap-5">
            {/* Logo text – không cần file ảnh */}
            <div className="bg-white rounded-2xl px-6 py-3 shadow-xl inline-flex items-center gap-3">
              <span className="text-3xl">🍳</span>
              <div>
                <p className="text-[#006400] font-extrabold text-xl leading-tight tracking-tight">Bếp Cô Hạ</p>
                <p className="text-gray-400 text-xs">Hacofood.vn</p>
              </div>
            </div>
            {/* Ảnh Cô Hạ tròn */}
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/co-ha-portrait.png"
                alt="Cô Hạ – Giảng viên dưa cà muối"
                className="w-40 h-40 sm:w-48 sm:h-48 object-cover object-top rounded-full border-4 border-white/80 shadow-2xl"
              />
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-white text-[#006400] font-bold text-xs px-3 py-1 rounded-full shadow whitespace-nowrap">
                👩‍🍳 Cô Hạ – Giảng viên
              </div>
            </div>
          </div>

          {/* Badge */}
          <div className="flex justify-center mb-5">
            <span className="bg-red-500 text-white text-sm font-bold px-5 py-1.5 rounded-full animate-bounce shadow">
              🔥 Ưu đãi đặc biệt – Chỉ hôm nay!
            </span>
          </div>

          {/* Headline */}
          <div className="text-center mb-8">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold leading-tight">
              Tại Sao Dưa Của Bạn<br />
              <span className="text-[#90EE90]">Bị Nhớt, Mau Hỏng, Màu Xỉn?</span>
            </h1>
            <p className="mt-4 text-green-200 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
              Vì bạn chưa biết <strong className="text-yellow-300">5 Bí Quyết Muối Chuẩn Vị</strong> của Cô Hạ —<br className="hidden sm:block" />
              Phương pháp giúp 149+ học viên làm được ngay từ lần đầu tiên
            </p>
          </div>

          {/* Stats */}
          <div className="flex flex-wrap justify-center gap-3 mb-8">
            {[
              { icon: '👩‍🍳', text: '149+ học viên' },
              { icon: '⭐', text: '5.0 đánh giá' },
              { icon: '📹', text: '20+ video' },
              { icon: '🔄', text: 'Học trọn đời' },
            ].map(s => (
              <div key={s.text} className="flex items-center gap-2 bg-white/10 backdrop-blur rounded-full px-4 py-2 text-sm border border-white/10">
                <span>{s.icon}</span><span className="font-medium">{s.text}</span>
              </div>
            ))}
          </div>

          <div className="flex justify-center">
            <button onClick={scrollToCourse}
              className="bg-white text-[#006400] font-bold text-lg px-8 py-4 rounded-2xl shadow-lg hover:bg-green-50 transition-colors">
              Xem Hệ Thống 5 Bí Quyết →
            </button>
          </div>
        </div>
      </section>

      {/* ══ GALLERY: THÀNH PHẨM ══ */}
      <section className="py-12 px-4 sm:px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-8">
            <span className="inline-block border border-[#90EE90] bg-[#f0fff0] text-[#006400] font-bold text-xs px-5 py-1.5 rounded-full tracking-widest mb-3">
              THÀNH PHẨM
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-800 mb-2">
              Những Hũ Dưa Cà <span className="text-[#006400]">Giòn Ngon, Đẹp Mắt</span>
            </h2>
            <p className="text-gray-400 text-sm max-w-lg mx-auto">
              Học xong là làm được ngay — tất cả đều do học viên Cô Hạ tự tay làm
            </p>
          </div>

          {/* Hàng 1: 3 ảnh cùng chiều cao cố định */}
          <div className="grid grid-cols-3 gap-3 mb-3 h-64 sm:h-80">
            {[
              { src: '/images/products/bo-suu-tap.jpg',        label: '🏆 Bộ sưu tập 6 món dưa cà',  objPos: 'object-center' },
              { src: '/images/products/ca-muoi-mam-cay.jpg',   label: 'Cà muối mắm cay',             objPos: 'object-top' },
              { src: '/images/products/dua-cu-cai-ca-rot.png', label: 'Dưa củ cải cà rốt',           objPos: 'object-center' },
            ].map(item => (
              <div key={item.label} className="relative rounded-2xl overflow-hidden group shadow-md h-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.src} alt={item.label}
                  className={`w-full h-full object-cover ${item.objPos} group-hover:scale-105 transition-transform duration-500`} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" />
                <p className="absolute bottom-2.5 left-3 text-white text-xs sm:text-sm font-semibold drop-shadow">{item.label}</p>
              </div>
            ))}
          </div>

          {/* Hàng 2: 4 ảnh vuông đều nhau */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { src: '/images/products/ca-muoi-xanh.png',  label: 'Cà muối xanh' },
              { src: '/images/products/sung-muoi.png',      label: 'Sung muối sả tắc' },
              { src: '/images/products/dua-bap-cai.png',    label: 'Dưa bắp cải' },
              { src: '/images/products/dua-cai-chua.png',   label: 'Dưa cải muối chua' },
            ].map(item => (
              <div key={item.label} className="relative rounded-xl overflow-hidden group shadow-sm" style={{ aspectRatio: '1/1' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.src} alt={item.label}
                  className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <p className="absolute bottom-2 left-2 text-white text-xs font-semibold drop-shadow">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ FLOW 1: GIFT FORM ══ */}
      <section className="py-16 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="text-center mb-10">
            <span className="text-3xl">🎁</span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-gray-800 mt-2 mb-3">
              Nhận Ngay Quà Tặng <span className="text-[#006400]">MIỄN PHÍ</span> Từ Cô Hạ
            </h2>
            <p className="text-gray-500 text-base max-w-xl mx-auto">
              Điền thông tin để nhận <strong>"3 Sai Lầm Khiến Dưa Bị Nhớt & Công Thức Cà Muối Mắm Giòn 7 Ngày Của Cô Hạ"</strong> – gửi vào email ngay lập tức!
            </p>
          </div>

          {/* 2-column on desktop, stacked on mobile */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12 items-center">
            {/* Left: Video preview */}
            <div className="flex flex-col items-center gap-4">
              <YTShort id="hv52ihJTWKU" title="Video Cà Muối Mắm miễn phí" />
              <p className="text-sm text-gray-500 text-center italic">
                🎬 Preview video quà tặng – nhận full công thức qua email!
              </p>
            </div>

            {/* Right: Form */}
            <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 border border-green-100">
              {/* Benefits */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                {[
                  { icon: '🚫', title: '3 sai lầm khiến dưa bị nhớt', desc: 'Tránh ngay từ lần đầu' },
                  { icon: '✅', title: 'Công thức tỷ lệ nước ngâm chuẩn', desc: 'Tỷ lệ chuẩn, dễ làm' },
                  { icon: '⚡', title: 'Gửi vào email trong 60 giây', desc: 'Nhận ngay lập tức' },
                  { icon: '🆓', title: 'Không cần trả phí', desc: 'Miễn phí hoàn toàn' },
                ].map(b => (
                  <div key={b.title} className="flex items-start gap-2.5 bg-green-50 rounded-xl p-3">
                    <span className="text-xl">{b.icon}</span>
                    <div>
                      <p className="font-semibold text-gray-800 text-xs">{b.title}</p>
                      <p className="text-gray-400 text-xs">{b.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <LeadForm ctaText="🎁 Gửi Công Thức Cho Tôi Ngay!" ctaColor="green"
                onSuccess={d => { setGiftName(d.name); setGiftSuccess(true) }} />
            </div>
          </div>
        </div>
      </section>

      {/* ══ FLOW 2: COURSE ══ */}
      <section ref={courseRef} id="khoa-hoc" className="py-16 px-4 sm:px-6 scroll-mt-4">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="text-center mb-10">
            <span className="inline-block bg-[#006400] text-[#90EE90] font-bold text-xs px-4 py-1.5 rounded-full mb-4 tracking-widest uppercase">
              Khóa học chuyên sâu
            </span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-gray-800 mb-4">
              Hệ Thống 5 Bí Quyết Muối Chuẩn Vị –<br />
              <span className="text-[#006400]">Từ Gia Đình Đến Kinh Doanh</span>
            </h2>
            <p className="text-gray-500 max-w-2xl mx-auto text-base leading-relaxed">
              Cô Hạ đã dạy <strong>149+ học viên</strong> — hơn 90% làm được ngay trong tuần đầu tiên.<br />
              Phương pháp của Cô Hạ khác ở chỗ: dạy cả <strong>LÝ DO</strong> đằng sau từng bước —
              không chỉ dạy làm theo, mà dạy để bạn <strong>HIỂU và tự điều chỉnh.</strong>
            </p>
          </div>

          {/* Video intro + course content side by side on desktop */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-10 items-center">
            {/* Video */}
            <div className="flex flex-col items-center gap-3">
              <YTShort id="tF_SRl4Ue3U" title="Giới thiệu khóa học Dưa Cà Muối" size="lg" />
              <p className="text-sm text-gray-500 italic text-center">📹 Xem trước nội dung khóa học</p>
            </div>

            {/* Course content */}
            <div className="space-y-5">

              {/* Pain Points */}
              <div className="bg-red-50 rounded-2xl p-5 border border-red-200">
                <h3 className="font-bold text-red-700 text-base mb-3">❌ Bạn có đang gặp những vấn đề này không?</h3>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex items-start gap-2"><span className="text-red-500 mt-0.5">•</span><span>Làm dưa xong bị nhớt, có mùi lạ → không ai dám ăn</span></li>
                  <li className="flex items-start gap-2"><span className="text-red-500 mt-0.5">•</span><span>Không biết tỷ lệ nước muối chuẩn → lần nào cũng phải đoán mò</span></li>
                  <li className="flex items-start gap-2"><span className="text-red-500 mt-0.5">•</span><span>Màu dưa xỉn, trông không ngon mắt</span></li>
                  <li className="flex items-start gap-2"><span className="text-red-500 mt-0.5">•</span><span>Để vài ngày là mềm, không giòn</span></li>
                  <li className="flex items-start gap-2"><span className="text-red-500 mt-0.5">•</span><span>Muốn bán nhưng không tự tin vào chất lượng</span></li>
                </ul>
                <p className="mt-3 text-sm font-semibold text-[#006400]">✅ Tất cả những vấn đề trên đều có giải pháp trong khóa học này.</p>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
                <h3 className="font-bold text-gray-800 text-lg mb-4">📚 Bạn sẽ học được gì?</h3>
                <ul className="space-y-3">
                  {[
                    ['🥬', 'Dưa cải bẹ muối chua', 'Đúng chuẩn, không bị nhớt, ăn giòn'],
                    ['🥒', 'Dưa góp', 'Màu đẹp, chua ngọt vừa miệng'],
                    ['🍅', 'Sung cà muối chua ngọt', 'Bí quyết giữ được lâu không hỏng'],
                    ['🥕', 'Dưa củ cải cà rốt', 'Đủ màu sắc, làm quà biếu rất sang'],
                    ['🌶️', 'Cà muối mắm', 'Thơm đậm đà, chuẩn vị Nam Bộ'],
                  ].map(([icon, title, desc]) => (
                    <li key={String(title)} className="flex items-start gap-3">
                      <span className="text-xl flex-shrink-0">{icon}</span>
                      <div>
                        <p className="font-semibold text-gray-800 text-sm">{title}</p>
                        <p className="text-gray-400 text-xs">{desc}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Value Stack */}
              <div className="bg-[#f0fff0] rounded-2xl p-5 border border-[#90ee90]">
                <h3 className="font-bold text-[#006400] text-base mb-4">🎁 NHỮNG GÌ BẠN NHẬN ĐƯỢC<br /><span className="text-sm font-normal text-gray-500">(Tổng trị giá: 1.095.000đ)</span></h3>
                <ul className="space-y-3 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-[#007a00] font-bold text-base flex-shrink-0">✅</span>
                    <div className="flex-1">
                      <div className="flex justify-between items-start gap-2">
                        <span className="font-semibold text-gray-800">5 Video Công Thức Dưa Cà Muối Từ A-Z</span>
                        <span className="text-[#006400] font-bold whitespace-nowrap">399.000đ</span>
                      </div>
                      <p className="text-gray-400 text-xs">(Dưa cải, dưa góp, sung muối, củ cải, cà muối mắm)</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#007a00] font-bold text-base flex-shrink-0">✅</span>
                    <div className="flex-1">
                      <div className="flex justify-between items-start gap-2">
                        <span className="font-semibold text-gray-800">"Bảng Tỷ Lệ Nước Ngâm Chuẩn Vị 5 Món"</span>
                        <span className="text-[#006400] font-bold whitespace-nowrap">99.000đ</span>
                      </div>
                      <p className="text-gray-400 text-xs">Không bao giờ nhầm tỷ lệ — dùng mãi mãi</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#007a00] font-bold text-base flex-shrink-0">✅</span>
                    <div className="flex-1">
                      <div className="flex justify-between items-start gap-2">
                        <span className="font-semibold text-gray-800">"Checklist 12 Dấu Hiệu Chọn Nguyên Liệu Tươi"</span>
                        <span className="text-[#006400] font-bold whitespace-nowrap">99.000đ</span>
                      </div>
                      <p className="text-gray-400 text-xs">Mua đúng ngay từ lần đầu tại chợ</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#007a00] font-bold text-base flex-shrink-0">✅</span>
                    <div className="flex-1">
                      <div className="flex justify-between items-start gap-2">
                        <span className="font-semibold text-gray-800">"Bí Quyết Bảo Quản Giữ Dưa Giòn 30 Ngày"</span>
                        <span className="text-[#006400] font-bold whitespace-nowrap">99.000đ</span>
                      </div>
                      <p className="text-gray-400 text-xs">Không cần tủ lạnh — phù hợp bán hàng</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#007a00] font-bold text-base flex-shrink-0">✅</span>
                    <div className="flex-1">
                      <div className="flex justify-between items-start gap-2">
                        <span className="font-semibold text-gray-800">Group Hỗ Trợ Học Viên 24/7 mãi mãi</span>
                        <span className="text-[#006400] font-bold whitespace-nowrap">399.000đ</span>
                      </div>
                      <p className="text-gray-400 text-xs">Hỏi gì cũng có người trả lời</p>
                    </div>
                  </li>
                </ul>
                <div className="mt-4 pt-3 border-t border-[#90ee90]">
                  <div className="flex justify-between text-sm text-gray-500 mb-1">
                    <span>Tổng giá trị:</span>
                    <span className="line-through">1.095.000đ</span>
                  </div>
                  <div className="flex justify-between font-extrabold text-base text-[#006400]">
                    <span>Giá hôm nay:</span>
                    <span>chỉ 299.000đ ← Tiết kiệm 796.000đ</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Pricing + Form full width below */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            {/* Testimonials */}
            <div className="space-y-4">
              <h3 className="font-bold text-gray-700 text-base">💬 Học viên nói gì?</h3>
              {[
                { name: 'Chị Lan – Hà Nội', text: 'Học xong là làm được ngay, cả nhà khen nức nở! Mấy hũ dưa cải của tôi giờ không đủ bán 😄', av: '👩' },
                { name: 'Chị Mai – TP.HCM', text: 'Công thức chi tiết lắm, Cô Hạ giải thích rõ ràng từng bước. Đáng tiền lắm chị em ơi!', av: '👩‍🦱' },
                { name: 'Chị Hương – Đà Nẵng', text: 'Tôi mở hàng bán dưa cà sau khi học khóa này, khách phản hồi rất tốt 🙏', av: '👩‍🦳' },
                { name: 'Chị Thảo – Cần Thơ', text: 'Trước giờ tôi muối cà hay bị nhũn, học bí quyết của Cô Hạ xong là hết lỗi luôn. Cà giòn đều từng hũ!', av: '👩' },
                { name: 'Anh Tùng – Hải Phòng', text: 'Vợ tôi học xong rồi bán online, một tháng thêm được vài triệu. Cô Hạ dạy rất tận tâm, chu đáo!', av: '👨' },
                { name: 'Chị Ngọc – Bình Dương', text: 'Giờ tự muối đủ loại dưa cho gia đình, không cần mua ngoài nữa. Sạch hơn, an toàn hơn, ngon hơn!', av: '👩‍🦰' },
              ].map(t => (
                <div key={t.name} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">{t.av}</span>
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">{t.name}</p>
                      <span className="text-amber-400 text-xs">★★★★★</span>
                    </div>
                  </div>
                  <p className="text-gray-600 text-sm italic">"{t.text}"</p>
                </div>
              ))}
            </div>

            {/* Pricing card */}
            <div>
              {/* Countdown */}
              <div className="bg-red-600 text-white rounded-2xl p-4 mb-4 text-center">
                <p className="text-sm text-red-100 mb-2">⚡ Giá Đặc Biệt Chỉ Còn:</p>
                <div className="flex justify-center gap-3">
                  {[{ v: countdown.h.toString().padStart(2, '0'), l: 'Giờ' }, { v: countdown.m.toString().padStart(2, '0'), l: 'Phút' }, { v: countdown.s.toString().padStart(2, '0'), l: 'Giây' }].map(({ v, l }) => (
                    <div key={l} className="bg-white/20 rounded-lg px-3 py-2 min-w-[52px]">
                      <div className="font-mono text-2xl font-bold">{v}</div>
                      <div className="text-xs text-red-200">{l}</div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-red-200 mt-2">(Sau khi hết ưu đãi → giá trở về 299.000đ)</p>
              </div>

              <div className="bg-white rounded-2xl shadow-2xl border-2 border-[#90ee90] overflow-hidden">
                <div className="bg-gradient-to-r from-[#006400] to-[#007a00] px-6 py-5 text-center">
                  <p className="text-white/70 text-sm line-through mb-1">Giá gốc: 999.000đ</p>
                  <span className="text-white text-5xl font-extrabold">299.000đ</span>
                  <div className="mt-2">
                    <span className="inline-block bg-yellow-400 text-yellow-900 text-sm font-bold px-3 py-1 rounded-full">
                      Tiết kiệm 861.000đ – Giảm 86%!
                    </span>
                  </div>
                </div>
                <div className="p-6">
                  <LeadForm ctaText="🎓 Đăng ký học – 299.000đ" ctaColor="red"
                    onSuccess={(d: FormData & { qr?: QRData; paymentRef?: string }) => {
                      setCourseName(d.name)
                      if (d.qr) setQrData({ ...d.qr, paymentRef: d.paymentRef || '' })
                    }} />
                  <div className="mt-5 pt-4 border-t border-gray-100 grid grid-cols-2 gap-3">
                    {[{ icon: '🔒', text: 'Thanh toán an toàn' }, { icon: '📱', text: 'Học online mọi lúc' }, { icon: '🔄', text: 'Xem lại không giới hạn' }, { icon: '💬', text: 'Hỗ trợ 24/7' }].map(i => (
                      <div key={i.text} className="flex items-center gap-1.5 text-xs text-gray-500">
                        <span>{i.icon}</span><span>{i.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Cam kết */}
              <div className="mt-4 bg-[#f0fff0] border border-[#90ee90] rounded-xl p-4 text-center">
                <div className="text-2xl mb-1">🌟</div>
                <p className="font-bold text-[#006400] text-sm">Cam Kết Đầu Ra Của Cô Hạ</p>
                <p className="text-[#007a00] text-xs mt-1 leading-relaxed">
                  Sau khi học xong, bạn tự làm được ít nhất 3 món dưa cà muối giòn ngon chuẩn vị.<br />
                  Nếu làm đúng theo hướng dẫn mà chưa được — Cô Hạ hỗ trợ 1-1 trong group đến khi làm được.<br />
                  Truy cập video & tài liệu mãi mãi, cập nhật công thức mới miễn phí.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ ABOUT CÔ HẠ ══ */}
      <section className="py-16 px-4 sm:px-6 bg-[#F4FAF6]">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
            <div className="flex justify-center order-last md:order-first">
              <div className="relative">
                <div className="rounded-3xl overflow-hidden shadow-2xl max-w-xs sm:max-w-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/images/co-ha-portrait.png" alt="Cô Hạ Dạy Nấu Ăn" className="w-full object-cover" />
                </div>
                <div className="absolute -bottom-4 -right-4 bg-[#006400] text-white rounded-2xl px-4 py-2.5 shadow-lg">
                  <p className="font-extrabold text-base">6+ năm</p>
                  <p className="text-green-200 text-xs">dạy nấu ăn</p>
                </div>
              </div>
            </div>
            <div>
              <span className="inline-block bg-[#006400] text-[#90EE90] font-bold text-xs px-4 py-1.5 rounded-full mb-4 tracking-widest uppercase">Giáo viên trực tiếp</span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-800 mb-5">
                Cô Hạ – Người Truyền Lửa<br /><span className="text-[#006400]">Căn Bếp Việt</span>
              </h2>
              <div className="space-y-4 text-gray-600 text-sm leading-relaxed">
                <p><strong className="text-gray-800">Cô Hạ Dạy Nấu Ăn</strong> là thương hiệu thuộc HACO Food, do chính Cô Hạ trực tiếp đứng lớp và truyền nghề. Hơn 6 năm qua, Cô Hạ đã dạy hàng nghìn học viên cách làm những món truyền thống đậm vị Việt, từ bữa cơm gia đình hằng ngày đến các món dưa cà muối giòn ngon, sạch và an toàn cho cả nhà.</p>
                <p>Trong khoá học Dưa Cà Muối, Cô Hạ chia sẻ <strong>Hệ Thống 5 Bí Quyết Muối Chuẩn Vị</strong> đã được đúc kết qua nhiều năm, hướng dẫn từng bước dễ làm tại nhà, để ai cũng có thể tự tay muối được hũ dưa, hũ cà giòn thơm, để được lâu mà vẫn giữ trọn hương vị quê nhà.</p>
                <p className="italic text-[#006400] font-medium border-l-4 border-[#90EE90] pl-4">"Cô Hạ tin rằng một bữa cơm Việt trọn vẹn luôn cần thêm chút dưa, chút cà, và đó cũng là cách giữ lửa căn bếp gia đình bằng những điều giản dị nhất."</p>
              </div>
              <div className="flex flex-wrap gap-2 mt-6">
                {['6+ năm kinh nghiệm', 'Hàng nghìn học viên', 'HACO Food', 'Ẩm thực truyền thống Việt'].map(tag => (
                  <span key={tag} className="bg-white text-[#006400] text-xs font-semibold px-3 py-1.5 rounded-full border border-green-200 shadow-sm">{tag}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ FAQ ══ */}
      <section className="py-12 px-4 sm:px-6 bg-white">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center text-gray-800 mb-8">❓ Câu hỏi thường gặp</h2>
          <div className="space-y-3">
            {[
              { q: 'Tôi chưa bao giờ làm dưa, học được không?', a: 'Được! Khóa học thiết kế cho người hoàn toàn mới bắt đầu. Nhiều học viên của Cô Hạ chưa bao giờ làm dưa trước đó — sau tuần đầu họ đã có hũ dưa giòn ngon để cả nhà ăn thử.' },
              { q: 'Sau bao lâu thì làm được?', a: 'Ngay sau bài học đầu tiên bạn đã có thể làm được món cơ bản. Phần lớn học viên hoàn thành cả 5 món trong vòng 2 tuần.' },
              { q: 'Khóa học này học ở đâu?', a: 'Sau khi thanh toán, bạn được mời vào nhóm Facebook riêng của học viên. Toàn bộ video bài giảng có trong group, xem được trên điện thoại hoặc máy tính bất cứ lúc nào.' },
              { q: 'Tôi không biết nấu ăn có học được không?', a: 'Hoàn toàn được! Cô Hạ dạy từng bước từ cơ bản. Chưa biết nấu ăn vẫn làm được ngay sau khi xem video.' },
              { q: 'Thanh toán như thế nào?', a: 'Chuyển khoản qua QR code hoặc chuyển khoản thủ công. Sau khi chuyển, hệ thống tự xác nhận và gửi link group qua email trong vài phút.' },
              { q: 'Tôi có thể học lại nhiều lần không?', a: 'Có! Xem video không giới hạn số lần và thời gian. Group học viên luôn mở, Cô Hạ tiếp tục cập nhật công thức mới miễn phí.' },
              { q: 'Sau khi đăng ký, tôi nhận được gì?', a: 'Bạn nhận email xác nhận và link mời vào group Facebook học viên riêng tư. Toàn bộ video bài giảng, công thức và tài liệu đều có trong group, truy cập được ngay lập tức.' },
              { q: 'Khóa học có phù hợp để kinh doanh không?', a: 'Rất phù hợp! Nhiều học viên dùng công thức của Cô Hạ để mở hàng bán online thành công. Cô Hạ cũng chia sẻ cách làm số lượng lớn và bảo quản được lâu để bán.' },
              { q: 'Nếu làm không thành công thì sao?', a: 'Trong group học viên, bạn có thể hỏi Cô Hạ và đội ngũ hỗ trợ bất cứ lúc nào. Cô Hạ trực tiếp giải đáp từng thắc mắc cho đến khi bạn làm được thành công.' },
            ].map(item => (
              <details key={item.q} className="bg-gray-50 rounded-xl border border-gray-200 group">
                <summary className="px-5 py-4 font-semibold text-gray-800 cursor-pointer flex justify-between items-center hover:text-[#006400] transition-colors text-sm sm:text-base">
                  {item.q}
                  <span className="text-gray-400 group-open:rotate-180 transition-transform text-xs ml-2 flex-shrink-0">▼</span>
                </summary>
                <p className="px-5 pb-4 text-gray-600 text-sm leading-relaxed">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ══ FINAL CTA ══ */}
      <section className={`py-16 px-4 bg-gradient-to-b ${C.hero} text-white text-center`}>
        <div className="max-w-2xl mx-auto">
          <div className="text-5xl mb-4">🥒</div>
          <h2 className="text-2xl sm:text-3xl font-extrabold mb-4">
            Còn chờ gì nữa? Mỗi ngày bạn chưa học là một ngày:
          </h2>
          <ul className="text-green-200 mb-6 text-base text-left max-w-md mx-auto space-y-2">
            <li className="flex items-start gap-2"><span className="text-yellow-300 mt-0.5">•</span><span>Tiếp tục đoán mò tỷ lệ → dưa vẫn bị nhớt</span></li>
            <li className="flex items-start gap-2"><span className="text-yellow-300 mt-0.5">•</span><span>Bỏ lỡ cơ hội có thêm thu nhập từ dưa cà muối</span></li>
            <li className="flex items-start gap-2"><span className="text-yellow-300 mt-0.5">•</span><span>Vẫn phải mua ngoài thay vì tự làm ngon hơn, sạch hơn, rẻ hơn</span></li>
          </ul>
          <p className="text-green-200 mb-8 text-lg">
            Chỉ <strong className="text-yellow-300 text-2xl">299.000đ</strong> — ít hơn 1 bữa ăn ngoài hàng —<br />
            bạn có <strong className="text-yellow-300">Hệ Thống 5 Bí Quyết Muối Chuẩn Vị</strong> cho cả đời!
          </p>
          <button onClick={scrollToCourse}
            className="bg-white text-[#006400] font-extrabold text-xl px-10 py-5 rounded-2xl shadow-xl hover:bg-green-50 transition-colors">
            🎓 Đăng ký ngay – 299.000đ
          </button>
        </div>
      </section>

      {/* ══ FOOTER ══ */}
      <footer className="bg-[#003200] text-green-400/60 text-center py-6 px-4 text-sm">
        <p>© 2025 Bếp Cô Hạ – <a href="https://hacofood.vn" className="text-[#90EE90] hover:underline">Hacofood.vn</a></p>
        <p className="mt-1">Chuyên đào tạo dưa cà muối & ẩm thực truyền thống Việt Nam</p>
      </footer>

      {/* ══ MODALS ══ */}
      {qrData && !courseSuccess && (
        <PaymentModal qr={qrData} onClose={() => setQrData(null)} onPaid={() => { setQrData(null); setCourseSuccess(true) }} />
      )}
      {courseSuccess && <SuccessScreen type="course" name={courseName} onClose={() => setCourseSuccess(false)} />}
      {giftSuccess && <SuccessScreen type="gift" name={giftName} onClose={() => setGiftSuccess(false)} />}
    </div>
  )
}
