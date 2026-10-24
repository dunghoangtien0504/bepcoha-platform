// Điểm danh, Hạt Cốm, Sổ tay của Mini App (v2-A) trên PostgreSQL THẬT (haco_test). Chạy: npm run test:db
import { test, before } from 'node:test'
import assert from 'node:assert/strict'

const URL = process.env.TEST_DATABASE_URL
const skip = !URL

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sql: any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let svc: any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ck: any

const ctx = { ip: '127.0.0.1', ua: 'test' }
let n = 0
const anon = () => 'anon-ck-' + Date.now().toString(36) + '-' + n++
const phone = (k: number) => '09' + String(82000000 + k).slice(-8)

before(async () => {
  if (skip) return
  process.env.DATABASE_URL = URL
  const db = await import('../lib/db')
  const schema = await import('../lib/crm/schema')
  await schema.ensureCrmSchema()
  sql = db.getDb()
  svc = await import('../lib/mini/service')
  ck = await import('../lib/mini/checkin')
  await sql`DELETE FROM app_settings WHERE key = 'mini_points'`
})

test('thuật toán chuỗi ngày: liên tiếp, giữ chuỗi 1 lần/7 ngày, đứt khi lỡ 2 ngày', { skip: false }, async () => {
  const { computeStreak } = await import('../lib/mini/checkin')
  const T = '2026-10-24'
  assert.equal(computeStreak(['2026-10-22', '2026-10-23', '2026-10-24'], T).streak, 3)
  assert.equal(computeStreak(['2026-10-20', '2026-10-21', '2026-10-23', '2026-10-24'], T).streak, 4)
  assert.equal(computeStreak(['2026-10-18', '2026-10-20', '2026-10-22', '2026-10-24'], T).streak, 2)
  assert.equal(computeStreak(['2026-10-20', '2026-10-21'], T).streak, 0)
})

test('điểm danh: lần đầu +5, gọi lại cùng ngày không cộng thêm', { skip }, async () => {
  const id = (await svc.identify({ anon_id: anon(), phone: phone(1) }, ctx)).session.id
  const a = await ck.checkin(id)
  assert.deepEqual(a.earned.map((e: { reason: string }) => e.reason), ['diem_danh'])
  assert.equal(a.points, 5)
  assert.equal(a.checkin.today_done, true)
  const b = await ck.checkin(id)
  assert.deepEqual(b.earned, [])
  assert.equal(b.points, 5)
})

test('điểm danh: đủ 3 ngày liền thì thưởng mốc, chỉ 1 lần cho chuỗi đó', { skip }, async () => {
  const id = (await svc.identify({ anon_id: anon(), phone: phone(2) }, ctx)).session.id
  const day = (k: number) => new Date(Date.now() + 7 * 3600e3 - k * 86400e3).toISOString().slice(0, 10)
  await sql`INSERT INTO daily_checkins (mini_session_id, day) VALUES (${id}, ${day(2)}), (${id}, ${day(1)})`
  const r = await ck.checkin(id)
  assert.equal(r.checkin.streak, 3)
  const bonus = r.earned.find((e: { reason: string }) => e.reason === 'moc_chuoi')
  assert.equal(bonus?.milestone, 3)
  assert.equal(bonus?.points, 10)
  const rows = await sql`SELECT COUNT(*)::int AS n FROM points_ledger WHERE mini_session_id = ${id} AND reason = 'moc_chuoi'`
  assert.equal(rows[0].n, 1)
})

test('luật điểm ghi đè được bằng app_settings mini_points', { skip }, async () => {
  await sql`INSERT INTO app_settings (key, value) VALUES ('mini_points', ${sql.json({ checkin: 2, milestones: { '3': 7 } })})
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`
  const rules = await ck.pointsRules()
  assert.deepEqual(rules, { checkin: 2, milestones: { '3': 7 } })
  await sql`DELETE FROM app_settings WHERE key = 'mini_points'`
  assert.deepEqual(await ck.pointsRules(), ck.DEFAULT_POINTS)
})

test('khách đã xác minh: điểm danh tính theo khách — máy thứ hai cùng ngày không cộng lần nữa', { skip }, async () => {
  const p = phone(3)
  await sql`INSERT INTO pancake_orders (pos_order_id, pos_order_id_norm, phone_norm, platform, status, inserted_at)
            VALUES ('88003', '88003', ${p}, 'facebook', 3, NOW()) ON CONFLICT DO NOTHING`
  const a = (await svc.identify({ anon_id: anon(), phone: p }, ctx)).session.id
  await svc.claimOrder(a, '88003', ctx) // xác minh qua order_match
  await ck.checkin(a)
  const b = (await svc.identify({ anon_id: anon(), phone: p }, ctx)).session.id
  await svc.claimOrder(b, '88003', ctx) // phiên 2 cùng khách: đơn đã ghép → chờ duyệt, nên xác minh tay
  const { promoteMiniSession } = await import('../lib/crm/mini')
  await promoteMiniSession(b, 'staff', { type: 'staff', id: null })
  const r = await ck.checkin(b)
  assert.deepEqual(r.earned, [], 'đã điểm danh hôm nay ở máy khác')
  assert.equal(r.points, 5)
})

test('2 máy cùng điểm danh 1 ngày khi chưa xác minh, rồi cả hai xác minh → chỉ tính 1 lần (không cộng trùng)', { skip }, async () => {
  const p = phone(6)
  const a = (await svc.identify({ anon_id: anon(), phone: p }, ctx)).session.id
  const b = (await svc.identify({ anon_id: anon(), phone: p }, ctx)).session.id
  await ck.checkin(a)
  await ck.checkin(b)
  await ck.saveRecipe(b, 'nom-tron-5-phut', true)
  const { promoteMiniSession } = await import('../lib/crm/mini')
  await promoteMiniSession(a, 'staff', { type: 'staff', id: null })
  await promoteMiniSession(b, 'staff', { type: 'staff', id: null })
  const ha = await ck.homeState(await svc.loadSession(a))
  const hb = await ck.homeState(await svc.loadSession(b))
  assert.equal(ha.points, 5)
  assert.equal(hb.points, 5, 'máy thứ hai thấy cùng số dư, không phải 10')
  assert.equal(hb.checkin.streak, 1)
  assert.deepEqual(ha.saved_recipes, ['nom-tron-5-phut'], 'Sổ tay gộp theo khách sau khi xác minh')
})

test('Sổ tay: lưu, không trùng, bỏ lưu; slug sai bị từ chối; chưa đăng ký thì no_session', { skip }, async () => {
  const id = (await svc.identify({ anon_id: anon(), phone: phone(4) }, ctx)).session.id
  assert.deepEqual((await ck.saveRecipe(id, 'thit-xa-xiu', true)).saved_recipes, ['thit-xa-xiu'])
  assert.deepEqual((await ck.saveRecipe(id, 'thit-xa-xiu', true)).saved_recipes, ['thit-xa-xiu'])
  assert.deepEqual((await ck.saveRecipe(id, 'thit-xa-xiu', false)).saved_recipes, [])
  await assert.rejects(ck.saveRecipe(id, '../x', true), (e: { code: string }) => e.code === 'bad_request')
  await assert.rejects(ck.saveRecipe(null, 'thit-xa-xiu', true), (e: { code: string }) => e.code === 'no_session')
})

test('homeState: phiên mới có 0 điểm, chưa điểm danh, Sổ tay rỗng, có luật điểm', { skip }, async () => {
  const id = (await svc.identify({ anon_id: anon(), phone: phone(5) }, ctx)).session.id
  const s = await svc.loadSession(id)
  const h = await ck.homeState(s)
  assert.equal(h.points, 0)
  assert.equal(h.checkin.today_done, false)
  assert.deepEqual(h.saved_recipes, [])
  assert.equal(h.points_rules.checkin, 5)
})

test('points_earned: tiêu điểm không trừ tổng đã tích, trả lại khi huỷ đơn không cộng thêm', { skip }, async () => {
  const id = (await svc.identify({ anon_id: anon(), phone: phone(6) }, ctx)).session.id
  await ck.checkin(id)
  const { promoteMiniSession } = await import('../lib/crm/mini')
  await promoteMiniSession(id, 'staff', { type: 'staff', id: null })
  const s = await svc.loadSession(id)
  // Dòng âm chỉ ghi được khi đã gắn khách đã xác minh (ràng buộc DB).
  await sql`INSERT INTO points_ledger (mini_session_id, customer_id, delta, reason, ref) VALUES (${id}, ${s.customer_id}, -3, 'dung_don', 'HMA-T1')`
  await sql`INSERT INTO points_ledger (mini_session_id, customer_id, delta, reason, ref) VALUES (${id}, ${s.customer_id}, 3, 'hoan_don', 'HMA-T1')`
  await sql`INSERT INTO points_ledger (mini_session_id, customer_id, delta, reason, ref) VALUES (${id}, ${s.customer_id}, -2, 'dung_don', 'HMA-T2')`
  const h = await ck.homeState(s)
  assert.equal(h.points, 3)
  assert.equal(h.points_earned, 5)
})
