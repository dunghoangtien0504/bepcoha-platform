import { DEPARTMENT_LABEL, type Department } from '@/lib/crm/permissions'
import { leaderboard } from '@/lib/crm/san-choi'

export const metadata = { title: 'Bảng Vàng' }

const MEDAL = ['🥇', '🥈', '🥉']

/** Bảng Vàng tháng: bộ phận xếp theo % ca đúng giờ (không theo tổng), cá nhân chỉ hiện top 3 — không bêu người cuối bảng. */
export default async function BangVang() {
  const board = await leaderboard()
  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-b from-amber-50 to-white p-4 shadow-sm">
        <div className="text-[11px] font-bold uppercase tracking-widest text-amber-700">Bảng Vàng tháng này</div>
        <div className="mt-3 grid grid-cols-3 items-end gap-2 text-center">
          {[1, 0, 2].map(k => {
            const p = board.topStreak[k]
            return (
              <div key={k} className={k === 0 ? '' : 'pt-4'}>
                <div className="text-3xl">{MEDAL[k]}</div>
                <div className="truncate text-sm font-bold text-stone-900">{p?.name ?? '—'}</div>
                <div className="text-xs text-stone-500">{p ? `${p.streak} ca liền · ${p.level.icon}` : ''}</div>
                <div className={`mt-1 rounded-t-lg bg-amber-200/70 ${k === 0 ? 'h-16' : k === 1 ? 'h-11' : 'h-8'}`} />
              </div>
            )
          })}
        </div>
        <p className="mt-2 text-center text-xs text-stone-500">Xếp theo chuỗi đúng giờ dài nhất</p>
      </section>
      <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
        <div className="mb-2 text-base font-extrabold">Nhiều ca hoàn hảo nhất</div>
        {board.topPerfect.length === 0 ? <p className="text-sm text-stone-500">Chưa có ai trong tháng.</p> : (
          <ol className="space-y-2">{board.topPerfect.map((p, i) => <li key={p.id} className="flex justify-between text-[15px]"><span>{MEDAL[i]} {p.name}</span><b>{p.perfect} ca</b></li>)}</ol>
        )}
      </section>
      <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
        <div className="mb-3 text-base font-extrabold">Tổ đội đúng giờ nhất</div>
        {board.teams.length === 0 ? <p className="text-sm text-stone-500">Chưa có tổ đội nào đang chơi.</p> : (
          <ul className="space-y-3">
            {board.teams.map((t, i) => (
              <li key={t.department}>
                <div className="flex justify-between text-sm"><span className="font-semibold">{t.pct !== null && i < 3 ? MEDAL[i] + ' ' : ''}{DEPARTMENT_LABEL[t.department as Department] ?? t.department}</span>
                  <span className="tabular-nums text-stone-600">{t.pct === null ? 'chưa có ca' : `${t.pct}% · ${t.onTime}/${t.shifts} ca`}</span></div>
                <div className="mt-1 h-3 rounded-full bg-stone-100"><div className="h-3 rounded-full bg-gradient-to-r from-amber-300 to-amber-500" style={{ width: `${t.pct ?? 0}%` }} /></div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
