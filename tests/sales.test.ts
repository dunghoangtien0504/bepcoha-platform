// Bước 0 nối vào route bán hàng: giá khoá học do máy chủ quyết, thanh toán khoá học xác nhận 1 lần.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { coursePriceFor, createPromoParams, COURSE_PRICE, PROMO_PRICE } from '../lib/promo'
import { handleCoursePayment, type CoursePaymentDeps, type CourseLeadLite } from '../lib/course-payment'

function withEnv<T>(env: Record<string, string | undefined>, fn: () => T): T {
  const old: Record<string, string | undefined> = {}
  for (const k of Object.keys(env)) { old[k] = process.env[k]; if (env[k] === undefined) delete process.env[k]; else process.env[k] = env[k] }
  try { return fn() } finally { for (const k of Object.keys(old)) { if (old[k] === undefined) delete process.env[k]; else process.env[k] = old[k] } }
}

test('giá khoá học: ?promo=239 trơn KHÔNG còn được giảm (lỗi K2)', () => withEnv({ PROMO_SECRET: 's-1234567890', PROMO_LEGACY_UNTIL: undefined }, () => {
  assert.equal(coursePriceFor('a@x.com', { promo: '239' }), COURSE_PRICE)
  assert.equal(coursePriceFor('a@x.com', {}), COURSE_PRICE)
}))

test('giá khoá học: link có chữ ký đúng email thì được 239k; email khác thì không', () => withEnv({ PROMO_SECRET: 's-1234567890' }, () => {
  const p = createPromoParams('a@x.com')!
  assert.equal(coursePriceFor('A@X.com ', { promo: '239', ...p }), PROMO_PRICE)
  assert.equal(coursePriceFor('b@x.com', { promo: '239', ...p }), COURSE_PRICE)
  assert.equal(coursePriceFor('a@x.com', { promo: '199', ...p }), COURSE_PRICE)
}))

test('giá khoá học: link cũ chỉ được giảm trong cửa sổ chuyển tiếp, và chỉ khi không kèm chữ ký sai', () => {
  const future = new Date(Date.now() + 86400000).toISOString()
  withEnv({ PROMO_SECRET: 's-1234567890', PROMO_LEGACY_UNTIL: future }, () => {
    assert.equal(coursePriceFor('a@x.com', { promo: '239' }), PROMO_PRICE)
    assert.equal(coursePriceFor('a@x.com', { promo: '239', x: '1', t: 'sai' }), COURSE_PRICE)
  })
  withEnv({ PROMO_SECRET: 's-1234567890', PROMO_LEGACY_UNTIL: '2020-01-01T00:00:00Z' }, () => {
    assert.equal(coursePriceFor('a@x.com', { promo: '239' }), COURSE_PRICE)
  })
})

function courseDeps(lead: CourseLeadLite | undefined, over: Partial<CoursePaymentDeps> = {}) {
  const log = { confirmed: 0, emails: 0, notified: 0, mismatch: 0, unmatched: 0, enqueued: [] as string[], emailMarked: 0 }
  let paid = lead?.payment_status === 'paid'
  const d: CoursePaymentDeps = {
    getLead: async () => (lead ? { ...lead, payment_status: paid ? 'paid' : 'pending' } : undefined),
    confirm: async () => { if (paid) return false; paid = true; log.confirmed++; return true },
    sendEmail: async () => { log.emails++; return null },
    markEmailSent: async () => { log.emailMarked++ },
    notifyPaid: async () => { log.notified++ },
    markTelegramSent: async () => {},
    mismatch: async () => { log.mismatch++ },
    unmatched: async () => { log.unmatched++ },
    enqueue: async k => { log.enqueued.push(k) },
    ...over,
  }
  return { d, log }
}
const LEAD: CourseLeadLite = { id: 1, name: 'A', email: 'a@x.com', phone: '0900000000', amount: 239000, payment_status: 'pending' }

test('thanh toán khoá: mã chuẩn không có học viên → báo "tiền về không có đơn"', async () => {
  const { d, log } = courseDeps(undefined)
  await handleCoursePayment('DH1234567890', 239000, 'DH1234567890', true, d)
  assert.equal(log.unmatched, 1)
})

test('thanh toán khoá: chuyển thiếu → không kích hoạt, báo lệch tiền', async () => {
  const { d, log } = courseDeps(LEAD)
  await handleCoursePayment('DH1', 10000, 'DH1', true, d)
  assert.equal(log.confirmed, 0); assert.equal(log.mismatch, 1); assert.equal(log.emails, 0)
})

test('thanh toán khoá: SePay gọi trùng đồng thời → email/Telegram đúng 1 lần', async () => {
  const { d, log } = courseDeps(LEAD)
  await Promise.all([handleCoursePayment('DH1', 239000, 'DH1', true, d), handleCoursePayment('DH1', 239000, 'DH1', true, d)])
  assert.equal(log.confirmed, 1); assert.equal(log.emails, 1); assert.equal(log.notified, 1)
})

test('thanh toán khoá: Resend trả lỗi → KHÔNG đánh dấu đã gửi, xếp hàng gửi lại', async () => {
  const { d, log } = courseDeps(LEAD, { sendEmail: async () => ({ error: { message: 'quota' } }) })
  await handleCoursePayment('DH1', 239000, 'DH1', true, d)
  assert.equal(log.emailMarked, 0)
  assert.deepEqual(log.enqueued, ['course_email'])
})
