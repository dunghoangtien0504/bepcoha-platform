'use client'

import { useState, useEffect, useCallback } from 'react'

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
}

function fmt(n: number) { return n.toLocaleString('vi-VN') + 'đ' }
function fmtDate(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ── Login Screen ──────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }: { onLogin: (pw: string) => void }) {
  const [pw, setPw] = useState('')
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
    else { setErr('Mật khẩu không đúng') }
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
            <input
              type="password"
              value={pw}
              onChange={e => { setPw(e.target.value); setErr('') }}
              placeholder="Nhập mật khẩu admin..."
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-base focus:border-[#43A047] focus:outline-none transition-colors"
              autoFocus
            />
          </div>
          {err && <p className="text-red-500 text-sm text-center bg-red-50 rounded-xl py-2">{err}</p>}
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

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Tổng đăng ký', value: stats.total, color: 'blue', icon: '👥' },
              { label: 'Đã thanh toán', value: stats.paid, color: 'green', icon: '✅' },
              { label: 'Chờ thanh toán', value: stats.pending, color: 'amber', icon: '⏳' },
              { label: 'Tổng doanh thu', value: fmt(stats.revenue), color: 'purple', icon: '💰', isText: true },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-gray-500 text-xs font-medium">{s.label}</p>
                    <p className={`font-black text-2xl mt-1 ${
                      s.color === 'green' ? 'text-green-600' :
                      s.color === 'blue' ? 'text-blue-600' :
                      s.color === 'amber' ? 'text-amber-600' : 'text-purple-600'
                    }`}>{'isText' in s && s.isText ? s.value : s.value}</p>
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
