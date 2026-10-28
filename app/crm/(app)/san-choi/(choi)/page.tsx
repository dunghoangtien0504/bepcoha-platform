import Link from 'next/link'
import { getDb } from '@/lib/db'
import { pageUser } from '@/lib/crm/session'
import { letterWallet, FULL_WORD } from '@/lib/crm/san-choi'
import { dateTime } from '@/lib/crm/format'
import { ComSays } from '../mascot'
import { SpinWheel } from '../wheel-client'
import { meState } from '../state'

export const metadata = { title: 'Vòng quay của tôi' }

/** Vòng quay của tôi (khung hình B2 bài 12 · 2:53): thẻ VÒNG QUAY MAY MẮN + Kho chữ HACO FOOD + lượt quay gần đây. */
export default async function VongQuay() {
  const user = await pageUser()
  const [me, prizes, lw] = await Promise.all([
    meState(user.id),
    getDb()`SELECT id, label, short, kind FROM sc_prizes WHERE active AND weight > 0 ORDER BY sort, id`,
    letterWallet(user.id),
  ])
  const lv = me.level
  const line = !me.playing ? 'Bộ phận bạn sắp vào Sân chơi. Chờ Cốm nhé!'
    : me.tokens > 0 ? `Có ${me.tokens} lượt quay. Quay thôi!`
    : me.waitingReview > 0 ? `${me.waitingReview} ca hoàn hảo đang chờ duyệt.`
    : lv.next ? `Còn ${lv.next.min - me.streak} ca đúng giờ nữa lên ${lv.next.name}!` : 'Đầu bếp Vàng! Giữ vững nhé!'
  return (
    <div className="space-y-4">
      <ComSays mood={me.tokens > 0 ? 'tu_hao' : 'vui'} line={line} size={60} />

      <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-start justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-amber-700">Vòng quay may mắn</div>
            <div className="text-lg font-extrabold text-stone-900">{prizes.length} phần quà</div>
          </div>
          <div className="text-right text-xs text-stone-500">Mỗi lượt quay<br />chắc chắn có quà</div>
        </div>
        <SpinWheel prizes={prizes.map(p => ({ id: p.id, label: p.label, short: p.short || p.label, kind: p.kind }))} tokens={me.tokens} playing={me.playing} />
        <div className="mt-3 text-center">
          <Link href="/crm/san-choi/luat" className="text-sm font-semibold text-amber-700">📋 Xem quy tắc cấp lượt và tỷ lệ quà ›</Link>
          <div className="mt-1 text-[11px] text-stone-400">Thể lệ v2.0 · cập nhật 28/10/2026</div>
        </div>
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="text-base font-extrabold text-stone-900">Kho chữ HACO FOOD</div>
          <div className="text-xs text-stone-500">{lw.total} chữ trong quý</div>
        </div>
        <div className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-stone-500">Tiến độ ghép cụm giải</div>
        <div className="mt-2 space-y-3">
          {lw.words.map(w => {
            const pool = { ...lw.have }
            const got = [...w.word].map(ch => { const ok = (pool[ch] ?? 0) > 0; if (ok) pool[ch]--; return ok })
            const claimed = w.claimed
            return (
              <div key={w.word}>
                <div className="flex justify-between text-sm"><span className="font-semibold text-violet-700">● {w.word} <span className="font-normal text-stone-500">· {w.reward / 1000}k</span></span>
                  <span className="text-stone-500">{claimed ? (claimed.status === 'da_tra' ? '✅ đã nhận tháng này' : '⏳ chờ ngân sách tuần') : `${got.filter(Boolean).length}/${w.word.length}`}</span></div>
                <div className="mt-1.5 flex gap-1.5">
                  {[...w.word].map((ch, i) => (
                    <span key={i} className={`flex h-10 w-10 items-center justify-center rounded-lg border-2 text-lg font-extrabold ${claimed || got[i] ? 'border-violet-300 bg-violet-50 text-violet-700' : 'border-dashed border-stone-200 text-stone-300'}`}>{ch}</span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
        <p className="mt-3 text-xs text-stone-500">Đủ cả HACO và FOOD trong tháng: thêm {FULL_WORD.reward / 1000}k và lên Bảng Vàng. Chữ hiếm: <b>C</b>, <b>D</b>. Chữ lẻ không đổi ra tiền, hết quý thì làm mới.</p>
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
        <div className="mb-2 text-base font-extrabold text-stone-900">Lượt quay gần đây</div>
        {me.spins.length === 0 ? <p className="text-sm text-stone-500">Chưa quay lần nào.</p> : (
          <ul className="divide-y divide-stone-100 text-sm">
            {me.spins.map(s => <li key={s.id} className="flex justify-between gap-2 py-2"><span className="font-semibold">{s.label}</span><span className="text-xs text-stone-400">{dateTime(s.created_at)}</span></li>)}
          </ul>
        )}
      </section>
    </div>
  )
}
