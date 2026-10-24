// Nghiệp vụ /api/mini/* trên PostgreSQL THẬT (database test riêng haco_test). Chạy: npm run test:db
// Kiểm đúng các quy tắc đã chốt giữa phiên Mini App và phiên CRM (Mini-App/THIET-KE-MINI-APP-v1.md mục 6).
import { test, before } from 'node:test'
import assert from 'node:assert/strict'

const URL = process.env.TEST_DATABASE_URL
const skip = !URL

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sql: any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let svc: any

const ctx = { ip: '127.0.0.1', ua: 'test' }
const CONSENT = [{ channel: 'zalo_oa', purpose: 'cham_soc_sau_mua', text_version: 'mini-2026-10-v1' }]
let n = 0
const anon = () => 'anon-test-' + Date.now().toString(36) + '-' + n++
const phone = (k: number) => '09' + String(81000000 + k).slice(-8)

before(async () => {
  if (skip) return
  process.env.DATABASE_URL = URL
  const db = await import('../lib/db')
  const schema = await import('../lib/crm/schema')
  await schema.ensureCrmSchema()
  sql = db.getDb()
  svc = await import('../lib/mini/service')
  await sql`INSERT INTO qr_batches (code, channel, cta) VALUES ('FB-TEST-01', 'facebook', 'khoa_hoc_xoi_com') ON CONFLICT DO NOTHING`
})

async function setVoucher(on: boolean) {
  if (on) {
    await sql`INSERT INTO app_settings (key, value) VALUES ('mini_voucher', ${sql.json({ program: 'mini-test', amount: 30000, valid_days: 14 })})
              ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`
  } else {
    await sql`DELETE FROM app_settings WHERE key = 'mini_voucher'`
  }
}

async function addOrder(id: string, ph: string, platform = 'facebook', masked = false) {
  await sql`
    INSERT INTO pancake_orders (pos_order_id, pos_order_id_norm, phone_norm, phone_masked, platform, status, inserted_at)
    VALUES (${id}, ${id.toUpperCase().replace(/[\s\-#.]/g, '')}, ${masked ? '' : ph}, ${masked}, ${platform}, 3, NOW())
    ON CONFLICT (pos_order_id) DO NOTHING`
}

test('SĐT mới chưa xác minh: tạo khách source mini, phone_verified_at NULL, cấp voucher khoá theo SĐT', { skip }, async () => {
  await setVoucher(true)
  const p = phone(1)
  const res = await svc.identify({ anon_id: anon(), phone: p, consents: CONSENT, name: 'Lan' }, ctx)
  assert.equal(res.session.verified, false)
  assert.equal(res.session.phone_masked, '09******01')
  assert.equal(JSON.stringify(res).includes(p), false, 'không lộ SĐT đầy đủ')
  const c = (await sql`SELECT id, source, stage, phone_verified_at, name FROM customers WHERE phone = ${p}`)[0]
  assert.equal(c.source, 'mini')
  assert.equal(c.stage, 'moi')
  assert.equal(c.phone_verified_at, null)
  const s = (await sql`SELECT * FROM mini_sessions WHERE id = ${res.session.id}`)[0]
  assert.equal(s.created_customer, true)
  assert.equal(s.customer_id, c.id)
  assert.equal(res.rewards.length, 1)
  assert.equal(res.rewards[0].amount, 30000)
  const consent = (await sql`SELECT customer_id, verified, text_hash FROM consents WHERE mini_session_id = ${s.id}`)[0]
  assert.equal(consent.customer_id, null)
  assert.equal(consent.verified, false)
  assert.match(consent.text_hash, /^[0-9a-f]{64}$/)
})

test('SĐT đã có của khách cũ, chưa xác minh: không đụng hồ sơ, không gắn khách, KHÔNG cấp voucher', { skip }, async () => {
  await setVoucher(true)
  const p = phone(2)
  const cid = (await sql`INSERT INTO customers (phone, name, source, segments) VALUES (${p}, 'Tên thật', 'pancake', ARRAY['A']::text[]) RETURNING id`)[0].id
  await sql`INSERT INTO reward_ledger (customer_id, kind, program, amount, code, status) VALUES (${cid}, 'voucher', 'cu', 50000, 'OLDCODE2', 'da_cap')`
  const res = await svc.identify({ anon_id: anon(), phone: p, consents: CONSENT, name: 'Kẻ gõ nhầm' }, ctx)
  assert.equal(res.rewards.length, 0)
  const c = (await sql`SELECT name, segments, source FROM customers WHERE id = ${cid}`)[0]
  assert.equal(c.name, 'Tên thật')
  assert.deepEqual(c.segments, ['A'])
  const s = (await sql`SELECT customer_id, created_customer FROM mini_sessions WHERE id = ${res.session.id}`)[0]
  assert.equal(s.customer_id, null)
  assert.equal(s.created_customer, false)
  const me = await svc.getMe(res.session.id)
  assert.equal(me.rewards.length, 0, 'không thấy voucher cũ của khách thật')
  assert.equal(me.claims.length, 0)
  assert.equal(me.referral_code, null)
  const acts = await sql`SELECT 1 FROM customer_activities WHERE customer_id = ${cid}`
  assert.equal(acts.length, 0)
})

test('ghép mã đơn khớp SĐT → da_khop, xác minh order_match, gắn khách, cấp voucher lúc xác minh', { skip }, async () => {
  await setVoucher(true)
  const p = phone(3)
  const cid = (await sql`INSERT INTO customers (phone, name, source) VALUES (${p}, 'Chị Hoa', 'pancake') RETURNING id`)[0].id
  await addOrder('C5400123.0001', p)
  const id = (await svc.identify({ anon_id: anon(), phone: p, consents: CONSENT }, ctx)).session.id
  const r = await svc.claimOrder(id, 'c5400123-0001', ctx)
  assert.equal(r.status, 'da_khop')
  assert.equal(r.session.verified, true)
  assert.equal(r.session.verified_via, 'order_match')
  const s = (await sql`SELECT customer_id FROM mini_sessions WHERE id = ${id}`)[0]
  assert.equal(s.customer_id, cid)
  const consent = (await sql`SELECT customer_id, verified FROM consents WHERE mini_session_id = ${id}`)[0]
  assert.equal(consent.customer_id, cid)
  assert.equal(consent.verified, true)
  const me = await svc.getMe(id)
  assert.equal(me.rewards.length, 1)
  assert.equal(me.claims[0].status, 'da_khop')
  const acts = (await sql`SELECT kind FROM customer_activities WHERE customer_id = ${cid}`).map((a: { kind: string }) => a.kind)
  assert.ok(acts.includes('order_claim_matched'))
})

test('một đơn chỉ được nhận một lần: phiên thứ hai cùng mã → chờ duyệt, không xác minh', { skip }, async () => {
  const p = phone(4)
  await addOrder('77001', p)
  const a = (await svc.identify({ anon_id: anon(), phone: p }, ctx)).session.id
  assert.equal((await svc.claimOrder(a, '77001', ctx)).status, 'da_khop')
  const b = (await svc.identify({ anon_id: anon(), phone: p }, ctx)).session.id
  const r = await svc.claimOrder(b, '77001', ctx)
  assert.equal(r.status, 'cho_duyet')
  assert.equal(r.session.verified, false)
})

test('mã đơn đúng nhưng SĐT khác, hoặc đơn sàn (SĐT bị che) → chờ duyệt, không xác minh, không trả lý do', { skip }, async () => {
  await addOrder('77002', phone(50))
  await addOrder('580000000000000777', '', 'tiktok', true)
  const id = (await svc.identify({ anon_id: anon(), phone: phone(5) }, ctx)).session.id
  const r1 = await svc.claimOrder(id, '77002', ctx)
  assert.equal(r1.status, 'cho_duyet')
  assert.equal(r1.session.verified, false)
  assert.equal('lookup_result' in r1, false)
  const r2 = await svc.claimOrder(id, '580000000000000777', ctx)
  assert.equal(r2.status, 'cho_duyet')
  const rows = (await sql`SELECT lookup_result FROM order_claims WHERE mini_session_id = ${id} ORDER BY id`).map((x: { lookup_result: string }) => x.lookup_result)
  assert.deepEqual(rows, ['sai_sdt', 'don_san'])
})

test('nhập sai 5 lần/phiên → khoá nhập mã 24 giờ (429 claim_locked)', { skip }, async () => {
  const id = (await svc.identify({ anon_id: anon(), phone: phone(6) }, ctx)).session.id
  for (let i = 0; i < 5; i++) await svc.claimOrder(id, '9' + String(10000 + i), ctx)
  await assert.rejects(svc.claimOrder(id, '99999', ctx), (e: { status: number; code: string; extra: { until?: string } }) => e.status === 429 && e.code === 'claim_locked' && !!e.extra.until)
})

test('mã đơn quá ngắn bị từ chối, không tính vào giới hạn', { skip }, async () => {
  const id = (await svc.identify({ anon_id: anon(), phone: phone(7) }, ctx)).session.id
  await assert.rejects(svc.claimOrder(id, '12', ctx), (e: { code: string }) => e.code === 'invalid_code')
  const c = await sql`SELECT COUNT(*)::int AS n FROM order_claims WHERE mini_session_id = ${id}`
  assert.equal(c[0].n, 0)
})

test('tiến độ học: bài chưa mở → 403; xem ≥ 90% → hoàn thành; tiến độ không giảm', { skip }, async () => {
  const id = (await svc.identify({ anon_id: anon(), phone: phone(8) }, ctx)).session.id
  await assert.rejects(svc.recordProgress(id, 8, 50), (e: { status: number; code: string }) => e.status === 403 && e.code === 'not_unlocked')
  const r = await svc.recordProgress(id, 1, 95)
  assert.ok(r.completed_at)
  const r2 = await svc.recordProgress(id, 1, 10)
  assert.equal(r2.watched_pct, 95)
  const me = await svc.getMe(id)
  assert.equal(me.lessons[0].watched_pct, 95)
})

test('event: client không tự gửi qr_scan; bỏ event lệch giờ > 24h; mở lại trong 30 phút không đếm quét lần 2', { skip }, async () => {
  const a = anon()
  await svc.startSession({ anon_id: a, batch: 'fb-test-01' }, null)
  await svc.startSession({ anon_id: a, batch: 'FB-TEST-01' }, null)
  const kept = await svc.recordEvents({ anon_id: a, events: [
    { name: 'qr_scan', step: 1 },
    { name: 'welcome_view', step: 3 },
    { name: 'combo_click', step: 7, at: new Date(Date.now() - 3 * 86400000).toISOString() },
  ] }, null)
  assert.equal(kept, 1)
  const rows = (await sql`SELECT name, step FROM funnel_events WHERE anon_id = ${a} ORDER BY id`).map((r: { name: string }) => r.name)
  assert.deepEqual(rows, ['qr_scan', 'welcome_view'])
})

test('event: tối đa 60 event/anon_id/phút (đếm trong DB)', { skip }, async () => {
  const a = anon()
  let total = 0
  for (let i = 0; i < 4; i++) total += await svc.recordEvents({ anon_id: a, events: Array.from({ length: 20 }, () => ({ name: 'lesson_open' })) }, null)
  assert.equal(total, 60)
})

test('event ẩn danh trước đăng ký được gom vào phiên; promote gắn vào khách', { skip }, async () => {
  const a = anon()
  const p = phone(9)
  await svc.recordEvents({ anon_id: a, events: [{ name: 'welcome_view' }] }, null)
  await addOrder('77009', p)
  const id = (await svc.identify({ anon_id: a, phone: p }, ctx)).session.id
  await svc.claimOrder(id, '77009', ctx)
  const ev = (await sql`SELECT mini_session_id, customer_id FROM funnel_events WHERE anon_id = ${a} AND name = 'welcome_view'`)[0]
  assert.equal(ev.mini_session_id, id)
  assert.ok(ev.customer_id)
})

test('ngừng nhận tin: chưa xác minh chỉ ghi revoked_at; đã xác minh bật opted_out_at', { skip }, async () => {
  const p1 = phone(10)
  const cid1 = (await sql`INSERT INTO customers (phone, source) VALUES (${p1}, 'pancake') RETURNING id`)[0].id
  const u = (await svc.identify({ anon_id: anon(), phone: p1, consents: CONSENT }, ctx)).session.id
  await svc.revokeConsent(u, undefined, ctx)
  assert.ok((await sql`SELECT revoked_at FROM consents WHERE mini_session_id = ${u}`)[0].revoked_at)
  assert.equal((await sql`SELECT opted_out_at FROM customers WHERE id = ${cid1}`)[0].opted_out_at, null)

  const p2 = phone(11)
  await addOrder('77011', p2)
  const v = (await svc.identify({ anon_id: anon(), phone: p2, consents: CONSENT }, ctx)).session.id
  await svc.claimOrder(v, '77011', ctx)
  await svc.revokeConsent(v, undefined, ctx)
  const c2 = (await sql`SELECT opted_out_at FROM customers WHERE phone = ${p2}`)[0]
  assert.ok(c2.opted_out_at)
})

test('mỗi SĐT chỉ nhận voucher một lần; chưa cấu hình voucher thì không cấp', { skip }, async () => {
  await setVoucher(false)
  const r0 = await svc.identify({ anon_id: anon(), phone: phone(12) }, ctx)
  assert.equal(r0.rewards.length, 0)
  await setVoucher(true)
  const p = phone(13)
  await addOrder('77013', p)
  const a = (await svc.identify({ anon_id: anon(), phone: p }, ctx)).session.id
  assert.equal((await svc.getMe(a)).rewards.length, 1, 'số mới: cấp ngay')
  await svc.claimOrder(a, '77013', ctx)
  const n = await sql`SELECT COUNT(*)::int AS n FROM reward_ledger WHERE locked_phone = ${p} AND program = 'mini-test'`
  assert.equal(n[0].n, 1)
})

test('câu đồng ý sai phiên bản / SĐT sai / anon_id sai → lỗi đúng mã', { skip }, async () => {
  await assert.rejects(svc.identify({ anon_id: anon(), phone: phone(14), consents: [{ channel: 'zalo_oa', purpose: 'cham_soc_sau_mua', text_version: 'v0' }] }, ctx), (e: { code: string }) => e.code === 'invalid_consent')
  await assert.rejects(svc.identify({ anon_id: anon(), phone: '0212345678' }, ctx), (e: { code: string }) => e.code === 'invalid_phone')
  await assert.rejects(svc.identify({ anon_id: 'x', phone: phone(15) }, ctx), (e: { code: string }) => e.code === 'bad_request')
})

test('một máy (anon_id) tạo tối đa 5 phiên/ngày', { skip }, async () => {
  const a = anon()
  for (let i = 0; i < 5; i++) await svc.identify({ anon_id: a, phone: phone(20 + i) }, ctx)
  await assert.rejects(svc.identify({ anon_id: a, phone: phone(30) }, ctx), (e: { status: number }) => e.status === 429)
})
