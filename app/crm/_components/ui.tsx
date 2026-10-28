// Thành phần giao diện dùng chung cho CRM (viên gạch "Chuẩn giao diện"): cùng khoảng cách, cùng màu, cùng kiểu bảng.
import Link from 'next/link'
import type { ReactNode } from 'react'

export function PageHeader({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-stone-900 sm:text-2xl">{title}</h1>
        {sub && <p className="mt-1 text-sm text-stone-500">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function Card({ title, actions, children, className = '', pad = true }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={`min-w-0 rounded-2xl border border-stone-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] ${className}`}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-2 border-b border-stone-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-stone-800">{title}</h2>
          {actions}
        </div>
      )}
      <div className={pad ? 'p-4' : ''}>{children}</div>
    </section>
  )
}

export function Stat({ label, value, hint, tone = 'default', href }: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'default' | 'good' | 'warn' | 'bad'; href?: string }) {
  const ring = { default: 'border-stone-200', good: 'border-emerald-200', warn: 'border-amber-200', bad: 'border-rose-200' }[tone]
  const body = (
    <div className={`h-full rounded-xl border ${ring} bg-white p-4 shadow-sm transition hover:shadow`}>
      <div className="text-xs font-medium text-stone-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-stone-900">{value}</div>
      {hint && <div className="mt-1 text-xs text-stone-500">{hint}</div>}
    </div>
  )
  return href ? <Link href={href} className="block h-full">{body}</Link> : body
}

const BADGE = {
  gray: 'bg-stone-100 text-stone-700', green: 'bg-emerald-50 text-emerald-700 ring-emerald-200', amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  red: 'bg-rose-50 text-rose-700 ring-rose-200', blue: 'bg-sky-50 text-sky-700 ring-sky-200', violet: 'bg-violet-50 text-violet-700 ring-violet-200',
} as const
export type BadgeTone = keyof typeof BADGE

export function Badge({ children, tone = 'gray', title }: { children: ReactNode; tone?: BadgeTone; title?: string }) {
  return <span title={title} className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ring-transparent ${BADGE[tone]}`}>{children}</span>
}

export function Table({ head, children, empty }: { head: ReactNode[]; children: ReactNode; empty?: string }) {
  const hasRows = Array.isArray(children) ? children.length > 0 : !!children
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
          <tr>{head.map((h, i) => <th key={i} className="whitespace-nowrap px-3 py-2 font-medium">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-stone-100">{children}</tbody>
      </table>
      {!hasRows && <div className="px-3 py-8 text-center text-sm text-stone-400">{empty ?? 'Chưa có dữ liệu'}</div>}
    </div>
  )
}

export function Td({ children, className = '' }: { children?: ReactNode; className?: string }) {
  return <td className={`px-3 py-2 align-top ${className}`}>{children}</td>
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-stone-300 bg-white px-4 py-10 text-center text-sm text-stone-500">{children}</div>
}

export function Note({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warn' }) {
  const c = tone === 'warn' ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-sky-200 bg-sky-50 text-sky-900'
  return <div className={`rounded-lg border px-3 py-2 text-sm ${c}`}>{children}</div>
}

export function Tabs({ items, current }: { items: { href: string; label: string; key: string; count?: number }[]; current: string }) {
  return (
    <div className="mb-4 flex gap-1 overflow-x-auto border-b border-stone-200">
      {items.map(t => (
        <Link key={t.key} href={t.href}
          className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm ${t.key === current ? 'border-amber-500 font-medium text-stone-900' : 'border-transparent text-stone-500 hover:text-stone-800'}`}>
          {t.label}{t.count !== undefined && <span className="ml-1 text-xs text-stone-400">{t.count}</span>}
        </Link>
      ))}
    </div>
  )
}

export function Bar({ value, max, tone = 'emerald' }: { value: number; max: number; tone?: 'emerald' | 'amber' | 'rose' }) {
  const w = max > 0 ? Math.min(100, Math.round(value / max * 100)) : 0
  const c = { emerald: 'bg-emerald-600', amber: 'bg-amber-500', rose: 'bg-rose-500' }[tone]
  return <div className="h-2 w-full rounded-full bg-stone-100"><div className={`h-2 rounded-full ${c}`} style={{ width: `${w}%` }} /></div>
}

export function Forbidden() {
  return <Empty>Bạn chưa được cấp quyền xem mục này. Liên hệ quản trị nếu cần.</Empty>
}
