// Chạy: npx --yes tsx --test tests/followups.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { runFollowups, MAX_FOLLOWUP_ATTEMPTS, type RunDeps } from '../lib/followups'
import { handleProductPayment, type ProductHandler, type ProductOrder } from '../lib/payment-handlers'
import type { PaymentFollowup } from '../lib/db'

const ORDER: ProductOrder = { name: 'A', phone: '0900000000', product: 'x', quantity: 1, total_price: 100000, payment_status: 'paid', pancake_order_id: 'P1' }

function makeDeps(over: Partial<RunDeps> = {}, due: PaymentFollowup[] = []) {
  const log = { done: [] as number[], failed: [] as { id: number; error: string; attempts: number; giveUp: boolean }[], escalated: [] as { kind: string; ref: string; attempts: number; error: string }[], marked: [] as number[], notified: 0, pos: 0, emails: 0 }
  const handler: ProductHandler = {
    label: 'STN', getOrder: async () => ORDER, confirm: async () => true,
    notifyPaid: async () => { log.notified++ },
  }
  const deps: RunDeps = {
    productHandlers: { STN: handler },
    updatePosStatus: async () => { log.pos++; return true },
    getCourseLead: async () => ({ id: 7, name: 'B', email: 'b@x.com', amount: 299000, email_sent: false }),
    sendCourseEmail: async () => { log.emails++; return null },
    markCourseEmailSent: async () => {},
    claim: async () => due,
    done: async id => { log.done.push(id) },
    failed: async (id, error, attempts, giveUp) => { log.failed.push({ id, error, attempts, giveUp }) },
    escalate: async e => { log.escalated.push(e) },
    markEscalated: async id => { log.marked.push(id) },
    ...over,
  }
  return { deps, log }
}
const F = (over: Partial<PaymentFollowup> = {}): PaymentFollowup => ({ id: 1, kind: 'notify:STN', ref_code: 'STN1', status: 'pending', attempts: 0, last_error: null, escalated: false, ...over })

test('followup notify: gửi lại tin và xong', async () => {
  const { deps, log } = makeDeps({}, [F()])
  const r = await runFollowups(deps)
  assert.deepEqual(r, { done: 1, retry: 0, gaveUp: 0 })
  assert.equal(log.notified, 1)
  assert.deepEqual(log.done, [1])
})

test('followup: lỗi thì lùi lại thử sau, chưa báo động', async () => {
  const { deps, log } = makeDeps({ productHandlers: { STN: { label: 'STN', getOrder: async () => ORDER, confirm: async () => true, notifyPaid: async () => { throw new Error('Telegram 500') } } } }, [F({ attempts: 1 })])
  const r = await runFollowups(deps)
  assert.deepEqual(r, { done: 0, retry: 1, gaveUp: 0 })
  assert.equal(log.failed[0].attempts, 1)
  assert.equal(log.failed[0].giveUp, false)
  assert.equal(log.escalated.length, 0)
})

test('followup: quá số lần thì báo động đúng 1 lần và đánh dấu đã báo', async () => {
  const boom: ProductHandler = { label: 'STN', getOrder: async () => ORDER, confirm: async () => true, notifyPaid: async () => { throw new Error('x') } }
  const { deps, log } = makeDeps({ productHandlers: { STN: boom } }, [F({ attempts: MAX_FOLLOWUP_ATTEMPTS })])
  const r = await runFollowups(deps)
  assert.equal(r.gaveUp, 1)
  assert.equal(log.failed[0].giveUp, true)
  assert.equal(log.escalated.length, 1)
  assert.deepEqual(log.marked, [1])
})

test('followup: đã báo động rồi thì không báo lại', async () => {
  const boom: ProductHandler = { label: 'STN', getOrder: async () => ORDER, confirm: async () => true, notifyPaid: async () => { throw new Error('x') } }
  const { deps, log } = makeDeps({ productHandlers: { STN: boom } }, [F({ attempts: MAX_FOLLOWUP_ATTEMPTS, escalated: true })])
  await runFollowups(deps)
  assert.equal(log.escalated.length, 0)
})

test('followup: báo động lỗi thì KHÔNG đánh dấu đã báo (để lần sau còn báo)', async () => {
  const boom: ProductHandler = { label: 'STN', getOrder: async () => ORDER, confirm: async () => true, notifyPaid: async () => { throw new Error('x') } }
  const { deps, log } = makeDeps({ productHandlers: { STN: boom }, escalate: async () => { throw new Error('tele down') } }, [F({ attempts: MAX_FOLLOWUP_ATTEMPTS })])
  await runFollowups(deps)
  assert.deepEqual(log.marked, [])
})

test('followup pancake: cập nhật lại POS; vẫn lỗi thì thử lại', async () => {
  const ok = makeDeps({}, [F({ kind: 'pancake:STN' })])
  assert.equal((await runFollowups(ok.deps)).done, 1)
  const bad = makeDeps({ updatePosStatus: async () => false }, [F({ kind: 'pancake:STN' })])
  assert.equal((await runFollowups(bad.deps)).retry, 1)
})

test('followup course_email: gửi 1 lần, đã gửi rồi thì bỏ qua, lỗi Resend thì thử lại', async () => {
  const a = makeDeps({}, [F({ kind: 'course_email', ref_code: 'DH1' })])
  await runFollowups(a.deps)
  assert.equal(a.log.emails, 1)
  const b = makeDeps({ getCourseLead: async () => ({ id: 7, name: 'B', email: 'b@x.com', amount: 1, email_sent: true }) }, [F({ kind: 'course_email', ref_code: 'DH1' })])
  await runFollowups(b.deps)
  assert.equal(b.log.emails, 0)
  const c = makeDeps({ sendCourseEmail: async () => ({ error: { message: 'quota' } }) }, [F({ kind: 'course_email', ref_code: 'DH1' })])
  assert.equal((await runFollowups(c.deps)).retry, 1)
})

test('followup: đơn không còn thì coi như xong; nhãn lạ thì báo lỗi để bị thử lại/báo động', async () => {
  const gone = makeDeps({ productHandlers: { STN: { label: 'STN', getOrder: async () => undefined, confirm: async () => true, notifyPaid: async () => {} } } }, [F()])
  assert.equal((await runFollowups(gone.deps)).done, 1)
  const unknown = makeDeps({}, [F({ kind: 'notify:ZZZ', attempts: 1 })])
  const r = await runFollowups(unknown.deps)
  assert.equal(r.retry, 1)
  assert.equal(r.done, 0)
})

test('thanh toán: tin báo kho hỏng → xếp hàng thử lại, khách vẫn được xác nhận', async () => {
  const queued: string[] = []
  const h: ProductHandler = { label: 'STN', getOrder: async () => ({ ...ORDER, payment_status: 'pending', pancake_order_id: null }), confirm: async () => true, notifyPaid: async () => { throw new Error('Telegram 400') } }
  const res = await handleProductPayment(h, 'STN1', 100000, '', true, async (k, r) => { queued.push(`${k}|${r}`) })
  assert.equal(((await res.json()) as { success: boolean }).success, true)
  assert.deepEqual(queued, ['notify:STN|STN1'])
})

test('followup: việc đã failed mà chưa báo được thì lần sau chỉ báo lại, không xử lý lại', async () => {
  const { deps, log } = makeDeps({}, [F({ status: 'failed', attempts: MAX_FOLLOWUP_ATTEMPTS, last_error: 'x' })])
  const r = await runFollowups(deps)
  assert.equal(r.gaveUp, 1)
  assert.equal(log.notified, 0)
  assert.equal(log.escalated.length, 1)
  assert.deepEqual(log.marked, [1])
})

test('followup: bị cắt giữa chừng quá nhiều lần (attempts vượt ngưỡng) thì bỏ cuộc và báo', async () => {
  const { deps, log } = makeDeps({}, [F({ attempts: MAX_FOLLOWUP_ATTEMPTS + 1 })])
  const r = await runFollowups(deps)
  assert.equal(r.gaveUp, 1)
  assert.equal(log.notified, 0)
  assert.equal(log.failed[0].giveUp, true)
  assert.equal(log.escalated.length, 1)
})

test('followup sheet: đẩy lead sang Sheet; lỗi thì thử lại; chưa cấu hình thì bỏ qua', async () => {
  const pushed: number[] = []
  const ok = makeDeps({ pushGiftLeadToSheet: async id => { pushed.push(id) } }, [F({ kind: 'sheet:gift', ref_code: '42' })])
  assert.equal((await runFollowups(ok.deps)).done, 1)
  assert.deepEqual(pushed, [42])
  const bad = makeDeps({ pushGiftLeadToSheet: async () => { throw new Error('Google Sheet trả lỗi 500') } }, [F({ kind: 'sheet:gift', ref_code: '42', attempts: 1 })])
  assert.equal((await runFollowups(bad.deps)).retry, 1)
  const none = makeDeps({}, [F({ kind: 'sheet:gift', ref_code: '42' })])
  assert.equal((await runFollowups(none.deps)).done, 1)
})
