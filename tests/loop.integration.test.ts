// Kiểm tra SQL của vòng lặp trên PostgreSQL THẬT (bản nháp).
// Chạy: DB_SSL=off TEST_DATABASE_URL=postgres://... npx --yes tsx --test tests/loop.integration.test.ts
import { test, before } from 'node:test'
import assert from 'node:assert/strict'

const URL = process.env.TEST_DATABASE_URL
const skip = !URL

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sql: any

before(async () => {
  if (skip) return
  process.env.DATABASE_URL = URL
  db = await import('../lib/db')
  await db.initDb()
  sql = db.getDb()
})

const phone = (n: number) => '09' + String(30000000 + n).slice(-8)

async function addCustomer(n: number, o: { orders?: number; spent?: number; daysAgo?: number; email?: string; optedOut?: boolean } = {}) {
  const rows = await sql`
    INSERT INTO customers (phone, name, email, source, order_count, total_spent, last_order_at, opted_out_at)
    VALUES (${phone(n)}, ${'Khach ' + n}, ${o.email ?? ''}, 'pancake', ${o.orders ?? 1}, ${o.spent ?? 200000},
            NOW() - make_interval(days => ${o.daysAgo ?? 100}), ${o.optedOut ? sql`NOW()` : null})
    RETURNING id
  `
  return rows[0].id as number
}

test('lead quà thành khách (CRM chung), nhóm, nhập bảng tính, không ghi đè dữ liệu có sẵn', { skip }, async () => {
  const loop = await import('../lib/loop-db')
  const exist = await addCustomer(601, { orders: 1, spent: 100000, daysAgo: 100 })
  await sql`UPDATE customers SET name = 'Tên gốc', segments = ARRAY['A']::text[] WHERE id = ${exist}`
  await db.insertGiftLead({ name: 'Tên khác', email: 'lead601@x.com', phone: phone(601), consentText: 'ok', segmentAnswer: 'B' })
  await db.insertGiftLead({ name: 'Khach moi', email: 'lead602@x.com', phone: phone(602), segmentAnswer: 'D' })
  await db.insertGiftLead({ name: 'Sai so', email: 'bad@x.com', phone: '123' })
  assert.ok((await loop.mergeGiftLeadsIntoCustomers()) >= 2)
  assert.equal(await loop.mergeGiftLeadsIntoCustomers(), 0)
  const a = (await sql`SELECT name, email, segments, order_count FROM customers WHERE id = ${exist}`)[0]
  assert.equal(a.name, 'Tên gốc')
  assert.deepEqual(a.segments, ['A', 'B'])
  assert.equal(a.order_count, 1)
  const b = (await sql`SELECT name, segments, total_spent FROM customers WHERE phone = ${phone(602)}`)[0]
  assert.equal(b.name, 'Khach moi')
  assert.deepEqual(b.segments, ['D'])
  assert.equal(Number(b.total_spent), 0)

  const { parseSheetLeads } = await import('../lib/loop')
  const { normalizePhone } = await import('../lib/phone')
  const csv = `phone,name,email,segment,source\n${phone(603)},Tu Sheet,s603@x.com,c,facebook\n${phone(601)},Bo qua,,d,fb\n`
  const { leads } = parseSheetLeads(csv, normalizePhone)
  assert.equal(await loop.upsertSheetLeads(leads), 2)
  const c = (await sql`SELECT name, segments FROM customers WHERE phone = ${phone(603)}`)[0]
  assert.equal(c.name, 'Tu Sheet')
  assert.deepEqual(c.segments, ['C'])
  const a2 = (await sql`SELECT name, segments FROM customers WHERE id = ${exist}`)[0]
  assert.equal(a2.name, 'Tên gốc')
  assert.deepEqual(a2.segments, ['A', 'B', 'D'])
})

test('nhóm C khi mua khóa; nhóm A mặc định cho khách đã mua', { skip }, async () => {
  const loop = await import('../lib/loop-db')
  const c1 = await addCustomer(701, { orders: 1, spent: 150000 })
  const c2 = await addCustomer(702, { orders: 1, spent: 150000 })
  await sql`UPDATE customers SET segments = '{}' WHERE id IN (${c1}, ${c2})`
  await sql`INSERT INTO course_leads (name, email, phone, payment_ref, payment_status, amount, paid_at) VALUES ('K', 'k702@x.com', ${phone(702)}, 'DHSEG702', 'paid', 299000, NOW())`
  await loop.refreshSegments()
  const r = await sql`SELECT id, segments FROM customers WHERE id IN (${c1}, ${c2})`
  const by = (id: number) => r.find((x: { id: number }) => x.id === id).segments
  assert.deepEqual(by(c1), ['A'])
  assert.ok(by(c2).includes('C'))
})

test('mã giới thiệu duy nhất, ghi nhận người giới thiệu, thưởng đúng 1 lần, chặn tự giới thiệu', { skip }, async () => {
  const loop = await import('../lib/loop-db')
  const ref = await addCustomer(801, { orders: 2, spent: 500000 })
  const buyer = await addCustomer(802, { orders: 1, spent: 200000 })
  const self = await addCustomer(803, { orders: 1, spent: 200000 })
  assert.ok((await loop.ensureReferralCodes()) >= 3)
  const codes = await sql`SELECT id, referral_code FROM customers WHERE id IN (${ref}, ${buyer}, ${self})`
  assert.ok(codes.every((c: { referral_code: string }) => /^[2-9A-HJKMNP-Z]{6}$/.test(c.referral_code)))
  assert.equal(new Set(codes.map((c: { referral_code: string }) => c.referral_code)).size, 3)
  const refCode = codes.find((c: { id: number }) => c.id === ref).referral_code
  const selfCode = codes.find((c: { id: number }) => c.id === self).referral_code

  await db.insertGiftLead({ name: 'B', email: 'b802@x.com', phone: phone(802), referredByCode: refCode.toLowerCase() })
  await db.insertGiftLead({ name: 'S', email: 's803@x.com', phone: phone(803), referredByCode: selfCode })
  assert.ok((await loop.resolveReferrals()) >= 1)
  const rb = await sql`SELECT id, referred_by FROM customers WHERE id IN (${buyer}, ${self})`
  assert.equal(rb.find((x: { id: number }) => x.id === buyer).referred_by, ref)
  assert.equal(rb.find((x: { id: number }) => x.id === self).referred_by, null)

  assert.ok((await loop.createReferralRewardTasks()) >= 1)
  assert.equal(await loop.createReferralRewardTasks(), 0)
  const t = await sql`SELECT title, customer_id FROM crm_tasks WHERE auto_key = ${'ref:' + buyer}`
  assert.equal(t.length, 1)
  assert.equal(t[0].customer_id, ref)
})

test('việc theo mốc vòng đời: đúng người, đúng 1 lần, bỏ qua khách từ chối và nhóm đối chứng', { skip }, async () => {
  const loop = await import('../lib/loop-db')
  const d7 = await addCustomer(901, { orders: 1, spent: 150000, daysAgo: 8, email: 'd7@x.com' })
  const early = await addCustomer(902, { orders: 1, spent: 150000, daysAgo: 2 })
  const nx = await addCustomer(903, { orders: 1, spent: 150000, daysAgo: 15 })
  const optout = await addCustomer(904, { orders: 1, spent: 150000, daysAgo: 8, optedOut: true })
  const hold = await addCustomer(905, { orders: 1, spent: 150000, daysAgo: 8 })
  const vip = await addCustomer(906, { orders: 5, spent: 9000000, daysAgo: 20 })
  await sql`UPDATE customers SET name = 'Nguyen Van D7' WHERE id = ${d7}`
  const camp = await sql`INSERT INTO care_campaigns (key, name, criteria, created_by) VALUES ('kloop', 'x', ${sql.json({ goal: 'repeat' } as never)}, 0) RETURNING id`
  await sql`INSERT INTO care_campaign_members (campaign_id, customer_id, arm, order_count_at_start, total_spent_at_start) VALUES (${camp[0].id}, ${hold}, 'holdout', 1, 150000)`

  const r1 = await loop.createLifecycleTasks()
  assert.ok(r1.d7 >= 1 && r1.next >= 1 && r1.vip >= 1)
  const has = async (key: string) => await sql`SELECT title FROM crm_tasks WHERE auto_key = ${key}`
  assert.equal((await has('d7:' + d7)).length, 1)
  assert.ok((await has('d7:' + d7))[0].title.includes('Nguyen Van D7'))
  assert.ok(!(await has('d7:' + d7))[0].title.includes('{{'))
  assert.equal((await has('d7:' + early)).length, 0)
  assert.equal((await has('nx:' + nx)).length, 1)
  assert.equal((await has('d7:' + optout)).length, 0)
  assert.equal((await has('d7:' + hold)).length, 0)
  assert.equal((await sql`SELECT 1 FROM crm_tasks WHERE auto_key LIKE ${'vip:' + vip + ':%'}`).length, 1)

  const r2 = await loop.createLifecycleTasks()
  assert.equal(r2.d7 + r2.next + r2.vip + r2.course_welcome, 0)
})
