'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

interface ConversationMessage {
  id?: string
  from_customer: boolean
  sender_name?: string
  content: string
  timestamp?: string
}

interface Conversation {
  id: string  // pancake conversation_id
  page_id: string
  customer_id: string
  customer_name: string
  customer_phone: string
  platform: string
  page_name: string
  last_message_preview: string
  last_message_at: string
  messages: ConversationMessage[]
  messages_loaded: boolean
  ai_summary: string | null
  customer_needs: string | null
  sales_name: string | null
  sales_evaluation: string | null
  ai_score: number | null
  needs_attention: boolean | null
  issue: string | null
  tags: string[] | null
  analyzed_at: string | null
  evaluation_score: number | null
  evaluation_label: string | null
  evaluation_note: string | null
  evaluated_at: string | null
}

interface AiOrder {
  id: number
  poscake_order_id: string | null
  customer_name: string
  customer_phone: string
  customer_address: string | null
  items: Array<{ variation_id: string; product_name: string; quantity: number }>
  confidence: number | null
  status: 'created' | 'failed' | 'pending'
  source: string
  note: string | null
  created_at: string
}

interface Lead {
  id: number
  name: string
  email: string
  phone: string
  payment_ref: string
  payment_status: string
  amount: number
  paid_at: string | null
  created_at: string
  course_name: string
}

interface Stats {
  total: number
  paid: number
  pending: number
  revenue: number
  pendingRevenue: number
}

function fmt(n: number) { return n.toLocaleString('vi-VN') + 'đ' }
function fmtDate(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ── Login Screen ──────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }: { onLogin: (pw: string) => void }) {
  const [pw, setPw] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pw.trim()) return
    setLoading(true); setErr('')
    const res = await fetch('/api/portal/leads', {
      headers: { Authorization: `Bearer ${pw.trim()}` },
    })
    setLoading(false)
    if (res.ok) { onLogin(pw.trim()) }
    else if (res.status === 401) { setErr('Mật khẩu không đúng') }
    else { setErr(`Lỗi server (${res.status}) — kiểm tra DATABASE_URL trong Vercel`) }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0D2B0D] to-[#1A3C1A] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="bg-gradient-to-r from-[#1B5E20] to-[#2E7D32] px-8 py-8 text-center">
          <div className="text-5xl mb-3">🍳</div>
          <h1 className="text-white font-black text-xl">Bếp Cô Hạ</h1>
          <p className="text-green-200 text-sm mt-1">Admin Portal</p>
        </div>
        <form onSubmit={handleSubmit} className="p-8 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Mật khẩu</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={pw}
                onChange={e => { setPw(e.target.value); setErr('') }}
                placeholder="Nhập mật khẩu admin..."
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 pr-12 text-base focus:border-[#43A047] focus:outline-none transition-colors"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1"
                tabIndex={-1}
              >
                {showPw ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>
          {err && <p className="text-red-500 text-sm text-center bg-red-50 rounded-xl py-2 px-3">{err}</p>}
          <button type="submit" disabled={loading}
            className="w-full py-3.5 rounded-xl font-black text-white text-base bg-gradient-to-r from-[#2E7D32] to-[#43A047] hover:from-[#1B5E20] hover:to-[#2E7D32] disabled:opacity-60 transition-all shadow-lg">
            {loading ? 'Đang kiểm tra...' : '🔓 Đăng nhập'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function Dashboard({ token, onLogout }: { token: string; onLogout: () => void }) {
  const [tab, setTab] = useState<'leads' | 'ai-orders' | 'conversations'>('leads')
  const [leads, setLeads] = useState<Lead[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [course, setCourse] = useState('all')
  const [status, setStatus] = useState('all')
  const [search, setSearch] = useState('')

  const fetchLeads = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (course !== 'all') params.set('course', course)
    if (status !== 'all') params.set('status', status)
    const res = await fetch('/api/portal/leads?' + params.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      const data = await res.json()
      setLeads(data.leads)
      setStats(data.stats)
    }
    setLoading(false)
  }, [token, course, status])

  useEffect(() => { fetchLeads() }, [fetchLeads])

  const filtered = leads.filter(l => {
    if (!search) return true
    const q = search.toLowerCase()
    return l.name.toLowerCase().includes(q) || l.email.toLowerCase().includes(q) || l.phone.includes(q) || l.payment_ref.toLowerCase().includes(q)
  })

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-[#1B5E20] to-[#2E7D32] px-4 py-4 sticky top-0 z-10 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🍳</span>
            <div>
              <h1 className="text-white font-black text-lg leading-none">Bếp Cô Hạ</h1>
              <p className="text-green-300 text-xs">Admin Portal · hacofood.vn</p>
            </div>
          </div>
          {/* Tab switcher */}
          <div className="flex items-center gap-1 bg-white/20 rounded-xl p-1">
            <button onClick={() => setTab('leads')}
              className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${tab === 'leads' ? 'bg-white text-[#1B5E20]' : 'text-white/80 hover:text-white'}`}>
              📊 Học viên
            </button>
            <button onClick={() => setTab('ai-orders')}
              className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${tab === 'ai-orders' ? 'bg-white text-[#1B5E20]' : 'text-white/80 hover:text-white'}`}>
              🤖 AI Đơn hàng
            </button>
            <button onClick={() => setTab('conversations')}
              className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${tab === 'conversations' ? 'bg-white text-[#1B5E20]' : 'text-white/80 hover:text-white'}`}>
              💬 Hội thoại
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={fetchLeads}
              className="bg-white/20 hover:bg-white/30 text-white text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors">
              🔄 Tải lại
            </button>
            <button onClick={onLogout}
              className="bg-red-500/80 hover:bg-red-600 text-white text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors">
              Đăng xuất
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">

        {/* AI Orders Tab */}
        {tab === 'ai-orders' && <AiOrdersTab token={token} />}

        {/* Conversations Tab */}
        {tab === 'conversations' && <ConversationsTab token={token} />}

        {/* Leads Tab */}
        {tab === 'leads' && <>

      {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
            {[
              { label: 'Tổng đăng ký', value: stats.total, color: 'blue', icon: '👥' },
              { label: 'Đã thanh toán', value: stats.paid, color: 'green', icon: '✅' },
              { label: 'Chờ thanh toán', value: stats.pending, color: 'amber', icon: '⏳' },
              { label: 'Doanh thu đã TT', value: fmt(stats.revenue), color: 'purple', icon: '💰', isText: true },
              { label: 'Doanh thu chưa TT', value: fmt(stats.pendingRevenue), color: 'red', icon: '⏰', isText: true },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-gray-500 text-xs font-medium">{s.label}</p>
                    <p className={`font-black text-2xl mt-1 ${
                      s.color === 'green' ? 'text-green-600' :
                      s.color === 'blue' ? 'text-blue-600' :
                      s.color === 'amber' ? 'text-amber-600' :
                      s.color === 'red' ? 'text-red-500' : 'text-purple-600'
                    }`}>{s.value}</p>
                  </div>
                  <span className="text-2xl">{s.icon}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Course filter */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
              {[
                { val: 'all', label: 'Tất cả khóa' },
                { val: 'dua-ca', label: '🥒 Dưa Cà Muối' },
                { val: 'rau-ma', label: '🌿 Rau Má ĐX' },
              ].map(({ val, label }) => (
                <button key={val} onClick={() => setCourse(val)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${course === val ? 'bg-white text-[#1B5E20] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                  {label}
                </button>
              ))}
            </div>

            {/* Status filter */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
              {[
                { val: 'all', label: 'Tất cả' },
                { val: 'paid', label: '✅ Đã TT' },
                { val: 'pending', label: '⏳ Chờ TT' },
              ].map(({ val, label }) => (
                <button key={val} onClick={() => setStatus(val)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${status === val ? 'bg-white text-[#1B5E20] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                  {label}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <input
                type="text"
                placeholder="🔍 Tìm tên, email, SĐT, mã GD..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-[#43A047] focus:outline-none"
              />
            </div>

            <span className="text-gray-400 text-sm ml-auto whitespace-nowrap">
              {filtered.length} / {leads.length} học viên
            </span>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-gray-400">
              <div className="text-center">
                <div className="text-4xl mb-3 animate-pulse">⏳</div>
                <p>Đang tải dữ liệu...</p>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex items-center justify-center py-20 text-gray-400">
              <div className="text-center">
                <div className="text-4xl mb-3">🔍</div>
                <p>Không tìm thấy học viên nào</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    {['#', 'Họ tên', 'Email', 'SĐT', 'Khóa học', 'Mã GD', 'Số tiền', 'Trạng thái', 'Đăng ký', 'Thanh toán'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((l, i) => (
                    <tr key={l.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                      <td className="px-4 py-3 font-semibold text-gray-800 whitespace-nowrap">{l.name}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        <a href={`mailto:${l.email}`} className="hover:text-[#2E7D32] hover:underline">{l.email}</a>
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        <a href={`tel:${l.phone}`} className="hover:text-[#2E7D32]">{l.phone}</a>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${
                          l.course_name === 'Dưa Cà Muối'
                            ? 'bg-orange-100 text-orange-700'
                            : l.course_name === 'Rau Má Đậu Xanh'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}>
                          {l.course_name === 'Dưa Cà Muối' ? '🥒' : l.course_name === 'Rau Má Đậu Xanh' ? '🌿' : '?'} {l.course_name}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <code className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-700 font-mono">{l.payment_ref}</code>
                      </td>
                      <td className="px-4 py-3 font-bold text-gray-800 whitespace-nowrap">{fmt(l.amount)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${
                          l.payment_status === 'paid'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}>
                          {l.payment_status === 'paid' ? '✅ Đã TT' : '⏳ Chờ TT'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{fmtDate(l.created_at)}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{fmtDate(l.paid_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Export hint */}
        <p className="text-center text-gray-400 text-xs mt-4">
          Dữ liệu tự động làm mới khi đổi bộ lọc · Click tên/email/SĐT để liên hệ
        </p>
        </>}
      </div>
    </div>
  )
}

// ── Conversations Tab ─────────────────────────────────────────────────────────
const EVAL_LABELS = [
  { key: 'order',    label: 'Đặt hàng',       color: 'bg-green-100 text-green-700 border-green-300' },
  { key: 'inquiry',  label: 'Hỏi thông tin',   color: 'bg-blue-100 text-blue-700 border-blue-300' },
  { key: 'no_buy',   label: 'Không mua',        color: 'bg-amber-100 text-amber-700 border-amber-300' },
  { key: 'ai_wrong', label: 'AI sai',           color: 'bg-red-100 text-red-600 border-red-300' },
  { key: 'need_staff',label: 'Cần NV hỗ trợ',  color: 'bg-purple-100 text-purple-700 border-purple-300' },
]

function labelStyle(key: string | null) {
  const found = EVAL_LABELS.find(l => l.key === key)
  return found ? found.color : 'bg-gray-100 text-gray-500 border-gray-200'
}
function labelText(key: string | null) {
  return EVAL_LABELS.find(l => l.key === key)?.label ?? 'Chưa đánh giá'
}

function ConversationsTab({ token }: { token: string }) {
  const [convs, setConvs] = useState<Conversation[]>([])
  const [selected, setSelected] = useState<Conversation | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [filter, setFilter] = useState<'all' | 'unevaluated' | 'attention' | 'order' | 'no_buy'>('all')
  const [search, setSearch] = useState('')
  const [score, setScore] = useState(0)
  const [label, setLabel] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [msgWarning, setMsgWarning] = useState('')
  const [showMessages, setShowMessages] = useState(false)
  const [batchRunning, setBatchRunning] = useState(false)
  const [batchProgress, setBatchProgress] = useState({ done: 0, total: 0 })
  const [showReport, setShowReport] = useState(false)

  const fetchConvs = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/portal/conversations', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) { const d = await res.json(); setConvs(d.conversations) }
    setLoading(false)
  }, [token])

  useEffect(() => { fetchConvs() }, [fetchConvs])

  // Gọi AI phân tích nhu cầu khách + đánh giá phiên trả lời sales (khai báo trước, dùng ở dưới)
  const analyze = useCallback(async (c: Conversation) => {
    setAnalyzing(true)
    try {
      const res = await fetch(`/api/portal/conversations/${c.id}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: c.customer_name,
          page_name: c.page_name,
          page_id: c.page_id,
          customer_id: c.customer_id,
        }),
      })
      if (res.ok) {
        const d = await res.json()
        const patch = {
          ai_summary: d.ai_summary ?? null,
          customer_needs: d.customer_needs ?? null,
          sales_name: d.sales_name ?? null,
          sales_evaluation: d.sales_evaluation ?? null,
          ai_score: d.ai_score ?? null,
          needs_attention: d.needs_attention ?? false,
          issue: d.issue || null,
          tags: d.tags ?? [],
          evaluation_label: d.outcome ?? null,
          analyzed_at: new Date().toISOString(),
        }
        setSelected(prev => prev && prev.id === c.id ? { ...prev, ...patch } : prev)
        setConvs(prev => prev.map(x => x.id === c.id ? { ...x, ...patch } : x))
        setLabel(d.outcome ?? '')
      }
    } finally {
      setAnalyzing(false)
    }
  }, [token])

  // Phân tích hàng loạt. force=true: phân tích lại cả những cái đã phân tích.
  const analyzeAll = useCallback(async (force = false) => {
    const pending = force ? convs.slice() : convs.filter(c => !c.analyzed_at)
    if (!pending.length) return
    setBatchRunning(true)
    setBatchProgress({ done: 0, total: pending.length })
    for (let i = 0; i < pending.length; i++) {
      const c = pending[i]
      try {
        const res = await fetch(`/api/portal/conversations/${c.id}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customer_name: c.customer_name, page_name: c.page_name,
            page_id: c.page_id, customer_id: c.customer_id,
          }),
        })
        if (res.ok) {
          const d = await res.json()
          const patch = {
            ai_summary: d.ai_summary ?? null,
            customer_needs: d.customer_needs ?? null,
            sales_name: d.sales_name ?? null,
            sales_evaluation: d.sales_evaluation ?? null,
            ai_score: d.ai_score ?? null,
            needs_attention: d.needs_attention ?? false,
            issue: d.issue || null,
            tags: d.tags ?? [],
            evaluation_label: d.outcome ?? null,
            analyzed_at: new Date().toISOString(),
          }
          setConvs(prev => prev.map(x => x.id === c.id ? { ...x, ...patch } : x))
        }
      } catch { /* bỏ qua lỗi từng cái */ }
      setBatchProgress({ done: i + 1, total: pending.length })
    }
    setBatchRunning(false)
  }, [convs, token])

  // Tự động phân tích toàn bộ ngay khi tải xong (chỉ chạy 1 lần / lần vào tab)
  const autoRan = useRef(false)
  useEffect(() => {
    if (!loading && !autoRan.current && convs.some(c => !c.analyzed_at)) {
      autoRan.current = true
      analyzeAll()
    }
  }, [loading, convs, analyzeAll])

  const selectConv = async (c: Conversation) => {
    setSelected(c)
    setScore(c.evaluation_score ?? c.ai_score ?? 0)
    setLabel(c.evaluation_label ?? '')
    setNote(c.evaluation_note ?? '')
    setMsgWarning('')
    setShowMessages(false)

    // Lazy load messages nếu chưa có
    let merged = c
    if (!c.messages_loaded) {
      setLoadingMsgs(true)
      try {
        const qs = new URLSearchParams({ page_id: c.page_id, customer_id: c.customer_id })
        const res = await fetch(`/api/portal/conversations/${c.id}?${qs.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const d = await res.json()
          if (d.warning) setMsgWarning(d.warning)
          merged = {
            ...c,
            messages: d.messages || [],
            messages_loaded: true,
            ai_summary: d.ai_summary ?? c.ai_summary,
            customer_needs: d.customer_needs ?? c.customer_needs,
            sales_name: d.sales_name ?? c.sales_name,
            sales_evaluation: d.sales_evaluation ?? c.sales_evaluation,
            ai_score: d.ai_score ?? c.ai_score,
            needs_attention: d.needs_attention ?? c.needs_attention,
            issue: d.issue ?? c.issue,
            tags: d.tags ?? c.tags,
            analyzed_at: d.analyzed_at ?? c.analyzed_at,
            evaluation_score: d.evaluation_score ?? c.evaluation_score,
            evaluation_label: d.evaluation_label ?? c.evaluation_label,
            evaluation_note: d.evaluation_note ?? c.evaluation_note,
          }
          setSelected(merged)
          setScore(merged.evaluation_score ?? merged.ai_score ?? 0)
          setLabel(merged.evaluation_label ?? '')
          setNote(merged.evaluation_note ?? '')
          setConvs(prev => prev.map(x => x.id === c.id ? merged : x))
        }
      } finally {
        setLoadingMsgs(false)
      }
    }

    // AI tự phân tích nếu chưa từng phân tích & có tin nhắn
    if (!merged.analyzed_at && merged.messages.length > 0) {
      analyze(merged)
    }
  }

  const saveEval = async () => {
    if (!selected) return
    setSaving(true)
    await fetch(`/api/portal/conversations/${selected.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ score, label, note, customer_name: selected.customer_name, page_name: selected.page_name }),
    })
    setSaving(false)
    setSelected(prev => prev ? { ...prev, evaluation_score: score, evaluation_label: label, evaluation_note: note } : null)
    setConvs(prev => prev.map(c => c.id === selected.id ? { ...c, evaluation_score: score, evaluation_label: label, evaluation_note: note } : c))
  }

  const filtered = convs.filter(c => {
    if (filter === 'unevaluated' && c.analyzed_at) return false
    if (filter === 'attention' && !c.needs_attention) return false
    if (filter === 'order' && c.evaluation_label !== 'order') return false
    if (filter === 'no_buy' && c.evaluation_label !== 'no_buy') return false
    if (search) {
      const q = search.toLowerCase()
      return c.customer_name.toLowerCase().includes(q) || c.customer_phone.includes(q) || c.page_name.toLowerCase().includes(q)
    }
    return true
  })

  // Điểm hiển thị ưu tiên điểm người chỉnh tay, fallback điểm AI
  const effScore = (c: Conversation) => c.evaluation_score ?? c.ai_score
  const withScore = convs.filter(c => effScore(c))
  const flagged = convs.filter(c => c.needs_attention)
  const pendingCount = convs.filter(c => !c.analyzed_at).length

  // Gom thống kê theo nhân viên sales (từ sales_name của hội thoại đã phân tích)
  const bySales: Record<string, { count: number; scoreSum: number; scoreN: number; attention: number }> = {}
  convs.forEach(c => {
    if (!c.sales_name) return
    const k = c.sales_name
    if (!bySales[k]) bySales[k] = { count: 0, scoreSum: 0, scoreN: 0, attention: 0 }
    bySales[k].count++
    const s = effScore(c)
    if (s) { bySales[k].scoreSum += s; bySales[k].scoreN++ }
    if (c.needs_attention) bySales[k].attention++
  })
  const salesList = Object.entries(bySales).sort((a, b) => b[1].count - a[1].count)
  const stats = {
    total: convs.length,
    analyzed: convs.filter(c => c.analyzed_at).length,
    attention: flagged.length,
    avgScore: withScore.length
      ? (withScore.reduce((a, c) => a + (effScore(c) || 0), 0) / withScore.length).toFixed(1)
      : '—',
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Tổng hội thoại', value: stats.total, color: 'text-blue-600' },
          { label: 'Đã phân tích AI', value: stats.analyzed, color: 'text-purple-600' },
          { label: 'Điểm sales TB', value: `${stats.avgScore}★`, color: 'text-amber-600' },
          { label: 'Cần xử lý', value: stats.attention, color: stats.attention ? 'text-red-600' : 'text-gray-400', alert: true },
        ].map(s => (
          <button key={s.label} type="button"
            onClick={() => s.alert && stats.attention ? (setFilter('attention'), setShowReport(true)) : undefined}
            className={`text-left bg-white rounded-2xl p-4 shadow-sm border transition-colors ${s.alert && stats.attention ? 'border-red-200 hover:border-red-400 cursor-pointer' : 'border-gray-100 cursor-default'}`}>
            <p className="text-gray-500 text-xs font-medium">{s.label}{s.alert && stats.attention ? ' ⚠️' : ''}</p>
            <p className={`font-black text-2xl mt-1 ${s.color}`}>{s.value}</p>
          </button>
        ))}
      </div>

      {/* Thanh công cụ: phân tích tất cả + báo cáo */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3 flex flex-wrap items-center gap-3">
        <button onClick={() => analyzeAll(pendingCount === 0)} disabled={batchRunning || !convs.length}
          className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors disabled:opacity-50">
          {batchRunning
            ? `Đang phân tích ${batchProgress.done}/${batchProgress.total}...`
            : pendingCount ? `🤖 Phân tích tất cả (${pendingCount})` : '🔄 Phân tích lại tất cả'}
        </button>
        {batchRunning && (
          <div className="flex-1 min-w-[120px] h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-purple-500 transition-all" style={{ width: `${batchProgress.total ? Math.round(batchProgress.done / batchProgress.total * 100) : 0}%` }} />
          </div>
        )}
        <button onClick={() => setShowReport(v => !v)}
          className="text-sm font-semibold px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors ml-auto">
          📊 Báo cáo tổng quan {stats.attention > 0 && <span className="text-red-500">({stats.attention} ⚠️)</span>}
        </button>
      </div>

      {/* Báo cáo tổng quan + vấn đề khách hàng cần CEO xử lý */}
      {showReport && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div><p className="text-2xl font-black text-blue-600">{stats.total}</p><p className="text-xs text-gray-500">Hội thoại</p></div>
            <div><p className="text-2xl font-black text-purple-600">{stats.analyzed}</p><p className="text-xs text-gray-500">Đã phân tích</p></div>
            <div><p className="text-2xl font-black text-amber-500">{stats.avgScore}★</p><p className="text-xs text-gray-500">Điểm sales TB</p></div>
            <div><p className={`text-2xl font-black ${stats.attention ? 'text-red-600' : 'text-green-600'}`}>{stats.attention}</p><p className="text-xs text-gray-500">Cần xử lý</p></div>
          </div>

          {/* Thống kê theo nhân viên sales */}
          <div>
            <p className="text-sm font-bold text-gray-700 mb-2">
              👥 Thống kê theo nhân viên {salesList.length > 0 && <span className="text-gray-400 font-normal">({salesList.length} người)</span>}
            </p>
            {salesList.length === 0 ? (
              <p className="text-sm text-gray-400 bg-gray-50 rounded-xl p-3 text-center">Chưa có dữ liệu — bấm &quot;Phân tích tất cả&quot;</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 text-xs">
                      <th className="px-3 py-2 text-left font-semibold">Nhân viên</th>
                      <th className="px-3 py-2 text-center font-semibold">Hội thoại</th>
                      <th className="px-3 py-2 text-center font-semibold">Điểm TB</th>
                      <th className="px-3 py-2 text-center font-semibold">Cần xử lý</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {salesList.map(([name, s]) => (
                      <tr key={name} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium text-gray-800">{name}</td>
                        <td className="px-3 py-2 text-center text-gray-600">{s.count}</td>
                        <td className="px-3 py-2 text-center text-amber-500 font-semibold">
                          {s.scoreN ? (s.scoreSum / s.scoreN).toFixed(1) + '★' : '—'}
                        </td>
                        <td className={`px-3 py-2 text-center font-semibold ${s.attention ? 'text-red-600' : 'text-gray-400'}`}>
                          {s.attention || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div>
            <p className="text-sm font-bold text-gray-700 mb-2">🚨 Vấn đề khách hàng cần can thiệp</p>
            {flagged.length === 0 ? (
              <p className="text-sm text-gray-400 bg-gray-50 rounded-xl p-3 text-center">Không có vấn đề hệ trọng nào 🎉</p>
            ) : (
              <div className="space-y-2">
                {flagged.map(c => (
                  <button key={c.id} onClick={() => selectConv(c)}
                    className="w-full text-left flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-3 hover:border-red-400 transition-colors">
                    <span className="text-lg">⚠️</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-gray-800">{c.customer_name}</span>
                        <span className="text-xs text-gray-400">{c.page_name}</span>
                        {c.customer_phone && <span className="text-xs text-gray-500">· {c.customer_phone}</span>}
                      </div>
                      <p className="text-sm text-red-700 leading-relaxed mt-0.5">{c.issue}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main panel: list + detail */}
      <div className="grid grid-cols-[280px_1fr_240px] gap-3" style={{ minHeight: '520px' }}>

        {/* LEFT: Conversation list */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
          <div className="p-3 border-b border-gray-100 space-y-2">
            <input
              placeholder="Tìm tên, SĐT..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-[#43A047]"
            />
            <div className="flex gap-1 flex-wrap">
              {[
                { k: 'all', label: 'Tất cả' },
                { k: 'attention', label: '⚠️ Cần xử lý' },
                { k: 'unevaluated', label: 'Chưa phân tích' },
                { k: 'order', label: 'Đặt hàng' },
                { k: 'no_buy', label: 'Không mua' },
              ].map(f => (
                <button key={f.k} onClick={() => setFilter(f.k as typeof filter)}
                  className={`text-xs px-2 py-1 rounded-lg border transition-all ${filter === f.k ? 'bg-[#1B5E20] text-white border-[#1B5E20]' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-y-auto flex-1">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-gray-400 text-sm">Đang tải...</div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400 text-sm gap-2">
                <span className="text-3xl">💬</span>
                <span>Chưa có hội thoại</span>
              </div>
            ) : filtered.map(c => (
              <button key={c.id} onClick={() => selectConv(c)} className={`w-full text-left p-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${selected?.id === c.id ? 'bg-green-50 border-l-2 border-l-[#2E7D32]' : ''}`}>
                <div className="flex justify-between items-start mb-1">
                  <span className="font-medium text-sm text-gray-800 truncate pr-2">
                    {c.needs_attention && <span className="text-red-500">⚠️ </span>}{c.customer_name || 'Khách ẩn danh'}
                  </span>
                  <span className="text-xs text-gray-400 whitespace-nowrap">{c.page_name}</span>
                </div>
                <div className="text-xs text-gray-500 truncate mb-1.5">
                  {c.customer_needs
                    ? <span className="text-purple-600 font-medium">🎯 {c.customer_needs.slice(0, 60)}…</span>
                    : c.last_message_preview || '(chưa có tin nhắn)'}
                </div>
                <div className="flex gap-1.5 flex-wrap items-center">
                  {c.evaluation_label
                    ? <span className={`text-xs px-2 py-0.5 rounded-full border ${labelStyle(c.evaluation_label)}`}>{labelText(c.evaluation_label)}</span>
                    : <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 border border-gray-200">Chưa phân tích</span>
                  }
                  {(c.evaluation_score ?? c.ai_score)
                    ? <span className="text-xs text-amber-500">{'★'.repeat(c.evaluation_score ?? c.ai_score ?? 0)}</span>
                    : null}
                  {c.sales_name && <span className="text-xs text-gray-400 truncate">· {c.sales_name}</span>}
                </div>
                {c.tags && c.tags.length > 0 && (
                  <div className="flex gap-1 flex-wrap mt-1">
                    {c.tags.map((t, i) => (
                      <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 border border-indigo-100">{t}</span>
                    ))}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* CENTER: Chat view */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
          {!selected ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3">
              <span className="text-5xl">💬</span>
              <p className="text-sm">Chọn hội thoại để xem</p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="p-3 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center text-xs font-bold text-green-800">
                    {(selected.customer_name || 'K').slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{selected.customer_name || 'Khách ẩn danh'}</p>
                    <p className="text-xs text-gray-400">{selected.page_name} · {selected.customer_phone || ''}</p>
                  </div>
                </div>
                <button onClick={() => analyze(selected)} disabled={analyzing || loadingMsgs}
                  className="text-xs px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-semibold disabled:opacity-50 transition-colors">
                  {analyzing ? 'Đang phân tích...' : selected.analyzed_at ? '🔄 Phân tích lại' : '✨ Phân tích AI'}
                </button>
              </div>

              {/* AI analysis */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {loadingMsgs ? (
                  <div className="flex items-center justify-center py-12 text-gray-400 text-sm gap-2">
                    <div className="animate-spin text-xl">⏳</div> Đang tải tin nhắn...
                  </div>
                ) : (
                  <>
                    {analyzing && !selected.customer_needs && (
                      <div className="flex items-center justify-center py-8 text-purple-400 text-sm gap-2">
                        <div className="animate-spin text-xl">✨</div> AI đang phân tích...
                      </div>
                    )}

                    {msgWarning && (
                      <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg">⚠️ {msgWarning}</div>
                    )}

                    {/* Cảnh báo vấn đề hệ trọng */}
                    {selected.needs_attention && selected.issue && (
                      <div className="bg-red-50 border-2 border-red-300 rounded-xl p-3">
                        <p className="text-xs font-bold text-red-700 mb-1">🚨 Vấn đề cần xử lý</p>
                        <p className="text-sm text-red-800 leading-relaxed">{selected.issue}</p>
                      </div>
                    )}

                    {/* Tags theo vấn đề */}
                    {selected.tags && selected.tags.length > 0 && (
                      <div className="flex gap-1.5 flex-wrap">
                        {selected.tags.map((t, i) => (
                          <span key={i} className="text-xs px-2 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 font-medium">🏷️ {t}</span>
                        ))}
                      </div>
                    )}

                    {/* Nhu cầu khách */}
                    {selected.customer_needs && (
                      <div className="bg-purple-50 border border-purple-200 rounded-xl p-3">
                        <p className="text-xs font-bold text-purple-700 mb-1">🎯 Nhu cầu khách hàng</p>
                        <p className="text-sm text-purple-900 leading-relaxed">{selected.customer_needs}</p>
                      </div>
                    )}

                    {/* Đánh giá phiên trả lời của sales */}
                    {selected.sales_evaluation && (
                      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs font-bold text-blue-700">💼 Đánh giá phiên trả lời</p>
                          {selected.ai_score && <span className="text-xs text-amber-500 font-bold">{'★'.repeat(selected.ai_score)} ({selected.ai_score}/5)</span>}
                        </div>
                        {selected.sales_name && <p className="text-xs text-blue-600 mb-1">👤 Sales trả lời: <b>{selected.sales_name}</b></p>}
                        <p className="text-sm text-blue-900 leading-relaxed">{selected.sales_evaluation}</p>
                      </div>
                    )}

                    {!selected.customer_needs && !analyzing && selected.messages.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-12 text-gray-400 text-sm gap-2">
                        <span className="text-3xl">💬</span>
                        <span>Chưa có tin nhắn để phân tích</span>
                      </div>
                    )}

                    {/* Tin nhắn gốc (thu gọn) */}
                    {selected.messages.length > 0 && (
                      <div className="border border-gray-100 rounded-xl overflow-hidden">
                        <button onClick={() => setShowMessages(v => !v)}
                          className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                          <span>💬 Tin nhắn gốc ({selected.messages.length})</span>
                          <span>{showMessages ? '▲' : '▼'}</span>
                        </button>
                        {showMessages && (
                          <div className="p-3 space-y-2 border-t border-gray-100 max-h-72 overflow-y-auto">
                            {selected.messages.map((msg, i) => (
                              <div key={i} className={`flex gap-2 items-end ${!msg.from_customer ? 'flex-row-reverse' : ''}`}>
                                <div className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold ${msg.from_customer ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                                  {msg.from_customer ? 'KH' : 'NV'}
                                </div>
                                <div className={`max-w-[78%] px-3 py-2 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap ${msg.from_customer
                                  ? 'bg-[#1B5E20] text-white rounded-bl-sm'
                                  : 'bg-gray-100 text-gray-800 rounded-br-sm'}`}>
                                  {!msg.from_customer && msg.sender_name && <span className="block text-[10px] text-gray-400 mb-0.5">{msg.sender_name}</span>}
                                  {msg.content}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {/* RIGHT: Evaluation panel */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
          <div className="p-3 border-b border-gray-100 font-medium text-sm text-gray-700">
            📋 Đánh giá phiên sales
          </div>
          {!selected ? (
            <div className="flex items-center justify-center flex-1 text-sm text-gray-400 p-4 text-center">
              Chọn 1 hội thoại để đánh giá
            </div>
          ) : (
            <div className="p-4 space-y-4 overflow-y-auto flex-1">
              {/* Stars */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-gray-600">Điểm phiên trả lời</p>
                  {selected.ai_score != null && (
                    <span className="text-[10px] text-purple-500">AI chấm: {selected.ai_score}★</span>
                  )}
                </div>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map(s => (
                    <button key={s} onClick={() => setScore(s)}
                      className={`text-2xl transition-colors ${s <= score ? 'text-amber-400' : 'text-gray-200'}`}>
                      ★
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-gray-400 mt-1">AI tự chấm khi mở · bạn có thể chỉnh lại</p>
              </div>

              {/* Labels */}
              <div>
                <p className="text-xs font-medium text-gray-600 mb-2">Kết quả hội thoại</p>
                <div className="flex flex-wrap gap-1.5">
                  {EVAL_LABELS.map(l => (
                    <button key={l.key} onClick={() => setLabel(label === l.key ? '' : l.key)}
                      className={`text-xs px-2.5 py-1.5 rounded-lg border transition-all ${label === l.key ? l.color : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Note */}
              <div>
                <p className="text-xs font-medium text-gray-600 mb-2">Ghi chú</p>
                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  rows={3}
                  placeholder="Nhận xét về hội thoại này..."
                  className="w-full text-xs border border-gray-200 rounded-xl p-2.5 focus:outline-none focus:border-[#43A047] resize-none text-gray-800"
                />
              </div>

              {/* Tỷ lệ thống kê */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-lg font-black text-green-600">
                    {convs.length ? Math.round(convs.filter(c => c.evaluation_label === 'order').length / convs.length * 100) : 0}%
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">Tỷ lệ chốt</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-lg font-black text-amber-500">{stats.avgScore}★</p>
                  <p className="text-xs text-gray-500 mt-0.5">Điểm TB</p>
                </div>
              </div>

              <button onClick={saveEval} disabled={saving || (!score && !label && !note)}
                className="w-full py-2.5 bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50">
                {saving ? 'Đang lưu...' : '💾 Lưu đánh giá'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── AI Orders Tab ─────────────────────────────────────────────────────────────
function AiOrdersTab({ token }: { token: string }) {
  const [orders, setOrders] = useState<AiOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/portal/ai-orders', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      const data = await res.json()
      setOrders(data.orders)
    }
    setLoading(false)
  }, [token])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  const filtered = orders.filter(o => {
    if (!search) return true
    const q = search.toLowerCase()
    return o.customer_name.toLowerCase().includes(q) ||
      o.customer_phone.includes(q) ||
      (o.customer_address || '').toLowerCase().includes(q) ||
      (o.poscake_order_id || '').includes(q)
  })

  const stats = {
    total: orders.length,
    created: orders.filter(o => o.status === 'created').length,
    failed: orders.filter(o => o.status === 'failed').length,
  }

  return (
    <div className="space-y-4">
      {/* Mini stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Tổng đơn AI', value: stats.total, icon: '🤖', color: 'blue' },
          { label: 'Thành công', value: stats.created, icon: '✅', color: 'green' },
          { label: 'Thất bại', value: stats.failed, icon: '❌', color: 'red' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-xs font-medium">{s.label}</p>
                <p className={`font-black text-2xl mt-1 ${
                  s.color === 'green' ? 'text-green-600' :
                  s.color === 'red' ? 'text-red-500' : 'text-blue-600'
                }`}>{s.value}</p>
              </div>
              <span className="text-2xl">{s.icon}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Webhook URL hint */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-800">
        <p className="font-bold mb-1">📡 Webhook URL để cấu hình trong Pancake CRM:</p>
        <code className="bg-white px-3 py-1 rounded-lg text-xs font-mono break-all">
          https://hacofood.vn/api/webhook/pancake-ai
        </code>
        <p className="text-xs mt-2 text-amber-600">Pancake CRM → Tiện ích → Webhook-API → Thêm URL trên</p>
      </div>

      {/* Search + Refresh */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="🔍 Tìm tên, SĐT, địa chỉ, mã đơn..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-[#43A047] focus:outline-none"
          />
          <button onClick={fetchOrders}
            className="bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
            🔄 Tải lại
          </button>
        </div>
      </div>

      {/* Orders table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <div className="text-center"><div className="text-3xl mb-2 animate-pulse">🤖</div><p>Đang tải đơn hàng AI...</p></div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <div className="text-center">
              <div className="text-3xl mb-2">📭</div>
              <p>Chưa có đơn hàng từ AI Agent</p>
              <p className="text-xs mt-1">Cấu hình webhook Pancake ở trên để bắt đầu</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['#', 'Mã Poscake', 'Khách hàng', 'SĐT', 'Địa chỉ', 'Sản phẩm', 'Kênh', 'Độ chính xác', 'Trạng thái', 'Thời gian'].map(h => (
                    <th key={h} className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((o, i) => (
                  <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-3 py-3 text-gray-400 text-xs">{i + 1}</td>
                    <td className="px-3 py-3">
                      {o.poscake_order_id
                        ? <code className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded font-mono">{o.poscake_order_id}</code>
                        : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="px-3 py-3 font-semibold text-gray-800 whitespace-nowrap">{o.customer_name}</td>
                    <td className="px-3 py-3 text-gray-600 whitespace-nowrap">
                      <a href={`tel:${o.customer_phone}`} className="hover:text-[#2E7D32]">{o.customer_phone}</a>
                    </td>
                    <td className="px-3 py-3 text-gray-500 text-xs max-w-[180px] truncate" title={o.customer_address || ''}>{o.customer_address || '—'}</td>
                    <td className="px-3 py-3 text-xs text-gray-700 whitespace-nowrap">
                      {o.items?.map((item, idx) => (
                        <span key={idx} className="inline-block bg-orange-50 text-orange-700 px-1.5 py-0.5 rounded mr-1">
                          {item.product_name} ×{item.quantity}
                        </span>
                      ))}
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-400 whitespace-nowrap">{o.source}</td>
                    <td className="px-3 py-3 text-xs">
                      {o.confidence != null
                        ? <span className={`font-bold ${o.confidence >= 0.85 ? 'text-green-600' : o.confidence >= 0.7 ? 'text-amber-600' : 'text-red-500'}`}>
                            {Math.round(o.confidence * 100)}%
                          </span>
                        : '—'}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${
                        o.status === 'created' ? 'bg-green-100 text-green-700' :
                        o.status === 'failed' ? 'bg-red-100 text-red-600' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {o.status === 'created' ? '✅ Đã tạo' : o.status === 'failed' ? '❌ Lỗi' : '⏳ Chờ'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-gray-400 text-xs whitespace-nowrap">{fmtDate(o.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function PortalPage() {
  const [token, setToken] = useState<string | null>(null)

  useEffect(() => {
    const saved = sessionStorage.getItem('haco_portal_token')
    if (saved) setToken(saved)
  }, [])

  const handleLogin = (pw: string) => {
    sessionStorage.setItem('haco_portal_token', pw)
    setToken(pw)
  }

  const handleLogout = () => {
    sessionStorage.removeItem('haco_portal_token')
    setToken(null)
  }

  if (!token) return <LoginScreen onLogin={handleLogin} />
  return <Dashboard token={token} onLogout={handleLogout} />
}
