'use client'
import { useState } from 'react'
import { api, useAction, btnClass, inputClass, labelClass, Feedback } from '../../_components/client'
import { PageHeader } from '../../_components/ui'

export default function AccountPage() {
  const { run, pending, error, message } = useAction()
  const [f, setF] = useState({ old_password: '', new_password: '', again: '' })
  const mismatch = f.again !== '' && f.again !== f.new_password
  return (
    <>
      <PageHeader title="Tài khoản" sub="Đổi mật khẩu sẽ đăng xuất bạn khỏi mọi máy khác." />
      <form className="max-w-sm space-y-3 rounded-xl border border-stone-200 bg-white p-5 shadow-sm" onSubmit={async e => {
        e.preventDefault()
        if (await run(() => api('/api/crm/auth/password', 'POST', { old_password: f.old_password, new_password: f.new_password }), 'Đã đổi mật khẩu')) setF({ old_password: '', new_password: '', again: '' })
      }}>
        <div><label className={labelClass}>Mật khẩu hiện tại</label><input type="password" autoComplete="current-password" required className={inputClass} value={f.old_password} onChange={e => setF({ ...f, old_password: e.target.value })} /></div>
        <div><label className={labelClass}>Mật khẩu mới (≥ 10 ký tự)</label><input type="password" autoComplete="new-password" required minLength={10} className={inputClass} value={f.new_password} onChange={e => setF({ ...f, new_password: e.target.value })} /></div>
        <div><label className={labelClass}>Nhập lại</label><input type="password" autoComplete="new-password" required className={inputClass} value={f.again} onChange={e => setF({ ...f, again: e.target.value })} />
          {mismatch && <p className="mt-1 text-xs text-rose-600">Chưa khớp</p>}</div>
        <button disabled={pending || mismatch} className={btnClass('primary')}>Đổi mật khẩu</button>
        <Feedback error={error} message={message} />
      </form>
    </>
  )
}
