// Chạy: npx --yes tsx --test tests/unsubscribe.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createUnsubscribeToken, verifyUnsubscribeToken, unsubscribeUrl, createConfirmToken, verifyConfirmToken, confirmOptInUrl } from '../lib/unsubscribe'

function withEnv(v: string | undefined, fn: () => void) {
  const old = process.env.UNSUBSCRIBE_SECRET
  if (v === undefined) delete process.env.UNSUBSCRIBE_SECRET; else process.env.UNSUBSCRIBE_SECRET = v
  try { fn() } finally { if (old === undefined) delete process.env.UNSUBSCRIBE_SECRET; else process.env.UNSUBSCRIBE_SECRET = old }
}

test('hủy nhận: không có khoá bí mật thì không tạo được link (không gửi thư marketing)', () => withEnv(undefined, () => {
  assert.equal(createUnsubscribeToken('a@b.com'), null)
  assert.equal(unsubscribeUrl('a@b.com'), null)
  assert.equal(verifyUnsubscribeToken('a@b.com', 'a'.repeat(32)), false)
}))

test('hủy nhận: token đúng email, không phân biệt hoa/thường và khoảng trắng', () => withEnv('secret-0123456789abc', () => {
  const t = createUnsubscribeToken('Khach@Mail.com')!
  assert.ok(t && t.length === 32)
  assert.equal(verifyUnsubscribeToken('khach@mail.com', t), true)
  assert.equal(verifyUnsubscribeToken('  KHACH@mail.com ', t), true)
}))

test('hủy nhận: token của người này không hủy được người khác; sửa token bị từ chối', () => withEnv('secret-0123456789abc', () => {
  const t = createUnsubscribeToken('a@b.com')!
  assert.equal(verifyUnsubscribeToken('c@d.com', t), false)
  assert.equal(verifyUnsubscribeToken('a@b.com', t.slice(0, 31) + (t.endsWith('0') ? '1' : '0')), false)
  assert.equal(verifyUnsubscribeToken('a@b.com', 'zzzz'), false)
  assert.equal(verifyUnsubscribeToken('a@b.com', null), false)
}))

test('hủy nhận: đổi khoá bí mật thì link cũ vô hiệu', () => {
  let t: string | null = null
  withEnv('secret-AAAAAAAAAAAAAA', () => { t = createUnsubscribeToken('a@b.com') })
  withEnv('secret-BBBBBBBBBBBBBB', () => assert.equal(verifyUnsubscribeToken('a@b.com', t), false))
})

test('hủy nhận: link chứa email đã mã hoá và token', () => withEnv('secret-0123456789abc', () => {
  const u = unsubscribeUrl('a+b@c.com')!
  assert.ok(u.includes('/api/unsubscribe?e=a%2Bb%40c.com&t='))
}))

test('token có mục đích: link hủy KHÔNG dùng để xác nhận đăng ký và ngược lại', () => withEnv('secret-0123456789abc', () => {
  const u = createUnsubscribeToken('a@b.com')!
  const c = createConfirmToken('a@b.com')!
  assert.notEqual(u, c)
  assert.equal(verifyConfirmToken('a@b.com', c), true)
  assert.equal(verifyConfirmToken('a@b.com', u), false)
  assert.equal(verifyUnsubscribeToken('a@b.com', c), false)
  assert.equal(verifyConfirmToken('x@y.com', c), false)
}))

test('xác nhận: link chứa đường dẫn đúng và không tạo được khi thiếu khoá', () => {
  withEnv('secret-0123456789abc', () => assert.ok(confirmOptInUrl('a@b.com')!.includes('/api/confirm-optin?e=a%40b.com&t=')))
  withEnv(undefined, () => { assert.equal(confirmOptInUrl('a@b.com'), null); assert.equal(createConfirmToken('a@b.com'), null) })
})
