// Chạy: npx --yes tsx --test tests/step0.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createPromoParams, isPromoValid, isLegacyPromoAllowed, PROMO_TTL_MS } from '../lib/promo'
import { checkApiKey } from '../lib/internal-auth'
import { handleProductPayment, matchProductRef, matchCourseRef, type ProductHandler, type ProductOrder } from '../lib/payment-handlers'

const HOUR = 60 * 60 * 1000

function withEnv(vars: Record<string, string | undefined>, fn: () => void | Promise<void>) {
  const old: Record<string, string | undefined> = {}
  for (const k of Object.keys(vars)) old[k] = process.env[k]
  for (const [k, v] of Object.entries(vars)) { if (v === undefined) delete process.env[k]; else process.env[k] = v }
  const restore = () => { for (const [k, v] of Object.entries(old)) { if (v === undefined) delete process.env[k]; else process.env[k] = v } }
  try {
    const r = fn()
    if (r instanceof Promise) return r.finally(restore)
    restore()
  } catch (e) { restore(); throw e }
}

// ── K2: mã khuyến mãi có chữ ký ───────────────────────────────────────────────
test('promo: không có PROMO_SECRET thì không tạo được và không hợp lệ', () => withEnv({ PROMO_SECRET: undefined }, () => {
  assert.equal(createPromoParams('a@b.com'), null)
  assert.equal(isPromoValid('a@b.com', String(Date.now() + HOUR), 'x'.repeat(32)), false)
}))

test('promo: hợp lệ cho đúng email (không phân biệt hoa thường/khoảng trắng)', () => withEnv({ PROMO_SECRET: 'test-secret-123' }, () => {
  const p = createPromoParams('Khach@Mail.com')!
  assert.ok(p)
  assert.equal(isPromoValid('khach@mail.com', p.x, p.t), true)
  assert.equal(isPromoValid('  KHACH@mail.com ', p.x, p.t), true)
}))

test('promo: sai email thì từ chối (link không dùng chung được)', () => withEnv({ PROMO_SECRET: 'test-secret-123' }, () => {
  const p = createPromoParams('khach@mail.com')!
  assert.equal(isPromoValid('nguoikhac@mail.com', p.x, p.t), false)
}))

test('promo: hết hạn thì từ chối', () => withEnv({ PROMO_SECRET: 'test-secret-123' }, () => {
  const p = createPromoParams('khach@mail.com', Date.now() - PROMO_TTL_MS - 1000)!
  assert.equal(isPromoValid('khach@mail.com', p.x, p.t), false)
}))

test('promo: sửa hạn dùng hoặc chữ ký thì từ chối', () => withEnv({ PROMO_SECRET: 'test-secret-123' }, () => {
  const p = createPromoParams('khach@mail.com')!
  assert.equal(isPromoValid('khach@mail.com', String(Number(p.x) + 7 * 24 * HOUR), p.t), false)
  assert.equal(isPromoValid('khach@mail.com', p.x, p.t.slice(0, 31) + (p.t.endsWith('0') ? '1' : '0')), false)
  assert.equal(isPromoValid('khach@mail.com', p.x, 'abc'), false)
  assert.equal(isPromoValid('khach@mail.com', undefined, undefined), false)
  assert.equal(isPromoValid('khach@mail.com', 'NaN', p.t), false)
}))

test('promo: đổi PROMO_SECRET thì mã cũ vô hiệu', () => {
  let p: { x: string; t: string } | null = null
  withEnv({ PROMO_SECRET: 'secret-A' }, () => { p = createPromoParams('khach@mail.com') })
  withEnv({ PROMO_SECRET: 'secret-B' }, () => { assert.equal(isPromoValid('khach@mail.com', p!.x, p!.t), false) })
})

test('promo: cửa sổ chuyển tiếp PROMO_LEGACY_UNTIL', () => {
  withEnv({ PROMO_LEGACY_UNTIL: undefined }, () => assert.equal(isLegacyPromoAllowed(), false))
  withEnv({ PROMO_LEGACY_UNTIL: new Date(Date.now() + HOUR).toISOString() }, () => assert.equal(isLegacyPromoAllowed(), true))
  withEnv({ PROMO_LEGACY_UNTIL: new Date(Date.now() - HOUR).toISOString() }, () => assert.equal(isLegacyPromoAllowed(), false))
  withEnv({ PROMO_LEGACY_UNTIL: 'khong-phai-ngay' }, () => assert.equal(isLegacyPromoAllowed(), false))
})

// ── K3/K4: khoá API, không có giá trị dự phòng ────────────────────────────────
test('api key: chưa cấu hình biến môi trường → misconfigured, KHÔNG cho qua bằng khoá dự phòng', () => withEnv({ EMAIL_SEQUENCE_API_KEY: undefined }, () => {
  const req = new Request('http://x', { headers: { 'x-api-key': 'old-fallback-key' } })
  assert.equal(checkApiKey(req, 'EMAIL_SEQUENCE_API_KEY'), 'misconfigured')
}))

test('api key: đúng khoá → ok; sai/thiếu khoá → unauthorized', () => withEnv({ EMAIL_SEQUENCE_API_KEY: 'k-real' }, () => {
  assert.equal(checkApiKey(new Request('http://x', { headers: { 'x-api-key': 'k-real' } }), 'EMAIL_SEQUENCE_API_KEY'), 'ok')
  assert.equal(checkApiKey(new Request('http://x', { headers: { 'x-api-key': 'k-fake' } }), 'EMAIL_SEQUENCE_API_KEY'), 'unauthorized')
  assert.equal(checkApiKey(new Request('http://x'), 'EMAIL_SEQUENCE_API_KEY'), 'unauthorized')
  assert.equal(checkApiKey(new Request('http://x', { headers: { 'x-api-key': 'k-real-longer' } }), 'EMAIL_SEQUENCE_API_KEY'), 'unauthorized')
}))

// ── K6: thanh toán xác nhận đúng 1 lần ────────────────────────────────────────
function makeHandler(order: ProductOrder | undefined, confirmResults: boolean[]) {
  const calls = { confirm: 0, notifyPaid: 0 }
  const h: ProductHandler = {
    label: 'TEST',
    getOrder: async () => order,
    confirm: async () => { calls.confirm++; return confirmResults.shift() ?? false },
    notifyPaid: async () => { calls.notifyPaid++ },
  }
  return { h, calls }
}
const ORDER: ProductOrder = { name: 'A', phone: '0900000000', product: 'x', quantity: 1, total_price: 148000, payment_status: 'pending', pancake_order_id: null }
const body = async (r: Response) => (await r.json()) as { success: boolean; message?: string }

test('thanh toán: không có đơn → báo, không xác nhận', async () => {
  const { h, calls } = makeHandler(undefined, [true])
  const r = await body(await handleProductPayment(h, 'TST123', 148000, 'noi dung'))
  assert.equal(r.message, 'TEST order not found')
  assert.equal(calls.confirm, 0)
  assert.equal(calls.notifyPaid, 0)
})

test('thanh toán: đơn đã trả rồi → bỏ qua', async () => {
  const { h, calls } = makeHandler({ ...ORDER, payment_status: 'paid' }, [true])
  const r = await body(await handleProductPayment(h, 'TST123', 148000, ''))
  assert.equal(r.message, 'Already paid')
  assert.equal(calls.confirm, 0)
})

test('thanh toán: chuyển thiếu → KHÔNG xác nhận', async () => {
  const { h, calls } = makeHandler(ORDER, [true])
  const r = await body(await handleProductPayment(h, 'TST123', 147999, ''))
  assert.equal(r.message, 'Underpaid')
  assert.equal(calls.confirm, 0)
  assert.equal(calls.notifyPaid, 0)
})

test('thanh toán: đủ tiền → xác nhận và báo 1 lần; dư tiền vẫn được', async () => {
  const a = makeHandler(ORDER, [true])
  assert.equal((await body(await handleProductPayment(a.h, 'TST123', 148000, ''))).success, true)
  assert.deepEqual(a.calls, { confirm: 1, notifyPaid: 1 })
  const b = makeHandler(ORDER, [true])
  await handleProductPayment(b.h, 'TST123', 200000, '')
  assert.deepEqual(b.calls, { confirm: 1, notifyPaid: 1 })
})

test('thanh toán: SePay gọi trùng (đua nhau) → chỉ 1 lần báo/kích hoạt', async () => {
  // Cả hai request đều đọc thấy đơn "pending" rồi cùng gọi confirm; CSDL chỉ cho 1 request thắng.
  const { h, calls } = makeHandler(ORDER, [true, false])
  const [r1, r2] = await Promise.all([
    handleProductPayment(h, 'TST123', 148000, ''),
    handleProductPayment(h, 'TST123', 148000, ''),
  ])
  const msgs = [(await body(r1)).message, (await body(r2)).message].sort()
  assert.deepEqual(msgs, ['Already paid', undefined].sort())
  assert.equal(calls.confirm, 2)
  assert.equal(calls.notifyPaid, 1)
})

// ── Nhận diện mã đơn trong nội dung chuyển khoản ─────────────────────────────
test('mã đơn: đúng định dạng, dính chữ thừa vẫn cắt đúng', () => {
  assert.deepEqual(matchProductRef('SXC1234567890'), { label: 'SXC', ref: 'SXC1234567890', strict: true })
  assert.deepEqual(matchProductRef('thanh toan sxc1234567890 cam on'), { label: 'SXC', ref: 'SXC1234567890', strict: true })
  assert.equal(matchProductRef('SXC1234567890chuyentien')?.ref, 'SXC1234567890')
  assert.equal(matchProductRef('MBVCB.123 STN0987654321 Nguyen Van A')?.ref, 'STN0987654321')
  assert.equal(matchProductRef('SXX1234567890AB12CK')?.ref, 'SXX1234567890AB12')
  assert.equal(matchProductRef('KDX0011223344')?.label, 'KDX')
})

test('mã đơn: mã cũ khớp mẫu rộng nhưng KHÔNG được tính là strict (để không báo động nhầm)', () => {
  const m = matchProductRef('SXC12345')
  assert.ok(m)
  assert.equal(m!.strict, false)
  const c = matchCourseRef('chuyen tien mua dhung cu')
  assert.equal(c?.strict, false)          // "dhung" khớp DH[A-Z0-9]+ nhưng không phải mã đơn thật
  assert.equal(matchCourseRef('DH9876123456 hoc phi')?.strict, true)
})

test('mã đơn: nội dung không liên quan thì không khớp', () => {
  assert.equal(matchProductRef('tien luong thang 9'), null)
  assert.equal(matchCourseRef('tien luong thang 9'), null)
})

test('thanh toán: mã không strict mà không tìm thấy đơn thì vẫn trả về bình thường, không lỗi', async () => {
  const { h, calls } = makeHandler(undefined, [true])
  const r = await body(await handleProductPayment(h, 'DHUNG', 100000, 'dhung', false))
  assert.equal(r.message, 'TEST order not found')
  assert.equal(calls.confirm, 0)
})

test('mã đơn: chữ giống mã sản phẩm khác không che mất mã chuẩn', () => {
  const m = matchProductRef('STNguyen chuyen KDX0011223344')
  assert.equal(m?.label, 'KDX')
  assert.equal(m?.strict, true)
})
