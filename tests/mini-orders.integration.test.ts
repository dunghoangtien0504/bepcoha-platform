// Giỏ hàng Mini App (v2-B) trên PostgreSQL THẬT. Chạy: TEST_DB_NAME=haco_test_mini npm run test:db
// POScake được giả bằng cách thay fetch: không gọi mạng thật, chỉ ghi lại body gửi đi.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'

const URL = process.env.TEST_DATABASE_URL
const skip = !URL

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sql: any, svc: any, ord: any
const ctx = { ip: '127.0.0.1', ua: 'test' }
const web = { zalo: false }
let n = 0
const anon = () => 'anon-ord-' + Date.now().toString(36) + '-' + n++
// Mỗi lần chạy một dải SĐT riêng: chạy lại không cần xoá DB (giới hạn đơn, voucher 1 lần/SĐT không dính lần trước).
const RUN = Math.floor(Math.random() * 900000) + 50000
const phone = (k: number) => '09' + String(RUN * 100 + k).padStart(8, '0')
const ADDR = { name: 'Chị Lan', address: '12 Ngõ 5, Phường Láng, Hà Nội' }

const posCalls: Record<string, unknown>[] = []
let posFail = false
const realFetch = globalThis.fetch

before(async () => {
  if (skip) return
  process.env.DATABASE_URL = URL
  process.env.PANCAKE_API_KEY = 'test-key'
  for (const v of ['PANCAKE_VAR_SXC', 'PANCAKE_VAR_SXX_500G', 'PANCAKE_VAR_SXX_1KG', 'PANCAKE_VAR_500G', 'PANCAKE_VAR_1KG']) process.env[v] = 'var-' + v
  delete process.env.PANCAKE_KDX_VAR // khăn đồ xôi "chưa có variation" để thử nhánh không gửi POScake
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)
    if (url.includes('pos.pages.fm') && init?.method === 'POST') {
      posCalls.push(JSON.parse(String(init.body)))
      if (posFail) return new Response('boom', { status: 500 })
      return Response.json({ data: { id: 900000 + posCalls.length } })
    }
    return realFetch(input as never, init)
  }) as typeof fetch
  const db = await import('../lib/db')
  const schema = await import('../lib/crm/schema')
  await schema.ensureCrmSchema()
  sql = db.getDb()
  svc = await import('../lib/mini/service')
  ord = await import('../lib/mini/orders')
  await sql`DELETE FROM app_settings WHERE key IN ('mini_points', 'mini_voucher')`
})

after(() => {
  globalThis.fetch = realFetch
})

const session = async (p: string) => (await svc.identify({ anon_id: anon(), phone: p }, ctx)).session.id as number

test('đặt COD: máy chủ tự tính giá, lưu đơn, tạo đơn POScake đủ món, ghi order_placed', { skip }, async () => {
  const id = await session(phone(1))
  const r = await ord.placeOrder(id, { ...ADDR, payment: 'cod', items: [{ sku: 'sxc-set', qty: 2, price: 1 }, { sku: 'stn-500g', qty: 1 }] }, web)
  assert.equal(r.order.subtotal, 2 * 148000 + 65000, 'giá app gửi lên bị bỏ qua')
  assert.equal(r.order.total, r.order.subtotal)
  assert.equal(r.qr, null)
  assert.match(r.order.ref_code, /^HMA\d{10}[0-9A-F]{4}$/)
  const row = (await sql`SELECT * FROM mini_orders WHERE ref_code = ${r.order.ref_code}`)[0]
  assert.equal(row.pos_status, 'da_tao')
  assert.equal(row.customer_id, null, 'phiên chưa xác minh: đơn không gắn khách')
  const body = posCalls.at(-1) as { cod: number; items: { variation_id: string; quantity: number }[]; note: string }
  assert.equal(body.cod, r.order.total)
  assert.deepEqual(body.items.map(i => [i.variation_id, i.quantity]), [['var-PANCAKE_VAR_SXC', 2], ['var-PANCAKE_VAR_500G', 1]])
  assert.match(body.note, new RegExp(r.order.ref_code))
  const ev = await sql`SELECT props FROM funnel_events WHERE mini_session_id = ${id} AND name = 'order_placed'`
  assert.equal(ev.length, 1)
})

test('món thiếu variation POScake: đơn vẫn lưu, KHÔNG gửi POScake thiếu hàng, pos_status loi', { skip }, async () => {
  const id = await session(phone(2))
  const before = posCalls.length
  const r = await ord.placeOrder(id, { ...ADDR, payment: 'cod', items: [{ sku: 'kdx', qty: 1 }, { sku: 'sxc-set', qty: 1 }] }, web)
  assert.equal(posCalls.length, before, 'không gửi đơn thiếu khăn đồ xôi')
  const row = (await sql`SELECT pos_status, pos_error FROM mini_orders WHERE ref_code = ${r.order.ref_code}`)[0]
  assert.equal(row.pos_status, 'loi')
  assert.match(row.pos_error, /thieu_variation:kdx/)
})

test('POScake lỗi 500: đơn vẫn lưu với pos_status loi', { skip }, async () => {
  const id = await session(phone(3))
  posFail = true
  try {
    const r = await ord.placeOrder(id, { ...ADDR, payment: 'cod', items: [{ sku: 'sxx-1kg', qty: 1 }] }, web)
    const row = (await sql`SELECT pos_status FROM mini_orders WHERE ref_code = ${r.order.ref_code}`)[0]
    assert.equal(row.pos_status, 'loi')
  } finally {
    posFail = false
  }
})

test('kiểm dữ liệu: giỏ trống, sku lạ, địa chỉ ngắn, quá số lượng, chưa đăng ký, bản Zalo chưa có Checkout', { skip }, async () => {
  const id = await session(phone(4))
  const bad = (body: object) => ord.placeOrder(id, { ...ADDR, payment: 'cod', ...body }, web)
  await assert.rejects(bad({ items: [] }), (e: { code: string }) => e.code === 'empty_cart')
  await assert.rejects(bad({ items: [{ sku: 'khong-co', qty: 1 }] }), (e: { code: string }) => e.code === 'bad_request')
  await assert.rejects(bad({ items: [{ sku: 'kdx', qty: 1 }], address: 'HN' }), (e: { code: string }) => e.code === 'bad_request')
  await assert.rejects(bad({ items: [{ sku: 'kdx', qty: 21 }] }), (e: { code: string }) => e.code === 'bad_request')
  await assert.rejects(bad({ items: [{ sku: 'kdx', qty: 1 }], payment: 'the' }), (e: { code: string }) => e.code === 'bad_request')
  await assert.rejects(ord.placeOrder(null, { ...ADDR, payment: 'cod', items: [{ sku: 'kdx', qty: 1 }] }, web), (e: { code: string }) => e.code === 'no_session')
  await assert.rejects(ord.placeOrder(id, { ...ADDR, payment: 'cod', items: [{ sku: 'kdx', qty: 1 }] }, { zalo: true }),
    (e: { code: string }) => e.code === 'checkout_required')
})

test('expected_total lệch giá máy chủ → 409 price_changed kèm báo giá mới, không tạo đơn', { skip }, async () => {
  const id = await session(phone(5))
  await assert.rejects(ord.placeOrder(id, { ...ADDR, payment: 'cod', items: [{ sku: 'kdx', qty: 1 }], expected_total: 1000 }, web),
    (e: { code: string; extra: { quote: { total: number } } }) => e.code === 'price_changed' && e.extra.quote.total === 49000)
  const c = await sql`SELECT COUNT(*)::int AS n FROM mini_orders WHERE mini_session_id = ${id}`
  assert.equal(c[0].n, 0)
})

test('giới hạn 3 đơn/phiên/giờ', { skip }, async () => {
  const id = await session(phone(6))
  for (let i = 0; i < 3; i++) await ord.placeOrder(id, { ...ADDR, payment: 'cod', items: [{ sku: 'kdx', qty: 1 }] }, web)
  await assert.rejects(ord.placeOrder(id, { ...ADDR, payment: 'cod', items: [{ sku: 'kdx', qty: 1 }] }, web),
    (e: { code: string }) => e.code === 'order_limit')
})

test('voucher khoá SĐT: dùng được 1 lần, đánh dấu da_dung; số khác không dùng được', { skip }, async () => {
  await sql`INSERT INTO app_settings (key, value) VALUES ('mini_voucher', ${sql.json({ program: 'mini-order-test', amount: 30000, valid_days: 14 })})
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`
  try {
    const p = phone(7)
    const res = await svc.identify({ anon_id: anon(), phone: p }, ctx)
    const code = res.rewards[0]?.code
    assert.ok(code, 'SĐT mới được cấp voucher')
    const other = await session(phone(8))
    await assert.rejects(ord.previewOrder(other, { items: [{ sku: 'kdx', qty: 1 }], voucher_code: code }), (e: { code: string }) => e.code === 'voucher_invalid')

    const q = await ord.previewOrder(res.session.id, { items: [{ sku: 'kdx', qty: 1 }], voucher_code: code })
    assert.equal(q.voucher.amount, 30000)
    assert.equal(q.total, 19000)
    const r = await ord.placeOrder(res.session.id, { ...ADDR, payment: 'chuyen_khoan', items: [{ sku: 'kdx', qty: 1 }], voucher_code: code, expected_total: 19000 }, web)
    assert.equal(r.order.total, 19000)
    assert.equal(r.qr.amount, 19000)
    assert.equal(r.qr.content, r.order.ref_code)
    const v = (await sql`SELECT status, order_id FROM reward_ledger WHERE code = ${code}`)[0]
    assert.deepEqual([v.status, v.order_id], ['da_dung', r.order.ref_code])
    await assert.rejects(ord.placeOrder(res.session.id, { ...ADDR, payment: 'cod', items: [{ sku: 'kdx', qty: 1 }], voucher_code: code }, web),
      (e: { code: string }) => e.code === 'voucher_invalid')
  } finally {
    await sql`DELETE FROM app_settings WHERE key = 'mini_voucher'`
  }
})

test('voucher lớn hơn tạm tính: chỉ giảm tối đa bằng tạm tính, tổng không âm', { skip }, async () => {
  await sql`INSERT INTO app_settings (key, value) VALUES ('mini_voucher', ${sql.json({ program: 'mini-order-big', amount: 500000, valid_days: 14 })})
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`
  try {
    const res = await svc.identify({ anon_id: anon(), phone: phone(9) }, ctx)
    const q = await ord.previewOrder(res.session.id, { items: [{ sku: 'kdx', qty: 1 }], voucher_code: res.rewards[0].code })
    assert.equal(q.voucher.amount, 49000)
    assert.equal(q.total, 0)
  } finally {
    await sql`DELETE FROM app_settings WHERE key = 'mini_voucher'`
  }
})

test('Hạt Cốm: phiên chưa xác minh không tiêu được; đã xác minh tiêu được trong hạn mức, trừ vào sổ cái', { skip }, async () => {
  await sql`INSERT INTO app_settings (key, value) VALUES ('mini_points', ${sql.json({ checkin: 5, milestones: {}, redeem: { vnd_per_point: 100, max_pct: 20 } })})
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`
  try {
    const ck = await import('../lib/mini/checkin')
    const p = phone(10)
    const id = await session(p)
    await ck.checkin(id)
    const q0 = await ord.previewOrder(id, { items: [{ sku: 'kdx', qty: 1 }], use_points: 5 })
    assert.equal(q0.points, null, 'chưa xác minh: không có mục Hạt Cốm')

    const { promoteMiniSession } = await import('../lib/crm/mini')
    await promoteMiniSession(id, 'staff', { type: 'staff', id: null })
    await sql`INSERT INTO points_ledger (mini_session_id, customer_id, delta, reason, ref, note, created_by)
              SELECT ${id}, customer_id, 1000, 'dieu_chinh', 'test', 'test', 1 FROM mini_sessions WHERE id = ${id}`
    // 1005 hạt, tạm tính 148.000 → tối đa 20% = 29.600đ = 296 hạt
    const q = await ord.previewOrder(id, { items: [{ sku: 'sxc-set', qty: 1 }], use_points: 5000 })
    assert.equal(q.points.available, 1005)
    assert.equal(q.points.usable, 296)
    assert.equal(q.points.used, 296)
    assert.equal(q.total, 148000 - 29600)
    const r = await ord.placeOrder(id, { ...ADDR, payment: 'cod', items: [{ sku: 'sxc-set', qty: 1 }], use_points: 296 }, web)
    assert.equal(r.order.points_used, 296)
    const s = await svc.loadSession(id)
    assert.equal(await ck.pointsBalance(s), 1005 - 296)
    assert.ok(r.order.total === 118400)
    const body = posCalls.at(-1) as { total_discount?: number; note: string }
    assert.match(body.note, /Hạt Cốm -29\.600đ/)
  } finally {
    await sql`DELETE FROM app_settings WHERE key = 'mini_points'`
  }
})

test('SePay: getOrder/confirm theo mã HMA, xác nhận lặp chỉ thành công 1 lần', { skip }, async () => {
  const id = await session(phone(11))
  const r = await ord.placeOrder(id, { ...ADDR, payment: 'chuyen_khoan', items: [{ sku: 'sxx-500g', qty: 2 }] }, web)
  const ref = r.order.ref_code
  const o = await ord.getMiniOrderByRef(ref.toLowerCase())
  assert.equal(o.total_price, 200000)
  assert.equal(o.payment_status, 'pending')
  assert.equal(o.quantity, 2)
  assert.ok(o.pancake_order_id)
  assert.equal(await ord.confirmMiniPayment(ref), true)
  assert.equal(await ord.confirmMiniPayment(ref), false)
  assert.equal((await ord.getMiniOrderByRef(ref)).payment_status, 'paid')
  const st = await ord.orderStatus(id, ref)
  assert.equal(st.qr, null, 'đã trả thì không hiện QR nữa')
})

test('Đơn của tôi: phiên chỉ thấy đơn của mình; người khác không xem được đơn theo mã', { skip }, async () => {
  const a = await session(phone(12))
  const b = await session(phone(13))
  const r = await ord.placeOrder(a, { ...ADDR, payment: 'cod', items: [{ sku: 'kdx', qty: 1 }] }, web)
  assert.deepEqual((await ord.listOrders(a)).orders.map((o: { ref_code: string }) => o.ref_code), [r.order.ref_code])
  assert.deepEqual((await ord.listOrders(b)).orders, [])
  await assert.rejects(ord.orderStatus(b, r.order.ref_code), (e: { code: string }) => e.code === 'not_found')
  assert.equal((await ord.listOrders(a)).orders[0].phone_masked.includes('*'), true)
})

test('2 lần bấm đặt cùng lúc với 1 voucher: chỉ 1 đơn dùng được voucher', { skip }, async () => {
  await sql`INSERT INTO app_settings (key, value) VALUES ('mini_voucher', ${sql.json({ program: 'mini-order-race', amount: 20000, valid_days: 14 })})
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`
  try {
    const res = await svc.identify({ anon_id: anon(), phone: phone(14) }, ctx)
    const code = res.rewards[0].code
    const body = { ...ADDR, payment: 'cod', items: [{ sku: 'kdx', qty: 1 }], voucher_code: code }
    const out = await Promise.allSettled([ord.placeOrder(res.session.id, body, web), ord.placeOrder(res.session.id, body, web)])
    assert.equal(out.filter(o => o.status === 'fulfilled').length, 1)
    const rej = out.find(o => o.status === 'rejected') as PromiseRejectedResult
    assert.equal(rej.reason.code, 'voucher_invalid')
  } finally {
    await sql`DELETE FROM app_settings WHERE key = 'mini_voucher'`
  }
})
