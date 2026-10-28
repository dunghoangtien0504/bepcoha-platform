import Link from 'next/link'
import { pageUser } from '@/lib/crm/session'
import { myVouchers, letterWallet, getSettings, REDEEM } from '@/lib/crm/san-choi'
import { dateTime } from '@/lib/crm/format'
import { MoneyWallet, VoucherList } from '../../wheel-client'
import { meState } from '../../state'

export const metadata = { title: 'Ví của tôi' }

const money = (n: number) => n.toLocaleString('vi-VN') + 'đ'

/** Ví của tôi (khung hình B2 bài 12 · 4:04–4:49): Ví tiền thưởng · Ví chữ · Ví Voucher/Coupon; sổ giao dịch có số dư sau từng dòng. */
export default async function ViPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await pageUser()
  const sp = await props.searchParams
  const w = (typeof sp.w === 'string' ? sp.w : 'tien') as 'tien' | 'chu' | 'voucher'
  const [me, settings] = await Promise.all([meState(user.id), getSettings()])
  const seg = [['tien', 'Ví tiền thưởng'], ['chu', 'Ví chữ'], ['voucher', 'Ví Voucher/Coupon']] as const
  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-stone-200 bg-white p-3 shadow-sm">
        <div className="mb-2 px-1 text-[11px] font-bold uppercase tracking-widest text-amber-700">Ví của tôi</div>
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-stone-100 p-1">
          {seg.map(([k, l]) => (
            <Link key={k} href={`/crm/san-choi/vi?w=${k}`} className={`rounded-lg px-1 py-2 text-center text-[13px] ${w === k ? 'bg-white font-bold text-stone-900 shadow-sm' : 'text-stone-500'}`}>{l}</Link>
          ))}
        </div>
      </section>

      {w === 'tien' && (
        <>
          <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
            <MoneyWallet balance={me.balance} perWeek={settings.voucher_per_week} days={settings.voucher_days} />
          </section>
          {me.redemptions.some(r => r.kind === 'luong' || r.kind === 'vat_pham') && (
            <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
              <div className="mb-2 text-base font-extrabold">Yêu cầu chờ duyệt / đã duyệt</div>
              <ul className="divide-y divide-stone-100 text-sm">
                {me.redemptions.filter(r => r.kind === 'luong' || r.kind === 'vat_pham').map(r => (
                  <li key={r.id} className="flex justify-between gap-2 py-2">
                    <span>{r.kind === 'vat_pham' ? '🎁 ' + r.item_label : `${REDEEM.luong.label} · ${money(r.amount)}`}{r.review_note ? <span className="block text-xs text-stone-500">{r.review_note}</span> : null}</span>
                    <span className={`shrink-0 text-xs font-semibold ${r.status === 'da_duyet' ? 'text-emerald-700' : r.status === 'tu_choi' ? 'text-rose-600' : 'text-amber-700'}`}>{r.status === 'da_duyet' ? 'Đã duyệt' : r.status === 'tu_choi' ? 'Từ chối' : 'Chờ duyệt'}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
            <div className="mb-1 text-base font-extrabold">Sổ giao dịch</div>
            {me.ledger.length === 0 ? <p className="py-4 text-sm text-stone-500">Ví còn trống. Quay trúng tiền hoặc giữ chuỗi để có tiền thưởng.</p> : (
              <ul className="divide-y divide-stone-100">
                {me.ledger.map(l => (
                  <li key={l.id} className="flex justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <div className="text-[14px] font-semibold text-stone-800">{l.reason}</div>
                      <div className="text-xs text-stone-400">{dateTime(l.created_at)}</div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className={`text-[15px] font-bold tabular-nums ${l.delta > 0 ? 'text-emerald-700' : 'text-rose-600'}`}>{l.delta > 0 ? '+' : '−'}{money(Math.abs(l.delta))}</div>
                      <div className="text-[11px] text-stone-400">Số dư: {money(Number(l.after))}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {w === 'chu' && <ChuTab staffId={user.id} />}
      {w === 'voucher' && <VoucherTab staffId={user.id} gifts={me.gifts.map(g => ({ id: g.id, label: g.label, status: g.status }))} />}
    </div>
  )
}

async function ChuTab({ staffId }: { staffId: number }) {
  const lw = await letterWallet(staffId)
  const letters = ['H', 'A', 'C', 'O', 'F', 'D']
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="mb-3 text-base font-extrabold">Ví chữ · {lw.total} chữ</div>
      <div className="grid grid-cols-6 gap-2">
        {letters.map(ch => (
          <div key={ch} className={`rounded-xl border-2 py-2 text-center ${lw.have[ch] ? 'border-violet-300 bg-violet-50' : 'border-dashed border-stone-200'}`}>
            <div className={`text-2xl font-extrabold ${lw.have[ch] ? 'text-violet-700' : 'text-stone-300'}`}>{ch}</div>
            <div className="text-xs text-stone-500">×{lw.have[ch] ?? 0}</div>
          </div>
        ))}
      </div>
      <ul className="mt-4 space-y-2 text-sm">
        {lw.words.map(w => <li key={w.word} className="flex justify-between"><span>Cụm <b>{w.word}</b></span><span>{w.claimed ? (w.claimed.status === 'da_tra' ? `✅ +${w.reward / 1000}k tháng này` : '⏳ chờ ngân sách tuần') : `${w.reward / 1000}k khi đủ`}</span></li>)}
      </ul>
      {lw.claims.length > 0 && <p className="mt-3 text-xs text-stone-500">Đã ghép: {lw.claims.map(c => `${c.word} (${c.month})`).join(', ')}</p>}
      <p className="mt-3 text-xs text-stone-500">Mỗi cụm nhận 1 lần/tháng. Chữ lẻ không đổi ra tiền; hết quý làm mới.</p>
    </section>
  )
}

async function VoucherTab({ staffId, gifts }: { staffId: number; gifts: { id: number; label: string; status: string }[] }) {
  const vouchers = await myVouchers(staffId)
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="text-base font-extrabold">Ví Voucher / Quà của tôi</div>
      <VoucherList gifts={gifts} vouchers={vouchers.map(v => ({ id: v.id, code: v.code, amount: v.amount, status: v.status, expires_at: new Date(v.expires_at).toISOString(), used_at: v.used_at ? new Date(v.used_at).toISOString() : null }))} />
    </section>
  )
}
