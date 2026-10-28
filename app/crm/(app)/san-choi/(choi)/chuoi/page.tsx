import { pageUser } from '@/lib/crm/session'
import { streakCalendar, LEVELS, MILESTONES } from '@/lib/crm/san-choi'
import { meState } from '../../state'

export const metadata = { title: 'Chuỗi của tôi' }

const CELL: Record<string, [string, string]> = {
  du_cong: ['bg-emerald-500 text-white', 'Đúng giờ, đủ ca'],
  khien: ['bg-indigo-400 text-white', 'Khiên đã đỡ'],
  di_muon: ['bg-rose-400 text-white', 'Đi muộn'], ve_som: ['bg-rose-300 text-white', 'Về sớm'], muon_som: ['bg-rose-400 text-white', 'Muộn và về sớm'],
  thieu_cham: ['bg-orange-300 text-white', 'Thiếu lượt chấm'], vang: ['bg-stone-700 text-white', 'Vắng không phép'],
  nghi_co_phep: ['bg-sky-200 text-sky-900', 'Nghỉ có phép'], chua_den: ['bg-white ring-1 ring-stone-200 text-stone-400', 'Chưa tới ca'], dang_lam: ['bg-amber-300 text-amber-950', 'Đang làm'],
}

/** Chuỗi của tôi: chuỗi tay nghề (4 cấp, thay "chuỗi khoa bảng"), lịch 5 tuần từng ca, khiên, mốc thưởng lượt. */
export default async function ChuoiPage() {
  const user = await pageUser()
  const [me, cal] = await Promise.all([meState(user.id), streakCalendar(user.id)])
  const lv = me.level
  const next = lv.next
  const pct = next ? Math.round((me.streak - lv.min) / (next.min - lv.min) * 100) : 100
  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-orange-200 bg-gradient-to-b from-orange-50 to-white p-5 text-center shadow-sm">
        <div className="text-5xl">🔥</div>
        <div className="mt-1 text-5xl font-extrabold tabular-nums text-orange-600">{me.streak}</div>
        <div className="text-sm text-stone-600">ca đúng giờ liên tiếp</div>
        <div className="mt-3 text-lg font-bold">{lv.icon} {lv.name}{lv.bonus ? <span className="ml-2 text-sm font-medium text-emerald-700">+{lv.bonus.toLocaleString('vi-VN')}đ/ca</span> : null}</div>
        {next && (
          <div className="mx-auto mt-2 max-w-xs">
            <div className="h-2.5 rounded-full bg-orange-100"><div className="h-2.5 rounded-full bg-orange-500" style={{ width: `${pct}%` }} /></div>
            <div className="mt-1 text-xs text-stone-500">Còn {next.min - me.streak} ca nữa lên {next.icon} {next.name}</div>
          </div>
        )}
        <div className="mt-3 text-sm">🛡️ Khiên đang giữ: <b>{me.shields}</b> / 1</div>
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
        <div className="mb-3 text-base font-extrabold">5 tuần gần đây</div>
        {cal.length === 0 ? <p className="text-sm text-stone-500">Chưa có ca nào được xếp.</p> : (
          <div className="grid grid-cols-7 gap-1.5">
            {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(d => <div key={d} className="text-center text-[11px] font-semibold text-stone-400">{d}</div>)}
            {/* Ô trống để ngày đầu tiên rơi đúng cột thứ */}
            {Array.from({ length: (new Date(cal[0].day + 'T12:00:00Z').getUTCDay() + 6) % 7 }, (_, i) => <div key={'b' + i} />)}
            {cal.map((c, i) => {
              const [cls, label] = CELL[c.status] ?? CELL.chua_den
              return (
                <div key={i} title={`${c.day.split('-').reverse().join('/')} · ${c.shift} · ${label}`}
                  className={`relative flex aspect-square flex-col items-center justify-center rounded-lg text-xs font-bold ${cls}`}>
                  {c.day.slice(8)}{c.perfect && <span className="absolute -right-1 -top-1 text-[11px]">⭐</span>}
                </div>
              )
            })}
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-stone-600">
          {['du_cong', 'khien', 'di_muon', 'vang', 'nghi_co_phep'].map(k => <span key={k} className="flex items-center gap-1"><span className={`h-3 w-3 rounded ${CELL[k][0]}`} />{CELL[k][1]}</span>)}
          <span>⭐ ca hoàn hảo</span>
        </div>
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
        <div className="mb-3 text-base font-extrabold">Bậc thang tay nghề</div>
        <ol className="space-y-2">
          {[...LEVELS].reverse().map(l => {
            const reached = me.streak >= l.min
            return (
              <li key={l.name} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${l.name === lv.name ? 'bg-amber-100 ring-2 ring-amber-400' : reached ? 'bg-emerald-50' : 'bg-stone-50'}`}>
                <span className="text-2xl">{l.icon}</span>
                <span className="flex-1"><b>{l.name}</b><span className="block text-xs text-stone-500">từ {l.min} ca liền</span></span>
                <span className="text-sm font-semibold text-emerald-700">{l.bonus ? `+${l.bonus / 1000}k/ca` : '—'}</span>
              </li>
            )
          })}
        </ol>
        <p className="mt-3 text-xs text-stone-500">Mốc {Object.keys(MILESTONES).join(' và ')} ca liền: +{Object.values(MILESTONES)[0]} lượt quay mỗi mốc. Muộn 1 phút là đứt chuỗi; nghỉ có phép không đứt.</p>
      </section>
    </div>
  )
}
