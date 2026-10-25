// Góc bếp chị em (Mini App v8) trên PostgreSQL THẬT (haco_test). Chạy: TEST_DB_NAME=haco_test_mini npm run test:db
import { test, before } from 'node:test'
import assert from 'node:assert/strict'

const URL = process.env.TEST_DATABASE_URL
const skip = !URL

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sql: any, svc: any, cm: any
const ctx = { ip: '127.0.0.1', ua: 'test' }
let n = 0
const anon = () => 'anon-cm-' + Date.now().toString(36) + '-' + n++
const phone = (k: number) => '09' + String(83000000 + k).slice(-8)
// JPEG tối thiểu hợp lệ về byte đầu (FFD8FF) đủ dài để qua kiểm tra.
const jpeg = 'data:image/jpeg;base64,' + Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 1)]).toString('base64')

before(async () => {
  if (skip) return
  process.env.DATABASE_URL = URL
  const db = await import('../lib/db')
  const schema = await import('../lib/crm/schema')
  await schema.ensureCrmSchema()
  sql = db.getDb()
  svc = await import('../lib/mini/service')
  cm = await import('../lib/mini/community')
  await cm.ensureCommunitySchema()
})

test('đăng bài: cần đăng ký, cần đồng ý, ảnh phải đúng định dạng', { skip }, async () => {
  await assert.rejects(cm.createPost(null, { caption: 'Thịt kho', consent: true, image: jpeg }), (e: { code: string }) => e.code === 'no_session')
  const id = (await svc.identify({ anon_id: anon(), phone: phone(1) }, ctx)).session.id
  await assert.rejects(cm.createPost(id, { caption: 'Thịt kho', consent: false, image: jpeg }), (e: { code: string }) => e.code === 'bad_request')
  await assert.rejects(cm.createPost(id, { caption: 'Thịt kho', consent: true, image: 'data:image/jpeg;base64,' + Buffer.from('<svg>').toString('base64') }), (e: { code: string }) => e.code === 'bad_request')
  await assert.rejects(cm.createPost(id, { caption: 'Thịt kho', consent: true, image: 'data:image/svg+xml;base64,PHN2Zz4=' }), (e: { code: string }) => e.code === 'bad_request')
  await assert.rejects(cm.createPost(id, { caption: 'x', consent: true, image: jpeg }), (e: { code: string }) => e.code === 'bad_request')
  const r = await cm.createPost(id, { caption: '  Nồi thịt kho\u0007 nhà mình  ', consent: true, image: jpeg, display_name: 'Chị Lan', area: 'Hà Nội', recipe_slug: 'thit-kho-trung' })
  assert.equal(r.post.status, 'cho_duyet')
  const row = (await sql`SELECT caption, image_mime FROM cook_posts WHERE id = ${r.post.id}`)[0]
  assert.equal(row.caption, 'Nồi thịt kho nhà mình')
  assert.equal(row.image_mime, 'image/jpeg')
})

test('chưa duyệt: người khác không thấy bài, không xem được ảnh; chủ bài thấy trong "bài của tôi"', { skip }, async () => {
  const a = (await svc.identify({ anon_id: anon(), phone: phone(2) }, ctx)).session.id
  const b = (await svc.identify({ anon_id: anon(), phone: phone(3) }, ctx)).session.id
  const { post } = await cm.createPost(a, { caption: 'Canh chua cá', consent: true, image: jpeg })
  assert.ok(!(await cm.listApproved()).posts.some((p: { id: number }) => p.id === post.id))
  await assert.rejects(cm.postImage(post.id, b), (e: { code: string }) => e.code === 'not_found')
  await assert.rejects(cm.postImage(post.id, null), (e: { code: string }) => e.code === 'not_found')
  const own = await cm.postImage(post.id, a)
  assert.equal(own.isPublic, false)
  const mine = await cm.myPosts(a)
  assert.equal(mine.posts[0].status, 'cho_duyet')
})

test('duyệt + khen thì hiện công khai; từ chối bắt buộc lý do và chủ bài thấy lý do; ghim lên đầu', { skip }, async () => {
  const staff = (await sql`SELECT id FROM staff ORDER BY id LIMIT 1`)[0]?.id
  if (!staff) return
  const a = (await svc.identify({ anon_id: anon(), phone: phone(4) }, ctx)).session.id
  const p1 = (await cm.createPost(a, { caption: 'Gà rang gừng', consent: true, image: jpeg })).post
  const p2 = (await cm.createPost(a, { caption: 'Ảnh mờ', consent: true, image: jpeg })).post
  await cm.moderatePost(p1.id, 'khen', staff, '', '127.0.0.1')
  await assert.rejects(cm.moderatePost(p2.id, 'tu_choi', staff, '  ', '127.0.0.1'), (e: { code: string }) => e.code === 'bad_request')
  await cm.moderatePost(p2.id, 'tu_choi', staff, 'Ảnh chưa rõ món', '127.0.0.1')
  const pub = (await cm.listApproved()).posts.find((p: { id: number }) => p.id === p1.id)
  assert.ok(pub && pub.praised)
  assert.equal((await cm.postImage(p1.id, null)).isPublic, true)
  const mine = (await cm.myPosts(a)).posts.find((p: { id: number }) => p.id === p2.id)
  assert.equal(mine.status, 'tu_choi')
  assert.equal(mine.reject_reason, 'Ảnh chưa rõ món')
  await cm.moderatePost(p1.id, 'ghim', staff, '', '127.0.0.1')
  assert.equal((await cm.listApproved()).posts[0].id, p1.id)
  const log = await sql`SELECT action FROM audit_logs WHERE table_name = 'cook_posts' AND record_id = ${p1.id}`
  assert.ok(log.length >= 2)
})

test('giới hạn 3 bài mỗi ngày mỗi phiên', { skip }, async () => {
  const a = (await svc.identify({ anon_id: anon(), phone: phone(5) }, ctx)).session.id
  for (let i = 0; i < 3; i++) await cm.createPost(a, { caption: 'Món ' + i, consent: true, image: jpeg })
  await assert.rejects(cm.createPost(a, { caption: 'Món 4', consent: true, image: jpeg }), (e: { code: string }) => e.code === 'post_limit')
})
