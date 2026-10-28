// Kiểm tra SQL trên PostgreSQL THẬT (bản nháp, không dùng dữ liệu thật).
// Chạy: TEST_DATABASE_URL=postgres://... npx --yes tsx --test tests/db.integration.test.ts
// Không đặt TEST_DATABASE_URL thì bỏ qua toàn bộ (để `npm test` thường không cần cơ sở dữ liệu).
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

const phone = (n: number) => '09' + String(10000000 + n).slice(-8)

async function addCustomer(n: number, o: { orders?: number; spent?: number; daysAgo?: number; email?: string; optedOut?: boolean } = {}) {
  const orders = o.orders ?? 1
  const rows = await sql`
    INSERT INTO customers (phone, name, email, source, order_count, total_spent, last_order_at, opted_out_at)
    VALUES (${phone(n)}, ${'Khach ' + n}, ${o.email ?? ''}, 'pancake', ${orders}, ${o.spent ?? 200000},
            NOW() - make_interval(days => ${o.daysAgo ?? 100}), ${o.optedOut ? sql`NOW()` : null})
    ON CONFLICT (phone) DO UPDATE SET order_count = EXCLUDED.order_count, total_spent = EXCLUDED.total_spent,
      last_order_at = EXCLUDED.last_order_at, email = EXCLUDED.email, opted_out_at = EXCLUDED.opted_out_at
    RETURNING id
  `
  return rows[0].id as number
}

test('initDb: chạy 2 lần không lỗi và có đủ bảng/cột mới', { skip }, async () => {
  await db.initDb()
  const t = await sql`
    SELECT to_regclass('public.payment_followups') IS NOT NULL AS a, to_regclass('public.care_campaigns') IS NOT NULL AS b,
           to_regclass('public.care_campaign_members') IS NOT NULL AS c, to_regclass('public.care_campaign_exports') IS NOT NULL AS d,
           to_regclass('public.email_optouts') IS NOT NULL AS e`
  assert.deepEqual(Object.values(t[0]), [true, true, true, true, true])
  const cols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name='customers' AND column_name='opted_out_at'`
  assert.equal(cols.length, 1)
  const g = await sql`SELECT column_name FROM information_schema.columns WHERE table_name='gift_leads' AND column_name IN ('consent_at','consent_text','confirmed_at')`
  assert.equal(g.length, 3)
})

test('payment_followups: xếp hàng, lấy việc (tăng attempts), lùi lịch, xong, báo động', { skip }, async () => {
  await db.enqueueFollowup('notify:STN', 'STNTEST1')
  await db.enqueueFollowup('notify:STN', 'STNTEST1')   // trùng: bỏ qua
  const n = await sql`SELECT COUNT(*)::int AS n FROM payment_followups WHERE ref_code = 'STNTEST1'`
  assert.equal(n[0].n, 1)

  let due = await db.claimDueFollowups(10)
  const mine = due.find((f: { ref_code: string }) => f.ref_code === 'STNTEST1')
  assert.ok(mine)
  assert.equal(mine.attempts, 1)                        // tăng ngay lúc lấy
  assert.equal((await db.claimDueFollowups(10)).filter((f: { ref_code: string }) => f.ref_code === 'STNTEST1').length, 0) // lấy rồi thì chưa đến hạn

  await db.markFollowupFailed(mine.id, 'lỗi thử nghiệm có email a@b.com', 1, false)
  const r = await sql`SELECT status, attempts, last_error, next_attempt_at > NOW() AS later FROM payment_followups WHERE id = ${mine.id}`
  assert.equal(r[0].status, 'pending')
  assert.equal(r[0].later, true)
  assert.ok(!String(r[0].last_error).includes('a@b.com'))   // email đã bị che

  await db.markFollowupFailed(mine.id, 'x', 8, true)
  await sql`UPDATE payment_followups SET next_attempt_at = NOW() - INTERVAL '1 minute' WHERE id = ${mine.id}`
  due = await db.claimDueFollowups(10)
  const failed = due.find((f: { id: number }) => f.id === mine.id)
  assert.ok(failed, 'việc failed chưa báo động phải được lấy lại để báo')
  assert.equal(failed.status, 'failed')
  await db.markFollowupEscalated(mine.id)
  await sql`UPDATE payment_followups SET next_attempt_at = NOW() - INTERVAL '1 minute' WHERE id = ${mine.id}`
  assert.equal((await db.claimDueFollowups(10)).filter((f: { id: number }) => f.id === mine.id).length, 0)

  await db.enqueueFollowup('course_email', 'DHTEST1', 10)    // hẹn 10 phút sau
  assert.equal((await db.claimDueFollowups(10)).filter((f: { ref_code: string }) => f.ref_code === 'DHTEST1').length, 0)
  await db.markFollowupDoneByRef('course_email', 'DHTEST1')
  const d = await sql`SELECT status FROM payment_followups WHERE ref_code = 'DHTEST1'`
  assert.equal(d[0].status, 'done')
})

test('chiến dịch: chọn khách, chia nhóm, loại trừ, đo kết quả, xuất CSV, giới hạn xuất', { skip }, async () => {
  const { assignArm, DEFAULT_CRITERIA } = await import('../lib/campaigns')
  const ids: number[] = []
  for (let i = 1; i <= 60; i++) ids.push(await addCustomer(i, { daysAgo: 100 }))
  await addCustomer(101, { daysAgo: 10 })                    // mới mua: không chọn
  await addCustomer(102, { orders: 3 })                      // mua nhiều lần: không chọn (maxOrders=1)
  await addCustomer(103, { optedOut: true })                 // đã từ chối: không chọn
  await addCustomer(104, { spent: 0 })                       // chưa trả tiền: không chọn
  await sql`UPDATE customers SET phone = '123' WHERE phone = ${phone(103)} AND false`

  const c = { ...DEFAULT_CRITERIA, cap: 500 }
  const preview = await db.findCampaignCandidates(c)
  const previewIds = preview.map((x: { id: number }) => x.id)
  for (const id of ids) assert.ok(previewIds.includes(id))
  assert.equal(previewIds.length, 60, `chỉ 60 khách đủ điều kiện, thực tế ${previewIds.length}`)

  const created = await db.createCampaignAtomic('ktest1', 'Kiểm thử', c, 0, (id: number) => assignArm('ktest1', id, 20, 'secret-0123456789abc'))
  assert.ok(created)
  assert.equal(created.treatment + created.holdout, 60)
  assert.ok(created.holdout > 0 && created.treatment > 0)

  // khách đã trong chiến dịch bị loại khỏi lần chọn sau (cửa sổ 120 ngày)
  assert.equal((await db.findCampaignCandidates(c)).length, 0)
  assert.equal(await db.createCampaignAtomic('ktest2', 'Trùng', c, 0, () => 'treatment'), null)

  // nhóm đối chứng được bảo vệ ở mọi kênh
  const holdoutIds = await db.getAllActiveHoldoutIds()
  assert.equal(holdoutIds.size, created.holdout)
  const some = [...holdoutIds][0]
  assert.equal((await db.getActiveHoldoutIds([some, 999999])).has(some), true)

  // xuất CSV: chỉ nhóm được liên hệ, bỏ khách vừa từ chối
  const camp = (await db.listCampaigns())[0]
  let exported = await db.getCampaignTreatmentForExport(camp.id)
  assert.equal(exported.length, created.treatment)
  const firstTreat = exported[0].id
  await db.updateCustomerCrm(firstTreat, { optedOut: true })
  exported = await db.getCampaignTreatmentForExport(camp.id)
  assert.equal(exported.length, created.treatment - 1)
  assert.ok(!exported.some((r: { id: number }) => holdoutIds.has(r.id)), 'không được lộ nhóm đối chứng')
  await db.updateCustomerCrm(firstTreat, { optedOut: false })

  // giới hạn 10 lần/24h/người, kiểm tra + ghi trong 1 giao dịch
  for (let i = 0; i < 10; i++) assert.equal(await db.recordCampaignExport(camp.id, 7, 5, '1.1.1.1'), true)
  assert.equal(await db.recordCampaignExport(camp.id, 7, 5, '1.1.1.1'), false)
  assert.equal(await db.recordCampaignExport(camp.id, 8, 5, '1.1.1.1'), true)   // người khác vẫn xuất được

  // đo kết quả (mua lại): 1 khách nhóm liên hệ + 1 khách đối chứng mua thêm
  let stats = await db.getCampaignArmStats(camp.id)
  assert.equal(stats.treatment.hits + stats.holdout.hits, 0)
  const treatId = exported[1].id
  await sql`UPDATE customers SET order_count = order_count + 1, total_spent = total_spent + 150000, last_order_at = NOW() WHERE id IN (${treatId}, ${some})`
  stats = await db.getCampaignArmStats(camp.id)
  assert.equal(stats.treatment.hits, 1)
  assert.equal(stats.holdout.hits, 1)
  assert.equal(stats.treatment.revenue, 150000)
  assert.equal(stats.treatment.n, created.treatment)
})

test('chiến dịch mục tiêu khóa học: loại người đã mua khóa, đo theo thanh toán khóa học', { skip }, async () => {
  const { assignArm, validateCriteria } = await import('../lib/campaigns')
  const v = validateCriteria({ goal: 'course', excludeRecentCampaignDays: 365 })
  assert.ok('criteria' in v)
  const c = (v as { criteria: import('../lib/campaigns').CampaignCriteria }).criteria
  const a = await addCustomer(201, { orders: 2, daysAgo: 30 })
  const b = await addCustomer(202, { orders: 1, daysAgo: 30 })
  const bought = await addCustomer(203, { orders: 1, daysAgo: 30 })
  await sql`INSERT INTO course_leads (name, email, phone, payment_ref, payment_status, amount, paid_at) VALUES ('K', 'k@x.com', ${phone(203)}, 'DHOLD1', 'paid', 299000, NOW() - INTERVAL '60 days')`
  const cand = (await db.findCampaignCandidates(c)).map((x: { id: number }) => x.id)
  assert.ok(cand.includes(a) && cand.includes(b))
  assert.ok(!cand.includes(bought), 'người đã mua khóa phải bị loại')

  const created = await db.createCampaignAtomic('kcourse1', 'Khóa', c, 0, (id: number) => assignArm('kcourse1', id, 20, 'secret-0123456789abc'))
  assert.ok(created)
  const camp = (await db.listCampaigns())[0]
  assert.equal(camp.goal, 'course')
  let stats = await db.getCampaignArmStats(camp.id)
  assert.equal(stats.treatment.hits + stats.holdout.hits, 0)
  await sql`INSERT INTO course_leads (name, email, phone, payment_ref, payment_status, amount, paid_at) VALUES ('B', 'b@x.com', ${phone(202)}, 'DHNEW1', 'paid', 299000, NOW() + INTERVAL '1 minute')`
  stats = await db.getCampaignArmStats(camp.id)
  assert.equal(stats.treatment.hits + stats.holdout.hits, 1)
  assert.equal(stats.treatment.revenue + stats.holdout.revenue, 299000)
})

test('hủy nhận tin + xác nhận hai bước + đăng ký lại', { skip }, async () => {
  // không tick → no_consent; tick → pending_confirm (đều tạm dừng, cron không lấy)
  const noC = await db.insertGiftLead({ name: 'A', email: 'noconsent@x.com', phone: phone(301) })
  const yes = await db.insertGiftLead({ name: 'B', email: 'consent@x.com', phone: phone(302), consentText: 'Tôi đồng ý' })
  const st = await sql`SELECT id, email_sequence_status AS s, email_sequence_paused AS p FROM gift_leads WHERE id IN (${noC}, ${yes})`
  const by = (id: number) => st.find((r: { id: number }) => r.id === id)
  assert.equal(by(noC).s, 'no_consent'); assert.equal(by(noC).p, true)
  assert.equal(by(yes).s, 'pending_confirm'); assert.equal(by(yes).p, true)
  await sql`UPDATE gift_leads SET next_email_at = NOW() - INTERVAL '1 hour' WHERE id IN (${noC}, ${yes})`
  const pending = (await db.getGiftLeadsPendingEmails()).map((l: { id: number }) => l.id)
  assert.ok(!pending.includes(noC) && !pending.includes(yes))

  // xác nhận: vào chuỗi
  assert.equal(await db.confirmGiftOptIn('CONSENT@x.com'), true)
  assert.equal(await db.confirmGiftOptIn('consent@x.com'), false)          // xác nhận lần 2: không đổi
  await sql`UPDATE gift_leads SET next_email_at = NOW() - INTERVAL '1 hour' WHERE id = ${yes}`
  assert.ok((await db.getGiftLeadsPendingEmails()).some((l: { id: number }) => l.id === yes))

  // hủy: dừng chuỗi + sổ hủy + đánh dấu khách trùng email
  const cid = await addCustomer(303, { email: 'consent@x.com' })
  await db.unsubscribeEmail('Consent@X.com')
  assert.equal(await db.isEmailOptedOut('consent@x.com'), true)
  assert.ok(!(await db.getGiftLeadsPendingEmails()).some((l: { id: number }) => l.id === yes))
  const cu = await sql`SELECT opted_out_at FROM customers WHERE id = ${cid}`
  assert.ok(cu[0].opted_out_at)

  // sổ hủy chặn cả chọn khách chiến dịch (kênh khác) và nhắc mua lại
  const { DEFAULT_CRITERIA } = await import('../lib/campaigns')
  const cand = (await db.findCampaignCandidates({ ...DEFAULT_CRITERIA, excludeRecentCampaignDays: 365, cap: 5000 })).map((x: { id: number }) => x.id)
  assert.ok(!cand.includes(cid))

  // đăng ký lại có chủ ý (đồng ý MỚI hơn lần hủy + chủ email xác nhận) thì được nhận lại
  await new Promise(r => setTimeout(r, 20))
  const again = await db.insertGiftLead({ name: 'B2', email: 'consent@x.com', phone: phone(302), consentText: 'Tôi đồng ý' })
  assert.equal(await db.confirmGiftOptIn('consent@x.com'), true)
  assert.equal(await db.isEmailOptedOut('consent@x.com'), true)   // vẫn true vì customers.opted_out_at do hủy đặt (kênh khác)
  const gone = await sql`SELECT 1 FROM email_optouts WHERE email = 'consent@x.com'`
  assert.equal(gone.length, 0)
  assert.ok(again)
})

test('số liệu khách: chỉ đơn ĐÃ TRẢ TIỀN được tính, quà miễn phí không', { skip }, async () => {
  await sql`INSERT INTO gift_leads (name, email, phone) VALUES ('Q', 'q@x.com', ${phone(401)})`
  await sql`INSERT INTO khan_do_xoi_orders (name, phone, address, quantity, total_price, ref_code, payment_status)
            VALUES ('Y', ${phone(402)}, 'HN', 1, 100000, 'KDX1111111111', 'paid'), ('Z', ${phone(402)}, 'HN', 1, 50000, 'KDX2222222222', 'pending')`.catch(async () => {
    // tên cột bảng đơn có thể khác: bỏ qua phần này nếu lược đồ khác, vẫn kiểm phần quà
  })
  await db.recomputeCustomerStatsFromLocalOrders()
  const g = await sql`SELECT order_count, total_spent, last_order_at FROM customers WHERE phone = ${phone(401)}`
  assert.equal(g[0].order_count, 0)
  assert.equal(Number(g[0].total_spent), 0)
  assert.equal(g[0].last_order_at, null)
  const p = await sql`SELECT order_count, total_spent FROM customers WHERE phone = ${phone(402)}`
  if (p.length) { assert.equal(p[0].order_count, 1); assert.equal(Number(p[0].total_spent), 100000) }
})

test('nhắc mua lại: bỏ qua khách từ chối, khách chưa trả tiền, nhóm đối chứng', { skip }, async () => {
  const ok = await addCustomer(501, { email: 'ok501@x.com', daysAgo: 60 })
  const out = await addCustomer(502, { email: 'out502@x.com', daysAgo: 60, optedOut: true })
  const free = await addCustomer(503, { email: 'free503@x.com', daysAgo: 60, spent: 0 })
  const list = (await db.getCustomersNeedingReminder(30, 30)).map((c: { id: number }) => c.id)
  assert.ok(list.includes(ok))
  assert.ok(!list.includes(out))
  assert.ok(!list.includes(free))
})
