'use client'

import { useState, useEffect, useCallback } from 'react'
import type { GiftLead, CourseLead } from '@/lib/db'

interface AdminData {
  giftLeads: GiftLead[]
  courseLeads: CourseLead[]
  stats: {
    totalGiftLeads: number
    totalCourseLeads: number
    paidLeads: number
    revenue: number
  }
}

function formatVND(n: number) {
  return n.toLocaleString('vi-VN') + 'đ'
}

export default function AdminPage() {
  const [password, setPassword] = useState('')
  const [authed, setAuthed] = useState(false)
  const [data, setData] = useState<AdminData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'gift' | 'course'>('course')
  const [search, setSearch] = useState('')

  const fetchData = useCallback(async (pw: string) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin-data', {
        headers: { 'x-admin-password': pw },
      })
      if (!res.ok) throw new Error('Sai mật khẩu')
      const json = await res.json()
      setData(json)
      setAuthed(true)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Lỗi')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    fetchData(password)
  }

  const exportCSV = (type: 'gift' | 'course') => {
    if (!data) return
    const rows = type === 'gift' ? data.giftLeads : data.courseLeads
    const headers = type === 'gift'
      ? ['ID', 'Tên', 'Email', 'SĐT', 'Thời gian', 'Email gửi']
      : ['ID', 'Tên', 'Email', 'SĐT', 'Mã GD', 'Trạng thái', 'Số tiền', 'Thanh toán lúc', 'Thời gian']

    const csvContent = [
      headers.join(','),
      ...rows.map((r) => {
        if (type === 'gift') {
          const g = r as GiftLead
          return [g.id, `"${g.name}"`, g.email, g.phone, g.created_at, g.email_sent ? 'Có' : 'Không'].join(',')
        } else {
          const c = r as CourseLead
          return [c.id, `"${c.name}"`, c.email, c.phone, c.payment_ref, c.payment_status, c.amount, c.paid_at || '', c.created_at].join(',')
        }
      }),
    ].join('\n')

    const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${type === 'gift' ? 'qua-tang' : 'khoa-hoc'}-leads-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Auto-refresh every 30s
  useEffect(() => {
    if (!authed) return
    const id = setInterval(() => fetchData(password), 30000)
    return () => clearInterval(id)
  }, [authed, password, fetchData])

  if (!authed) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm">
          <div className="text-center mb-6">
            <div className="text-4xl mb-2">🔐</div>
            <h1 className="text-xl font-bold text-gray-800">Admin – Hacofood.vn</h1>
            <p className="text-gray-500 text-sm mt-1">Trang quản lý khóa học Dưa Cà Muối</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="password"
              placeholder="Mật khẩu admin"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-amber-400 focus:outline-none"
            />
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-60"
            >
              {loading ? 'Đang tải...' : 'Đăng nhập'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  const filteredGift = data?.giftLeads.filter(
    (l) => l.name.includes(search) || l.email.includes(search) || l.phone.includes(search)
  ) || []

  const filteredCourse = data?.courseLeads.filter(
    (l) => l.name.includes(search) || l.email.includes(search) || l.phone.includes(search)
  ) || []

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-bold text-gray-800 text-lg">🥒 Admin – Khóa học Dưa Cà Muối</h1>
            <p className="text-gray-400 text-xs">Hacofood.vn</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchData(password)}
              className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
            >
              🔄 Làm mới
            </button>
            <button
              onClick={() => { setAuthed(false); setData(null) }}
              className="text-sm text-red-500 hover:text-red-700"
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats */}
        {data && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Lượt nhận quà', value: data.stats.totalGiftLeads, icon: '🎁', color: 'amber' },
              { label: 'Đăng ký khóa học', value: data.stats.totalCourseLeads, icon: '📝', color: 'blue' },
              { label: 'Đã thanh toán', value: data.stats.paidLeads, icon: '✅', color: 'green' },
              { label: 'Doanh thu', value: formatVND(data.stats.revenue), icon: '💰', color: 'purple' },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <div className="text-2xl mb-2">{s.icon}</div>
                <div className="text-2xl font-bold text-gray-800">{s.value}</div>
                <div className="text-gray-500 text-sm">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Search & Tabs */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex gap-2">
              <button
                onClick={() => setTab('course')}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${tab === 'course' ? 'bg-amber-100 text-amber-700' : 'text-gray-500 hover:bg-gray-100'}`}
              >
                💳 Đăng ký khóa học ({data?.stats.totalCourseLeads || 0})
              </button>
              <button
                onClick={() => setTab('gift')}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${tab === 'gift' ? 'bg-amber-100 text-amber-700' : 'text-gray-500 hover:bg-gray-100'}`}
              >
                🎁 Nhận quà ({data?.stats.totalGiftLeads || 0})
              </button>
            </div>
            <div className="flex gap-2 md:ml-auto">
              <input
                type="text"
                placeholder="🔍 Tìm tên, email, SĐT..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-400 w-48"
              />
              <button
                onClick={() => exportCSV(tab)}
                className="bg-green-500 hover:bg-green-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                📥 Xuất CSV
              </button>
            </div>
          </div>

          {/* Course leads table */}
          {tab === 'course' && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3 text-left">ID</th>
                    <th className="px-4 py-3 text-left">Tên</th>
                    <th className="px-4 py-3 text-left">Email</th>
                    <th className="px-4 py-3 text-left">SĐT</th>
                    <th className="px-4 py-3 text-left">Mã GD</th>
                    <th className="px-4 py-3 text-left">Trạng thái</th>
                    <th className="px-4 py-3 text-left">Thời gian</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredCourse.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Chưa có dữ liệu</td></tr>
                  ) : filteredCourse.map((lead) => (
                    <tr key={lead.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-400">#{lead.id}</td>
                      <td className="px-4 py-3 font-medium text-gray-800">{lead.name}</td>
                      <td className="px-4 py-3 text-gray-600">{lead.email}</td>
                      <td className="px-4 py-3 text-gray-600">{lead.phone}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{lead.payment_ref}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${lead.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          {lead.payment_status === 'paid' ? '✅ Đã TT' : '⏳ Chờ TT'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{lead.created_at}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Gift leads table */}
          {tab === 'gift' && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3 text-left">ID</th>
                    <th className="px-4 py-3 text-left">Tên</th>
                    <th className="px-4 py-3 text-left">Email</th>
                    <th className="px-4 py-3 text-left">SĐT</th>
                    <th className="px-4 py-3 text-left">Email</th>
                    <th className="px-4 py-3 text-left">Thời gian</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredGift.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Chưa có dữ liệu</td></tr>
                  ) : filteredGift.map((lead) => (
                    <tr key={lead.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-400">#{lead.id}</td>
                      <td className="px-4 py-3 font-medium text-gray-800">{lead.name}</td>
                      <td className="px-4 py-3 text-gray-600">{lead.email}</td>
                      <td className="px-4 py-3 text-gray-600">{lead.phone}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${lead.email_sent ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                          {lead.email_sent ? '✅ Đã gửi' : '⏳ Chưa gửi'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{lead.created_at}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
