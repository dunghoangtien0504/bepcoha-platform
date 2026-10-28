// Hai agent đầu tiên của Trung tâm AI (giai đoạn 1–3 của kế hoạch). Cả hai chạy bằng quy tắc + mẫu câu,
// chưa gọi model: số liệu lấy thẳng từ DB nên không bịa (B2 K33), mẫu tin cố định nên không nói sai giá hay công dụng.
// Agent chỉ gọi propose(): được làm tới đâu do mức tự chủ trong ai_agents quyết định, không do code agent.
import { getDb } from '../db'
import { propose } from './ai'
import { businessSummary, reportAsOf } from './reports'
import { timesheet } from './attendance'
import { contactableSql } from './tasks'
import { PRODUCT_LINES, type ProductLine } from './labels'
import { moneyShort, num, addDays } from './format'

type Sql = ReturnType<typeof getDb>

const pc = (v: number) => (v * 100).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + '%'

/** Trợ lý CEO: bản tin hằng sáng về ngày hôm qua. Chỉ đọc số. */
export async function runTroLyCeo(sql: Sql = getDb()) {
  const { asOf, stale } = await reportAsOf(sql)
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })
  const y = addDays(today, -1)
  const [day, month, extra, sheet] = await Promise.all([
    businessSummary(y, y, sql),
    businessSummary(y.slice(0, 8) + '01', y, sql),
    sql`SELECT
          (SELECT COUNT(*)::int FROM crm_tasks WHERE status IN ('can_lam', 'dang_lam') AND due_at < NOW()) AS overdue,
          (SELECT COUNT(*)::int FROM ai_actions WHERE status IN ('cho_duyet', 'de_xuat')) AS waiting,
          (SELECT COUNT(*)::int FROM order_claims WHERE status = 'cho_duyet') AS claims,
          (SELECT COUNT(*)::int FROM customers WHERE first_order_at >= ${y}::date AND first_order_at < ${today}::date) AS new_customers,
          (SELECT COUNT(*)::int FROM crm_tasks WHERE status IN ('xong', 'bo_qua') AND reviewed_at IS NULL AND done_at < NOW() - INTERVAL '24 hours'
             AND done_at > NOW() - INTERVAL '7 days' AND kind NOT IN ('duyet_don_tu', 'ghep_don') AND COALESCE(edit_reason, '') NOT LIKE 'Hết hạn tự động%') AS review_late,
          (SELECT COUNT(*)::int FROM crm_tasks WHERE edit_reason LIKE 'Hết hạn tự động%' AND done_at >= ${y}::date) AS expired,
          (SELECT MAX(finished_at) FROM sync_runs WHERE ok) AS last_sync`,
    timesheet(y, y),
  ])
  const d = day.tong, m = month.tong, x = extra[0]
  const late = sheet.filter(r => ['di_muon', 've_som', 'muon_som'].includes(r.day_status as string)).length
  const absent = sheet.filter(r => ['vang', 'thieu_cham'].includes(r.day_status as string)).length
  const topChannel = [...day.kenh].sort((a, b) => b.doanh_thu - a.doanh_thu)[0]
  const lines = [
    `Bản tin ${y.slice(8)}/${y.slice(5, 7)}`,
    `• Doanh thu hôm qua ${moneyShort(d.doanh_thu)} · ${num(d.don_chot)} đơn chốt · giá trị đơn TB ${moneyShort(d.aov)}`,
    `• Từ đầu tháng ${moneyShort(m.doanh_thu)} · ${num(m.don_chot)} đơn chốt · hủy ${pc(m.ty_le_huy)} · hoàn ${pc(m.ty_le_hoan)}`,
    topChannel ? `• Kênh dẫn đầu hôm qua: ${topChannel.k} (${moneyShort(topChannel.doanh_thu)})` : '• Hôm qua chưa có đơn tính doanh thu',
    `• Khách mua lần đầu hôm qua: ${num(x.new_customers)}`,
    `• Chấm công hôm qua: ${num(late)} lượt đi muộn/về sớm · ${num(absent)} ca vắng hoặc thiếu chấm (trên ${num(sheet.length)} ca)`,
    `• Việc quá hạn: ${num(x.overdue)} · chờ duyệt AI: ${num(x.waiting)} · ghép đơn sàn chờ duyệt: ${num(x.claims)} · việc chờ duyệt quá 24 giờ: ${num(x.review_late)}`,
  ]
  if (x.expired) lines.push(`• ${num(x.expired)} việc tự sinh đã tự đóng vì quá hạn (xem nhật ký việc)`)
  if (!x.last_sync || Date.now() - new Date(x.last_sync).getTime() > 3 * 3600_000) {
    lines.push(`⚠ Đồng bộ Pancake chưa chạy hơn 3 giờ (lần cuối ${x.last_sync ? new Date(x.last_sync).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : 'chưa có'}): số đơn có thể thiếu.`)
  }
  if (stale) lines.push(`⚠ Đơn mới nhất trong CRM là ${asOf.toLocaleDateString('vi-VN')}: số hôm qua có thể thiếu, kiểm tra đồng bộ Pancake.`)
  return propose({
    agent: 'tro_ly_ceo', kind: 'bao_cao', title: lines[0], body: lines.slice(1).join('\n'), dedupeKey: `brief:${y}`,
    rationale: 'Số lấy từ đơn Pancake trong CRM theo đúng quy tắc màn Thống kê (businessSummary).',
    payload: { day: y, doanh_thu: d.doanh_thu, don_chot: d.don_chot, thang: m.doanh_thu },
  }, sql)
}

const LINE_PHRASE: Partial<Record<ProductLine, string>> = {
  sot_xa_xiu: 'hũ sốt xá xíu', sot_tron_nom: 'hũ sốt trộn nộm', sot_nuong: 'hũ sốt nướng', sot_suon: 'hũ sốt sườn',
  sot_cham_ga: 'hũ sốt chấm gà', sot_thai: 'hũ sốt thái', sot_khac: 'hũ sốt', xoi_com: 'sét xôi cốm', che_com: 'sét chè cốm',
  com_kho: 'cốm khô', hat_sen: 'hạt sen', gia_vi: 'gói gia vị',
}

const fold = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()
// Tên tổ chức / cửa hàng: không gọi "anh/chị + tên"
const BUSINESS = /\b(cong ty|cty|tnhh|co phan|jsc|cua hang|shop|quan|dai ly|nha hang|hkd|ho kinh doanh|store|mart|bep|hotel|khach san)\b/
// Họ phổ biến: tên viết kiểu "Lien Tran" (họ đứng cuối) thì lấy chữ đầu
const SURNAMES = new Set(['nguyen', 'tran', 'le', 'pham', 'hoang', 'huynh', 'phan', 'vu', 'vo', 'dang', 'bui', 'do', 'ho', 'ngo', 'duong', 'ly', 'dinh', 'truong', 'mai', 'trinh', 'lam', 'luong'])

/** Tên gọi trong tin ("chị Lan"). Tên tổ chức, tên rác hay không chắc thì không gọi tên. */
export function callName(name: string | null | undefined): string {
  const raw = String(name ?? '').trim()
  if (!raw || BUSINESS.test(fold(raw))) return ''
  const words = raw.split(/\s+/).filter(w => /^[\p{L}]{2,12}$/u.test(w))
  if (!words.length || words.length !== raw.split(/\s+/).length) return ''
  let w = words[words.length - 1]
  if (words.length >= 2 && SURNAMES.has(fold(w)) && !SURNAMES.has(fold(words[0]))) w = words[0]
  if (words.length === 1 && SURNAMES.has(fold(w))) return ''
  return w[0].toUpperCase() + w.slice(1).toLowerCase()
}

export function repurchaseMessage(name: string | null, lines: string[], days: number): string {
  const thing = lines.map(l => LINE_PHRASE[l as ProductLine]).find(Boolean)
  const who = callName(name)
  const you = who ? `anh/chị ${who}` : 'anh/chị'
  const used = thing ? `${thing[0].toUpperCase() + thing.slice(1)} nhà mình dùng được` : 'Từ lần mua trước tới nay đã'
  return `Dạ em chào ${you} ạ, em bên Bếp Cô Hạ đây. ${used} khoảng ${Math.round(days / 7)} tuần rồi, cả nhà ăn thấy hợp vị không ạ?\nNếu sắp hết, ${you} nhắn em một tiếng để Cô Hạ gửi thêm nhé.`
}

/** Giữ chân: khách lẻ đã mua 25–45 ngày trước, liên hệ được, chưa có việc mở, chưa được đề xuất trong 30 ngày. */
export async function runGiuChan(limit = 20, sql: Sql = getDb()) {
  const ok = contactableSql(sql)
  const rows = await sql`
    SELECT c.id, c.name, c.order_count, EXTRACT(DAY FROM NOW() - c.last_order_at)::int AS days,
      (SELECT o.product_lines FROM pancake_orders o WHERE o.customer_id = c.id AND o.is_real ORDER BY o.inserted_at DESC LIMIT 1) AS lines
    FROM customers c
    WHERE c.order_count >= 1 AND NOT c.is_wholesale
      AND c.last_order_at BETWEEN NOW() - INTERVAL '45 days' AND NOW() - INTERVAL '25 days'
      AND ${ok}
      AND NOT EXISTS (SELECT 1 FROM crm_tasks t WHERE t.customer_id = c.id AND t.status IN ('can_lam', 'dang_lam'))
      AND NOT EXISTS (SELECT 1 FROM ai_actions a WHERE a.customer_id = c.id AND a.agent_code = 'giu_chan' AND a.created_at > NOW() - INTERVAL '30 days')
    ORDER BY c.total_spent DESC NULLS LAST
    LIMIT ${limit}`
  const month = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).slice(0, 7)
  let proposed = 0
  for (const r of rows) {
    const lines = (r.lines as string[] | null) ?? []
    const a = await propose({
      agent: 'giu_chan', kind: 'gui_tin', customerId: r.id,
      title: `Mời mua lại: ${r.name || 'khách #' + r.id}`,
      body: repurchaseMessage(r.name, lines, r.days),
      rationale: `Đơn gần nhất ${r.days} ngày trước (${lines.map(l => PRODUCT_LINES[l as ProductLine] ?? l).join(', ') || 'chưa rõ món'}), đã mua ${r.order_count} lần.`,
      dedupeKey: `giu_chan:${r.id}:${month}`,
      expiresAt: new Date(Date.now() + 3 * 86400_000),
    }, sql)
    if (a) proposed++
  }
  return { candidates: rows.length, proposed }
}
