'use client'

import { useState, useEffect, useCallback } from 'react'
import type { GiftLead, CourseLead, Staff, AuditLogWithStaff, CourseSettings } from '@/lib/db'

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

type Tab = 'gift' | 'course' | 'staff' | 'audit' | 'settings'

function formatVND(n: number) {
  return n.toLocaleString('vi-VN') + 'đ'
}

function formatDateTime(dt: string) {
  return new Date(dt).toLocaleString('vi-VN')
}

export default function AdminPage() {
  // Auth state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authed, setAuthed] = useState(false)
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Data state
  const [data, setData] = useState<AdminData | null>(null)
  const [staff, setStaff] = useState<Staff[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLogWithStaff[]>([])
  const [courseSettings, setCourseSettings] = useState<CourseSettings | null>(null)

  // UI state
  const [tab, setTab] = useState<Tab>('course')
  const [search, setSearch] = useState('')

  // Staff form
  const [newStaffForm, setNewStaffForm] = useState({ name: '', email: '', password: '', role: 'staff' })
  const [staffLoading, setStaffLoading] = useState(false)
  const [staffError, setStaffError] = useState('')

  // Settings form
  const [settingsForm, setSettingsForm] = useState<CourseSettings | null>(null)
  const [settingsLoading, setSettingsLoading] = useState(false)

  // Audit filters
  const [auditAction, setAuditAction] = useState('')
  const [auditTable, setAuditTable] = useState('')

  const fetchAdminData = useCallback(async (t: string) => {
    try {
      const res = await fetch('/api/admin-data', {
        headers: { 'x-admin-password': process.env.NEXT_PUBLIC_ADMIN_PASSWORD || 'hacofood2024' },
      })
      if (!res.ok) throw new Error('Sai mật khẩu')
      const json = await res.json()
      setData(json)
    } catch (e: unknown) {
      console.error('Error fetching admin data:', e)
    }
  }, [])

  const fetchStaff = useCallback(async (t: string) => {
    try {
      const res = await fetch('/api/staff', {
        headers: { 'Authorization': `Bearer ${t}` },
      })
      if (!res.ok) throw new Error('Không thể tải danh sách nhân viên')
      const json = await res.json()
      setStaff(json.staff)
    } catch (e: unknown) {
      console.error('Error fetching staff:', e)
    }
  }, [])

  const fetchAuditLogs = useCallback(async (t: string) => {
    try {
      const params = new URLSearchParams()
      if (auditAction) params.set('action', auditAction)
      if (auditTable) params.set('table', auditTable)
      const res = await fetch(`/api/audit-logs?${params}`, {
        headers: { 'Authorization': `Bearer ${t}` },
      })
      if (!res.ok) throw new Error('Không thể tải audit logs')
      const json = await res.json()
      setAuditLogs(json.logs)
    } catch (e: unknown) {
      console.error('Error fetching audit logs:', e)
    }
  }, [auditAction, auditTable])

  const fetchCourseSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/course')
      if (!res.ok) throw new Error('Không thể tải cài đặt khóa học')
      const json = await res.json()
      setCourseSettings(json)
      setSettingsForm(json)
    } catch (e: unknown) {
      console.error('Error fetching course settings:', e)
    }
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || 'Lỗi đăng nhập')
      }
      const json = await res.json()
      setToken(json.token)
      setAuthed(true)
      localStorage.setItem('admin_token', json.token)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Lỗi')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    setAuthed(false)
    setToken('')
    localStorage.removeItem('admin_token')
    setData(null)
    setStaff([])
    setAuditLogs([])
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

  const addStaff = async (e: React.FormEvent) => {
    e.preventDefault()
    setStaffLoading(true)
    setStaffError('')
    try {
      const res = await fetch('/api/staff/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(newStaffForm),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error)
      }
      setNewStaffForm({ name: '', email: '', password: '', role: 'staff' })
      await fetchStaff(token)
    } catch (e: unknown) {
      setStaffError(e instanceof Error ? e.message : 'Lỗi')
    } finally {
      setStaffLoading(false)
    }
  }

  const updateStaff = async (id: number, updates: any) => {
    try {
      const res = await fetch(`/api/staff/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      })
      if (!res.ok) throw new Error('Không thể cập nhật')
      await fetchStaff(token)
    } catch (e: unknown) {
      setStaffError(e instanceof Error ? e.message : 'Lỗi')
    }
  }

  const deleteStaff = async (id: number) => {
    if (!confirm('Bạn chắc chắn muốn xóa nhân viên này?')) return
    try {
      const res = await fetch(`/api/staff/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })
      if (!res.ok) throw new Error('Không thể xóa')
      await fetchStaff(token)
    } catch (e: unknown) {
      setStaffError(e instanceof Error ? e.message : 'Lỗi')
    }
  }

  const saveCourseSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!settingsForm) return
    setSettingsLoading(true)
    try {
      const res = await fetch('/api/settings/course', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          courseName: settingsForm.course_name,
          coursePrice: settingsForm.course_price,
          discountPrice: settingsForm.discount_price,
          courseDescription: settingsForm.course_description,
        }),
      })
      if (!res.ok) throw new Error('Không thể lưu cài đặt')
      const json = await res.json()
      setCourseSettings(json.settings)
      setSettingsForm(json.settings)
    } catch (e: unknown) {
      console.error('Error:', e)
    } finally {
      setSettingsLoading(false)
    }
  }

  // Load token and refresh data
  useEffect(() => {
    const savedToken = localStorage.getItem('admin_token')
    if (savedToken) {
      setToken(savedToken)
      setAuthed(true)
    }
  }, [])

  useEffect(() => {
    if (!authed || !token) return
    fetchAdminData(token)
    fetchStaff(token)
    fetchAuditLogs(token)
    fetchCourseSettings()

    const interval = setInterval(() => {
      fetchAdminData(token)
      fetchStaff(token)
      fetchAuditLogs(token)
    }, 30000)

    return () => clearInterval(interval)
  }, [authed, token, fetchAdminData, fetchStaff, fetchAuditLogs, fetchCourseSettings])

  useEffect(() => {
    if (!authed || !token) return
    fetchAuditLogs(token)
  }, [auditAction, auditTable, fetchAuditLogs, authed, token])

  if (!authed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <div className="text-5xl mb-3">🔐</div>
            <h1 className="text-2xl font-bold text-gray-800">Admin Portal</h1>
            <p className="text-gray-500 text-sm mt-2">Khóa học Dưa Cà Muối</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-amber-400 focus:outline-none"
              required
            />
            <input
              type="password"
              placeholder="Mật khẩu"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-amber-400 focus:outline-none"
              required
            />
            {error && <p className="text-red-500 text-sm text-center bg-red-50 p-2 rounded">{error}</p>}
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
              onClick={() => {
                fetchAdminData(token)
                fetchStaff(token)
                fetchAuditLogs(token)
                fetchCourseSettings()
              }}
              className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
            >
              🔄 Làm mới
            </button>
            <button
              onClick={handleLogout}
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

        {/* 5 Tabs */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b flex flex-wrap gap-2">
            {[
              { id: 'gift', label: '🎁 Nhận quà', count: data?.stats.totalGiftLeads || 0 },
              { id: 'course', label: '💳 Đăng ký khóa học', count: data?.stats.totalCourseLeads || 0 },
              { id: 'staff', label: '👥 Quản lý nhân viên', count: staff.length },
              { id: 'audit', label: '📋 Lịch sử chỉnh sửa', count: auditLogs.length },
              { id: 'settings', label: '⚙️ Cài đặt khóa học', count: 0 },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id as Tab)}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                  tab === t.id ? 'bg-amber-100 text-amber-700' : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                {t.label} {t.count > 0 && `(${t.count})`}
              </button>
            ))}
          </div>

          {/* Search for leads tabs */}
          {(tab === 'gift' || tab === 'course') && (
            <div className="px-6 py-4 border-b flex flex-col md:flex-row md:items-center gap-4">
              <input
                type="text"
                placeholder="🔍 Tìm tên, email, SĐT..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-400 flex-1"
              />
              <button
                onClick={() => exportCSV(tab as 'gift' | 'course')}
                className="bg-green-500 hover:bg-green-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                📥 Xuất CSV
              </button>
            </div>
          )}

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

          {/* Staff Management Tab */}
          {tab === 'staff' && (
            <div className="p-6">
              {/* Add new staff form */}
              <div className="mb-8 p-6 bg-gray-50 rounded-xl border border-gray-200">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Thêm nhân viên mới</h3>
                <form onSubmit={addStaff} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input
                    type="text"
                    placeholder="Tên"
                    value={newStaffForm.name}
                    onChange={(e) => setNewStaffForm({ ...newStaffForm, name: e.target.value })}
                    className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:border-amber-400"
                    required
                  />
                  <input
                    type="email"
                    placeholder="Email"
                    value={newStaffForm.email}
                    onChange={(e) => setNewStaffForm({ ...newStaffForm, email: e.target.value })}
                    className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:border-amber-400"
                    required
                  />
                  <input
                    type="password"
                    placeholder="Mật khẩu"
                    value={newStaffForm.password}
                    onChange={(e) => setNewStaffForm({ ...newStaffForm, password: e.target.value })}
                    className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:border-amber-400"
                    required
                  />
                  <select
                    value={newStaffForm.role}
                    onChange={(e) => setNewStaffForm({ ...newStaffForm, role: e.target.value })}
                    className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:border-amber-400"
                  >
                    <option value="staff">Nhân viên</option>
                    <option value="admin">Admin</option>
                  </select>
                  <button
                    type="submit"
                    disabled={staffLoading}
                    className="md:col-span-2 bg-amber-500 hover:bg-amber-600 text-white font-bold py-2 rounded-lg transition-colors disabled:opacity-60"
                  >
                    {staffLoading ? 'Đang thêm...' : 'Thêm nhân viên'}
                  </button>
                </form>
                {staffError && <p className="text-red-500 text-sm mt-2">{staffError}</p>}
              </div>

              {/* Staff list */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3 text-left">Tên</th>
                      <th className="px-4 py-3 text-left">Email</th>
                      <th className="px-4 py-3 text-left">Role</th>
                      <th className="px-4 py-3 text-left">Trạng thái</th>
                      <th className="px-4 py-3 text-left">Lần cuối đăng nhập</th>
                      <th className="px-4 py-3 text-center">Hành động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {staff.length === 0 ? (
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Chưa có nhân viên</td></tr>
                    ) : staff.map((s) => (
                      <tr key={s.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-800">{s.name}</td>
                        <td className="px-4 py-3 text-gray-600">{s.email}</td>
                        <td className="px-4 py-3">
                          <select
                            value={s.role}
                            onChange={(e) => updateStaff(s.id, { role: e.target.value })}
                            className="border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:border-amber-400"
                          >
                            <option value="staff">Nhân viên</option>
                            <option value="admin">Admin</option>
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={s.status}
                            onChange={(e) => updateStaff(s.id, { status: e.target.value })}
                            className={`border rounded px-2 py-1 text-xs focus:outline-none focus:border-amber-400 ${
                              s.status === 'active' ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'
                            }`}
                          >
                            <option value="active">Hoạt động</option>
                            <option value="inactive">Khóa</option>
                          </select>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{s.last_login ? formatDateTime(s.last_login) : 'Chưa đăng nhập'}</td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => deleteStaff(s.id)}
                            className="text-red-500 hover:text-red-700 font-medium text-sm"
                          >
                            Xóa
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Audit Logs Tab */}
          {tab === 'audit' && (
            <div className="p-6">
              {/* Filters */}
              <div className="mb-6 flex gap-4 flex-wrap">
                <select
                  value={auditAction}
                  onChange={(e) => setAuditAction(e.target.value)}
                  className="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-amber-400"
                >
                  <option value="">Tất cả hành động</option>
                  <option value="INSERT">Thêm mới</option>
                  <option value="UPDATE">Chỉnh sửa</option>
                  <option value="DELETE">Xóa</option>
                </select>
                <select
                  value={auditTable}
                  onChange={(e) => setAuditTable(e.target.value)}
                  className="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-amber-400"
                >
                  <option value="">Tất cả bảng</option>
                  <option value="gift_leads">Quà tặng</option>
                  <option value="course_leads">Khóa học</option>
                  <option value="staff">Nhân viên</option>
                </select>
              </div>

              {/* Audit log table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3 text-left">Người dùng</th>
                      <th className="px-4 py-3 text-left">Hành động</th>
                      <th className="px-4 py-3 text-left">Bảng</th>
                      <th className="px-4 py-3 text-left">ID</th>
                      <th className="px-4 py-3 text-left">Thời gian</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {auditLogs.length === 0 ? (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Chưa có hoạt động</td></tr>
                    ) : auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-800">{log.user_name}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            log.action === 'INSERT' ? 'bg-green-100 text-green-700' :
                            log.action === 'UPDATE' ? 'bg-blue-100 text-blue-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {log.action === 'INSERT' ? '➕ Thêm' : log.action === 'UPDATE' ? '✏️ Sửa' : '❌ Xóa'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-xs">{log.table_name}</td>
                        <td className="px-4 py-3 text-gray-500 font-mono">#{log.record_id}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{formatDateTime(log.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Settings Tab */}
          {tab === 'settings' && settingsForm && (
            <div className="p-6">
              <form onSubmit={saveCourseSettings} className="max-w-2xl space-y-6">
                <div>
                  <label className="block text-sm font-bold text-gray-800 mb-2">Tên khóa học</label>
                  <input
                    type="text"
                    value={settingsForm.course_name}
                    onChange={(e) => setSettingsForm({ ...settingsForm, course_name: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-800 mb-2">Giá gốc (đ)</label>
                    <input
                      type="number"
                      value={settingsForm.course_price}
                      onChange={(e) => setSettingsForm({ ...settingsForm, course_price: parseInt(e.target.value) })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-800 mb-2">Giá khuyến mãi (đ)</label>
                    <input
                      type="number"
                      value={settingsForm.discount_price}
                      onChange={(e) => setSettingsForm({ ...settingsForm, discount_price: parseInt(e.target.value) })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-800 mb-2">Mô tả khóa học</label>
                  <textarea
                    value={settingsForm.course_description || ''}
                    onChange={(e) => setSettingsForm({ ...settingsForm, course_description: e.target.value })}
                    rows={4}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:border-amber-400"
                  />
                </div>

                <button
                  type="submit"
                  disabled={settingsLoading}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-60"
                >
                  {settingsLoading ? 'Đang lưu...' : 'Lưu cài đặt'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
