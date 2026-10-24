'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import type { Permission } from '@/lib/crm/permissions'
import { api } from '../_components/client'

export interface NavItem { href: string; label: string; icon: string; perm: Permission | null; group?: string }

export function Nav({ items, who }: { items: NavItem[]; who: string }) {
  const path = usePathname()
  const [open, setOpen] = useState(false)
  const active = (href: string) => (href === '/crm' ? path === '/crm' : path.startsWith(href))
  const groups: { name: string; items: NavItem[] }[] = []
  for (const it of items) {
    const name = it.group ?? ''
    let g = groups.find(x => x.name === name)
    if (!g) groups.push(g = { name, items: [] })
    g.items.push(it)
  }
  async function logout() {
    await api('/api/crm/auth/logout', 'POST').catch(() => {})
    window.location.href = '/crm/dang-nhap'
  }
  const list = (
    <nav className="flex flex-col gap-4">
      {groups.map(g => (
        <div key={g.name}>
          {g.name && <div className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-emerald-200/70">{g.name}</div>}
          {g.items.map(it => (
            <Link key={it.href} href={it.href} onClick={() => setOpen(false)}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm ${active(it.href) ? 'bg-white/15 font-medium text-white' : 'text-emerald-50/80 hover:bg-white/10 hover:text-white'}`}>
              <span aria-hidden className="w-4 text-center text-base leading-none">{it.icon}</span>{it.label}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  )
  return (
    <>
      {/* Thanh trên cùng cho điện thoại */}
      <header className="sticky top-0 z-30 flex items-center justify-between bg-emerald-900 px-4 py-3 text-white lg:hidden">
        <Link href="/crm" className="font-semibold">HACO CRM</Link>
        <button onClick={() => setOpen(!open)} className="rounded-md px-2 py-1 text-sm ring-1 ring-white/30" aria-expanded={open}>{open ? 'Đóng' : 'Menu'}</button>
      </header>
      {open && <div className="fixed inset-0 z-20 overflow-y-auto bg-emerald-900 px-3 pb-8 pt-16 lg:hidden">{list}
        <div className="mt-6 border-t border-white/15 px-3 pt-4 text-xs text-emerald-100">{who}<Link href="/crm/tai-khoan" onClick={() => setOpen(false)} className="mt-2 block underline">Tài khoản</Link><button onClick={logout} className="mt-2 block underline">Đăng xuất</button></div></div>}
      {/* Thanh bên cho máy tính */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col justify-between overflow-y-auto bg-emerald-900 px-3 py-5 lg:flex">
        <div>
          <Link href="/crm" className="mb-6 block px-3">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-amber-300">Bếp Cô Hạ</div>
            <div className="text-lg font-semibold text-white">HACO CRM</div>
          </Link>
          {list}
        </div>
        <div className="mt-6 border-t border-white/15 px-3 pt-4 text-xs text-emerald-100">
          <div className="truncate" title={who}>{who}</div>
          <div className="mt-2 flex gap-3">
            <Link href="/crm/tai-khoan" className="text-emerald-200 underline hover:text-white">Tài khoản</Link>
            <button onClick={logout} className="text-emerald-200 underline hover:text-white">Đăng xuất</button>
          </div>
        </div>
      </aside>
    </>
  )
}
