// Sự kiện và thông báo của Mini App (v3-A) trên PostgreSQL THẬT. Chạy: TEST_DB_NAME=haco_test_mini npm run test:db
import { test, before } from 'node:test'
import assert from 'node:assert/strict'

const URL = process.env.TEST_DATABASE_URL
const skip = !URL

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sql: any, svc: any, ev: any, nt: any
const ctx = { ip: '127.0.0.1', ua: 'test' }
let n = 0
const RUN = Math.floor(Math.random() * 900000) + 50000
const anon = () => 'anon-ev-' + Date.now().toString(36) + '-' + n++
const phone = (k: number) => '09' + String(RUN * 100 + k).padStart(8, '0')
const slug = (k: string) => `test-${RUN}-${k}`
const session = async (k: number) => (await svc.identify({ anon_id: anon(), phone: phone(k) }, ctx)).session.id as number

async function makeEvent(k: string, o: { inHours?: number; capacity?: number | null; status?: string } = {}) {
  const r = await sql`
    INSERT INTO events (slug, title, kind, starts_at, capacity, status)
    VALUES (${slug(k)}, ${'Sự kiện ' + k}, 'workshop', NOW() + make_interval(mins => ${Math.round((o.inHours ?? 48) * 60)}),
            ${o.capacity ?? null}, ${o.status ?? 'cong_bo'})
    RETURNING id`
  return r[0].id as number
}

before(async () => {
  if (skip) return
  process.env.DATABASE_URL = URL
  const db = await import('../lib/db')
  const schema = await import('../lib/crm/schema')
  await schema.ensureCrmSchema()
  sql = db.getDb()
  svc = await import('../lib/mini/service')
  ev = await import('../lib/mini/events')
  nt = await import('../lib/mini/notifications')
})

test('sự kiện: chỉ hiện bản đã công bố; sắp tới sắp theo giờ, đã qua ở tab riêng; khách chưa đăng ký vẫn xem được', { skip }, async () => {
  await makeEvent('nhap', { status: 'nhap' })
  await makeEvent('sau', { inHours: 72 })
  await makeEvent('truoc', { inHours: 24 })
  await makeEvent('cu', { inHours: -48 })
  const up = (await ev.listEvents(null, 'sap_toi')).events.map((e: { slug: string }) => e.slug).filter((s: string) => s.startsWith(`test-${RUN}`))
  assert.deepEqual(up, [slug('truoc'), slug('sau')])
  const past = (await ev.listEvents(null, 'da_qua')).events.map((e: { slug: string }) => e.slug)
  assert.ok(past.includes(slug('cu')))
  assert.ok(!past.includes(slug('nhap')))
  await assert.rejects(ev.getEvent(null, slug('nhap')), (e: { code: string }) => e.code === 'not_found')
})

test('nhắc tôi: cần đăng ký; bật/tắt không tạo dòng trùng; sự kiện đã qua thì không bật được', { skip }, async () => {
  await makeEvent('nhac')
  await makeEvent('qua', { inHours: -5 })
  await assert.rejects(ev.setReminder(null, slug('nhac'), 'nhac', true), (e: { code: string }) => e.code === 'no_session')
  const id = await session(1)
  assert.equal((await ev.setReminder(id, slug('nhac'), 'nhac', true)).event.reminded, true)
  assert.equal((await ev.setReminder(id, slug('nhac'), 'nhac', true)).event.reminded, true)
  assert.equal((await ev.setReminder(id, slug('nhac'), 'nhac', false)).event.reminded, false)
  const rows = await sql`SELECT COUNT(*)::int AS n FROM event_reminders r JOIN events e ON e.id = r.event_id WHERE e.slug = ${slug('nhac')}`
  assert.equal(rows[0].n, 1)
  await assert.rejects(ev.setReminder(id, slug('qua'), 'nhac', true), (e: { code: string }) => e.code === 'event_closed')
  await assert.rejects(ev.setReminder(id, slug('nhac'), 'khac', true), (e: { code: string }) => e.code === 'bad_request')
})

test('giữ chỗ: đủ chỗ thì báo event_full; huỷ chỗ thì người khác giữ được; giữ chỗ kèm luôn nhắc giờ', { skip }, async () => {
  await makeEvent('cho', { capacity: 2 })
  const [a, b, c] = [await session(2), await session(3), await session(4)]
  const ra = await ev.setReminder(a, slug('cho'), 'giu_cho', true)
  assert.equal(ra.event.booked, true)
  assert.equal(ra.event.reminded, true)
  assert.equal(ra.event.seats_left, 1)
  await ev.setReminder(b, slug('cho'), 'giu_cho', true)
  await assert.rejects(ev.setReminder(c, slug('cho'), 'giu_cho', true), (e: { code: string }) => e.code === 'event_full')
  await ev.setReminder(a, slug('cho'), 'giu_cho', false)
  assert.equal((await ev.setReminder(c, slug('cho'), 'giu_cho', true)).event.booked, true)
  await makeEvent('khong-cho')
  await assert.rejects(ev.setReminder(a, slug('khong-cho'), 'giu_cho', true), (e: { code: string }) => e.code === 'bad_request')
})

test('giữ chỗ cùng lúc: 5 người tranh 1 chỗ cuối thì chỉ 1 người được', { skip }, async () => {
  await makeEvent('tranh', { capacity: 1 })
  const ids = await Promise.all([10, 11, 12, 13, 14].map(session))
  const out = await Promise.allSettled(ids.map(id => ev.setReminder(id, slug('tranh'), 'giu_cho', true)))
  assert.equal(out.filter(o => o.status === 'fulfilled').length, 1)
})

test('thông báo: đúng người nhận; khách chưa xác minh không thấy tin cho khách đã xác minh', { skip }, async () => {
  const a = await session(20)
  const b = await session(21)
  const tag = `T${RUN}`
  await sql`INSERT INTO notifications (title, kind, audience) VALUES (${tag + ' tat ca'}, 'he_thong', 'tat_ca')`
  await sql`INSERT INTO notifications (title, kind, audience) VALUES (${tag + ' da xac minh'}, 'uu_dai', 'da_xac_minh')`
  await sql`INSERT INTO notifications (title, kind, audience, mini_session_id, link) VALUES (${tag + ' rieng a'}, 'khoe_mon', 'phien', ${a}, '/so-tay')`
  const titles = async (id: number) =>
    (await nt.listNotifications(id)).notifications.map((x: { title: string }) => x.title).filter((t: string) => t.startsWith(tag))
  assert.deepEqual((await titles(a)).sort(), [tag + ' rieng a', tag + ' tat ca'].sort())
  assert.deepEqual(await titles(b), [tag + ' tat ca'])
})

test('thông báo: đánh dấu đã đọc một tin / tất cả; số chưa đọc giảm theo', { skip }, async () => {
  const a = await session(30)
  const tag = `R${RUN}`
  const [x] = await sql`INSERT INTO notifications (title, kind, audience, mini_session_id) VALUES (${tag + '1'}, 'he_thong', 'phien', ${a}) RETURNING id`
  await sql`INSERT INTO notifications (title, kind, audience, mini_session_id) VALUES (${tag + '2'}, 'he_thong', 'phien', ${a})`
  const s = await svc.loadSession(a)
  const before = await nt.unreadCount(s)
  assert.ok(before >= 2)
  assert.equal((await nt.markRead(a, { ids: [x.id] })).unread, before - 1)
  assert.equal((await nt.markRead(a, { all: true })).unread, 0)
  await assert.rejects(nt.markRead(a, { ids: ['x'] }), (e: { code: string }) => e.code === 'bad_request')
})

test('thông báo: link ngoài app bị DB chặn (Zalo mục 4.1)', { skip }, async () => {
  await assert.rejects(sql`INSERT INTO notifications (title, kind, audience, link) VALUES ('x', 'he_thong', 'tat_ca', 'https://evil.example')`)
})

test('nhắc sự kiện sắp diễn ra trong 24 giờ hiện trong hộp thư và tính vào số chưa đọc', { skip }, async () => {
  const a = await session(40)
  await makeEvent('sap', { inHours: 0.5 })
  await makeEvent('xa', { inHours: 72 })
  await ev.setReminder(a, slug('sap'), 'nhac', true)
  await ev.setReminder(a, slug('xa'), 'nhac', true)
  const box = await nt.listNotifications(a)
  const mine = box.reminders.filter((r: { slug: string }) => r.slug.startsWith(`test-${RUN}`))
  assert.deepEqual(mine.map((r: { slug: string }) => r.slug), [slug('sap')])
  assert.equal(mine[0].within_hour, true)
})
