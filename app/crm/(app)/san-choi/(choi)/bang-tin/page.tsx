import { getDb } from '@/lib/db'
import { pageUser, can } from '@/lib/crm/session'
import { feed, KUDOS_REASONS, type KudosReason } from '@/lib/crm/san-choi'
import { dateTime } from '@/lib/crm/format'
import { KudosForm } from '../../wheel-client'

export const metadata = { title: 'Bảng tin' }

/** Bảng tin: ai khen ai (công khai — chống thưởng cho người thân), ai trúng quà lớn, ai ghép đủ chữ. Quản lý khen ngay tại đây. */
export default async function BangTin() {
  const user = await pageUser()
  const manager = can(user, 'viec.giao') || can(user, 'cai_dat.sua')
  const allDepts = user.role === 'admin' || user.department === 'ban_giam_doc'
  const [news, staff] = await Promise.all([
    feed(30),
    manager ? getDb()`SELECT id, name FROM staff WHERE status = 'active' AND id <> ${user.id} AND (${allDepts} OR department = ${user.department}) ORDER BY name` : Promise.resolve([]),
  ])
  return (
    <div className="space-y-4">
      {manager && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm">
          <div className="mb-1 text-base font-extrabold">👏 Thưởng nóng tại chỗ</div>
          <p className="mb-3 text-xs text-stone-600">Khen ngay khi thấy việc tốt — nóng hơn thưởng cuối tháng. Lời khen hiện công khai ở bảng tin.</p>
          <KudosForm staff={staff.map(s => ({ id: s.id, name: s.name }))} reasons={KUDOS_REASONS} />
        </section>
      )}
      <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
        <div className="mb-2 text-base font-extrabold">Bảng tin</div>
        {news.length === 0 ? <p className="py-6 text-center text-sm text-stone-500">Chưa có tin nào.</p> : (
          <ul className="divide-y divide-stone-100">
            {news.map((n, i) => (
              <li key={i} className="flex gap-3 py-3">
                <span className="text-2xl leading-none">{n.type === 'khen' ? '👏' : '🎉'}</span>
                <div className="min-w-0 text-[14px]">
                  {n.type === 'khen'
                    ? <><b>{n.who}</b> khen <b>{n.to_name}</b> · {KUDOS_REASONS[n.code as KudosReason] ?? n.code}{n.text ? <span className="block text-stone-600">“{n.text}”</span> : null}
                      {n.tokens > 0 && <span className="mt-1 inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">+{n.tokens} lượt quay</span>}</>
                    : <><b>{n.who}</b> trúng <b className="text-amber-700">{n.text}</b></>}
                  <div className="text-xs text-stone-400">{dateTime(n.created_at)}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
