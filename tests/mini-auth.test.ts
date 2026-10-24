// Token phiên khách Mini App và câu đồng ý (không cần database). Chạy: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SignJWT } from 'jose'

process.env.MINI_SESSION_SECRET = 'test-mini-secret-0123456789-abcdefghijklmnop'

test('token Mini App: ký rồi đọc lại được đúng mini_session id', async () => {
  const { createMiniToken, verifyMiniToken } = await import('../lib/mini-auth')
  const t = await createMiniToken(42)
  assert.equal(await verifyMiniToken(t), 42)
})

test('token Mini App: từ chối token sai audience (vd token nhân viên), sai chữ ký, rác', async () => {
  const { verifyMiniToken } = await import('../lib/mini-auth')
  const key = new TextEncoder().encode(process.env.MINI_SESSION_SECRET)
  const staffLike = await new SignJWT({}).setProtectedHeader({ alg: 'HS256' }).setSubject('42').setAudience('crm').setExpirationTime('1h').sign(key)
  assert.equal(await verifyMiniToken(staffLike), null)
  const otherKey = await new SignJWT({}).setProtectedHeader({ alg: 'HS256' }).setSubject('42').setAudience('mini').setExpirationTime('1h').sign(new TextEncoder().encode('x'.repeat(40)))
  assert.equal(await verifyMiniToken(otherKey), null)
  assert.equal(await verifyMiniToken('abc.def.ghi'), null)
  assert.equal(await verifyMiniToken(null), null)
})

test('token Mini App: đọc từ header Authorization trước, rồi tới cookie', async () => {
  const { miniTokenFromRequest } = await import('../lib/mini-auth')
  const both = new Request('http://x/api/mini/me', { headers: { authorization: 'Bearer AAA', cookie: 'a=1; mini_session=BBB' } })
  assert.equal(miniTokenFromRequest(both), 'AAA')
  const cookieOnly = new Request('http://x/api/mini/me', { headers: { cookie: 'a=1; mini_session=BBB; c=3' } })
  assert.equal(miniTokenFromRequest(cookieOnly), 'BBB')
  assert.equal(miniTokenFromRequest(new Request('http://x/')), null)
})

test('cookie phiên: httpOnly, SameSite=Lax, có hạn; xoá được', async () => {
  const { miniCookieHeader } = await import('../lib/mini-auth')
  const set = miniCookieHeader('tok')
  assert.match(set, /^mini_session=tok; Path=\/; HttpOnly; SameSite=Lax; Max-Age=\d+/)
  assert.match(miniCookieHeader(null), /Max-Age=0/)
})

test('câu đồng ý: có phiên bản mini-2026-10-v1, hash sha256 ổn định, phiên bản lạ trả null', async () => {
  const { consentText, consentHash } = await import('../lib/mini-consent')
  const text = consentText('mini-2026-10-v1')
  assert.ok(text && text.includes('HACO Food'))
  assert.equal(consentHash(text!), consentHash(text!))
  assert.match(consentHash(text!), /^[0-9a-f]{64}$/)
  assert.equal(consentText('khong-co'), null)
  assert.equal(consentText('__proto__'), null)
})

test('quy tắc mở bài: bài 1 ngay, bài 2 lúc 00:00 giờ VN hôm sau, tối đa 8 bài', async () => {
  const { unlockAt, unlockedLessons } = await import('../lib/mini/service')
  const started = new Date('2026-10-23T14:30:00Z') // 21:30 giờ VN
  assert.equal(unlockAt(started, 1).toISOString(), started.toISOString())
  assert.equal(unlockAt(started, 2).toISOString(), '2026-10-23T17:00:00.000Z')
  assert.deepEqual(unlockedLessons(started, new Date('2026-10-23T18:00:00Z')).map(l => l.no), [1, 2])
  assert.equal(unlockedLessons(started, new Date('2027-01-01T00:00:00Z')).length, 8)
})
