// Đặt hàng + webhook SePay chạy thật trên PostgreSQL (database test). Không có PANCAKE_API_KEY/TELEGRAM → coi như POScake lỗi.
import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'

const URL = process.env.TEST_DATABASE_URL
const skip = !URL

before(async () => {
  if (skip) return
  process.env.DATABASE_URL = URL
  process.env.SEPAY_API_KEY = 'sepay-test-key'
  delete process.env.PANCAKE_API_KEY
  delete process.env.TELEGRAM_BOT_TOKEN
  const db = await import('../lib/db')
  await db.initDb()
})

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  new NextRequest(`http://localhost${path}`, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '10.0.0.' + Math.floor(Math.random() * 250), ...headers } })

test('đặt hàng: giá do máy chủ quyết, POScake lỗi vẫn lưu đơn và trả mã chuyển khoản', { skip }, async () => {
  const { POST } = await import('../app/api/sot-xa-xiu-order/route')
  const res = await POST(post('/api/sot-xa-xiu-order', { name: 'Chị Test', phone: '0977123456', address: 'Hà Nội', product: '1kg', quantity: 2, totalPrice: 1000 }))
  assert.equal(res.status, 200)
  const j = await res.json()
  assert.equal(j.totalPrice, 380000)
  assert.match(j.refCode, /^SXX\d{10}[0-9A-F]{4}$/)
  const { getSxxOrderByRef } = await import('../lib/db')
  const o = await getSxxOrderByRef(j.refCode)
  assert.ok(o)
  assert.equal(o!.pancake_order_id, null)
})

test('đặt hàng: dữ liệu sai bị từ chối; quá 5 đơn/IP/10 phút bị chặn', { skip }, async () => {
  const { POST } = await import('../app/api/set-xoi-com-order/route')
  assert.equal((await POST(post('/x', { name: 'A', phone: '123', address: 'HN' }))).status, 400)
  const ip = { 'x-forwarded-for': '10.9.9.9' }
  const codes: number[] = []
  for (let i = 0; i < 6; i++) codes.push((await POST(post('/x', { name: 'A', phone: '0977000000', address: 'HN', quantity: 1 }, ip))).status)
  assert.deepEqual(codes.slice(0, 5), [200, 200, 200, 200, 200])
  assert.equal(codes[5], 429)
})

test('webhook SePay: sai khoá → 401; tiền ra bị bỏ qua; đủ tiền → xác nhận 1 lần dù gọi trùng', { skip }, async () => {
  const order = await import('../app/api/khan-do-xoi-order/route')
  const j = await (await order.POST(post('/x', { name: 'B', phone: '0977222333', address: 'HN', quantity: 1 }))).json()
  const { POST } = await import('../app/api/payment-webhook/route')
  const hook = (body: object, key = 'sepay-test-key') => POST(post('/api/payment-webhook', body, { Authorization: `Apikey ${key}` }))
  assert.equal((await hook({ content: j.refCode, transferAmount: 49000, transferType: 'in' }, 'sai')).status, 401)
  const out = await (await hook({ content: `CK ${j.refCode}`, transferAmount: 49000, transferType: 'out' })).json()
  assert.match(out.message, /outgoing/)
  const { getKdxOrderByRef } = await import('../lib/db')
  assert.notEqual((await getKdxOrderByRef(j.refCode))!.payment_status, 'paid')
  const [a, b] = await Promise.all([
    hook({ content: `CK ${j.refCode} cam on`, transferAmount: 49000, transferType: 'in' }),
    hook({ content: `CK ${j.refCode} cam on`, transferAmount: 49000, transferType: 'in' }),
  ])
  const msgs = [await a.json(), await b.json()].map(x => x.message ?? 'ok').sort()
  assert.deepEqual(msgs, ['Already paid', 'ok'])
  assert.equal((await getKdxOrderByRef(j.refCode))!.payment_status, 'paid')
})

test('khoá học: ?promo=239 trơn bị tính 299k (không còn ai cũng lấy được 239k)', { skip }, async () => {
  delete process.env.PROMO_LEGACY_UNTIL
  const { POST } = await import('../app/api/course-form/route')
  const j = await (await POST(post('/x', { name: 'C', email: 'c@x.com', phone: '0977333444', promo: '239' }))).json()
  assert.equal(j.amount, 299000)
})
