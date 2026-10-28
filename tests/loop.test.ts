// Chạy: npx --yes tsx --test tests/loop.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeSegments, parseSegmentAnswer, generateReferralCode, parseReferralCode, parseCsv, parseSheetLeads, taskTitle, displayName, REFERRAL_ALPHABET } from '../lib/loop'
import { normalizePhone } from '../lib/phone'

test('nhóm: chỉ nhận A-D, bỏ trùng, mặc định A', () => {
  assert.deepEqual(normalizeSegments(['b', 'B', 'x', 'd']), ['B', 'D'])
  assert.deepEqual(normalizeSegments('c; a'), ['A', 'C'])
  assert.deepEqual(normalizeSegments(''), ['A'])
  assert.deepEqual(normalizeSegments(null), ['A'])
  assert.equal(parseSegmentAnswer(' d '), 'D')
  assert.equal(parseSegmentAnswer('E'), null)
  assert.equal(parseSegmentAnswer('AB'), null)
  assert.equal(parseSegmentAnswer({}), null)
})

test('mã giới thiệu: 6 ký tự, chỉ ký tự dễ đọc, đọc lại được', () => {
  const code = generateReferralCode(new Uint8Array([0, 1, 2, 3, 250, 255, 4, 5, 6, 7, 8, 9]))
  assert.equal(code.length, 6)
  for (const ch of code) assert.ok(REFERRAL_ALPHABET.includes(ch))
  assert.equal(parseReferralCode(code.toLowerCase()), code)
  assert.equal(parseReferralCode(' ' + code + ' '), code)
  assert.equal(parseReferralCode('ABC0O1'), null)   // có ký tự dễ nhầm
  assert.equal(parseReferralCode('ABC'), null)
  assert.equal(parseReferralCode("ABCDEF'; DROP"), null)
  assert.equal(parseReferralCode(123456), null)
})

test('CSV: ô có dấu phẩy, nháy kép, xuống dòng, BOM, CRLF', () => {
  const rows = parseCsv('﻿a,b,c\r\n"x, y","he said ""hi""","dòng1\ndòng2"\r\n\r\n1,2,3')
  assert.deepEqual(rows[0], ['a', 'b', 'c'])
  assert.deepEqual(rows[1], ['x, y', 'he said "hi"', 'dòng1\ndòng2'])
  assert.deepEqual(rows[2], ['1', '2', '3'])
  assert.equal(rows.length, 3)
})

test('bảng tính: nhận tên cột tiếng Việt, chuẩn hoá SĐT, bỏ dòng sai, gộp trùng', () => {
  const csv = 'Họ tên,SĐT,Email,Nhóm,Nguồn\n' +
    'Lan,+84 912 345 678,LAN@X.COM,b,facebook\n' +
    'Mai,0912345678,,c,tiktok\n' +          // trùng SĐT: giữ dòng sau
    'Hoa,12345,h@x.com,a,fb\n' +           // SĐT sai
    'Nga,0281234567,n@x.com,a,fb\n' +       // số bàn (đầu 02): không phải di động
    'Tam,0987654321,khong-phai-email,x,\n'
  const { leads, skipped } = parseSheetLeads(csv, normalizePhone)
  assert.equal(skipped, 2)
  assert.equal(leads.length, 2)
  const mai = leads.find(l => l.phone === '0912345678')!
  assert.equal(mai.name, 'Mai')
  assert.deepEqual(mai.segments, ['C'])
  const tam = leads.find(l => l.phone === '0987654321')!
  assert.equal(tam.email, '')                       // email sai bị bỏ
  assert.deepEqual(tam.segments, ['A'])             // nhóm lạ → mặc định A
  assert.equal(tam.source, 'sheet')
})

test('bảng tính: thiếu cột số điện thoại thì không nhận dòng nào; công thức Excel không được thực thi (chỉ là chuỗi)', () => {
  assert.deepEqual(parseSheetLeads('name,email\nA,a@x.com', normalizePhone).leads, [])
  const { leads } = parseSheetLeads('phone,name\n0912345678,=HYPERLINK("x")', normalizePhone)
  assert.equal(leads[0].name, '=HYPERLINK("x")')    // lưu nguyên dạng chữ; nơi xuất CSV đã chống công thức
})

test('bảng tính: giới hạn số dòng đọc', () => {
  const lines = ['phone']
  for (let i = 0; i < 50; i++) lines.push('09' + String(10000000 + i))
  assert.equal(parseSheetLeads(lines.join('\n'), normalizePhone, 10).leads.length, 10)
})

test('tiêu đề việc: tên rỗng dùng mã khách, cắt độ dài', () => {
  assert.equal(displayName('  ', 7), 'khách #7')
  assert.equal(displayName('x'.repeat(100), 1).length, 60)
  assert.ok(taskTitle('d7', 'Lan', 'Link: x').includes('Link: x'))
  assert.ok(taskTitle('vip', 'Lan').startsWith('VIP'))
})

test('mã giới thiệu: không đủ byte hợp lệ thì báo lỗi rõ ràng (không trả mã ngắn/sai)', () => {
  assert.throws(() => generateReferralCode(new Uint8Array([250, 251, 252, 253, 254, 255])))
})
