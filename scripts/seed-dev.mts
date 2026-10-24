// Nạp dữ liệu vào database PHÁT TRIỂN trên máy (không bao giờ chạy với Supabase thật):
//  - đơn Pancake thật đã xuất ở HACO-LOOP/data/orders.jsonl → pancake_orders + khách hàng
//  - danh mục 30 sản phẩm + bảng giá BG0926-001 từ HACO-LOOP/data/top30_catalog.json
//  - tài khoản nhân viên thử theo đội hình trong HACO-LOOP/00 (mật khẩu ngẫu nhiên, ghi ra .devdb/tai-khoan-thu.txt)
//  - kho ca, điểm làm việc, định biên giờ công, lịch ca 2 tuần, một ít lượt chấm công mẫu, việc tự sinh
// Chạy: npx tsx --env-file=.env.local scripts/seed-dev.mts
import { createReadStream, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { randomBytes } from 'node:crypto'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getDb } from '../lib/db'
import { ensureCrmSchema } from '../lib/crm/schema'
import { fromExportRow, upsertOrders, recomputeCustomerStats, type OrderRow } from '../lib/crm/orders'
import { generateDailyTasks, NEXT_OFFER } from '../lib/crm/tasks'
import { hashPassword } from '../lib/auth'
import { refreshSegments, ensureReferralCodes } from '../lib/loop-db'

const url = process.env.DATABASE_URL || ''
if (!/127\.0\.0\.1|localhost/.test(url)) {
  console.error('Từ chối chạy: DATABASE_URL không phải database trên máy. Script này chỉ dành cho môi trường phát triển.')
  process.exit(1)
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const loopData = join(root, '..', 'HACO-LOOP', 'data')
const sql = getDb()
await ensureCrmSchema()

// ── Nhân viên (đội hình theo HACO-LOOP/00 Phần 7; bếp/kho chưa có tên nên để tên vị trí) ─────────────
const team = [
  { email: 'coha@haco.test', name: 'Cô Hạ', role: 'admin', dept: 'ban_giam_doc', title: 'CEO' },
  { email: 'sale.ql@haco.test', name: 'Quản lý Sale', role: 'quan_ly', dept: 'sale_cskh', title: 'Trưởng nhóm Sale & CSKH' },
  { email: 'sale1@haco.test', name: 'NV Sale 1', role: 'staff', dept: 'sale_cskh', title: 'Sale & CSKH' },
  { email: 'sale2@haco.test', name: 'NV Sale 2', role: 'staff', dept: 'sale_cskh', title: 'Sale & CSKH' },
  { email: 'mkt.ql@haco.test', name: 'Quản lý Content', role: 'quan_ly', dept: 'marketing', title: 'Content Lead' },
  { email: 'mkt1@haco.test', name: 'NV Quay dựng', role: 'staff', dept: 'marketing', title: 'Quay & dựng' },
  { email: 'mkt2@haco.test', name: 'NV Editor', role: 'staff', dept: 'marketing', title: 'Editor' },
  { email: 'san.ql@haco.test', name: 'Quản lý Sàn', role: 'quan_ly', dept: 'san_tmdt', title: 'Vận hành sàn' },
  { email: 'bep1@haco.test', name: 'NV Bếp 1', role: 'quan_ly', dept: 'bep', title: 'Bếp trưởng' },
  { email: 'bep2@haco.test', name: 'NV Bếp 2', role: 'staff', dept: 'bep', title: 'Phụ bếp' },
  { email: 'kho1@haco.test', name: 'NV Kho 1', role: 'staff', dept: 'kho_van', title: 'Đóng gói' },
] as const
const accounts: string[] = []
for (const m of team) {
  const exists = (await sql`SELECT id FROM staff WHERE email = ${m.email}`)[0]
  if (exists) continue
  const pw = randomBytes(6).toString('base64url')
  await sql`INSERT INTO staff (name, email, password_hash, role, department, title) VALUES (${m.name}, ${m.email}, ${await hashPassword(pw)}, ${m.role}, ${m.dept}, ${m.title})`
  accounts.push(`${m.email}\t${pw}\t${m.name} (${m.title})`)
}
if (accounts.length) {
  const f = join(root, '.devdb', 'tai-khoan-thu.txt')
  writeFileSync(f, (existsSync(f) ? readFileSync(f, 'utf8') : 'Email\tMật khẩu\tNgười\n') + accounts.join('\n') + '\n')
  console.log(`Đã tạo ${accounts.length} tài khoản thử → .devdb/tai-khoan-thu.txt`)
}

// ── Sản phẩm ─────────────────────────────────────────────────────────────────────────────────
const famToLine: Record<string, string> = {
  'set-xoi-com': 'xoi_com', 'com-kho': 'com_kho', 'set-che-com': 'che_com', 'khan-do-xoi': 'khan', 'bot-khuc': 'bot_khuc', 'set-xoi-khuc': 'bot_khuc',
  'set-banh-khuc': 'bot_khuc', 'sot-xa-xiu': 'sot_xa_xiu', 'sot-nuong': 'sot_nuong', 'sot-tron-nom': 'sot_tron_nom', 'sot-suon': 'sot_suon',
  'sot-cham-ga': 'sot_cham_ga', 'sot-thai': 'sot_thai', 'hat-sen': 'hat_sen', 'ga-u-muoi': 'ga_u_muoi', 'bot-chien-tong-hop': 'bot_chien',
  'bot-cot-dua': 'cot_dua', 'set-che-buoi': 'buoi', 'cui-buoi-kho': 'buoi', 'cui-buoi-tuoi': 'buoi', 'may-xay-thit': 'thiet_bi',
  'ca-phe-phin': 'do_uong', 'tra-nhai': 'do_uong',
}
const cat = JSON.parse(readFileSync(join(loopData, 'top30_catalog.json'), 'utf8'))
for (const p of cat.products) {
  const line = famToLine[p.family] ?? (p.family.startsWith('sot') ? 'sot_khac' : 'gia_vi')
  const pl = p.price_list?.[0]
  const ws = (p.price_list ?? []).flatMap((x: { name: string; wholesale?: { min: string; price: number }[] }) =>
    (x.wholesale ?? []).filter(w => w.price != null).map(w => `${x.name} ${w.min}: ${w.price.toLocaleString("vi-VN")}đ`)).join('; ')
  await sql`
    INSERT INTO products (line, name, skus, retail_price, wholesale_note, next_offer, revenue_rank)
    VALUES (${line}, ${p.name}, ${p.skus}, ${pl?.retail ?? 0}, ${ws}, ${(NEXT_OFFER as Record<string, string>)[line] ?? ''}, ${p.rank})
    ON CONFLICT (line, name) DO UPDATE SET skus = EXCLUDED.skus, retail_price = EXCLUDED.retail_price, wholesale_note = EXCLUDED.wholesale_note, revenue_rank = EXCLUDED.revenue_rank`
}
console.log(`Sản phẩm: ${cat.products.length}`)

// ── Đơn Pancake thật ─────────────────────────────────────────────────────────────────────────
const ordersFile = join(loopData, 'orders.jsonl')
const have = (await sql`SELECT COUNT(*)::int AS n FROM pancake_orders`)[0].n
if (have === 0 && existsSync(ordersFile)) {
  let batch: OrderRow[] = [], n = 0
  const rl = createInterface({ input: createReadStream(ordersFile) })
  for await (const line of rl) {
    if (!line.trim()) continue
    const r = fromExportRow(JSON.parse(line))
    if (r) batch.push(r)
    if (batch.length >= 2000) { n += await upsertOrders(batch); batch = []; process.stdout.write(`\r  đơn: ${n}`) }
  }
  if (batch.length) n += await upsertOrders(batch)
  console.log(`\rĐơn Pancake đã nạp: ${n}`)
  await recomputeCustomerStats()
  await refreshSegments()
  let more = 1
  while (more) more = await ensureReferralCodes(2000)
}

// Ghi lại mốc dữ liệu: bản xuất dừng ở ngày đơn mới nhất. Giữ nguyên ngày thật (không dời) để báo cáo theo tháng đúng sự thật.
await sql`INSERT INTO sync_runs (kind, finished_at, ok, rows, detail)
  SELECT 'nap_ban_xuat', NOW(), TRUE, COUNT(*), 'Nạp từ HACO-LOOP/data/orders.jsonl, đơn mới nhất ' || to_char(MAX(inserted_at) AT TIME ZONE 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY')
  FROM pancake_orders WHERE NOT EXISTS (SELECT 1 FROM sync_runs WHERE kind = 'nap_ban_xuat')`

// ── Điểm làm việc, kho ca, định biên ─────────────────────────────────────────────────────────
await sql`INSERT INTO work_sites (name, address, lat, lng, radius_m) VALUES
  ('Bếp Cô Hạ (CẦN NHẬP TOẠ ĐỘ THẬT)', 'Hà Nội — sửa ở Cài đặt', 21.0285, 105.8542, 150) ON CONFLICT (name) DO NOTHING`
const shifts = [
  ['BEP-S', 'Bếp ca sáng', 'bep', '06:00', '14:00', 30, 'toan_ca', '#b45309'],
  ['BEP-C', 'Bếp ca chiều', 'bep', '13:00', '21:00', 30, 'toan_ca', '#c2410c'],
  ['KHO', 'Kho đóng gói', 'kho_van', '08:00', '17:00', 60, 'toan_ca', '#4d7c0f'],
  ['SALE-S', 'Sale ca sáng', 'sale_cskh', '08:00', '14:00', 0, 'ban_thoi_gian', '#0f766e'],
  ['SALE-T', 'Sale ca tối', 'sale_cskh', '14:00', '22:00', 30, 'toan_ca', '#0e7490'],
  ['VP', 'Văn phòng', null, '08:00', '17:30', 90, 'toan_ca', '#4338ca'],
  ['LIVE', 'Livestream tối', 'marketing', '19:00', '22:00', 0, 'ban_thoi_gian', '#be185d'],
] as const
for (const s of shifts) await sql`
  INSERT INTO shift_templates (code, name, department, start_time, end_time, break_minutes, kind, color)
  VALUES (${s[0]}, ${s[1]}, ${s[2]}, ${s[3]}, ${s[4]}, ${s[5]}, ${s[6]}, ${s[7]}) ON CONFLICT (code) DO NOTHING`
const targets: Record<string, number[]> = {   // giờ công/ngày theo thứ 2..CN (gợi ý ban đầu — chỉnh ở Cài đặt)
  bep: [15, 15, 15, 15, 15, 22, 15], kho_van: [8, 8, 8, 8, 8, 8, 0], sale_cskh: [20, 20, 20, 20, 20, 20, 14], marketing: [24, 24, 24, 24, 24, 3, 3],
}
for (const [d, hs] of Object.entries(targets)) for (let i = 0; i < 7; i++)
  await sql`INSERT INTO staffing_targets (department, weekday, hours) VALUES (${d}, ${i + 1}, ${hs[i]}) ON CONFLICT DO NOTHING`

// ── Lịch ca: tuần trước, tuần này, tuần sau ───────────────────────────────────────────────────
const hasShifts = (await sql`SELECT COUNT(*)::int AS n FROM shift_assignments`)[0].n
if (!hasShifts) {
  const staff = await sql`SELECT id, name, department FROM staff WHERE status = 'active' AND department IS NOT NULL AND email LIKE '%@haco.test'`
  const tpl = Object.fromEntries((await sql`SELECT id, code FROM shift_templates`).map(r => [r.code, r.id]))
  const site = (await sql`SELECT id FROM work_sites ORDER BY id LIMIT 1`)[0].id
  const plan: Record<string, string[][]> = {   // [mã ca theo thứ 2..CN] cho từng người trong bộ phận (luân phiên)
    sale_cskh: [['SALE-S', 'SALE-S', 'SALE-T', 'SALE-T', 'SALE-S', 'SALE-S', ''], ['SALE-T', 'SALE-T', 'SALE-S', 'SALE-S', 'SALE-T', '', 'SALE-S'], ['', 'SALE-S', 'SALE-T', 'SALE-T', 'SALE-T', 'SALE-T', 'SALE-T']],
    bep: [['BEP-S', 'BEP-S', 'BEP-S', 'BEP-S', 'BEP-S', 'BEP-S', ''], ['BEP-C', 'BEP-C', 'BEP-C', 'BEP-C', '', 'BEP-C', 'BEP-C']],
    kho_van: [['KHO', 'KHO', 'KHO', 'KHO', 'KHO', 'KHO', '']],
    marketing: [['VP', 'VP', 'VP', 'VP', 'VP', 'LIVE', ''], ['VP', 'VP', 'VP', 'VP', 'VP', '', 'LIVE'], ['VP', 'VP', 'LIVE', 'VP', 'VP', '', '']],
    san_tmdt: [['VP', 'VP', 'VP', 'VP', 'VP', 'VP', '']],
    ban_giam_doc: [['VP', 'VP', 'VP', 'VP', 'VP', '', '']],
  }
  const idx: Record<string, number> = {}
  const monday = new Date(); monday.setHours(12, 0, 0, 0); monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7) - 7)
  for (const s of staff) {
    const i = idx[s.department] = (idx[s.department] ?? -1) + 1
    const rows = plan[s.department]; if (!rows) continue
    const week = rows[i % rows.length]
    for (let d = 0; d < 21; d++) {
      const code = week[d % 7]; if (!code) continue
      const day = new Date(monday.getTime() + d * 86400000).toISOString().slice(0, 10)
      await sql`INSERT INTO shift_assignments (staff_id, work_date, template_id, site_id) VALUES (${s.id}, ${day}, ${tpl[code]}, ${site}) ON CONFLICT DO NOTHING`
    }
  }
  // Lượt chấm công MẪU cho các ca đã qua (đánh dấu ghi chú "dữ liệu mẫu"): đa số đúng giờ, vài lượt muộn 5–25 phút
  const past = await sql`
    SELECT a.id, a.staff_id, ((a.work_date + st.start_time) AT TIME ZONE 'Asia/Ho_Chi_Minh') AS s,
      ((a.work_date + st.end_time) AT TIME ZONE 'Asia/Ho_Chi_Minh') AS e
    FROM shift_assignments a JOIN shift_templates st ON st.id = a.template_id
    WHERE ((a.work_date + st.end_time) AT TIME ZONE 'Asia/Ho_Chi_Minh') < NOW()`
  for (const p of past) {
    const r = Math.random()
    if (r < 0.04) continue                                    // vắng
    const late = r < 0.18 ? 5 + Math.floor(Math.random() * 20) : -Math.floor(Math.random() * 10)
    const inAt = new Date(new Date(p.s).getTime() + late * 60000)
    const outAt = new Date(new Date(p.e).getTime() + (r > 0.95 ? -30 : Math.floor(Math.random() * 15)) * 60000)
    await sql`INSERT INTO attendance_logs (staff_id, assignment_id, kind, at, lat, lng, distance_m, site_id, device_id, method, validity, note)
      VALUES (${p.staff_id}, ${p.id}, 'vao', ${inAt}, 21.0286, 105.8543, 14, ${site}, 'mau', 'gps', 'hop_le', 'dữ liệu mẫu')`
    if (r < 0.97) await sql`INSERT INTO attendance_logs (staff_id, assignment_id, kind, at, lat, lng, distance_m, site_id, device_id, method, validity, note)
      VALUES (${p.staff_id}, ${p.id}, 'ra', ${outAt}, 21.0286, 105.8543, 14, ${site}, 'mau', 'gps', 'hop_le', 'dữ liệu mẫu')`
  }
  console.log(`Lịch ca 3 tuần + ${past.length} ca đã qua có chấm công mẫu`)
}

// ── Kho việc theo ca (B2 Z10): checklist mẫu cho bếp/kho ────────────────────────────────────────
const tplTasks = [
  ['bep', 'Mở ca bếp: vệ sinh, kiểm nhiệt độ tủ mát, ghi sổ HACCP', ['Vệ sinh bàn bếp', 'Nhiệt độ tủ mát ≤ 5°C', 'Ghi sổ HACCP'], 'BEP-S'],
  ['bep', 'Đóng ca bếp: dán nhãn ngày, cất nguyên liệu, rửa dụng cụ', ['Dán nhãn ngày SX', 'Cất nguyên liệu đúng chỗ', 'Rửa & phơi dụng cụ'], 'BEP-C'],
  ['kho_van', 'Đóng gói: đối chiếu đơn POScake, bỏ thẻ QR đúng lô vào hộp', ['In phiếu từ POScake', 'Bỏ đúng 1 thẻ QR/hộp', 'Chụp ảnh hộp đơn sàn'], 'KHO'],
  ['sale_cskh', 'Đầu ca: đọc hết tin chưa trả lời trên Pancake', ['Tin > 5 phút chưa trả lời = 0', 'Gắn thẻ khách hỏi giá'], null],
] as const
for (const t of tplTasks) await sql`
  INSERT INTO task_templates (department, title, checklist, shift_code) VALUES (${t[0]}, ${t[1]}, ${sql.json(t[2].map(x => ({ text: x, done: false })))}, ${t[3]})
  ON CONFLICT DO NOTHING`

// ── Lô QR mẫu + việc tự sinh ─────────────────────────────────────────────────────────────────
await sql`INSERT INTO qr_batches (code, sku, channel, cta, printed_qty, note) VALUES
  ('SXC-FB-2610', 'SXC', 'facebook', 'Quét mã — Cô Hạ tặng 21 món ăn gia đình', 500, 'Lô thử, đơn Facebook'),
  ('SXC-TT-2610', 'SXC', 'tiktok', 'Quét mã xem video hướng dẫn nấu (không kêu gọi mua ngoài sàn)', 300, 'Chờ quản lý sàn kiểm điều khoản sàn')
  ON CONFLICT DO NOTHING`
const gen = await generateDailyTasks()
console.log('Việc tự sinh:', gen)

const stats = (await sql`SELECT (SELECT COUNT(*) FROM customers)::int AS customers, (SELECT COUNT(*) FROM pancake_orders WHERE is_real)::int AS real_orders,
  (SELECT COUNT(*) FROM crm_tasks)::int AS tasks`)[0]
console.log('Xong:', stats)
await sql.end()
