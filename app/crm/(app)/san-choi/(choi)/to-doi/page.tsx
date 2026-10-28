import Link from 'next/link'
import { pageUser } from '@/lib/crm/session'
import { DEPARTMENT_LABEL, DEPARTMENTS, type Department } from '@/lib/crm/permissions'
import { teamBoard, getSettings } from '@/lib/crm/san-choi'

export const metadata = { title: 'Tổ đội' }

/** Tổ đội = bộ phận. Cả tổ cùng giữ % đúng giờ; mỗi người thấy chuỗi của đồng đội để kéo nhau đi đúng giờ. */
export default async function ToDoi(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await pageUser()
  const sp = await props.searchParams
  const s = await getSettings()
  const boss = user.role === 'admin' || user.department === 'ban_giam_doc'
  const options = boss ? s.departments : s.departments.filter(d => d === user.department)
  const dept = (typeof sp.bp === 'string' && options.includes(sp.bp) ? sp.bp : options[0]) as Department | undefined
  if (!dept) return <p className="rounded-2xl border border-stone-200 bg-white p-6 text-center text-sm text-stone-500">Tổ của bạn chưa vào Sân chơi đợt này.</p>
  const team = await teamBoard(dept)
  return (
    <div className="space-y-4">
      {options.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {options.filter(d => (DEPARTMENTS as readonly string[]).includes(d)).map(d => (
            <Link key={d} href={`/crm/san-choi/to-doi?bp=${d}`} className={`rounded-full px-3 py-1.5 text-sm ${d === dept ? 'bg-amber-500 font-semibold text-white' : 'bg-white ring-1 ring-stone-200'}`}>{DEPARTMENT_LABEL[d as Department]}</Link>
          ))}
        </div>
      )}
      <section className="rounded-2xl border border-stone-200 bg-white p-5 text-center shadow-sm">
        <div className="text-[11px] font-bold uppercase tracking-widest text-amber-700">Tổ {DEPARTMENT_LABEL[dept]}</div>
        <div className="mt-1 text-5xl font-extrabold tabular-nums text-emerald-700">{team.pct ?? '—'}<span className="text-2xl">%</span></div>
        <div className="text-sm text-stone-600">ca đúng giờ tháng này · {team.onTime}/{team.shifts} ca · {team.members.length} người</div>
      </section>
      <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
        <div className="mb-2 text-base font-extrabold">Thành viên</div>
        <ul className="divide-y divide-stone-100">
          {team.members.map(m => (
            <li key={m.id} className={`flex items-center gap-3 py-2.5 ${m.id === user.id ? 'font-semibold' : ''}`}>
              <span className="text-2xl">{m.level.icon}</span>
              <span className="min-w-0 flex-1"><span className="block truncate text-[15px]">{m.name}{m.id === user.id ? ' (bạn)' : ''}</span><span className="text-xs text-stone-500">{m.level.name}{m.title ? ` · ${m.title}` : ''}</span></span>
              <span className="text-right text-sm"><b className="text-orange-600">🔥 {m.streak}</b><span className="block text-xs text-stone-500">⭐ {m.perfect} ca hoàn hảo</span></span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
