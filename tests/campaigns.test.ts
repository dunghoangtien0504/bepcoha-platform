// Chạy: npx --yes tsx --test tests/campaigns.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
const S = 'test-secret-0123456789'
import { validateCriteria, assignArm, compareArms, csvCell, toCsv, DEFAULT_CRITERIA } from '../lib/campaigns'

test('tiêu chí: mặc định hợp lệ; số ngoài khoảng hoặc không nguyên bị từ chối', () => {
  const ok = validateCriteria({})
  assert.ok('criteria' in ok)
  assert.deepEqual((ok as { criteria: unknown }).criteria, DEFAULT_CRITERIA)
  assert.ok('error' in validateCriteria({ holdoutPct: 5 }))       // đối chứng quá nhỏ
  assert.ok('error' in validateCriteria({ holdoutPct: 60 }))
  assert.ok('error' in validateCriteria({ cap: 999999 }))
  assert.ok('error' in validateCriteria({ minDaysSinceLastOrder: 1.5 }))
  assert.ok('error' in validateCriteria({ minDaysSinceLastOrder: 'abc' }))
  assert.ok('error' in validateCriteria({ minDaysSinceLastOrder: 100, maxDaysSinceLastOrder: 50 }))
  assert.ok('error' in validateCriteria({ minOrders: 3, maxOrders: 1 }))
  assert.ok('criteria' in validateCriteria(null))
})

test('chia nhóm: cố định (cùng đầu vào → cùng nhóm), gần đúng tỷ lệ đối chứng', () => {
  assert.equal(assignArm('k1', 5, 20, S), assignArm('k1', 5, 20, S))
  let holdout = 0
  const N = 10000
  for (let i = 1; i <= N; i++) if (assignArm('camp-x', i, 20, S) === 'holdout') holdout++
  const pct = (holdout / N) * 100
  assert.ok(pct > 18 && pct < 22, `tỷ lệ đối chứng lệch: ${pct}`)
})

test('chia nhóm: đổi khoá chiến dịch thì phân chia khác (không dính cứng 1 khách vào 1 nhóm)', () => {
  let diff = 0
  for (let i = 1; i <= 500; i++) if (assignArm('a', i, 50, S) !== assignArm('b', i, 50, S)) diff++
  assert.ok(diff > 100)
})

test('chia nhóm: đổi khoá bí mật thì chia khác (không tự tính được nếu không có khoá)', () => {
  let diff = 0
  for (let i = 1; i <= 500; i++) if (assignArm('a', i, 50, 'secret-A-0123456789') !== assignArm('a', i, 50, 'secret-B-0123456789')) diff++
  assert.ok(diff > 100)
})

test('tiêu chí: loại trừ chiến dịch gần đây không được ngắn hơn 120 ngày', () => {
  assert.ok('error' in validateCriteria({ excludeRecentCampaignDays: 0 }))
  assert.ok('error' in validateCriteria({ excludeRecentCampaignDays: 90 }))
  assert.ok('criteria' in validateCriteria({ excludeRecentCampaignDays: 120 }))
})

test('CSV: khoảng trắng đứng trước ký tự công thức vẫn bị vô hiệu', () => {
  assert.equal(csvCell('  =1+1'), "'  =1+1")
  assert.equal(csvCell('\u00a0@x'), "'\u00a0@x")
})

test('so sánh nhóm: ít mẫu thì KHÔNG kết luận', () => {
  const c = compareArms({ n: 40, hits: 10 }, { n: 10, hits: 0 })
  assert.equal(c.enough, false)
  assert.equal(c.verdict, 'chua-du-mau')
})

test('so sánh nhóm: đủ mẫu, chênh lớn → có tác dụng; chênh nhỏ → không khác biệt', () => {
  const big = compareArms({ n: 800, hits: 120 }, { n: 200, hits: 10 })   // 15% vs 5%
  assert.equal(big.verdict, 'co-tac-dung')
  assert.ok(big.lift! > 0.09 && big.lift! < 0.11)
  const same = compareArms({ n: 800, hits: 80 }, { n: 200, hits: 20 })   // 10% vs 10%
  assert.equal(same.verdict, 'khong-khac-biet')
  const neg = compareArms({ n: 800, hits: 20 }, { n: 200, hits: 40 })    // 2.5% vs 20%
  assert.equal(neg.verdict, 'tac-dung-am')
})

test('so sánh nhóm: nhóm rỗng không gây lỗi chia cho 0', () => {
  const c = compareArms({ n: 0, hits: 0 }, { n: 0, hits: 0 })
  assert.equal(c.lift, null)
  assert.equal(c.verdict, 'chua-du-mau')
})

test('CSV: ô bắt đầu bằng ký tự công thức bị vô hiệu; dấu phẩy/nháy được bọc đúng', () => {
  assert.equal(csvCell('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"')
  assert.equal(csvCell('+84900000000'), "'+84900000000")
  assert.equal(csvCell('@cmd'), "'@cmd")
  assert.equal(csvCell('-1+1'), "'-1+1")
  assert.equal(csvCell('Nguyễn, Văn "A"'), '"Nguyễn, Văn ""A"""')
  assert.equal(csvCell(null), '')
  assert.equal(csvCell(12345), '12345')
})

test('CSV: có BOM để Excel đọc tiếng Việt, xuống dòng CRLF', () => {
  const out = toCsv(['Tên', 'SĐT'], [['Lan', '0900000000']])
  assert.ok(out.startsWith('﻿'))
  assert.ok(out.includes('\r\n'))
})

test('so sánh nhóm: đủ người nhưng quá ít ca mua lại thì vẫn KHÔNG kết luận', () => {
  const c = compareArms({ n: 500, hits: 8 }, { n: 500, hits: 2 })   // chỉ 10 ca
  assert.equal(c.enough, false)
  assert.equal(c.verdict, 'chua-du-mau')
  const zero = compareArms({ n: 500, hits: 0 }, { n: 500, hits: 0 })
  assert.equal(zero.verdict, 'chua-du-mau')
})

test('tiêu chí: null hoặc chuỗi rỗng không được ngầm thành 0', () => {
  assert.ok('error' in validateCriteria({ contactCooldownDays: null }))
  assert.ok('error' in validateCriteria({ cap: '' }))
})

test('mục tiêu khoá học: đặt mặc định phù hợp; giá trị lạ bị từ chối', () => {
  const v = validateCriteria({ goal: 'course' })
  assert.ok('criteria' in v)
  const c = (v as { criteria: { goal: string; maxOrders: number; minDaysSinceLastOrder: number } }).criteria
  assert.equal(c.goal, 'course')
  assert.equal(c.maxOrders, 100)          // khách có thể đã mua nhiều lần
  assert.equal(c.minDaysSinceLastOrder, 14)
  assert.ok('error' in validateCriteria({ goal: 'khac' }))
  assert.equal((validateCriteria({}) as { criteria: { goal: string } }).criteria.goal, 'repeat')
})
