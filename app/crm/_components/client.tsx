'use client'
// Thành phần tương tác dùng chung: gọi API CRM (cookie phiên đi kèm tự động), báo lỗi, tải lại dữ liệu trang.
import { useRouter } from 'next/navigation'
import { useState, useTransition, type ReactNode } from 'react'

export async function api<T = unknown>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error || `Lỗi ${res.status}`)
  return data as T
}

export function useAction() {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  async function run<T>(fn: () => Promise<T>, okMsg?: string | ((r: T) => string)): Promise<T | undefined> {
    setError(null); setMessage(null)
    try {
      const r = await fn()
      if (okMsg) setMessage(typeof okMsg === 'function' ? okMsg(r) : okMsg)
      start(() => router.refresh())
      return r
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }
  return { run, pending, error, message, setError }
}

const BTN = {
  primary: 'bg-emerald-700 text-white hover:bg-emerald-800 disabled:bg-emerald-300',
  secondary: 'border border-stone-300 bg-white text-stone-700 hover:bg-stone-50 disabled:text-stone-300',
  danger: 'border border-rose-300 bg-white text-rose-700 hover:bg-rose-50',
  ghost: 'text-stone-600 hover:bg-stone-100',
} as const
export type BtnTone = keyof typeof BTN
export const btnClass = (tone: BtnTone = 'secondary', size: 'sm' | 'md' = 'md') =>
  `inline-flex items-center justify-center gap-1 rounded-lg font-medium transition ${size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-2 text-sm'} ${BTN[tone]}`

export function ActionButton({ url, method = 'POST', body, label, tone = 'secondary', size = 'md', confirm, done }:
  { url: string; method?: string; body?: unknown; label: ReactNode; tone?: BtnTone; size?: 'sm' | 'md'; confirm?: string; done?: string }) {
  const { run, pending, error, message } = useAction()
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button type="button" disabled={pending} className={btnClass(tone, size)}
        onClick={() => { if (confirm && !window.confirm(confirm)) return; run(() => api(url, method, body), done) }}>
        {pending ? 'Đang xử lý…' : label}
      </button>
      {error && <span className="text-xs text-rose-600">{error}</span>}
      {message && <span className="text-xs text-emerald-700">{message}</span>}
    </span>
  )
}

export function Feedback({ error, message }: { error: string | null; message?: string | null }) {
  if (error) return <p className="text-sm text-rose-600">{error}</p>
  if (message) return <p className="text-sm text-emerald-700">{message}</p>
  return null
}

export const inputClass = 'w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-100'
export const labelClass = 'mb-1 block text-xs font-medium text-stone-600'
