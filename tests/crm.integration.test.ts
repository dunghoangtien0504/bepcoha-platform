// CRM v2 trên PostgreSQL THẬT (database test riêng). Chạy: npm run test:db
import { test, before } from 'node:test'
import assert from 'node:assert/strict'

const URL = process.env.TEST_DATABASE_URL
const skip = !URL

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sql: any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let orders: any, mini: any, att: any, tasks: any, events: any

before(async () => {
  if (skip) return
  process.env.DATABASE_URL = URL
  const db = await import('../lib/db')
  const schema = await import('../lib/crm/schema')
  await schema.ensureCrmSchema()
  sql = db.getDb()
  orders = await import('../lib/crm/orders')
  mini = await import('../lib/crm/mini')
  att = await import('../lib/crm/attendance')
  tasks = await import('../lib/crm/tasks')
  events = await import('../lib/crm/events')
})

const ago = (d: number) => new Date(Date.now() - d * 86400000).toISOString()

test('đồng bộ đơn: tạo khách theo SĐT thật, bỏ qua SĐT bị che, chỉ đơn thật được tính', { skip }, async () => {
  const rows = [
    orders.fromExportRow({ id: 'T-90001', at: ago(40), st: 3, total: 148000, srcn: 'Facebook', phone: '0977000001', name: 'Chị A', items: [{ name: 'Sét xôi cốm', sku: 'SXC', q: 1, p: 148000 }] }),
    orders.fromExportRow({ id: 'T-90002', at: ago(10), st: 4, total: 49000, srcn: 'Facebook', phone: '+84977000001', name: 'Chị A', items: [{ name: 'Khăn đồ xôi', sku: 'KDX', q: 1, p: 49000 }] }),
    orders.fromExportRow({ id: 'T-90003', at: ago(5), st: 6, total: 99000, srcn: 'Facebook', phone: '0977000001', items: [{ name: 'Cốm', q: 1, p: 99000 }] }),
    orders.fromExportRow({ id: '599999999999999901', at: ago(3), st: 3, total: 148000, cod: 140600, srcn: 'Tiktok', phone: '+84977****01', items: [{ name: 'Sét xôi cốm', q: 1, p: 148000 }] }),
  ]
  await orders.upsertOrders(rows)
  const c = (await sql`SELECT id FROM customers WHERE phone = '0977000001'`)[0]
  await orders.recomputeCustomerStats([c.id])
  const after = (await sql`SELECT order_count, total_spent, phone_verified_at FROM customers WHERE id = ${c.id}`)[0]
  assert.equal(after.order_count, 2)              // 2 ngày mua; Đang hoàn vẫn tính doanh thu (như Pancake), đơn hủy không tính
  assert.equal(Number(after.total_spent), 197000)
  assert.ok(after.phone_verified_at)
  const tt = (await sql`SELECT customer_id, phone_masked, platform_order_ref, revenue, items_value FROM pancake_orders WHERE pos_order_id = '599999999999999901'`)[0]
  assert.equal(Number(tt.revenue), 140600, 'đơn sàn: doanh thu = tiền sàn trả, không phải giá niêm yết')
  assert.equal(Number(tt.items_value), 148000)
  assert.equal(tt.customer_id, null)
  assert.equal(tt.phone_masked, true)
  assert.equal(tt.platform_order_ref, '599999999999999901')
})

test('ghép mã đơn: đúng SĐT → khớp; sai SĐT → sai_sdt; đơn sàn → don_san; mã có dấu chấm vẫn khớp', { skip }, async () => {
  await orders.upsertOrders([orders.fromExportRow({ id: 'C7700001.0001', at: ago(2), st: 2, total: 148000, srcn: 'Facebook', phone: '0977000002', items: [] })])
  assert.equal((await mini.lookupOrderRef('c77000010001', '0977000002')).result, 'khop_sdt')
  assert.equal((await mini.lookupOrderRef('C7700001.0001', '0977000099')).result, 'sai_sdt')
  assert.equal((await mini.lookupOrderRef('599999999999999901', '0977000002')).result, 'don_san')
  assert.equal((await mini.lookupOrderRef('ZZZZ9999', '0977000002')).result, 'chua_thay')
})

test('phiên Mini App: chưa xác minh không chạm hồ sơ; xác minh thì gắn dữ liệu và áp rút đồng ý', { skip }, async () => {
  const s = (await sql`INSERT INTO mini_sessions (anon_id, phone) VALUES ('anon-1', '0977000001') RETURNING id`)[0].id
  await sql`INSERT INTO funnel_events (mini_session_id, anon_id, step, name) VALUES (${s}, 'anon-1', 4, 'identify_submit')`
  await sql`INSERT INTO funnel_events (anon_id, step, name) VALUES ('anon-1', 1, 'qr_scan')`
  // phiên khác cùng máy, chưa xác minh — không được bị kéo theo
  const other = (await sql`INSERT INTO mini_sessions (anon_id, phone) VALUES ('anon-1', '0977000077') RETURNING id`)[0].id
  await sql`INSERT INTO funnel_events (mini_session_id, anon_id, step, name) VALUES (${other}, 'anon-1', 4, 'identify_submit')`
  await sql`INSERT INTO consents (mini_session_id, channel, purpose, text_version, source, revoked_at) VALUES (${s}, 'zalo_oa', 'cham_soc_sau_mua', 'v1', 'mini', NOW())`
  const before = (await sql`SELECT opted_out_at FROM customers WHERE phone = '0977000001'`)[0]
  assert.equal(before.opted_out_at, null)
  const cid = await mini.promoteMiniSession(s, 'order_match', { type: 'system', id: null })
  const ev = await sql`SELECT mini_session_id, customer_id FROM funnel_events WHERE anon_id = 'anon-1' ORDER BY id`
  assert.deepEqual(ev.map((e: { customer_id: number | null }) => e.customer_id), [cid, cid, null])
  const c = (await sql`SELECT opted_out_at FROM customers WHERE id = ${cid}`)[0]
  assert.ok(c.opted_out_at, 'rút đồng ý từ phiên đã xác minh phải bật cờ không liên hệ')
})

test('Hạt Cốm: điểm trừ cần khách đã xác minh; xác minh 2 máy cùng ngày không cộng điểm danh 2 lần', { skip }, async () => {
  const a = (await sql`INSERT INTO mini_sessions (anon_id, phone) VALUES ('may-a', '0977555001') RETURNING id`)[0].id
  const b = (await sql`INSERT INTO mini_sessions (anon_id, phone) VALUES ('may-b', '0977555001') RETURNING id`)[0].id
  await assert.rejects(sql`INSERT INTO points_ledger (mini_session_id, delta, reason, ref) VALUES (${a}, -10, 'doi_qua', 'q1')`)
  for (const s of [a, b]) {
    await sql`INSERT INTO daily_checkins (mini_session_id, day) VALUES (${s}, '2026-10-24')`
    await sql`INSERT INTO points_ledger (mini_session_id, delta, reason, ref) VALUES (${s}, 5, 'diem_danh', '2026-10-24'), (${s}, 20, 'dang_ky', '')`
    await sql`INSERT INTO saved_recipes (mini_session_id, recipe_slug) VALUES (${s}, 'xoi-com')`
  }
  await assert.rejects(sql`INSERT INTO points_ledger (mini_session_id, delta, reason, ref) VALUES (${a}, 5, 'diem_danh', '2026-10-24')`)
  const cid = await mini.promoteMiniSession(a, 'otp', { type: 'system', id: null })
  await mini.promoteMiniSession(b, 'otp', { type: 'system', id: null })
  const bal = (await sql`SELECT COALESCE(SUM(delta), 0)::int AS n FROM points_ledger WHERE customer_id = ${cid}`)[0].n
  assert.equal(bal, 25, 'điểm danh 5 + đăng ký 20, không nhân đôi')
  assert.equal((await sql`SELECT COUNT(*)::int AS n FROM daily_checkins WHERE customer_id = ${cid}`)[0].n, 1)
  assert.equal((await sql`SELECT COUNT(*)::int AS n FROM saved_recipes WHERE customer_id = ${cid}`)[0].n, 2)
  // đã xác minh thì mới đổi quà được
  await sql`INSERT INTO points_ledger (mini_session_id, customer_id, delta, reason, ref) VALUES (${a}, ${cid}, -10, 'doi_qua', 'q1')`
})

test('chấm công: trong vùng hợp lệ, ngoài vùng bị gắn cờ, máy lạ bị gắn cờ; bảng công tính muộn', { skip }, async () => {
  const st = (await sql`INSERT INTO staff (name, email, password_hash, role, department) VALUES ('NV test', 'nvtest@haco.test', 'x', 'staff', 'bep') RETURNING id`)[0].id
  const site = (await sql`INSERT INTO work_sites (name, lat, lng, radius_m) VALUES ('Bếp test', 21.0285, 105.8542, 100) RETURNING id`)[0].id
  const tpl = (await sql`INSERT INTO shift_templates (code, name, start_time, end_time, break_minutes, late_grace_minutes)
    VALUES ('T-ALL', 'Ca test', '00:00', '23:59', 0, 5) RETURNING id`)[0].id
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })
  await sql`INSERT INTO shift_assignments (staff_id, work_date, template_id, site_id) VALUES (${st}, ${today}, ${tpl}, ${site})`
  const ok = await att.punch(st, { kind: 'vao', lat: 21.0286, lng: 105.8543, accuracy: 10, deviceId: 'may-1' })
  assert.equal(ok.validity, 'hop_le')
  const far = await att.punch(st, { kind: 'vao', lat: 21.04, lng: 105.86, accuracy: 10, deviceId: 'may-1' })
  assert.equal(far.validity, 'ngoai_vung')
  const strange = await att.punch(st, { kind: 'ra', lat: 21.0286, lng: 105.8543, accuracy: 10, deviceId: 'may-2' })
  assert.equal(strange.validity, 'thiet_bi_la')
  const ts = await att.timesheet(today, today, st)
  assert.equal(ts.length, 1)
  assert.ok(ts[0].late_min > 0, 'vào sau 00:05 là muộn')
  assert.equal(ts[0].flagged, 2)
})

test('việc tự sinh: khách từ chối và khách chưa xác minh không bao giờ có việc liên hệ', { skip }, async () => {
  const mk = async (phone: string, opts: { optedOut?: boolean; unverified?: boolean }) => (await sql`
    INSERT INTO customers (phone, name, source, order_count, total_spent, last_order_at, first_order_at, opted_out_at, phone_verified_at)
    VALUES (${phone}, 'Khách ngủ', 'pancake', 2, 99000000, NOW() - INTERVAL '200 days', NOW() - INTERVAL '300 days',
            ${opts.optedOut ? new Date() : null}, ${opts.unverified ? null : new Date()}) RETURNING id`)[0].id
  const okId = await mk('0977100001', {})
  const refused = await mk('0977100002', { optedOut: true })
  const unverified = await mk('0977100003', { unverified: true })
  await tasks.generateDailyTasks({ perKind: 1000, winbackPerDay: 1000 })
  const has = async (id: number) => (await sql`SELECT COUNT(*)::int AS n FROM crm_tasks WHERE customer_id = ${id}`)[0].n > 0
  assert.equal(await has(okId), true)
  assert.equal(await has(refused), false)
  assert.equal(await has(unverified), false)
  // chạy lại không sinh trùng
  const before = (await sql`SELECT COUNT(*)::int AS n FROM crm_tasks`)[0].n
  await tasks.generateDailyTasks({ perKind: 1000, winbackPerDay: 1000 })
  assert.equal((await sql`SELECT COUNT(*)::int AS n FROM crm_tasks`)[0].n, before)
})

test('đơn Mini App: DB chặn giỏ quá giới hạn; huỷ trên CRM trả voucher và Hạt Cốm; xác minh phiên gắn đơn vào khách', { skip }, async () => {
  const s = (await sql`INSERT INTO mini_sessions (anon_id, phone) VALUES ('may-don', '0977666001') RETURNING id`)[0].id
  const cid = await mini.promoteMiniSession(s, 'otp', { type: 'system', id: null })
  const staff = (await sql`INSERT INTO staff (name, email, password_hash, role, department) VALUES ('QL test', 'qltest@haco.test', 'x', 'quan_ly', 'sale_cskh') RETURNING id`)[0].id
  const v = (await sql`INSERT INTO reward_ledger (mini_session_id, customer_id, kind, program, amount, locked_phone, status, order_id)
                       VALUES (${s}, ${cid}, 'voucher', 'test', 20000, '0977666001', 'da_dung', 'HMA6001123456ABCD') RETURNING id`)[0].id
  const base = { phone: '0977666001', name: 'Chị D', address: '12 Ngõ 3, Hà Nội' }
  const line = (qty: number) => ({ sku: 'SXC', label: 'Sét xôi cốm', qty, unit_price: 148000 })
  // 21 cái 1 dòng → DB từ chối
  await assert.rejects(sql`INSERT INTO mini_orders (ref_code, mini_session_id, phone, name, address, items, subtotal, total, payment)
    VALUES ('HMA6001000000AAAA', ${s}, ${base.phone}, ${base.name}, ${base.address}, ${sql.json([line(21)])}, 3108000, 3108000, 'cod')`)
  // tổng sai (không bằng tạm tính − giảm) → DB từ chối
  await assert.rejects(sql`INSERT INTO mini_orders (ref_code, mini_session_id, phone, name, address, items, subtotal, total, payment)
    VALUES ('HMA6001000000BBBB', ${s}, ${base.phone}, ${base.name}, ${base.address}, ${sql.json([line(1)])}, 148000, 100000, 'cod')`)
  const o = (await sql`INSERT INTO mini_orders (ref_code, mini_session_id, customer_id, phone, name, address, items, subtotal, voucher_id, voucher_amount,
      points_used, points_amount, total, payment)
    VALUES ('HMA6001123456ABCD', ${s}, ${cid}, ${base.phone}, ${base.name}, ${base.address}, ${sql.json([line(2)])}, 296000, ${v}, 20000, 10, 10000, 266000, 'cod')
    RETURNING id`)[0].id
  await sql`INSERT INTO points_ledger (mini_session_id, customer_id, delta, reason, ref, created_by)
            VALUES (${s}, ${cid}, 30, 'dieu_chinh', 'nap', ${staff}), (${s}, ${cid}, -10, 'dung_don', 'HMA6001123456ABCD', NULL)`
  const r = await mini.cancelMiniOrder(o, staff, 'khách đặt nhầm', '127.0.0.1')
  assert.equal(r.voucherRestored, true)
  assert.equal(r.pointsRestored, 10)
  assert.equal((await sql`SELECT status FROM reward_ledger WHERE id = ${v}`)[0].status, 'da_cap')
  assert.equal((await sql`SELECT SUM(delta)::int AS n FROM points_ledger WHERE customer_id = ${cid}`)[0].n, 30)
  // huỷ lần 2 không trả điểm thêm
  assert.equal((await mini.cancelMiniOrder(o, staff, 'bấm lại', '127.0.0.1')).already, true)
  assert.equal((await sql`SELECT SUM(delta)::int AS n FROM points_ledger WHERE customer_id = ${cid}`)[0].n, 30)

  // phiên chưa xác minh đặt đơn → customer_id NULL; xác minh xong thì đơn gắn vào khách
  const s2 = (await sql`INSERT INTO mini_sessions (anon_id, phone) VALUES ('may-don-2', '0977666002') RETURNING id`)[0].id
  await sql`INSERT INTO mini_orders (ref_code, mini_session_id, phone, name, address, items, subtotal, total, payment)
    VALUES ('HMA6002123456CDEF', ${s2}, '0977666002', ${base.name}, ${base.address}, ${sql.json([line(1)])}, 148000, 148000, 'chuyen_khoan')`
  const cid2 = await mini.promoteMiniSession(s2, 'otp', { type: 'system', id: null })
  assert.equal((await sql`SELECT customer_id FROM mini_orders WHERE ref_code = 'HMA6002123456CDEF'`)[0].customer_id, cid2)
})

test('sự kiện: không giảm chỗ dưới số đã giữ; công bố 2 lần chỉ 1 thông báo; DB chặn link ra ngoài; xác minh gắn đăng ký vào khách', { skip }, async () => {
  const staff = (await sql`INSERT INTO staff (name, email, password_hash, role, department) VALUES ('MKT test', 'mkttest@haco.test', 'x', 'staff', 'marketing') RETURNING id`)[0].id
  const id = await events.createEvent(events.parseEventInput({ title: 'Workshop xôi cốm', kind: 'workshop', starts_at: '2026-12-01T09:00', capacity: '5' }), staff, '127.0.0.1')
  const s1 = (await sql`INSERT INTO mini_sessions (anon_id, phone) VALUES ('ev-1', '0977888001') RETURNING id`)[0].id
  const s2 = (await sql`INSERT INTO mini_sessions (anon_id, phone) VALUES ('ev-2', '0977888002') RETURNING id`)[0].id
  await sql`INSERT INTO event_reminders (event_id, mini_session_id, kind) VALUES (${id}, ${s1}, 'giu_cho'), (${id}, ${s2}, 'giu_cho'), (${id}, ${s1}, 'nhac')`
  await assert.rejects(events.updateEvent(id, events.parseEventInput({ title: 'Workshop xôi cốm', kind: 'workshop', starts_at: '2026-12-01T09:00', capacity: '1' }), staff, '127.0.0.1'), /2 người giữ chỗ/)
  await events.updateEvent(id, events.parseEventInput({ title: 'Workshop xôi cốm', kind: 'workshop', starts_at: '2026-12-01T09:00', capacity: '2' }), staff, '127.0.0.1')

  const a = await events.setEventStatus(id, 'cong_bo', { notify: true }, staff, '127.0.0.1')
  assert.ok(a.notificationId)
  await events.setEventStatus(id, 'nhap', {}, staff, '127.0.0.1')
  const b = await events.setEventStatus(id, 'cong_bo', { notify: true }, staff, '127.0.0.1')
  assert.equal(b.notificationId, null, 'công bố lại không gửi thông báo thứ 2')
  const n = (await sql`SELECT link, audience, kind FROM notifications WHERE event_id = ${id}`)
  assert.equal(n.length, 1)
  assert.equal(n[0].link, '/su-kien/workshop-xoi-com')
  // đã công bố thì không đổi đường dẫn
  await assert.rejects(events.updateEvent(id, events.parseEventInput({ title: 'Workshop xôi cốm', slug: 'doi-ten', kind: 'workshop', starts_at: '2026-12-01T09:00' }), staff, '127.0.0.1'))

  await assert.rejects(sql`INSERT INTO notifications (title, kind, audience, link) VALUES ('x', 'uu_dai', 'tat_ca', 'https://shopee.vn')`)
  await assert.rejects(sql`INSERT INTO notifications (title, kind, audience, mini_session_id) VALUES ('x', 'uu_dai', 'tat_ca', ${s1})`, 'tin chung không được gắn người')
  await assert.rejects(sql`INSERT INTO notifications (title, kind, audience) VALUES ('x', 'uu_dai', 'khach')`)

  await sql`INSERT INTO notification_reads (notification_id, mini_session_id) VALUES (${a.notificationId}, ${s1})`
  const cid = await mini.promoteMiniSession(s1, 'otp', { type: 'system', id: null })
  assert.equal((await sql`SELECT COUNT(*)::int AS n FROM event_reminders WHERE mini_session_id = ${s1} AND customer_id = ${cid}`)[0].n, 2)
  assert.equal((await sql`SELECT customer_id FROM notification_reads WHERE mini_session_id = ${s1}`)[0].customer_id, cid)

  const nid = await events.createNotification(events.parseNotificationInput({ title: 'Riêng chị', kind: 'uu_dai', audience: 'khach', customer_id: String(cid) }), staff, '127.0.0.1')
  assert.equal(await events.expireNotification(nid, staff, '127.0.0.1'), true)
  assert.equal(await events.expireNotification(nid, staff, '127.0.0.1'), false)
})

test('cầu nối Zalo CRM: chỉ gửi đơn chốt có SĐT thật từ mốc ngày; 4xx ghi lỗi, 401 dừng lượt', { skip }, async () => {
  const zl = await import('../lib/crm/zl-bridge')
  process.env.ZL_CRM_ORDER_WEBHOOK_URL = 'http://zl.test/hook'
  process.env.ZL_CRM_ORDER_WEBHOOK_SECRET = 'whsec_test'
  process.env.ZL_CRM_PUSH_SINCE = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10)
  await orders.upsertOrders([
    orders.fromExportRow({ id: 'ZL-1', at: ago(1), st: 3, total: 148000, srcn: 'Facebook', phone: '0977999001', items: [{ name: 'Sét xôi cốm', q: 1, p: 148000 }] }),
    orders.fromExportRow({ id: 'ZL-2', at: ago(1), st: 6, total: 148000, srcn: 'Facebook', phone: '0977999002', items: [{ name: 'Sét xôi cốm', q: 1, p: 148000 }] }),
    orders.fromExportRow({ id: 'ZL-3', at: ago(1), st: 3, total: 148000, srcn: 'Tiktok', phone: '+84977****03', items: [{ name: 'Sét xôi cốm', q: 1, p: 148000 }] }),
    orders.fromExportRow({ id: 'ZL-4', at: ago(30), st: 3, total: 148000, srcn: 'Facebook', phone: '0977999004', items: [{ name: 'Sét xôi cốm', q: 1, p: 148000 }] }),
    orders.fromExportRow({ id: 'ZL-5', at: ago(1), st: 3, total: 49000, srcn: 'Facebook', phone: '0977999005', items: [{ name: 'Khăn đồ xôi', q: 1, p: 49000 }] }),
  ])
  const seen: string[] = []
  const fake = (status: (id: string) => number) => (async (_u: string, init: RequestInit) => {
    const b = JSON.parse(String(init.body)); seen.push(b.orderId)
    assert.equal((init.headers as Record<string, string>)['X-Signature'], zl.signZlPayload('whsec_test', (init.headers as Record<string, string>)['X-Timestamp'], String(init.body)))
    return new Response('{}', { status: status(b.orderId) })
  }) as unknown as typeof fetch
  // 401 ngay đơn đầu → dừng, không đánh dấu gì
  const r0 = await zl.pushOrdersToZl(50, sql, fake(() => 401))
  assert.equal(r0.sent ?? 0, 0)
  assert.equal((await sql`SELECT COUNT(*)::int AS n FROM pancake_orders WHERE zl_push_error IS NOT NULL OR zl_pushed_at IS NOT NULL`)[0].n, 0)
  seen.length = 0
  const r = await zl.pushOrdersToZl(50, sql, fake(id => id === 'pancake:ZL-5' ? 400 : 202))
  assert.deepEqual(seen.filter(s => s.startsWith('pancake:ZL-')).sort(), ['pancake:ZL-1', 'pancake:ZL-5'], 'không gửi đơn hủy, đơn sàn che SĐT, đơn trước mốc')
  assert.ok((r.sent ?? 0) >= 1)
  assert.ok((await sql`SELECT zl_pushed_at FROM pancake_orders WHERE pos_order_id = 'ZL-1'`)[0].zl_pushed_at)
  assert.match((await sql`SELECT zl_push_error FROM pancake_orders WHERE pos_order_id = 'ZL-5'`)[0].zl_push_error, /^400/)
  // chạy lại: không gửi lại đơn đã gửi hay đơn đã lỗi
  seen.length = 0
  await zl.pushOrdersToZl(50, sql, fake(() => 202))
  assert.equal(seen.filter(s => s === 'pancake:ZL-1' || s === 'pancake:ZL-5').length, 0)
  delete process.env.ZL_CRM_ORDER_WEBHOOK_URL
})

test('Trung tâm AI: L0/L1/L2, dừng khẩn cấp chặn mọi việc, mô phỏng không làm thật, duyệt có sửa, hoàn tác, tự hạ cấp', { skip }, async () => {
  const ai = await import('../lib/crm/ai')
  const agents = await import('../lib/crm/ai-agents')
  const boss = (await sql`INSERT INTO staff (name, email, password_hash, role, department) VALUES ('Sếp AI', 'sepai@haco.test', 'x', 'admin', 'ban_giam_doc') RETURNING id`)[0].id
  const cust = (await sql`INSERT INTO customers (phone, name, source, order_count, total_spent, last_order_at, first_order_at, phone_verified_at)
    VALUES ('0977123401', 'Nguyễn Thị Hoa', 'pancake', 2, 500000, NOW() - INTERVAL '30 days', NOW() - INTERVAL '90 days', NOW()) RETURNING id`)[0].id
  const optedOut = (await sql`INSERT INTO customers (phone, name, source, order_count, total_spent, last_order_at, phone_verified_at, opted_out_at)
    VALUES ('0977123402', 'Từ chối', 'pancake', 1, 100000, NOW() - INTERVAL '30 days', NOW(), NOW()) RETURNING id`)[0].id

  // agent tắt → không đề xuất gì
  assert.equal(await ai.propose({ agent: 'giu_chan', kind: 'gui_tin', customerId: cust, title: 'x', body: 'y' }), null)
  await ai.updateAgent('giu_chan', { enabled: true }, boss, '127.0.0.1')
  await assert.rejects(ai.updateAgent('giu_chan', { level: 'L2' }, boss, '127.0.0.1'), /chỉ được tới L1/)
  await assert.rejects(ai.updateAgent('quang_cao', { level: 'L1' }, boss, '127.0.0.1'), /chỉ được tới L0/)
  // agent không được làm loại việc ngoài phạm vi
  await assert.rejects(ai.propose({ agent: 'giu_chan', kind: 'cap_nhat_khach', customerId: cust, title: 'x' }))
  // khách từ chối nhận tin: không bao giờ đề xuất nhắn
  assert.equal(await ai.propose({ agent: 'giu_chan', kind: 'gui_tin', customerId: optedOut, title: 'x', body: 'y' }), null)

  // L1 → chờ duyệt; trùng khoá → bỏ qua
  const a1 = (await ai.propose({ agent: 'giu_chan', kind: 'gui_tin', customerId: cust, title: 'Mời mua lại', body: 'Bản gốc', dedupeKey: 'test:1' }))!
  assert.equal(a1.status, 'cho_duyet')
  assert.equal(await ai.propose({ agent: 'giu_chan', kind: 'gui_tin', customerId: cust, title: 'Mời mua lại', body: 'Bản gốc', dedupeKey: 'test:1' }), null)

  // DỪNG KHẨN CẤP: duyệt bị chặn; Zalo CRM được gọi đúng khoá
  process.env.ZL_CRM_URL = 'http://zl.test'; process.env.ZL_CRM_API_KEY = 'key-test'
  const calls: string[] = []
  const fake = (async (u: string, init: RequestInit) => { calls.push(`${u} ${(init.headers as Record<string, string>)['x-api-key']} ${init.body}`); return new Response('{}', { status: 200 }) }) as unknown as typeof fetch
  const stopped = await ai.setEmergencyStop(true, boss, 'diễn tập', '127.0.0.1', sql, fake)
  assert.equal(stopped.zalo?.ok, true)
  assert.match(calls[0], /\/api\/public\/ai\/kill-switch key-test .*"action":"stop"/)
  await assert.rejects(ai.approveAction(a1.id, boss, {}), /DỪNG KHẨN CẤP/)
  assert.equal((await sql`SELECT status FROM ai_actions WHERE id = ${a1.id}`)[0].status, 'cho_duyet')
  await ai.setEmergencyStop(false, boss, 'xong diễn tập', '127.0.0.1', sql, fake)
  delete process.env.ZL_CRM_URL

  // duyệt bản đã sửa → thành việc cho người phụ trách, đánh dấu đã sửa; hoàn tác → bỏ việc
  const done = await ai.approveAction(a1.id, boss, { body: 'Bản người sửa' })
  assert.equal(done.status, 'da_thuc_hien')
  assert.equal(done.edited, true)
  const task = (await sql`SELECT kind, suggestion, status FROM crm_tasks WHERE id = ${done.result.task_id}`)[0]
  assert.deepEqual([task.kind, task.suggestion, task.status], ['ai_gui_tin', 'Bản người sửa', 'can_lam'])
  await ai.undoAction(a1.id, boss, 'thử hoàn tác', '127.0.0.1')
  assert.equal((await sql`SELECT status FROM crm_tasks WHERE id = ${done.result.task_id}`)[0].status, 'bo_qua')

  // từ chối phải có lý do
  const a2 = (await ai.propose({ agent: 'giu_chan', kind: 'tao_viec', customerId: cust, title: 'Gọi khách', body: 'gọi' }))!
  await assert.rejects(ai.rejectAction(a2.id, boss, ' ', '127.0.0.1'), /lý do/)
  await ai.rejectAction(a2.id, boss, 'khách vừa mua hôm qua', '127.0.0.1')

  // mô phỏng: chỉ ghi lại, không duyệt được, chấm giống/khác
  await ai.setSimulation(true, boss, '127.0.0.1')
  const s1 = (await ai.propose({ agent: 'giu_chan', kind: 'tao_viec', customerId: cust, title: 'Mô phỏng', body: 'x' }))!
  assert.equal(s1.status, 'mo_phong')
  await assert.rejects(ai.approveAction(s1.id, boss, {}))
  await ai.setSimVerdict(s1.id, boss, 'dong_y')
  await ai.setSimulation(false, boss, '127.0.0.1')

  // Trợ lý CEO (L2) tự làm bản tin; chạy lại trong ngày không tạo bản thứ 2
  const brief = (await agents.runTroLyCeo(sql))!
  assert.equal(brief.status, 'da_thuc_hien')
  assert.equal(brief.auto_executed, true)
  assert.match(brief.body, /Doanh thu hôm qua/)
  assert.equal(await agents.runTroLyCeo(sql), null)

  // Giữ chân: khách mua 30 ngày trước được đề xuất 1 lần, khách từ chối thì không
  await sql`UPDATE ai_actions SET created_at = NOW() - INTERVAL '40 days' WHERE customer_id = ${cust}`
  const g = await agents.runGiuChan(50, sql)
  assert.ok(g.proposed >= 1)
  const mine = await sql`SELECT body FROM ai_actions WHERE agent_code = 'giu_chan' AND customer_id = ${cust} AND created_at > NOW() - INTERVAL '1 hour'`
  assert.equal(mine.length, 1)
  assert.match(mine[0].body, /anh\/chị Hoa/)
  assert.equal((await sql`SELECT COUNT(*)::int AS n FROM ai_actions WHERE customer_id = ${optedOut}`)[0].n, 0)

  // tự hạ cấp: L2 bị từ chối > 20% trên ≥ 20 việc → về L1
  await sql`UPDATE ai_agents SET level = 'L2', kinds = '{bao_cao,tao_viec}' WHERE code = 'tro_ly_ceo'`
  for (let i = 0; i < 20; i++) {
    await sql`INSERT INTO ai_actions (agent_code, kind, title, status, level_at_create, decision_note) VALUES ('tro_ly_ceo', 'tao_viec', 'x', ${i < 6 ? 'tu_choi' : 'da_thuc_hien'}, 'L2', 'không đúng')`
  }
  assert.deepEqual(await ai.autoDowngrade(sql), ['tro_ly_ceo'])
  assert.equal((await sql`SELECT level FROM ai_agents WHERE code = 'tro_ly_ceo'`)[0].level, 'L1')
})
