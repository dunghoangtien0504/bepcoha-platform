'use client'
// Khung kiểu EasyERP (khung hình B2 bài 11 · 10:56, bài 12 · 2:53): thanh bên trắng, PHÂN HỆ gập/mở, ô "Tìm tính năng… Ctrl K",
// tab các trang đã mở, thẻ người dùng ở đáy. Điện thoại (phản biện CEO vòng 2): ẩn thanh bên, Ctrl K, tab trang;
// thay bằng thanh đáy 4 nút to — Chấm công · Việc · Sân chơi · Tôi.
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useStored, useClientValue, readStored, writeStored } from '../_components/use-stored'
import { api } from '../_components/client'
import { Icon } from '../_components/icons'
import { activeTab, type Section, type SectionTab } from './sections'

export interface NavUser { name: string; role: string; dept: string; initials: string }

type OpenTab = { href: string; label: string; icon?: string }
const DEFAULT_MODS = ['tasklist', 'san-choi']
const NO_TABS: OpenTab[] = []
const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()

function Count({ n, className = '' }: { n: number; className?: string }) {
  return n > 0 ? <span className={`rounded-full bg-rose-500 px-1.5 text-[11px] font-semibold leading-5 text-white tabular-nums ${className}`}>{n > 99 ? '99+' : n}</span> : null
}

async function logout() {
  await api('/api/crm/auth/logout', 'POST').catch(() => {})
  window.location.href = '/crm/dang-nhap'
}

export function Nav({ sections, user, approvals, siteName }: { sections: Section[]; user: NavUser; approvals: number; siteName: string | null }) {
  const path = usePathname()
  const current = activeTab(path, sections)
  const [palette, setPalette] = useState(false)
  const [sheet, setSheet] = useState(false)
  // Phân hệ đang mở: nhớ theo máy; phân hệ chứa trang hiện tại luôn mở
  const [openMods, setOpenMods] = useStored<string[]>('haco_mods', DEFAULT_MODS)
  const isOpen = (k: string) => openMods.includes(k) || current?.section.key === k
  const toggle = (k: string) => setOpenMods(openMods.includes(k) ? openMods.filter(x => x !== k) : [...openMods, k])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette(p => !p) } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const top = sections.filter(s => !s.module)
  const modules = sections.filter(s => s.module)

  const item = (t: SectionTab, onClick?: () => void) => {
    const active = current?.tab.href === t.href
    return (
      <Link key={t.href} href={t.href} onClick={onClick}
        className={`flex items-center gap-2.5 rounded-lg border-l-[3px] px-3 py-2 text-[14px] transition ${active ? 'border-amber-500 bg-amber-50 font-medium text-amber-900' : 'border-transparent text-stone-600 hover:bg-stone-50 hover:text-stone-900'}`}>
        <Icon name={t.icon ?? 'file'} className={active ? 'text-amber-600' : 'text-stone-400'} />
        <span className="min-w-0 flex-1 truncate">{t.label}</span>
        {t.href === '/crm/duyet' && <Count n={approvals} />}
      </Link>
    )
  }

  const moduleList = (onClick?: () => void) => modules.map(m => {
    const open = isOpen(m.key)
    const subs: { sub: string; tabs: SectionTab[] }[] = []
    for (const t of m.tabs) {
      const k = t.sub ?? ''
      let g = subs.find(x => x.sub === k)
      if (!g) subs.push(g = { sub: k, tabs: [] })
      g.tabs.push(t)
    }
    return (
      <div key={m.key} className="border-t border-stone-100 first:border-t-0">
        <button type="button" onClick={() => toggle(m.key)} aria-expanded={open}
          className="flex w-full items-center justify-between px-3 py-2.5 text-[11.5px] font-semibold uppercase tracking-wider text-stone-500 hover:text-stone-800">
          {m.label}<Icon name={open ? 'down' : 'chevron'} size={14} />
        </button>
        {open && (
          <div className="pb-2">
            {subs.map(g => (
              <div key={g.sub}>
                {g.sub && <div className="px-3 pb-1 pt-2 text-[10.5px] font-semibold uppercase tracking-wider text-stone-400">{g.sub}</div>}
                {g.tabs.map(t => item(t, onClick))}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  })

  const userCard = (
    <div className="flex items-center gap-2.5 border-t border-stone-200 px-3 py-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-sm font-bold text-amber-800">{user.initials}</span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-stone-900">{user.name}</div>
        <div className="truncate text-xs text-stone-500">{user.dept || user.role}</div>
      </div>
      <Link href="/crm/duyet" title="Cần duyệt" className="relative rounded-md p-1.5 text-stone-500 hover:bg-stone-100"><Icon name="inbox" />
        {approvals > 0 && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-rose-500" />}</Link>
      <Link href="/crm/tai-khoan" title="Tài khoản" className="rounded-md p-1.5 text-stone-500 hover:bg-stone-100"><Icon name="user" /></Link>
      <button type="button" onClick={logout} title="Đăng xuất" className="rounded-md p-1.5 text-rose-500 hover:bg-rose-50"><Icon name="logout" /></button>
    </div>
  )

  // Thanh đáy điện thoại: 4 nút to (CEO: cô chú bếp chấm công, xem việc, quay trong dưới 60 giây)
  const bottom = [
    { key: 'hom-nay', href: '/crm', label: 'Chấm công', icon: 'clock' },
    { key: 'viec', href: '/crm/viec', label: 'Việc', icon: 'list' },
    { key: 'san-choi', href: '/crm/san-choi', label: 'Sân chơi', icon: 'gift' },
  ]
  const bottomActive = (k: string) => !sheet && (k === 'hom-nay' ? path === '/crm' : k === 'viec' ? path.startsWith('/crm/viec') : path.startsWith('/crm/san-choi'))

  return (
    <>
      {/* Điện thoại: thanh trên gọn */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-stone-200 bg-white px-4 py-2.5 lg:hidden">
        <Logo compact />
        <span className="min-w-0 flex-1 truncate text-right text-sm font-medium text-stone-600">{current?.tab.label ?? ''}</span>
      </header>
      {sheet && (
        <div className="fixed inset-0 z-40 flex flex-col bg-white pb-20 lg:hidden">
          <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3"><Logo /><button onClick={() => setSheet(false)} className="p-2 text-stone-500"><Icon name="x" size={22} /></button></div>
          <div className="flex-1 overflow-y-auto px-2 py-2">
            {top.map(s => s.tabs.map(t => item(t, () => setSheet(false))))}
            {moduleList(() => setSheet(false))}
          </div>
          {userCard}
        </div>
      )}
      <nav className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-4 border-t border-stone-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
        {bottom.map(b => (
          <Link key={b.key} href={b.href} onClick={() => setSheet(false)} className={`flex h-16 flex-col items-center justify-center gap-1 text-[13px] ${bottomActive(b.key) ? 'font-semibold text-amber-700' : 'text-stone-500'}`}>
            <Icon name={b.icon} size={24} />{b.label}
          </Link>
        ))}
        <button type="button" onClick={() => setSheet(!sheet)} aria-expanded={sheet}
          className={`relative flex h-16 flex-col items-center justify-center gap-1 text-[13px] ${sheet ? 'font-semibold text-amber-700' : 'text-stone-500'}`}>
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-[11px] font-bold text-amber-800">{user.initials}</span>Tôi
          {approvals > 0 && <span className="absolute right-[28%] top-2 h-2.5 w-2.5 rounded-full bg-rose-500" />}
        </button>
      </nav>

      {/* Máy tính: thanh bên trắng kiểu EasyERP */}
      <aside className="sticky top-0 hidden h-screen w-[264px] shrink-0 flex-col border-r border-stone-200 bg-white lg:flex">
        <div className="flex items-center justify-between px-4 pb-3 pt-4">
          <Logo />
          <div className="flex gap-0.5 text-stone-500">
            <button type="button" onClick={() => setPalette(true)} title="Trang vừa mở" className="rounded-md p-1.5 hover:bg-stone-100"><Icon name="history" /></button>
            <button type="button" onClick={() => setPalette(true)} title="Tất cả tính năng" className="rounded-md p-1.5 hover:bg-stone-100"><Icon name="grid" /></button>
            <Link href="/crm/san-choi/luat" title="Luật chơi & trợ giúp" className="rounded-md p-1.5 text-amber-600 hover:bg-stone-100"><Icon name="help" /></Link>
          </div>
        </div>
        <div className="px-3">
          <button type="button" onClick={() => setPalette(true)}
            className="flex w-full items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-left text-sm text-stone-500 hover:border-stone-300">
            <Icon name="search" size={16} /><span className="flex-1 truncate">Tìm tính năng, trang…</span>
            <kbd className="rounded bg-stone-200 px-1.5 text-[11px] text-stone-600">Ctrl K</kbd>
          </button>
          <div className="mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-stone-700">
            <Icon name="store" size={16} className="text-stone-400" /><span className="truncate">{siteName ?? 'Bếp Cô Hạ'}</span>
          </div>
        </div>
        <div className="mt-1 flex-1 overflow-y-auto px-2 pb-3">
          <div className="mb-1 space-y-0.5">{top.map(s => s.tabs.map(t => item(t)))}</div>
          {moduleList()}
        </div>
        {userCard}
      </aside>

      {palette && <CommandPalette sections={sections} onClose={() => setPalette(false)} />}
    </>
  )
}

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/crm" className="flex items-center gap-2">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#006E32] text-sm font-black text-[#F2C14E]">H</span>
      {!compact ? (
        <span className="leading-tight">
          <span className="block text-[15px] font-bold text-stone-900">HACO <span className="text-amber-600">ERP</span></span>
          <span className="block text-[10px] font-medium uppercase tracking-widest text-stone-400">Bếp Cô Hạ</span>
        </span>
      ) : <span className="text-[15px] font-bold text-stone-900">HACO <span className="text-amber-600">ERP</span></span>}
    </Link>
  )
}

/** Ctrl K: gõ không dấu cũng tìm được ("vong quay", "xep ca"). Trang vừa mở hiện đầu tiên. */
function CommandPalette({ sections, onClose }: { sections: Section[]; onClose: () => void }) {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [i, setI] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const all = useMemo(() => sections.flatMap(s => s.tabs.map(t => ({ ...t, module: s.module ? s.label : '' }))), [sections])
  const recent = useMemo(() => { try { return (JSON.parse(readStored('haco_tabs') ?? '[]') as OpenTab[]).map(r => r.href) } catch { return [] } }, [])
  const list = useMemo(() => {
    const k = plain(q.trim())
    const hits = k ? all.filter(t => plain(t.label + ' ' + t.module).includes(k)) : [...all].sort((a, b) => (recent.includes(a.href) ? 0 : 1) - (recent.includes(b.href) ? 0 : 1))
    return hits.slice(0, 12)
  }, [q, all, recent])
  useEffect(() => { input.current?.focus() }, [])
  const go = (href: string) => { onClose(); router.push(href) }
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-stone-900/30 p-4 pt-[12vh]" onClick={onClose}>
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-stone-200 px-4"><Icon name="search" className="text-stone-400" />
          <input ref={input} value={q} onChange={e => { setQ(e.target.value); setI(0) }} placeholder="Tìm tính năng, trang… (gõ không dấu cũng được)"
            className="w-full py-3.5 text-[15px] outline-none"
            onKeyDown={e => {
              if (e.key === 'Escape') onClose()
              if (e.key === 'ArrowDown') { e.preventDefault(); setI(x => Math.min(x + 1, list.length - 1)) }
              if (e.key === 'ArrowUp') { e.preventDefault(); setI(x => Math.max(x - 1, 0)) }
              if (e.key === 'Enter' && list[i]) go(list[i].href)
            }} />
          <kbd className="rounded bg-stone-100 px-1.5 text-[11px] text-stone-500">Esc</kbd>
        </div>
        <ul className="max-h-[50vh] overflow-y-auto p-2">
          {list.length === 0 && <li className="px-3 py-6 text-center text-sm text-stone-400">Không thấy tính năng nào.</li>}
          {list.map((t, k) => (
            <li key={t.href}>
              <button type="button" onMouseEnter={() => setI(k)} onClick={() => go(t.href)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm ${k === i ? 'bg-amber-50 text-amber-900' : 'text-stone-700'}`}>
                <Icon name={t.icon ?? 'file'} className="text-stone-400" />
                <span className="flex-1">{t.label}</span>
                <span className="text-xs text-stone-400">{recent.includes(t.href) && !q ? 'vừa mở · ' : ''}{t.module}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/** Tab các trang đã mở (máy tính), như EasyERP: "Ca mẫu · Xếp ca · Tổng quan · Giao việc Cửa hàng ×". Nhớ theo máy. */
export function OpenTabs({ sections }: { sections: Section[] }) {
  const path = usePathname()
  const router = useRouter()
  const cur = activeTab(path, sections)
  const [saved, setSaved] = useStored<OpenTab[]>('haco_tabs', NO_TABS)
  // Trang đang xem luôn có tab; ghi lại vào máy (hệ thống ngoài) sau khi vẽ
  const tabs = cur && !saved.some(t => t.href === cur.tab.href) ? [...saved, { href: cur.tab.href, label: cur.tab.label, icon: cur.tab.icon }].slice(-8) : saved
  // Chỉ ghi sau khi đã đọc giá trị thật của trình duyệt (lúc hydrate vẫn là giá trị rỗng của máy chủ — ghi lúc đó sẽ xoá các tab cũ)
  const hydrated = useClientValue(() => true, false)
  useEffect(() => { if (hydrated && tabs !== saved) writeStored('haco_tabs', tabs) }, [hydrated, tabs, saved])
  const close = (href: string) => {
    const idx = tabs.findIndex(t => t.href === href)
    const next = tabs.filter(t => t.href !== href)
    setSaved(next)
    if (cur?.tab.href === href) router.push(next[Math.max(0, idx - 1)]?.href ?? '/crm')
  }
  if (tabs.length === 0) return null
  return (
    <div className="sticky top-0 z-20 -mx-8 mb-5 hidden border-b border-stone-200 bg-white/95 px-4 backdrop-blur lg:flex">
      <div className="flex min-w-0 gap-0.5 overflow-x-auto">
        {tabs.map(t => {
          const active = cur?.tab.href === t.href
          return (
            <div key={t.href} className={`group flex shrink-0 items-center border-b-2 ${active ? 'border-amber-500 bg-amber-50/60' : 'border-transparent hover:bg-stone-50'}`}>
              <Link href={t.href} className={`flex items-center gap-1.5 py-2.5 pl-3 pr-1 text-[13px] ${active ? 'font-medium text-stone-900' : 'text-stone-500'}`}>
                <Icon name={t.icon ?? 'file'} size={15} />{t.label}
              </Link>
              <button type="button" onClick={() => close(t.href)} title="Đóng tab" className="mr-1 rounded p-1 text-stone-400 opacity-60 hover:bg-stone-200 hover:text-stone-700 group-hover:opacity-100"><Icon name="x" size={13} /></button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Điện thoại: các trang con của phân hệ đang mở, kéo ngang. */
export function SectionTabs({ sections }: { sections: Section[] }) {
  const path = usePathname()
  const cur = activeTab(path, sections)
  if (!cur || cur.section.tabs.length < 2) return null
  // Trang chơi của Sân chơi đã có thanh tab riêng (Vòng quay · Ví · Chuỗi · Thêm) — không hiện 2 hàng tab
  if (cur.section.key === 'san-choi' && !cur.tab.sub) return null
  const tabs = cur.section.tabs.filter(t => !t.sub || t.sub === cur.tab.sub)
  if (tabs.length < 2) return null
  return (
    <div className="-mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4 pb-1 lg:hidden">
      {tabs.map(t => (
        <Link key={t.href} href={t.href}
          className={`whitespace-nowrap rounded-full px-3.5 py-2 text-sm ${t.href === cur.tab.href ? 'bg-amber-500 font-semibold text-white' : 'bg-white text-stone-600 ring-1 ring-stone-200'}`}>{t.label}</Link>
      ))}
    </div>
  )
}
