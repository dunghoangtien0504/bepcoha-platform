'use client'
import { useState } from 'react'
import { api, btnClass, inputClass, labelClass } from '../_components/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null)
    try {
      await api('/api/crm/auth/login', 'POST', { email, password })
      const next = new URLSearchParams(window.location.search).get('next')
      window.location.href = next && next.startsWith('/crm') ? next : '/crm'
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-100 px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="mb-6">
          <div className="text-xs font-semibold uppercase tracking-widest text-emerald-700">Bếp Cô Hạ</div>
          <h1 className="mt-1 text-2xl font-semibold text-stone-900">HACO CRM</h1>
          <p className="mt-1 text-sm text-stone-500">Đăng nhập bằng tài khoản nhân viên</p>
        </div>
        <label className={labelClass} htmlFor="email">Email hoặc tên đăng nhập</label>
        <input id="email" type="text" autoComplete="username" autoCapitalize="none" required value={email} onChange={e => setEmail(e.target.value)} className={inputClass} />
        <label className={`${labelClass} mt-3`} htmlFor="pw">Mật khẩu</label>
        <input id="pw" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} className={inputClass} />
        {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
        <button disabled={busy} className={`${btnClass('primary')} mt-5 w-full`}>{busy ? 'Đang đăng nhập…' : 'Đăng nhập'}</button>
        <p className="mt-4 text-xs text-stone-400">Nhập sai 5 lần tài khoản sẽ tạm khoá 15 phút.</p>
      </form>
    </main>
  )
}
