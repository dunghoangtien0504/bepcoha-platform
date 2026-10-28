import Link from 'next/link'
import { pageUser } from '@/lib/crm/session'
import { meState } from '../state'
import { SoundToggle, PlayTabs } from '../wheel-client'

/**
 * Sân chơi theo bố cục EasyERP (khung hình B2 bài 12 · 2:53): cột giữa hẹp như app điện thoại,
 * thẻ người chơi (lượt quay · ví · âm thanh) rồi thanh tab Vòng quay / Ví / Chuỗi / Bảng tin / Bảng Vàng / Tổ đội.
 */
export default async function PlayLayout({ children }: { children: React.ReactNode }) {
  const user = await pageUser()
  const me = await meState(user.id)
  const words = user.name.trim().split(/\s+/)
  const initials = (words.length > 1 ? words[0][0] + words[words.length - 1][0] : user.name.slice(0, 2)).toUpperCase()
  return (
    <div className="mx-auto max-w-[460px] pt-1 lg:pt-2">
      <PlayTabs />
      <section className="mb-4 flex items-center gap-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-base font-extrabold text-amber-800">{initials}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-bold text-stone-900">{user.name}</div>
          <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-sm">
            <span><b className="text-lg tabular-nums text-[#8a5a12]">{me.tokens}</b> <span className="text-stone-500">lượt quay</span></span>
            <Link href="/crm/san-choi/vi" className="font-bold tabular-nums text-[#8a5a12]">{me.balance.toLocaleString('vi-VN')}đ <span className="font-normal text-stone-500">Ví ›</span></Link>
          </div>
          <div className="mt-0.5 text-xs text-stone-500">{me.level.icon} {me.level.name} · chuỗi <b className="text-orange-600">{me.streak}</b> ca{me.waitingReview ? ` · ${me.waitingReview} ca chờ duyệt` : ''}</div>
        </div>
        <SoundToggle />
      </section>
      {children}
    </div>
  )
}
