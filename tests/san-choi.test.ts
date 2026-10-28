// Sân chơi + Dự án. Phần logic thuần chạy với `npm test`; phần database chạy với
// TEST_DB_NAME=haco_test_sanchoi npm run test:db (database riêng, không đụng haco_dev).
import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { walkStreak, levelFor, budgetOpened, pickWeighted, streakStatus, mascotLine, pickLetters, inWindow, DEFAULT_PRIZES, type CaRow } from '../lib/crm/san-choi'
import { CODE128, code128B } from '../app/crm/_components/barcode'
import { dueFor, TEMPLATES } from '../lib/crm/du-an'

const at = (iso: string) => new Date(iso)
function ca(id: number, day: string, status: string, inAt = '05:55', outAt = '14:05'): CaRow {
  return { assignment_id: id, day_status: status, start_at: at(`${day}T06:00:00+07:00`), end_at: at(`${day}T14:00:00+07:00`),
    in_at: at(`${day}T${inAt}:00+07:00`), out_at: at(`${day}T${outAt}:00+07:00`) }
}

test('chuỗi: đủ công đúng giờ cộng dồn, nghỉ có phép không đứt, đi muộn đứt', () => {
  const rows = [ca(1, '2026-10-01', 'du_cong'), ca(2, '2026-10-02', 'du_cong'), ca(3, '2026-10-03', 'nghi_co_phep'), ca(4, '2026-10-04', 'du_cong')]
  assert.equal(walkStreak(rows, new Map(), []).streak, 3)
  const broken = [...rows, ca(5, '2026-10-05', 'di_muon'), ca(6, '2026-10-06', 'du_cong')]
  assert.equal(walkStreak(broken, new Map(), []).streak, 1)
})

test('chuỗi: muộn 1 phút trong thời gian ân hạn của bảng công vẫn là muộn (luật Sân chơi)', () => {
  const r = ca(1, '2026-10-01', 'du_cong', '06:01')
  assert.equal(streakStatus(r), 'di_muon')
  assert.equal(streakStatus(ca(2, '2026-10-01', 'du_cong', '06:00')), 'du_cong')
})

test('khiên: tự đỡ 1 lần muộn, không đỡ vắng, tối đa 1 lần/tháng, phải có trước ca bị đứt', () => {
  const shield = [{ id: 9, created_at: at('2026-09-30T10:00:00Z') }]
  const late = [ca(1, '2026-10-01', 'du_cong'), ca(2, '2026-10-02', 'di_muon'), ca(3, '2026-10-03', 'du_cong')]
  const r = walkStreak(late, new Map(), shield)
  assert.equal(r.streak, 2)
  assert.deepEqual(r.useShields, [{ assignment_id: 2, item_id: 9 }])
  // vắng không phép: khiên không đỡ
  const absent = [ca(1, '2026-10-01', 'du_cong'), ca(2, '2026-10-02', 'vang'), ca(3, '2026-10-03', 'du_cong')]
  assert.equal(walkStreak(absent, new Map(), shield).streak, 1)
  // tháng này đã dùng 1 khiên rồi → không dùng thêm
  const used = new Map([[99, at('2026-10-01T09:00:00Z')]])
  assert.equal(walkStreak(late, used, shield).useShields.length, 0)
  // khiên nhận SAU ca bị đứt thì không đỡ ngược về trước
  assert.equal(walkStreak(late, new Map(), [{ id: 9, created_at: at('2026-10-05T00:00:00Z') }]).useShields.length, 0)
})

test('cấp tay nghề: 4 cấp, tiền chuỗi tối đa 3k/ca (CEO)', () => {
  assert.equal(levelFor(0).name, 'Phụ bếp')
  assert.equal(levelFor(5).name, 'Đầu bếp')
  assert.equal(levelFor(15).name, 'Bếp trưởng')
  assert.equal(levelFor(40).name, 'Đầu bếp Vàng')
  assert.equal(levelFor(40).bonus, 3000)
  assert.equal(levelFor(39).next?.name, 'Đầu bếp Vàng')
})

test('ngân sách mở theo tuần, dư cộng sang tuần sau, không quá trần tháng', () => {
  const s = { monthly_budget: 3_000_000, weekly_budget: 750_000 }
  assert.equal(budgetOpened(s, 1), 750_000)
  assert.equal(budgetOpened(s, 7), 750_000)
  assert.equal(budgetOpened(s, 8), 1_500_000)
  assert.equal(budgetOpened(s, 22), 3_000_000)
  assert.equal(budgetOpened(s, 31), 3_000_000)
})

test('ô quà (CEO vòng 2): chữ chiếm 20%, chữ hiếm C/D 3% phần chữ, tiền trung bình ≈ 4.100đ/lượt, có độc đắc', () => {
  const total = DEFAULT_PRIZES.reduce((a, p) => a + p.weight, 0)
  assert.equal(total, 1000)
  const letters = DEFAULT_PRIZES.filter(p => p.kind === 'chu')
  const lw = letters.reduce((a, p) => a + p.weight, 0)
  assert.equal(lw, 200)
  assert.equal(DEFAULT_PRIZES.find(p => p.letter === 'C')?.weight, 6)
  assert.equal(DEFAULT_PRIZES.find(p => p.letter === 'D')?.weight, 6)
  assert.deepEqual([...new Set(letters.map(p => p.letter))].sort(), ['A', 'C', 'D', 'F', 'H', 'O'])
  const ev = DEFAULT_PRIZES.reduce((a, p) => a + (p.kind === 'tien' ? p.value * p.weight : 0), 0) / total
  assert.equal(ev, 4100)
  assert.ok(300 * ev < 3_000_000 * 0.5, '300 lượt/tháng vẫn dưới nửa trần')
  assert.equal(DEFAULT_PRIZES.find(p => p.value === 200000)?.weight, 3)
})

test('ghép chữ: mỗi chữ dùng 1 lần, FOOD cần 2 chữ O', () => {
  const have = [{ id: 1, letter: 'F' }, { id: 2, letter: 'O' }, { id: 3, letter: 'D' }, { id: 4, letter: 'H' }]
  assert.equal(pickLetters(have, 'FOOD'), null)
  assert.deepEqual(pickLetters([...have, { id: 5, letter: 'O' }], 'FOOD'), [1, 2, 5, 3])
})

test('khung giờ kho: trong/ngoài giờ theo giờ Việt Nam; để trống = cả ngày', () => {
  assert.equal(inWindow('16:30-17:30', new Date('2026-10-28T09:45:00Z')), true)   // 16:45 VN
  assert.equal(inWindow('16:30-17:30', new Date('2026-10-28T03:00:00Z')), false)  // 10:00 VN
  assert.equal(inWindow('', new Date()), true)
})

test('mã vạch Code 128: bảng chuẩn đủ 107 mẫu, mỗi mẫu 11 mô-đun, vạch chẵn; checksum đúng', () => {
  assert.equal(CODE128.length, 107)
  assert.equal(new Set(CODE128).size, 107)
  CODE128.forEach((p, i) => {
    const w = [...p].map(Number)
    assert.equal(w.reduce((a, b) => a + b, 0), i === 106 ? 13 : 11, `mẫu ${i}`)
    assert.equal(w.filter((_, k) => k % 2 === 0).reduce((a, b) => a + b, 0) % 2, 0, `vạch chẵn ${i}`)
  })
  // "AB": Start B(104) + A(33)·1 + B(34)·2 = 205 → checksum 205 mod 103 = 102
  const widths = code128B('AB')
  assert.deepEqual(widths.slice(-13, -7), [...CODE128[102]].map(Number))
})

test('chọn ô theo trọng số đúng biên', () => {
  const items = [{ k: 'a', weight: 2 }, { k: 'b', weight: 0 }, { k: 'c', weight: 3 }]
  assert.equal(pickWeighted(items, () => 0).k, 'a')
  assert.equal(pickWeighted(items, () => 1).k, 'a')
  assert.equal(pickWeighted(items, () => 2).k, 'c')
  assert.equal(pickWeighted(items, () => 4).k, 'c')
})

test('câu của Cốm ngắn (≤ 12 chữ) và điền đúng biến', () => {
  const line = mascotLine('ra_con_viec', { open: 3 }, () => 0)
  assert.ok(line.includes('3'))
  for (const k of ['vao_dung', 'vao_muon', 'vao_khien', 'ra_xong', 'ra_con_viec', 'ra_cho_duyet', 'ra_binh', 'co', 'chua_choi'] as const) {
    for (let i = 0; i < 3; i++) {
      const l = mascotLine(k, { streak: 12, open: 4, old: 9 }, max => i % max).replace(/[^\p{L}\p{N}\s]/gu, ' ')
      assert.ok(l.trim().split(/\s+/).length <= 12, `${k}: "${l}"`)
    }
  }
})

test('dự án: hạn việc = hạn chót − N ngày lúc 17:00, không sớm hơn hôm nay', () => {
  assert.equal(dueFor('2027-01-28', 7, '2026-10-27'), '2027-01-21T17:00:00+07:00')
  assert.equal(dueFor('2027-01-28', 120, '2026-10-27'), '2026-10-27T17:00:00+07:00')
  assert.ok(TEMPLATES.tet.tasks.some(t => t.department === 'dao_tao'), 'mẫu Tết có việc cho mảng đào tạo')
  assert.equal(new Set(TEMPLATES.tet.tasks.map(t => t.department)).size, 7, 'mẫu Tết phủ đủ 7 bộ phận')
})

// ───────────────────────── Database ─────────────────────────
const URL = process.env.TEST_DATABASE_URL
const skip = !URL
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sql: any, sc: any, da: any

before(async () => {
  if (skip) return
  process.env.DATABASE_URL = URL
  const db = await import('../lib/db')
  const schema = await import('../lib/crm/schema')
  await schema.ensureCrmSchema()
  sql = db.getDb()
  sc = await import('../lib/crm/san-choi')
  da = await import('../lib/crm/du-an')
  await sc.ensureSanChoiSchema()
})

const vnDay = (offset: number) => new Date(Date.now() + offset * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })

async function staff(name: string, role: string, dept: string) {
  return (await sql`INSERT INTO staff (name, email, password_hash, role, department) VALUES (${name}, ${name.replace(/\s/g, '') + '@sc.test'}, 'x', ${role}, ${dept}) RETURNING id`)[0].id as number
}
let tplId: number | null = null
async function workedShift(staffId: number, offset: number, opts: { inAt?: string; reviewed?: boolean; tasksDone?: boolean } = {}) {
  tplId ??= (await sql`INSERT INTO shift_templates (code, name, start_time, end_time) VALUES ('SC-S', 'Ca sáng SC', '06:00', '14:00') RETURNING id`)[0].id
  const day = vnDay(offset)
  const asg = (await sql`INSERT INTO shift_assignments (staff_id, work_date, template_id) VALUES (${staffId}, ${day}, ${tplId}) RETURNING id`)[0].id
  await sql`INSERT INTO attendance_logs (staff_id, assignment_id, kind, at, validity) VALUES
    (${staffId}, ${asg}, 'vao', ${`${day}T${opts.inAt ?? '05:55'}:00+07:00`}, 'hop_le'),
    (${staffId}, ${asg}, 'ra', ${`${day}T14:05:00+07:00`}, 'hop_le')`
  await sql`INSERT INTO crm_tasks (title, kind, status, done_at, due_at, assigned_staff_id, source, department, auto_key, reviewed_at)
    VALUES ('Mở ca bếp', 'noi_bo', ${opts.tasksDone === false ? 'can_lam' : 'xong'}, ${opts.tasksDone === false ? null : `${day}T13:00:00+07:00`},
            ${`${day}T14:00:00+07:00`}, ${staffId}, 'kho_viec', 'bep', ${`kv:ca:${asg}:${staffId}:1`}, ${opts.reviewed === false ? null : new Date()})`
  return asg as number
}

test('ca hoàn hảo cho lượt chỉ khi quản lý đã duyệt việc; tính lại không trùng', { skip }, async () => {
  const cook = await staff('Bếp SC A', 'staff', 'bep')
  await workedShift(cook, -3)
  await workedShift(cook, -2)
  const a3 = await workedShift(cook, -1, { reviewed: false })
  let r = await sc.syncEarnings(cook)
  assert.equal(r.playing, true)
  assert.equal(r.streak, 3)
  assert.equal(r.newTokens, 2)
  assert.equal(r.waitingReview, 1)
  await sql`UPDATE crm_tasks SET reviewed_at = NOW() WHERE auto_key LIKE ${'kv:ca:' + a3 + ':%'}`
  r = await sc.syncEarnings(cook)
  assert.equal(r.newTokens, 1)
  r = await sc.syncEarnings(cook)
  assert.equal(r.newTokens, 0, 'chạy lại không cộng trùng')
  const n = (await sql`SELECT COUNT(*)::int AS n FROM sc_spin_tokens WHERE staff_id = ${cook}`)[0].n
  assert.equal(n, 3)
})

test('việc ca còn dở hoặc bộ phận chưa vào chơi thì không có lượt', { skip }, async () => {
  const cook = await staff('Bếp SC B', 'staff', 'bep')
  await workedShift(cook, -1, { tasksDone: false })
  assert.equal((await sc.syncEarnings(cook)).newTokens, 0)
  const mkt = await staff('MKT SC', 'staff', 'marketing')
  await workedShift(mkt, -1)
  const r = await sc.syncEarnings(mkt)
  assert.equal(r.playing, false)
  assert.equal(r.newTokens, 0)
})

test('quay: hết ngân sách thì không ra ô tiền; có ngân sách thì tiền vào ví; hết lượt thì báo', { skip }, async () => {
  const cook = await staff('Bếp SC C', 'staff', 'bep')
  await workedShift(cook, -2)
  await workedShift(cook, -1)
  await sc.syncEarnings(cook)
  await sql`UPDATE app_settings SET value = value || '{"weekly_budget": 0}'::jsonb WHERE key = 'san_choi'`
  const r1 = await sc.spin(cook, sql, () => 0)
  assert.notEqual(r1.kind, 'tien')
  assert.equal(r1.capped, true)
  await sql`UPDATE app_settings SET value = value || '{"weekly_budget": 750000}'::jsonb WHERE key = 'san_choi'`
  const r2 = await sc.spin(cook, sql, () => 0)
  assert.equal(r2.code, 'tien_2k')
  assert.equal(await sc.balance(cook), 2000)
  await assert.rejects(() => sc.spin(cook), /chưa có lượt/)
})

test('đổi thưởng: trừ ví ngay, từ chối thì hoàn, không tự duyệt, cộng lương 100k–300k/tháng', { skip }, async () => {
  const cook = await staff('Bếp SC D', 'staff', 'bep')
  const boss = await staff('Sếp SC', 'admin', 'ban_giam_doc')
  await sql`INSERT INTO sc_wallet (staff_id, delta, reason, source_key) VALUES (${cook}, 150000, 'test', ${'test:' + cook})`
  await assert.rejects(() => sc.requestRedeem(cook, { kind: 'luong', amount: 50000 }), /tối thiểu/)
  const rq = await sc.requestRedeem(cook, { kind: 'luong', amount: 100000 })
  assert.equal(await sc.balance(cook), 50000)
  await assert.rejects(() => sc.reviewRedeem(rq.id, cook, true, '', ''), /Không tự duyệt/)
  await assert.rejects(() => sc.reviewRedeem(rq.id, boss, false, '', ''), /lý do/)
  await sc.reviewRedeem(rq.id, boss, false, 'Sai kỳ lương', '')
  assert.equal(await sc.balance(cook), 150000)
  await assert.rejects(() => sc.requestRedeem(cook, { kind: 'hang_haco', amount: 30000 }), /Đổi voucher/)
  // trần cộng lương 300k/tháng (yêu cầu bị từ chối không tính)
  await sql`INSERT INTO sc_wallet (staff_id, delta, reason, source_key) VALUES (${cook}, 400000, 'test', ${'test2:' + cook})`
  const ok = await sc.requestRedeem(cook, { kind: 'luong', amount: 250000 })
  await sc.reviewRedeem(ok.id, boss, true, '', '')
  await assert.rejects(() => sc.requestRedeem(cook, { kind: 'luong', amount: 100000 }), /tối đa 300/)
})

test('thưởng nóng: lý do chọn sẵn, không tự khen, trần người nhận 3 lượt/tháng', { skip }, async () => {
  const lead = await staff('QL SC', 'quan_ly', 'bep')
  const cook = await staff('Bếp SC E', 'staff', 'bep')
  await assert.rejects(() => sc.giveKudos(lead, cook, 'bua', '', 1, ''), /lý do/)
  await assert.rejects(() => sc.giveKudos(lead, lead, 'giup_dong_doi', '', 1, ''), /tự khen/)
  await sc.giveKudos(lead, cook, 'cuu_don', 'Gói 40 đơn', 2, '')
  await assert.rejects(() => sc.giveKudos(lead, cook, 'sach_se', '', 2, ''), /đủ 3 lượt/)
  await sc.giveKudos(lead, cook, 'sach_se', '', 0, '')
  const feed = await sc.feed()
  assert.ok(feed.some((f: { type: string; to_name: string }) => f.type === 'khen' && f.to_name === 'Bếp SC E'))
})

test('dự án Tết: tạo đủ việc cho mọi bộ phận, giao quản lý bộ phận, chỉ ban giám đốc dùng mẫu và dời hạn', { skip }, async () => {
  const boss = await staff('CEO SC', 'admin', 'ban_giam_doc')
  const bepLead = await staff('Bếp trưởng SC', 'quan_ly', 'bep')
  const deadline = vnDay(90)
  await assert.rejects(() => da.createProject({ id: bepLead, role: 'quan_ly', department: 'bep' }, { name: 'Tết', deadline, template: 'tet' }, ''), /ban giám đốc/)
  const { project, tasks } = await da.createProject({ id: boss, role: 'admin', department: 'ban_giam_doc' }, { name: 'Tết 2027', deadline, template: 'tet' }, '')
  assert.equal(tasks, TEMPLATES.tet.tasks.length)
  const d = await da.projectDetail(project.id)
  assert.equal(d.tasks.length, tasks)
  const bepManagers = (await sql`SELECT id FROM staff WHERE department = 'bep' AND role = 'quan_ly'`).map((r: { id: number }) => r.id)
  assert.ok(bepManagers.includes(bepLead))
  assert.ok(d.tasks.filter((t: { department: string }) => t.department === 'bep').every((t: { assigned_staff_id: number }) => bepManagers.includes(t.assigned_staff_id)),
    'việc bếp giao cho quản lý bếp')
  const src = await sql`SELECT DISTINCT source FROM crm_tasks t JOIN project_tasks pt ON pt.task_id = t.id WHERE pt.project_id = ${project.id}`
  assert.deepEqual(src.map((r: { source: string }) => r.source), ['du_an'])
  await assert.rejects(() => da.addTask({ id: bepLead, role: 'quan_ly', department: 'bep' }, project.id, { title: 'X', department: 'bep', due_date: vnDay(120) }, ''), /sau hạn chót/)
  await assert.rejects(() => da.addTask({ id: bepLead, role: 'quan_ly', department: 'bep' }, project.id, { title: 'X', department: 'kho_van', due_date: vnDay(10) }, ''), /bộ phận mình/)
  await assert.rejects(() => da.updateProject({ id: bepLead, role: 'quan_ly', department: 'bep' }, project.id, { deadline: vnDay(100), reason: 'x' }, ''), /ban giám đốc/)
  await assert.rejects(() => da.updateProject({ id: boss, role: 'admin', department: 'ban_giam_doc' }, project.id, { deadline: vnDay(100) }, ''), /lý do/)
  const list = await da.listProjects()
  const row = list.find((p: { id: number }) => p.id === project.id)
  assert.equal(row.total, tasks)
  // việc dự án không bị quy tắc tự đóng việc máy sinh đụng tới
  await sql`UPDATE crm_tasks SET due_at = NOW() - INTERVAL '10 days' WHERE id IN (SELECT task_id FROM project_tasks WHERE project_id = ${project.id})`
  const tasksLib = await import('../lib/crm/tasks')
  await tasksLib.expireStaleAutoTasks()
  const closed = (await sql`SELECT COUNT(*)::int AS n FROM crm_tasks t JOIN project_tasks pt ON pt.task_id = t.id WHERE pt.project_id = ${project.id} AND t.status = 'bo_qua'`)[0].n
  assert.equal(closed, 0)
})

test('kho chữ: đủ HACO được 30k (1 lần/tháng), chữ lẻ không ra tiền', { skip }, async () => {
  const cook = await staff('Bếp SC F', 'staff', 'bep')
  for (const ch of 'HACOX') {
    if (ch === 'X') break
    await sql`INSERT INTO sc_items (staff_id, kind, code, label, letter) VALUES (${cook}, 'chu', ${'chu_' + ch}, ${'Chữ ' + ch}, ${ch})`
  }
  await sql`INSERT INTO sc_items (staff_id, kind, code, label, letter) VALUES (${cook}, 'chu', 'chu_F', 'Chữ F', 'F')`
  await workedShift(cook, -1)
  await sc.syncEarnings(cook)
  // quay ra 1 chữ bất kỳ → kiểm cụm
  const prizes = await sql`SELECT id, code FROM sc_prizes WHERE active AND weight > 0 ORDER BY sort, id`
  const idx = prizes.findIndex((p: { code: string }) => p.code === 'chu_O')
  // Số ngẫu nhiên trỏ thẳng vào đầu ô chữ O (cộng trọng số các ô đứng trước)
  const offset = prizes.slice(0, idx).reduce((a: number, p: { code: string }) => a + (DEFAULT_PRIZES.find(d => d.code === p.code)?.weight ?? 0), 0)
  const r = await sc.spin(cook, sql, () => offset)
  assert.equal(r.letter, 'O')
  const lw = await sc.letterWallet(cook)
  assert.equal(lw.words.find((w: { word: string }) => w.word === 'HACO').claimed.status, 'da_tra')
  assert.equal(await sc.balance(cook), 30000)
  assert.equal(lw.have.F, 1, 'chữ F lẻ vẫn còn, không ra tiền')
})

test('voucher: trừ ví, tối đa 2/tuần, kho không tự nhận của mình, hết hạn tự hoàn', { skip }, async () => {
  const cook = await staff('Bếp SC G', 'staff', 'bep')
  const kho = await staff('Kho SC', 'staff', 'kho_van')
  await sql`INSERT INTO sc_wallet (staff_id, delta, reason, source_key) VALUES (${cook}, 300000, 'test', ${'test:' + cook})`
  await assert.rejects(() => sc.exchangeVoucher(cook, 30000), /mệnh giá/)
  const v1 = await sc.exchangeVoucher(cook, 50000)
  assert.match(v1.code, /^HV50K-[A-Z2-9]{5}$/)
  assert.equal(await sc.balance(cook), 250000)
  await sc.exchangeVoucher(cook, 20000)
  await assert.rejects(() => sc.exchangeVoucher(cook, 20000), /tối đa 2/)
  await assert.rejects(() => sc.redeemVoucherAtKho(v1.code, { id: cook, boss: true }, '', ''), /Không tự nhận/)
  const used = await sc.redeemVoucherAtKho(v1.code.toLowerCase(), { id: kho, boss: true }, '1 hộp cốm', '')
  assert.equal(used.status, 'da_dung')
  await assert.rejects(() => sc.redeemVoucherAtKho(v1.code, { id: kho, boss: true }, '', ''), /đã dùng/)
  // voucher thứ 2 hết hạn → hoàn tiền
  await sql`UPDATE sc_vouchers SET expires_at = NOW() - INTERVAL '1 minute' WHERE staff_id = ${cook} AND status = 'con_han'`
  const list = await sc.myVouchers(cook)
  assert.ok(list.some((v: { status: string }) => v.status === 'het_han_hoan'))
  assert.equal(await sc.balance(cook), 250000, '300k − 50k (đã dùng) − 20k + 20k hoàn')
})

test('cấp/bỏ lượt: không tự cấp, quá 5 lượt chờ người thứ hai, bỏ lượt chỉ lượt chưa quay', { skip }, async () => {
  const ceo = await staff('CEO SC2', 'admin', 'ban_giam_doc')
  const admin2 = await staff('QTV SC', 'admin', 'ban_giam_doc')
  const cook = await staff('Bếp SC H', 'staff', 'bep')
  await assert.rejects(() => sc.grantTokens(ceo, ceo, 1, 'bu_loi', 'x', ''), /tự cấp/)
  await assert.rejects(() => sc.grantTokens(ceo, cook, 1, 'bu_loi', '', ''), /Ghi chú/)
  await sc.grantTokens(ceo, cook, 2, 'bu_loi', 'bù ca máy lỗi', '')
  const big = await sc.grantTokens(ceo, cook, 6, 'thi_dua', 'giải tháng', '')
  assert.equal(big.status, 'cho_duyet')
  const open = async () => (await sql`SELECT COUNT(*)::int AS n FROM sc_spin_tokens WHERE staff_id = ${cook} AND spin_id IS NULL AND revoked_at IS NULL`)[0].n
  assert.equal(await open(), 2)
  await assert.rejects(() => sc.reviewGrant(big.id, ceo, true, ''), /Người thứ hai/)
  await sc.reviewGrant(big.id, admin2, true, '')
  assert.equal(await open(), 8)
  const rv = await sc.revokeTokens(ceo, cook, 3, 'vi_pham', 'tick khống ca 26/10', '')
  assert.equal(rv.tokens, -3)
  assert.equal(await open(), 5)
})
