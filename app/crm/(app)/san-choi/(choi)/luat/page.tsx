import { getDb } from '@/lib/db'
import { DEPARTMENT_LABEL, type Department } from '@/lib/crm/permissions'
import { getSettings, LEVELS, MILESTONES, WORDS, FULL_WORD, ensureSanChoiSchema } from '@/lib/crm/san-choi'

export const metadata = { title: 'Luật chơi' }

const money = (n: number) => n.toLocaleString('vi-VN') + 'đ'

/** Thể lệ: ghi TỶ LỆ THẬT từng ô (CEO vòng 2 — bánh xe chỉ là hình vẽ, các ô không bằng nhau về xác suất). */
export default async function Luat() {
  await ensureSanChoiSchema()
  const [s, prizes] = await Promise.all([getSettings(), getDb()`SELECT label, kind, weight FROM sc_prizes WHERE active AND weight > 0 ORDER BY weight DESC`])
  const total = prizes.reduce((a, p) => a + Number(p.weight), 0) || 1
  const box = 'rounded-2xl border border-stone-200 bg-white p-4 shadow-sm'
  return (
    <div className="space-y-4 text-[15px] text-stone-700">
      <section className={box}>
        <div className="mb-2 text-base font-extrabold text-stone-900">⭐ Kiếm lượt quay</div>
        <ul className="space-y-2">
          <li><b>Ca hoàn hảo = 1 lượt</b> (tối đa 1/ngày): vào ca đúng giờ, ra đủ ca, xong hết việc của ca, quản lý đã duyệt việc.</li>
          <li><b>Giữ chuỗi</b> {Object.keys(MILESTONES).join(' và ')} ca liền: +{Object.values(MILESTONES)[0]} lượt mỗi mốc.</li>
          <li><b>Thưởng nóng</b>: quản lý khen khi bạn làm việc tốt (tối đa {s.kudos_per_receiver_month} lượt/tháng mỗi người).</li>
        </ul>
        <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">Muộn 1 phút là đứt chuỗi. Được chấm sớm 15 phút. Nghỉ có phép không đứt. Tick khống bị thu hồi lượt.</p>
      </section>
      <section className={box}>
        <div className="mb-2 text-base font-extrabold text-stone-900">🎡 Tỷ lệ trúng thật của từng ô</div>
        <ul className="divide-y divide-stone-100 text-sm">
          {prizes.map(p => <li key={p.label} className="flex justify-between py-1.5"><span>{p.label}</span><b className="tabular-nums">{(Number(p.weight) / total * 100).toFixed(1)}%</b></li>)}
        </ul>
        <p className="mt-2 text-xs text-stone-500">Trần thưởng chung {money(s.monthly_budget)}/tháng, mở {money(s.weekly_budget)} mỗi tuần. Hết ngân sách tuần thì ô tiền tạm khoá, vẫn có quà khác.</p>
      </section>
      <section className={box}>
        <div className="mb-2 text-base font-extrabold text-stone-900">🔤 Kho chữ HACO FOOD</div>
        <p>Đủ {WORDS.map(w => `${w.word} = ${w.reward / 1000}k`).join(', ')}; đủ cả hai trong tháng thêm {FULL_WORD.reward / 1000}k. Mỗi cụm 1 lần/tháng. Chữ hiếm: C, D. Chữ lẻ không đổi tiền, hết quý làm mới.</p>
      </section>
      <section className={box}>
        <div className="mb-2 text-base font-extrabold text-stone-900">🔥 Chuỗi tay nghề</div>
        <ul className="space-y-1 text-sm">{LEVELS.map(l => <li key={l.name} className="flex justify-between"><span>{l.icon} {l.name} (từ {l.min} ca)</span><span>{l.bonus ? `+${money(l.bonus)}/ca` : '—'}</span></li>)}</ul>
        <p className="mt-2 text-xs text-stone-500">🛡️ Khiên: tự đỡ 1 lần muộn/về sớm (không đỡ vắng không phép). Giữ tối đa 1, dùng tối đa 1 lần/tháng.</p>
      </section>
      <section className={box}>
        <div className="mb-2 text-base font-extrabold text-stone-900">💰 Ví thưởng</div>
        <ul className="space-y-1.5 text-sm">
          <li>🎟️ <b>Đổi voucher</b> 20k / 50k / 100k, hạn {s.voucher_days} ngày, tối đa {s.voucher_per_week}/tuần. Đưa mã cho thủ kho {s.kho_window ? `(${s.kho_window})` : ''} để lấy hàng HACO theo giá nội bộ, không thối tiền thừa. Hết hạn chưa dùng: tự hoàn về ví.</li>
          <li>💵 <b>Cộng lương</b> từ 100k, tối đa {money(s.salary_month_max)}/tháng, kế toán duyệt, chốt ngày 25.</li>
          <li>🎁 <b>Quà hiện vật</b> (món nhà làm, chọn trước ngày nghỉ): bấm “Dùng”, quản lý duyệt.</li>
        </ul>
      </section>
      <p className="text-center text-xs text-stone-500">Đang chơi: {s.departments.map(d => DEPARTMENT_LABEL[d as Department] ?? d).join(', ')} · Thể lệ v2.0 · 28/10/2026</p>
    </div>
  )
}
