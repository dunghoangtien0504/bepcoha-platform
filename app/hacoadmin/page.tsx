'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import type { GiftLead, CourseLead, Staff, AuditLogWithStaff, CourseSettings, StnOrder, KdxOrder } from '@/lib/db'

interface AdminData {
  giftLeads: GiftLead[]
  courseLeads: CourseLead[]
  stnOrders: StnOrder[]
  kdxOrders: KdxOrder[]
  stats: {
    totalGiftLeads: number
    totalCourseLeads: number
    paidLeads: number
    revenue: number
    stnTotal: number
    stnPaid: number
    stnRevenue: number
    kdxTotal: number
    kdxPaid: number
    kdxRevenue: number
  }
}

type Tab = 'dashboard' | 'gift' | 'course' | 'rau-ma' | 'stn' | 'kdx' | 'staff' | 'audit' | 'settings'

function formatVND(n: number) {
  return n.toLocaleString('vi-VN') + 'd'
}

function formatDateTime(dt: string) {
  return new Date(dt).toLocaleString('vi-VN')
}

function formatShortDate(dt: string) {
  return new Date(dt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
}

type SortDir = 'asc' | 'desc'

interface Column<T> {
  key: string
  label: string
  render: (row: T) => React.ReactNode
  sortValue?: (row: T) => string | number
  className?: string
  headerClass?: string
}

function DataTable<T extends { id: number }>({
  columns,
  data,
  loading,
  emptyText = 'Chưa có dữ liệu',
  pageSize: initialPageSize = 10,
}: {
  columns: Column<T>[]
  data: T[]
  loading: boolean
  emptyText?: string
  pageSize?: number
}) {
  const [page, setPage] = useState(0)
  const [perPage, setPerPage] = useState(initialPageSize)
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  useEffect(() => { setPage(0) }, [data.length, perPage])

  const sorted = useMemo(() => {
    if (!sortKey) return data
    const col = columns.find(c => c.key === sortKey)
    if (!col?.sortValue) return data
    const fn = col.sortValue
    return [...data].sort((a, b) => {
      const va = fn(a)
      const vb = fn(b)
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [data, sortKey, sortDir, columns])

  const totalPages = Math.max(1, Math.ceil(sorted.length / perPage))
  const pageData = sorted.slice(page * perPage, (page + 1) * perPage)

  const handleSort = (key: string) => {
    const col = columns.find(c => c.key === key)
    if (!col?.sortValue) return
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80">
              {columns.map(col => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className={`px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider ${col.sortValue ? 'cursor-pointer select-none hover:text-slate-700 transition-colors' : ''} ${col.headerClass || ''}`}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {col.sortValue && sortKey === col.key && (
                      <svg className="w-3 h-3" viewBox="0 0 12 12" fill="currentColor">
                        {sortDir === 'asc'
                          ? <path d="M6 2l4 5H2z" />
                          : <path d="M6 10l4-5H2z" />
                        }
                      </svg>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-16 text-center">
                  <div className="inline-flex items-center gap-2 text-slate-400">
                    <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" className="opacity-25" />
                      <path d="M4 12a8 8 0 018-8" className="opacity-75" />
                    </svg>
                    Đang tải...
                  </div>
                </td>
              </tr>
            ) : pageData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-16 text-center text-slate-400">
                  <div className="flex flex-col items-center gap-2">
                    <svg className="w-10 h-10 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                    {emptyText}
                  </div>
                </td>
              </tr>
            ) : pageData.map((row, i) => (
              <tr
                key={row.id}
                className={`border-b border-slate-100 transition-colors hover:bg-emerald-50/40 ${i % 2 === 1 ? 'bg-slate-50/40' : ''}`}
              >
                {columns.map(col => (
                  <td key={col.key} className={`px-4 py-3 ${col.className || ''}`}>
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sorted.length > 0 && (
        <div className="px-4 py-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span>Hiển thị</span>
            <select
              value={perPage}
              onChange={e => setPerPage(Number(e.target.value))}
              className="border border-slate-200 rounded-md px-2 py-1 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            >
              {[10, 25, 50].map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <span>/ {sorted.length} kết quả</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(0)}
              disabled={page === 0}
              className="p-1.5 rounded-md text-slate-500 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Trang đầu"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 17l-5-5 5-5M18 17l-5-5 5-5" /></svg>
            </button>
            <button
              onClick={() => setPage(p => p - 1)}
              disabled={page === 0}
              className="p-1.5 rounded-md text-slate-500 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Trang trước"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 19l-7-7 7-7" /></svg>
            </button>
            <span className="px-3 py-1 text-sm text-slate-600 font-medium">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={page >= totalPages - 1}
              className="p-1.5 rounded-md text-slate-500 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Trang sau"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 5l7 7-7 7" /></svg>
            </button>
            <button
              onClick={() => setPage(totalPages - 1)}
              disabled={page >= totalPages - 1}
              className="p-1.5 rounded-md text-slate-500 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Trang cuối"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 17l5-5-5-5M6 17l5-5-5-5" /></svg>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status, paidLabel = 'Đã TT', pendingLabel = 'Chờ TT' }: { status: string; paidLabel?: string; pendingLabel?: string }) {
  const isPaid = status === 'paid'
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${isPaid ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${isPaid ? 'bg-emerald-500' : 'bg-amber-500'}`} />
      {isPaid ? paidLabel : pendingLabel}
    </span>
  )
}

function StatCard({ icon, value, label, subtitle, active, onClick }: {
  icon: React.ReactNode
  value: string | number
  label: string
  subtitle?: string
  active?: boolean
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`text-left p-5 rounded-xl border transition-all duration-200 ${
        active
          ? 'border-emerald-300 bg-emerald-50 ring-2 ring-emerald-500/20'
          : 'border-slate-200 bg-white hover:border-emerald-200 hover:shadow-md'
      } ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
    >
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${
        active ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
      }`}>
        {icon}
      </div>
      <div className="text-2xl font-bold text-slate-800 tabular-nums">{value}</div>
      <div className="text-sm text-slate-500 mt-0.5">{label}</div>
      {subtitle && <div className="text-xs text-slate-400 mt-1">{subtitle}</div>}
    </button>
  )
}

function MiniBar({ values, max }: { values: number[]; max: number }) {
  const barMax = max || 1
  return (
    <div className="flex items-end gap-0.5 h-8">
      {values.map((v, i) => (
        <div
          key={i}
          className="flex-1 bg-emerald-500/70 rounded-t-sm min-h-[2px] transition-all"
          style={{ height: `${Math.max(8, (v / barMax) * 100)}%` }}
        />
      ))}
    </div>
  )
}

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000)
    return () => clearTimeout(t)
  }, [onClose])

  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-lg shadow-lg text-white text-sm font-medium animate-[slideUp_0.3s_ease-out] ${
      type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
    }`}>
      {type === 'success' ? (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 13l4 4L19 7" /></svg>
      ) : (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M15 9l-6 6M9 9l6 6" /></svg>
      )}
      {message}
      <button onClick={onClose} className="ml-2 opacity-70 hover:opacity-100">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
      </button>
    </div>
  )
}

const NAV_GROUPS = [
  {
    label: 'Tổng quan',
    items: [
      { id: 'dashboard' as Tab, label: 'Dashboard', icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="4" rx="1" /><rect x="14" y="10" width="7" height="11" rx="1" /><rect x="3" y="13" width="7" height="8" rx="1" /></svg>
      )},
    ],
  },
  {
    label: 'Đơn hàng',
    items: [
      { id: 'stn' as Tab, label: 'Sốt Trộn Nộm', icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
      )},
      { id: 'kdx' as Tab, label: 'Khăn Đồ Xôi', icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" /></svg>
      )},
    ],
  },
  {
    label: 'Khóa học',
    items: [
      { id: 'course' as Tab, label: 'Dưa Cà Muối', icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
      )},
      { id: 'rau-ma' as Tab, label: 'Rau Má Đậu Xanh', icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 007.92 12.446A9 9 0 1112 2.992z" /><path d="M17 3a5.5 5.5 0 014 8" /></svg>
      )},
    ],
  },
  {
    label: 'Marketing',
    items: [
      { id: 'gift' as Tab, label: 'Nhận quà', icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20 12v10H4V12M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 110-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 100-5C13 2 12 7 12 7z" /></svg>
      )},
    ],
  },
  {
    label: 'Hệ thống',
    items: [
      { id: 'staff' as Tab, label: 'Nhân viên', icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" /></svg>
      )},
      { id: 'audit' as Tab, label: 'Lịch sử', icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2M12 12h.01M8 12h.01M16 12h.01M12 16h.01M8 16h.01M16 16h.01" /></svg>
      )},
      { id: 'settings' as Tab, label: 'Cài đặt', icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z" /><circle cx="12" cy="12" r="3" /></svg>
      )},
    ],
  },
]

const MOBILE_NAV: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'dashboard', label: 'Tổng quan', icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="4" rx="1" /><rect x="14" y="10" width="7" height="11" rx="1" /><rect x="3" y="13" width="7" height="8" rx="1" /></svg> },
  { id: 'stn', label: 'STN', icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg> },
  { id: 'course', label: 'Khóa học', icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg> },
  { id: 'gift', label: 'Leads', icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20 12v10H4V12M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 110-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 100-5C13 2 12 7 12 7z" /></svg> },
  { id: 'staff', label: 'Hệ thống', icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z" /><circle cx="12" cy="12" r="3" /></svg> },
]

function Sidebar({ tab, setTab, onLogout, sidebarOpen, setSidebarOpen }: {
  tab: Tab
  setTab: (t: Tab) => void
  onLogout: () => void
  sidebarOpen: boolean
  setSidebarOpen: (v: boolean) => void
}) {
  return (
    <>
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`fixed top-0 left-0 bottom-0 w-64 bg-slate-900 text-white z-50 flex flex-col transition-transform duration-200 ease-out ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } lg:translate-x-0`}>
        <div className="p-5 border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center font-bold text-sm">HC</div>
            <div>
              <div className="font-semibold text-sm">HaCo Admin</div>
              <div className="text-xs text-slate-400">hacofood.vn</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3">
          {NAV_GROUPS.map(group => (
            <div key={group.label} className="mb-5">
              <div className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                {group.label}
              </div>
              {group.items.map(item => (
                <button
                  key={item.id}
                  onClick={() => { setTab(item.id); setSidebarOpen(false) }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors mb-0.5 ${
                    tab === item.id
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-700/50">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" /></svg>
            Đăng xuất
          </button>
        </div>
      </aside>
    </>
  )
}

function DashboardView({ data, duaCaLeads, rauMaLeads, setTab, allOrders }: {
  data: AdminData
  duaCaLeads: CourseLead[]
  rauMaLeads: CourseLead[]
  setTab: (t: Tab) => void
  allOrders: { name: string; amount: number; status: string; date: string; type: string }[]
}) {
  const totalRevenue = data.stats.revenue + data.stats.stnRevenue + data.stats.kdxRevenue
  const rauMaRevenue = rauMaLeads.filter(l => l.payment_status === 'paid').reduce((s, l) => s + l.amount, 0)

  const revenueBreakdown = [
    { label: 'Dưa Cà Muối', revenue: data.stats.revenue, paid: data.stats.paidLeads, total: duaCaLeads.length, tab: 'course' as Tab, color: 'bg-emerald-500' },
    { label: 'Rau Má Đậu Xanh', revenue: rauMaRevenue, paid: rauMaLeads.filter(l => l.payment_status === 'paid').length, total: rauMaLeads.length, tab: 'rau-ma' as Tab, color: 'bg-teal-500' },
    { label: 'Sốt Trộn Nộm', revenue: data.stats.stnRevenue, paid: data.stats.stnPaid, total: data.stats.stnTotal, tab: 'stn' as Tab, color: 'bg-amber-500' },
    { label: 'Khăn Đồ Xôi', revenue: data.stats.kdxRevenue, paid: data.stats.kdxPaid, total: data.stats.kdxTotal, tab: 'kdx' as Tab, color: 'bg-orange-500' },
  ]

  const maxRevenue = Math.max(...revenueBreakdown.map(r => r.revenue), 1)

  const recentStn = data.stnOrders.slice(0, 7)
  const stnDailyValues = recentStn.map(o => o.total_price)
  const stnMax = Math.max(...stnDailyValues, 1)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800">Dashboard</h2>
        <p className="text-sm text-slate-500 mt-1">Tổng quan hoạt động kinh doanh</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          icon={<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20 12v10H4V12M2 7h20v5H2zM12 22V7" /></svg>}
          value={data.stats.totalGiftLeads}
          label="Lượt nhận quà"
          subtitle="Gift leads"
          onClick={() => setTab('gift')}
        />
        <StatCard
          icon={<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>}
          value={data.stats.totalCourseLeads}
          label="Đăng ký khóa học"
          subtitle={`${data.stats.paidLeads + rauMaLeads.filter(l => l.payment_status === 'paid').length} đã thanh toán`}
          onClick={() => setTab('course')}
        />
        <StatCard
          icon={<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>}
          value={data.stats.stnTotal + data.stats.kdxTotal}
          label="Đơn sản phẩm"
          subtitle={`${data.stats.stnPaid + data.stats.kdxPaid} đã thanh toán`}
          onClick={() => setTab('stn')}
        />
        <StatCard
          icon={<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></svg>}
          value={formatVND(totalRevenue)}
          label="Tổng doanh thu"
          active
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-800 mb-4">Doanh thu theo sản phẩm</h3>
          <div className="space-y-4">
            {revenueBreakdown.map(item => (
              <button
                key={item.label}
                onClick={() => setTab(item.tab)}
                className="w-full text-left group"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium text-slate-700 group-hover:text-emerald-700 transition-colors">{item.label}</span>
                  <span className="text-sm font-bold text-slate-800 tabular-nums">{formatVND(item.revenue)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${item.color} transition-all duration-500`}
                      style={{ width: `${(item.revenue / maxRevenue) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-400 w-20 text-right tabular-nums">{item.paid}/{item.total} TT</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-800 mb-4">Đơn hàng gần đây</h3>
          {stnDailyValues.length > 0 && (
            <div className="mb-4 px-1">
              <MiniBar values={stnDailyValues} max={stnMax} />
            </div>
          )}
          <div className="space-y-3">
            {allOrders.slice(0, 5).map((order, i) => (
              <div key={i} className="flex items-center justify-between py-1.5">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-700 truncate">{order.name}</div>
                  <div className="text-xs text-slate-400">{order.type} - {formatShortDate(order.date)}</div>
                </div>
                <div className="flex items-center gap-2 ml-3">
                  <span className="text-sm font-semibold text-slate-700 tabular-nums">{formatVND(order.amount)}</span>
                  <span className={`w-2 h-2 rounded-full ${order.status === 'paid' ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="font-semibold text-slate-800 mb-4">Truy cập nhanh</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { label: 'Sốt Trộn Nộm', tab: 'stn' as Tab, count: data.stats.stnTotal },
            { label: 'Khăn Đồ Xôi', tab: 'kdx' as Tab, count: data.stats.kdxTotal },
            { label: 'Dưa Cà Muối', tab: 'course' as Tab, count: duaCaLeads.length },
            { label: 'Rau Má', tab: 'rau-ma' as Tab, count: rauMaLeads.length },
            { label: 'Gift Leads', tab: 'gift' as Tab, count: data.stats.totalGiftLeads },
          ].map(item => (
            <button
              key={item.tab}
              onClick={() => setTab(item.tab)}
              className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 transition-all group"
            >
              <span className="text-sm font-medium text-slate-600 group-hover:text-emerald-700">{item.label}</span>
              <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full group-hover:bg-emerald-100 group-hover:text-emerald-700 tabular-nums">{item.count}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function StaffView({ staff, token, fetchStaff, newStaffForm, setNewStaffForm, staffLoading, setStaffLoading, staffError, setStaffError, setToast }: {
  staff: Staff[]
  token: string
  fetchStaff: (t: string) => void
  newStaffForm: { name: string; email: string; password: string; role: string }
  setNewStaffForm: (f: { name: string; email: string; password: string; role: string }) => void
  staffLoading: boolean
  setStaffLoading: (v: boolean) => void
  staffError: string
  setStaffError: (v: string) => void
  setToast: (t: { message: string; type: 'success' | 'error' } | null) => void
}) {
  const addStaff = async (e: React.FormEvent) => {
    e.preventDefault(); setStaffLoading(true); setStaffError('')
    try {
      const res = await fetch('/api/staff/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(newStaffForm),
      })
      if (!res.ok) { const j = await res.json(); throw new Error(j.error) }
      setNewStaffForm({ name: '', email: '', password: '', role: 'staff' })
      await fetchStaff(token)
      setToast({ message: 'Thêm nhân viên thành công', type: 'success' })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Lỗi'
      setStaffError(msg)
      setToast({ message: msg, type: 'error' })
    } finally { setStaffLoading(false) }
  }

  const updateStaff = async (id: number, updates: Record<string, unknown>) => {
    try {
      const res = await fetch(`/api/staff/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(updates),
      })
      if (!res.ok) throw new Error('Không thể cập nhật')
      await fetchStaff(token)
      setToast({ message: 'Cập nhật thành công', type: 'success' })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Lỗi'
      setStaffError(msg)
      setToast({ message: msg, type: 'error' })
    }
  }

  const deleteStaff = async (id: number) => {
    if (!confirm('Bạn chắc chắn muốn xóa nhân viên này?')) return
    try {
      const res = await fetch(`/api/staff/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Không thể xóa')
      await fetchStaff(token)
      setToast({ message: 'Xóa nhân viên thành công', type: 'success' })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Lỗi'
      setStaffError(msg)
      setToast({ message: msg, type: 'error' })
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800">Nhan vien</h2>
        <p className="text-sm text-slate-500 mt-1">Quản lý tài khoản nhân viên</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-800 mb-4">Thêm nhân viên mới</h3>
        <form onSubmit={addStaff} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">Tên</label>
            <input type="text" value={newStaffForm.name}
              onChange={(e) => setNewStaffForm({ ...newStaffForm, name: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">Email</label>
            <input type="email" value={newStaffForm.email}
              onChange={(e) => setNewStaffForm({ ...newStaffForm, email: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">Mật khẩu</label>
            <input type="password" value={newStaffForm.password}
              onChange={(e) => setNewStaffForm({ ...newStaffForm, password: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">Vai trò</label>
            <select value={newStaffForm.role}
              onChange={(e) => setNewStaffForm({ ...newStaffForm, role: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors bg-white">
              <option value="staff">Nhân viên</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <button type="submit" disabled={staffLoading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {staffLoading && (
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" className="opacity-25" /><path d="M4 12a8 8 0 018-8" className="opacity-75" /></svg>
              )}
              {staffLoading ? 'Đang thêm...' : 'Thêm nhân viên'}
            </button>
          </div>
        </form>
        {staffError && <p className="text-red-600 text-sm mt-3 bg-red-50 p-2.5 rounded-lg">{staffError}</p>}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <DataTable
          columns={[
            { key: 'name', label: 'Tên', render: (s: Staff) => <span className="font-medium text-slate-800">{s.name}</span>, sortValue: (s: Staff) => s.name },
            { key: 'email', label: 'Email', render: (s: Staff) => <span className="text-slate-600">{s.email}</span> },
            { key: 'role', label: 'Vai trò', render: (s: Staff) => (
              <select value={s.role} onChange={(e) => updateStaff(s.id, { role: e.target.value })}
                className="border border-slate-200 rounded-md px-2 py-1 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500">
                <option value="staff">Nhân viên</option>
                <option value="admin">Admin</option>
              </select>
            )},
            { key: 'status', label: 'Trạng thái', render: (s: Staff) => (
              <select value={s.status} onChange={(e) => updateStaff(s.id, { status: e.target.value })}
                className={`border rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 ${s.status === 'active' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
                <option value="active">Hoạt động</option>
                <option value="inactive">Khóa</option>
              </select>
            )},
            { key: 'last_login', label: 'Lần cuối đăng nhập', render: (s: Staff) => <span className="text-slate-400 text-xs">{s.last_login ? formatDateTime(s.last_login) : 'Chưa đăng nhập'}</span>, sortValue: (s: Staff) => s.last_login || '' },
            { key: 'actions', label: '', render: (s: Staff) => (
              <button onClick={() => deleteStaff(s.id)} className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-md transition-colors" aria-label="Xóa nhân viên">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </button>
            ), headerClass: 'w-12' },
          ]}
          data={staff}
          loading={false}
          emptyText="Chưa có nhân viên"
        />
      </div>
    </div>
  )
}

function AuditView({ auditLogs, auditAction, setAuditAction, auditTable, setAuditTable }: {
  auditLogs: AuditLogWithStaff[]
  auditAction: string
  setAuditAction: (v: string) => void
  auditTable: string
  setAuditTable: (v: string) => void
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800">Lịch sử chỉnh sửa</h2>
        <p className="text-sm text-slate-500 mt-1">Theo dõi tất cả thay đổi trong hệ thống</p>
      </div>

      <div className="flex gap-3 flex-wrap">
        <select value={auditAction} onChange={(e) => setAuditAction(e.target.value)}
          className="border border-slate-200 rounded-lg px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500">
          <option value="">Tất cả hành động</option>
          <option value="INSERT">Thêm mới</option>
          <option value="UPDATE">Chỉnh sửa</option>
          <option value="DELETE">Xoa</option>
        </select>
        <select value={auditTable} onChange={(e) => setAuditTable(e.target.value)}
          className="border border-slate-200 rounded-lg px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500">
          <option value="">Tất cả bảng</option>
          <option value="gift_leads">Quà tặng</option>
          <option value="course_leads">Khóa học</option>
          <option value="staff">Nhân viên</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <DataTable
          columns={[
            { key: 'user', label: 'Người dùng', render: (log: AuditLogWithStaff) => <span className="font-medium text-slate-800">{log.user_name}</span> },
            { key: 'action', label: 'Hành động', render: (log: AuditLogWithStaff) => (
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                log.action === 'INSERT' ? 'bg-emerald-100 text-emerald-700' :
                log.action === 'UPDATE' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  log.action === 'INSERT' ? 'bg-emerald-500' :
                  log.action === 'UPDATE' ? 'bg-blue-500' : 'bg-red-500'
                }`} />
                {log.action === 'INSERT' ? 'Thêm' : log.action === 'UPDATE' ? 'Sửa' : 'Xóa'}
              </span>
            )},
            { key: 'table', label: 'Bảng', render: (log: AuditLogWithStaff) => <span className="text-slate-500 text-xs font-mono">{log.table_name}</span> },
            { key: 'record', label: 'ID', render: (log: AuditLogWithStaff) => <span className="text-slate-500 font-mono text-xs">#{log.record_id}</span> },
            { key: 'time', label: 'Thời gian', render: (log: AuditLogWithStaff) => <span className="text-slate-400 text-xs">{formatDateTime(log.created_at)}</span>, sortValue: (log: AuditLogWithStaff) => log.created_at },
          ]}
          data={auditLogs}
          loading={false}
          emptyText="Chưa có hoạt động"
        />
      </div>
    </div>
  )
}

function SettingsView({ courseSettings, settingsForm, setSettingsForm, token, setCourseSettings, setToast }: {
  courseSettings: CourseSettings | null
  settingsForm: CourseSettings | null
  setSettingsForm: (f: CourseSettings | null) => void
  token: string
  setCourseSettings: (s: CourseSettings) => void
  setToast: (t: { message: string; type: 'success' | 'error' } | null) => void
}) {
  const [settingsLoading, setSettingsLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  if (!settingsForm || !courseSettings) return null

  const hasChanges = settingsForm.course_name !== courseSettings.course_name ||
    settingsForm.course_price !== courseSettings.course_price ||
    settingsForm.discount_price !== courseSettings.discount_price ||
    (settingsForm.course_description || '') !== (courseSettings.course_description || '')

  const saveCourseSettings = async () => {
    if (!settingsForm) return
    setSettingsLoading(true)
    try {
      const res = await fetch('/api/settings/course', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          courseName: settingsForm.course_name,
          coursePrice: settingsForm.course_price,
          discountPrice: settingsForm.discount_price,
          courseDescription: settingsForm.course_description,
        }),
      })
      if (!res.ok) throw new Error('Không thể lưu cài đặt')
      const json = await res.json()
      setCourseSettings(json.settings); setSettingsForm(json.settings)
      setToast({ message: 'Lưu cài đặt thành công', type: 'success' })
    } catch (e: unknown) {
      console.error('Error:', e)
      setToast({ message: 'Không thể lưu cài đặt', type: 'error' })
    } finally { setSettingsLoading(false); setShowConfirm(false) }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (hasChanges) {
      setShowConfirm(true)
    }
  }

  const isChanged = (field: keyof CourseSettings) => {
    if (!courseSettings || !settingsForm) return false
    const original = courseSettings[field]
    const current = settingsForm[field]
    return String(original || '') !== String(current || '')
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800">Cài đặt khóa học</h2>
        <p className="text-sm text-slate-500 mt-1">Tùy chỉnh thông tin khóa học</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <form onSubmit={handleSubmit} className="max-w-2xl space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">Tên khóa học</label>
            <input type="text" value={settingsForm.course_name}
              onChange={(e) => setSettingsForm({ ...settingsForm, course_name: e.target.value })}
              className={`w-full border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors ${isChanged('course_name') ? 'border-amber-400 bg-amber-50/50' : 'border-slate-200'}`} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">Giá gốc (đ)</label>
              <input type="number" value={settingsForm.course_price}
                onChange={(e) => setSettingsForm({ ...settingsForm, course_price: parseInt(e.target.value) || 0 })}
                className={`w-full border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors ${isChanged('course_price') ? 'border-amber-400 bg-amber-50/50' : 'border-slate-200'}`} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">Giá khuyến mãi (đ)</label>
              <input type="number" value={settingsForm.discount_price}
                onChange={(e) => setSettingsForm({ ...settingsForm, discount_price: parseInt(e.target.value) || 0 })}
                className={`w-full border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors ${isChanged('discount_price') ? 'border-amber-400 bg-amber-50/50' : 'border-slate-200'}`} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">Mô tả khóa học</label>
            <textarea value={settingsForm.course_description || ''}
              onChange={(e) => setSettingsForm({ ...settingsForm, course_description: e.target.value })}
              rows={4}
              className={`w-full border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors resize-none ${isChanged('course_description') ? 'border-amber-400 bg-amber-50/50' : 'border-slate-200'}`} />
          </div>
          <button type="submit" disabled={settingsLoading || !hasChanges}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {settingsLoading && (
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" className="opacity-25" /><path d="M4 12a8 8 0 018-8" className="opacity-75" /></svg>
            )}
            {settingsLoading ? 'Đang lưu...' : hasChanges ? 'Lưu thay đổi' : 'Chưa có thay đổi'}
          </button>
        </form>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowConfirm(false)}>
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-slate-800 text-lg mb-2">Xác nhận lưu cài đặt</h3>
            <p className="text-sm text-slate-500 mb-4">Bạn có chắc chắn muốn lưu các thay đổi?</p>
            <div className="space-y-2 mb-5 text-sm">
              {isChanged('course_name') && (
                <div className="flex gap-2">
                  <span className="text-slate-400 w-24">Ten:</span>
                  <span className="text-red-500 line-through">{courseSettings.course_name}</span>
                  <span className="text-emerald-600">{settingsForm.course_name}</span>
                </div>
              )}
              {isChanged('course_price') && (
                <div className="flex gap-2">
                  <span className="text-slate-400 w-24">Giá gốc:</span>
                  <span className="text-red-500 line-through">{formatVND(courseSettings.course_price)}</span>
                  <span className="text-emerald-600">{formatVND(settingsForm.course_price)}</span>
                </div>
              )}
              {isChanged('discount_price') && (
                <div className="flex gap-2">
                  <span className="text-slate-400 w-24">Giá KM:</span>
                  <span className="text-red-500 line-through">{formatVND(courseSettings.discount_price)}</span>
                  <span className="text-emerald-600">{formatVND(settingsForm.discount_price)}</span>
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirm(false)} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                Huy
              </button>
              <button onClick={saveCourseSettings} disabled={settingsLoading} className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {settingsLoading && <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" className="opacity-25" /><path d="M4 12a8 8 0 018-8" className="opacity-75" /></svg>}
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


export default function AdminPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authed, setAuthed] = useState(false)
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [data, setData] = useState<AdminData | null>(null)
  const [staff, setStaff] = useState<Staff[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLogWithStaff[]>([])
  const [courseSettings, setCourseSettings] = useState<CourseSettings | null>(null)

  const [tab, setTab] = useState<Tab>('dashboard')
  const [search, setSearch] = useState('')
  const [dataLoading, setDataLoading] = useState(false)

  const [newStaffForm, setNewStaffForm] = useState({ name: '', email: '', password: '', role: 'staff' })
  const [staffLoading, setStaffLoading] = useState(false)
  const [staffError, setStaffError] = useState('')

  const [settingsForm, setSettingsForm] = useState<CourseSettings | null>(null)

  const [auditAction, setAuditAction] = useState('')
  const [auditTable, setAuditTable] = useState('')

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const fetchAdminData = useCallback(async (t: string) => {
    setDataLoading(true)
    try {
      const res = await fetch('/api/admin-data', {
        headers: { 'Authorization': `Bearer ${t}` },
      })
      if (res.status === 401) {
        localStorage.removeItem('admin_token')
        setAuthed(false); setToken(''); setData(null)
        setError('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.')
        return
      }
      if (!res.ok) throw new Error('Lỗi tải dữ liệu')
      setData(await res.json())
    } catch (e: unknown) {
      console.error('Error fetching admin data:', e)
    } finally {
      setDataLoading(false)
    }
  }, [])

  const fetchStaff = useCallback(async (t: string) => {
    try {
      const res = await fetch('/api/staff', { headers: { 'Authorization': `Bearer ${t}` } })
      if (!res.ok) throw new Error('Không thể tải danh sách nhân viên')
      const json = await res.json()
      setStaff(json.staff)
    } catch (e: unknown) { console.error('Error fetching staff:', e) }
  }, [])

  const fetchAuditLogs = useCallback(async (t: string) => {
    try {
      const params = new URLSearchParams()
      if (auditAction) params.set('action', auditAction)
      if (auditTable) params.set('table', auditTable)
      const res = await fetch(`/api/audit-logs?${params}`, { headers: { 'Authorization': `Bearer ${t}` } })
      if (!res.ok) throw new Error('Không thể tải audit logs')
      const json = await res.json()
      setAuditLogs(json.logs)
    } catch (e: unknown) { console.error('Error fetching audit logs:', e) }
  }, [auditAction, auditTable])

  const fetchCourseSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/course')
      if (!res.ok) throw new Error('Không thể tải cài đặt khóa học')
      const json = await res.json()
      setCourseSettings(json); setSettingsForm(json)
    } catch (e: unknown) { console.error('Error fetching course settings:', e) }
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (!res.ok) { const j = await res.json(); throw new Error(j.error || 'Lỗi đăng nhập') }
      const json = await res.json()
      setToken(json.token); setAuthed(true)
      localStorage.setItem('admin_token', json.token)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Lỗi')
    } finally { setLoading(false) }
  }

  const handleLogout = () => {
    setAuthed(false); setToken('')
    localStorage.removeItem('admin_token')
    setData(null); setStaff([]); setAuditLogs([])
  }

  const exportCSV = (type: Tab) => {
    if (!data) return
    let csvRows: string[] = []
    let headers: string[] = []
    let filename = ''

    if (type === 'gift') {
      headers = ['ID', 'Ten', 'Email', 'SDT', 'Thời gian', 'Email gửi']
      filename = 'qua-tang-leads'
      csvRows = data.giftLeads.map(g =>
        [g.id, `"${g.name}"`, g.email, g.phone, g.created_at, g.email_sent ? 'Co' : 'Khong'].join(',')
      )
    } else if (type === 'course') {
      headers = ['ID', 'Ten', 'Email', 'SDT', 'Mã GĐ', 'Trạng thái', 'Số tiền', 'Thanh toán lúc', 'Thời gian']
      filename = 'dua-ca-muoi-leads'
      csvRows = data.courseLeads.filter(l => !String(l.payment_ref).startsWith('RM')).map(c =>
        [c.id, `"${c.name}"`, c.email, c.phone, c.payment_ref, c.payment_status, c.amount, c.paid_at || '', c.created_at].join(',')
      )
    } else if (type === 'rau-ma') {
      headers = ['ID', 'Ten', 'Email', 'SDT', 'Mã GĐ', 'Trạng thái', 'Số tiền', 'Thanh toán lúc', 'Thời gian']
      filename = 'rau-ma-dau-xanh-leads'
      csvRows = data.courseLeads.filter(l => String(l.payment_ref).startsWith('RM')).map(c =>
        [c.id, `"${c.name}"`, c.email, c.phone, c.payment_ref, c.payment_status, c.amount, c.paid_at || '', c.created_at].join(',')
      )
    } else if (type === 'stn') {
      headers = ['ID', 'Mã GĐ', 'Ten', 'SDT', 'Email', 'Địa chỉ', 'Sản phẩm', 'SL', 'Tổng tiền', 'Trạng thái', 'Thời gian']
      filename = 'sot-tron-nom-orders'
      csvRows = data.stnOrders.map(o =>
        [o.id, o.ref_code, `"${o.name}"`, o.phone, o.email, `"${o.address}"`, o.product, o.quantity, o.total_price, o.payment_status, o.created_at].join(',')
      )
    } else if (type === 'kdx') {
      headers = ['ID', 'Mã GĐ', 'Ten', 'SDT', 'Email', 'Địa chỉ', 'SL', 'Tổng tiền', 'Trạng thái', 'Thời gian']
      filename = 'khan-do-xoi-orders'
      csvRows = data.kdxOrders.map(o =>
        [o.id, o.ref_code, `"${o.name}"`, o.phone, o.email, `"${o.address}"`, o.quantity, o.total_price, o.payment_status, o.created_at].join(',')
      )
    }

    if (!filename) return
    const csvContent = [headers.join(','), ...csvRows].join('\n')
    const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  useEffect(() => {
    const savedToken = localStorage.getItem('admin_token')
    if (savedToken) { setToken(savedToken); setAuthed(true) }
  }, [])

  useEffect(() => {
    if (!authed || !token) return
    fetchAdminData(token); fetchStaff(token); fetchAuditLogs(token); fetchCourseSettings()
    const interval = setInterval(() => {
      fetchAdminData(token); fetchStaff(token); fetchAuditLogs(token)
    }, 30000)
    return () => clearInterval(interval)
  }, [authed, token, fetchAdminData, fetchStaff, fetchAuditLogs, fetchCourseSettings])

  useEffect(() => {
    if (!authed || !token) return
    fetchAuditLogs(token)
  }, [auditAction, auditTable, fetchAuditLogs, authed, token])

  const duaCaLeads = data?.courseLeads.filter(l => !String(l.payment_ref).startsWith('RM')) || []
  const rauMaLeads = data?.courseLeads.filter(l => String(l.payment_ref).startsWith('RM')) || []

  const lowerSearch = search.toLowerCase()
  const filteredGift = data?.giftLeads.filter(l =>
    l.name.toLowerCase().includes(lowerSearch) || l.email.toLowerCase().includes(lowerSearch) || l.phone.includes(search)
  ) || []
  const filteredDuaCa = duaCaLeads.filter(l =>
    l.name.toLowerCase().includes(lowerSearch) || l.email.toLowerCase().includes(lowerSearch) || l.phone.includes(search)
  )
  const filteredRauMa = rauMaLeads.filter(l =>
    l.name.toLowerCase().includes(lowerSearch) || l.email.toLowerCase().includes(lowerSearch) || l.phone.includes(search)
  )
  const filteredStn = data?.stnOrders.filter(o =>
    o.name.toLowerCase().includes(lowerSearch) || o.phone.includes(search) || o.ref_code.toLowerCase().includes(lowerSearch)
  ) || []
  const filteredKdx = data?.kdxOrders.filter(o =>
    o.name.toLowerCase().includes(lowerSearch) || o.phone.includes(search) || o.ref_code.toLowerCase().includes(lowerSearch)
  ) || []

  const allOrders = useMemo(() => {
    if (!data) return []
    const orders: { name: string; amount: number; status: string; date: string; type: string }[] = []
    data.stnOrders.forEach(o => orders.push({ name: o.name, amount: o.total_price, status: o.payment_status, date: o.created_at, type: 'STN' }))
    data.kdxOrders.forEach(o => orders.push({ name: o.name, amount: o.total_price, status: o.payment_status, date: o.created_at, type: 'KDX' }))
    duaCaLeads.forEach(l => orders.push({ name: l.name, amount: l.amount, status: l.payment_status, date: l.created_at, type: 'DCM' }))
    rauMaLeads.forEach(l => orders.push({ name: l.name, amount: l.amount, status: l.payment_status, date: l.created_at, type: 'RM' }))
    return orders.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [data, duaCaLeads, rauMaLeads])

  const isDataTab = ['gift', 'course', 'rau-ma', 'stn', 'kdx'].includes(tab)

  const tabTitle = {
    gift: 'Nhận quà', course: 'Dưa Cà Muối', 'rau-ma': 'Rau Má Đậu Xanh', stn: 'Sốt Trộn Nộm', kdx: 'Khăn Đồ Xôi',
    dashboard: '', staff: '', audit: '', settings: '',
  }[tab]

  if (!authed) {
    return (
      <div className="min-h-dvh bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-8 w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-xl bg-emerald-600 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-slate-800">Admin Portal</h1>
            <p className="text-slate-400 text-sm mt-1">hacofood.vn</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">Email</label>
              <input type="email" value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">Mật khẩu</label>
              <input type="password" value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors" required />
            </div>
            {error && <p className="text-red-600 text-sm text-center bg-red-50 p-2.5 rounded-lg">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {loading && (
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" className="opacity-25" /><path d="M4 12a8 8 0 018-8" className="opacity-75" /></svg>
              )}
              {loading ? 'Đang tải...' : 'Đăng nhập'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  const giftColumns: Column<GiftLead>[] = [
    { key: 'id', label: 'ID', render: (l) => <span className="text-slate-400 font-mono text-xs">#{l.id}</span>, sortValue: (l) => l.id },
    { key: 'name', label: 'Tên', render: (l) => <span className="font-medium text-slate-800">{l.name}</span>, sortValue: (l) => l.name },
    { key: 'email', label: 'Email', render: (l) => <span className="text-slate-600">{l.email}</span>, className: 'hidden md:table-cell' },
    { key: 'phone', label: 'SĐT', render: (l) => <span className="text-slate-600">{l.phone}</span> },
    { key: 'sent', label: 'Email gửi', render: (l) => (
      <StatusBadge status={l.email_sent ? 'paid' : 'pending'} paidLabel="Đã gửi" pendingLabel="Chưa gửi" />
    )},
    { key: 'date', label: 'Thời gian', render: (l) => <span className="text-slate-400 text-xs">{formatDateTime(l.created_at)}</span>, sortValue: (l) => l.created_at, className: 'hidden lg:table-cell' },
  ]

  const courseColumns: Column<CourseLead>[] = [
    { key: 'id', label: 'ID', render: (l) => <span className="text-slate-400 font-mono text-xs">#{l.id}</span>, sortValue: (l) => l.id },
    { key: 'name', label: 'Tên', render: (l) => <span className="font-medium text-slate-800">{l.name}</span>, sortValue: (l) => l.name },
    { key: 'email', label: 'Email', render: (l) => <span className="text-slate-600">{l.email}</span>, className: 'hidden md:table-cell' },
    { key: 'phone', label: 'SĐT', render: (l) => <span className="text-slate-600">{l.phone}</span> },
    { key: 'ref', label: 'Mã GĐ', render: (l) => <span className="font-mono text-xs text-slate-500">{l.payment_ref}</span>, className: 'hidden lg:table-cell' },
    { key: 'status', label: 'Trạng thái', render: (l) => <StatusBadge status={l.payment_status} /> },
    { key: 'date', label: 'Thời gian', render: (l) => <span className="text-slate-400 text-xs">{formatDateTime(l.created_at)}</span>, sortValue: (l) => l.created_at, className: 'hidden lg:table-cell' },
  ]

  const stnColumns: Column<StnOrder>[] = [
    { key: 'ref', label: 'Mã GĐ', render: (o) => <span className="font-mono text-xs text-slate-500">{o.ref_code}</span>, sortValue: (o) => o.ref_code },
    { key: 'name', label: 'Tên', render: (o) => <span className="font-medium text-slate-800">{o.name}</span>, sortValue: (o) => o.name },
    { key: 'phone', label: 'SĐT', render: (o) => <span className="text-slate-600">{o.phone}</span> },
    { key: 'address', label: 'Địa chỉ', render: (o) => <span className="text-slate-600 max-w-[180px] truncate block" title={o.address}>{o.address}</span>, className: 'hidden lg:table-cell' },
    { key: 'product', label: 'SP', render: (o) => <span className="text-slate-600">{o.product === '500g' ? '500g' : '1kg'}</span> },
    { key: 'qty', label: 'SL', render: (o) => <span className="text-slate-600 tabular-nums">{o.quantity}</span> },
    { key: 'total', label: 'Tổng tiền', render: (o) => <span className="font-semibold text-slate-800 tabular-nums">{formatVND(o.total_price)}</span>, sortValue: (o) => o.total_price },
    { key: 'status', label: 'TT', render: (o) => <StatusBadge status={o.payment_status} /> },
    { key: 'date', label: 'Thời gian', render: (o) => <span className="text-slate-400 text-xs">{formatDateTime(o.created_at)}</span>, sortValue: (o) => o.created_at, className: 'hidden xl:table-cell' },
  ]

  const kdxColumns: Column<KdxOrder>[] = [
    { key: 'ref', label: 'Mã GĐ', render: (o) => <span className="font-mono text-xs text-slate-500">{o.ref_code}</span>, sortValue: (o) => o.ref_code },
    { key: 'name', label: 'Tên', render: (o) => <span className="font-medium text-slate-800">{o.name}</span>, sortValue: (o) => o.name },
    { key: 'phone', label: 'SĐT', render: (o) => <span className="text-slate-600">{o.phone}</span> },
    { key: 'address', label: 'Địa chỉ', render: (o) => <span className="text-slate-600 max-w-[180px] truncate block" title={o.address}>{o.address}</span>, className: 'hidden lg:table-cell' },
    { key: 'qty', label: 'SL', render: (o) => <span className="text-slate-600 tabular-nums">{o.quantity}</span> },
    { key: 'total', label: 'Tổng tiền', render: (o) => <span className="font-semibold text-slate-800 tabular-nums">{formatVND(o.total_price)}</span>, sortValue: (o) => o.total_price },
    { key: 'status', label: 'TT', render: (o) => <StatusBadge status={o.payment_status} /> },
    { key: 'date', label: 'Thời gian', render: (o) => <span className="text-slate-400 text-xs">{formatDateTime(o.created_at)}</span>, sortValue: (o) => o.created_at, className: 'hidden xl:table-cell' },
  ]

  return (
    <div className="min-h-dvh bg-slate-50">
      <style>{`@keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>

      <Sidebar
        tab={tab}
        setTab={(t) => { setTab(t); setSearch('') }}
        onLogout={handleLogout}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />

      <div className="lg:pl-64 pb-20 lg:pb-0">
        <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
          <div className="px-4 lg:px-8 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-slate-100 transition-colors"
                aria-label="Mở menu"
              >
                <svg className="w-5 h-5 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
              </button>
              <div>
                <h1 className="font-semibold text-slate-800 text-sm lg:text-base">
                  {tabTitle || 'HaCo Admin'}
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { fetchAdminData(token); fetchStaff(token); fetchAuditLogs(token); fetchCourseSettings() }}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                aria-label="Làm mới"
              >
                <svg className={`w-4 h-4 ${dataLoading ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M23 4v6h-6M1 20v-6h6" />
                  <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
                </svg>
              </button>
            </div>
          </div>
        </header>

        <main className="px-4 lg:px-8 py-6">
          {tab === 'dashboard' && data && (
            <DashboardView
              data={data}
              duaCaLeads={duaCaLeads}
              rauMaLeads={rauMaLeads}
              setTab={(t) => { setTab(t); setSearch('') }}
              allOrders={allOrders}
            />
          )}

          {tab === 'dashboard' && !data && (
            <div className="flex items-center justify-center py-24">
              <div className="flex items-center gap-3 text-slate-400">
                <svg className="w-6 h-6 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" className="opacity-25" /><path d="M4 12a8 8 0 018-8" className="opacity-75" /></svg>
                Đang tải dữ liệu...
              </div>
            </div>
          )}

          {isDataTab && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-800">{tabTitle}</h2>
                  <p className="text-sm text-slate-500 mt-1">
                    {tab === 'gift' ? 'Danh sách người nhận quà miễn phí' :
                     tab === 'course' ? 'Học viên đăng ký khóa học Dưa Cà Muối' :
                     tab === 'rau-ma' ? 'Học viên đăng ký khóa học Rau Má Đậu Xanh' :
                     tab === 'stn' ? 'Đơn hàng Sốt Trộn Nộm' :
                     'Đơn hàng Khăn Đồ Xôi'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative flex-1 sm:flex-none">
                    <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
                    <input
                      type="text"
                      placeholder="Tìm tên, SĐT, mã GĐ..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full sm:w-64 border border-slate-200 rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
                    />
                  </div>
                  <button
                    onClick={() => exportCSV(tab)}
                    className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors whitespace-nowrap"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
                    Xuất CSV
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                {tab === 'gift' && (
                  <DataTable columns={giftColumns} data={filteredGift} loading={dataLoading} emptyText="Chưa có dữ liệu" />
                )}
                {tab === 'course' && (
                  <DataTable columns={courseColumns} data={filteredDuaCa} loading={dataLoading} emptyText="Chưa có dữ liệu" />
                )}
                {tab === 'rau-ma' && (
                  <DataTable columns={courseColumns} data={filteredRauMa} loading={dataLoading} emptyText="Chưa có dữ liệu" />
                )}
                {tab === 'stn' && (
                  <DataTable columns={stnColumns} data={filteredStn} loading={dataLoading} emptyText="Chưa có đơn hàng" />
                )}
                {tab === 'kdx' && (
                  <DataTable columns={kdxColumns} data={filteredKdx} loading={dataLoading} emptyText="Chưa có đơn hàng" />
                )}
              </div>
            </div>
          )}

          {tab === 'staff' && (
            <StaffView
              staff={staff}
              token={token}
              fetchStaff={fetchStaff}
              newStaffForm={newStaffForm}
              setNewStaffForm={setNewStaffForm}
              staffLoading={staffLoading}
              setStaffLoading={setStaffLoading}
              staffError={staffError}
              setStaffError={setStaffError}
              setToast={setToast}
            />
          )}

          {tab === 'audit' && (
            <AuditView
              auditLogs={auditLogs}
              auditAction={auditAction}
              setAuditAction={setAuditAction}
              auditTable={auditTable}
              setAuditTable={setAuditTable}
            />
          )}

          {tab === 'settings' && (
            <SettingsView
              courseSettings={courseSettings}
              settingsForm={settingsForm}
              setSettingsForm={setSettingsForm}
              token={token}
              setCourseSettings={setCourseSettings}
              setToast={setToast}
            />
          )}
        </main>
      </div>

      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-30 safe-area-inset-bottom">
        <div className="flex items-center justify-around px-2 py-1">
          {MOBILE_NAV.map(item => (
            <button
              key={item.id}
              onClick={() => { setTab(item.id); setSearch('') }}
              className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg transition-colors min-w-[56px] ${
                tab === item.id ? 'text-emerald-600' : 'text-slate-400'
              }`}
            >
              {item.icon}
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
