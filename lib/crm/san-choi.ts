// Sân chơi Bếp Cô Hạ (B2 bài 12 · Easymart: vòng quay, ví, chuỗi, linh vật, bảng vàng; Kaizen Z12; K15–K17).
// Thiết kế + phản biện CEO: SAN-CHOI-DU-AN-THIET-KE.md. Nguyên tắc:
//  - Lượt quay KIẾM bằng hành vi muốn kéo lên (ca hoàn hảo đã được quản lý duyệt, giữ chuỗi), không mua được.
//  - Mọi lượt/khoản ví có khoá nguồn duy nhất (source_key) → tính lại bao nhiêu lần cũng không trùng.
//  - Quay ở máy chủ; ví là sổ chỉ cộng/trừ; mọi thao tác của người duyệt ghi nhật ký.
//  - MỘT trần tiền chung cho mọi khoản cộng ví (vòng quay + tiền chuỗi): 3 triệu/tháng, mở 750k mỗi tuần, tuần dư cộng sang tuần sau.
//  - Thí điểm theo bộ phận (mặc định bếp + kho); bộ phận chưa có danh sách việc chính thì chưa vào chơi.
import { randomInt } from 'node:crypto'
import { getDb } from '../db'
import { logAction } from './audit'
import { timesheet, TZ } from './attendance'

type Sql = ReturnType<typeof getDb>

export class SanChoiError extends Error {}

// ───────────────────────── Bảng riêng của Sân chơi (không đụng schema CRM) ─────────────────────────
let ready: Promise<void> | null = null
export function ensureSanChoiSchema(sql: Sql = getDb()): Promise<void> {
  if (!ready) ready = createSchema(sql).catch(e => { ready = null; throw e })
  return ready
}

/**
 * Ô quà mặc định (phản biện CEO vòng 2, trọng số trên 1000): ô chữ cái lấy chỗ của ô 2k (2k 40% → 20%, chữ 20%);
 * mỗi cụm có 1 chữ hiếm (C trong HACO, D trong FOOD — 3% của phần chữ). Tiền trung bình ≈ 4.100đ/lượt.
 * Thứ tự = thứ tự ô trên bánh xe (xen kẽ tiền / chữ / quà như vòng quay Easymart).
 */
export type PrizeKind = 'tien' | 'chu' | 'khien' | 'vat_pham'
export const DEFAULT_PRIZES: { code: string; label: string; short: string; kind: PrizeKind; value: number; letter?: string; weight: number }[] = [
  { code: 'tien_2k', label: '2.000đ', short: '2K', kind: 'tien', value: 2000, weight: 200 },
  { code: 'chu_H', label: 'Chữ H', short: 'H', kind: 'chu', value: 0, letter: 'H', weight: 47 },
  { code: 'tien_5k', label: '5.000đ', short: '5K', kind: 'tien', value: 5000, weight: 250 },
  { code: 'chu_A', label: 'Chữ A', short: 'A', kind: 'chu', value: 0, letter: 'A', weight: 47 },
  { code: 'khien', label: 'Khiên giữ chuỗi', short: 'Khiên', kind: 'khien', value: 0, weight: 100 },
  { code: 'tien_20k', label: '20.000đ', short: '20K', kind: 'tien', value: 20000, weight: 50 },
  { code: 'chu_C', label: 'Chữ C (hiếm)', short: 'C', kind: 'chu', value: 0, letter: 'C', weight: 6 },
  { code: 'vp_mon_nha_lam', label: 'Món nhà làm mang về', short: 'Món nhà làm', kind: 'vat_pham', value: 0, weight: 80 },
  { code: 'chu_O', label: 'Chữ O', short: 'O', kind: 'chu', value: 0, letter: 'O', weight: 47 },
  { code: 'tien_200k', label: 'ĐỘC ĐẮC 200.000đ', short: '200K', kind: 'tien', value: 200000, weight: 3 },
  { code: 'chu_F', label: 'Chữ F', short: 'F', kind: 'chu', value: 0, letter: 'F', weight: 47 },
  { code: 'vp_ngay_nghi', label: 'Chọn trước 1 ngày nghỉ', short: 'Chọn ngày nghỉ', kind: 'vat_pham', value: 0, weight: 100 },
  { code: 'chu_D', label: 'Chữ D (hiếm)', short: 'D', kind: 'chu', value: 0, letter: 'D', weight: 6 },
  { code: 'tien_50k', label: '50.000đ', short: '50K', kind: 'tien', value: 50000, weight: 17 },
]
export const PRIZE_VERSION = 2

export interface SanChoiSettings {
  monthly_budget: number        // trần chung mọi khoản cộng ví / tháng
  weekly_budget: number         // mở dần theo tuần, tuần dư cộng sang tuần sau
  departments: string[]         // bộ phận đang chơi (thí điểm)
  kudos_per_manager_month: number
  kudos_per_receiver_month: number
  manual_tokens_month: number   // Quỹ lượt cấp tay / tháng (CEO: 60)
  manual_second_over: number    // cấp quá N lượt một lần phải có người thứ hai duyệt
  voucher_days: number          // hạn voucher đổi hàng (ngày)
  voucher_per_week: number
  kho_window: string            // giờ thủ kho nhận voucher, vd "16:30-17:30" (để trống = cả ngày)
  salary_month_max: number      // cộng lương tối đa / người / tháng
  prize_version?: number
}
export const DEFAULT_SETTINGS: SanChoiSettings = {
  monthly_budget: 3_000_000, weekly_budget: 750_000, departments: ['bep', 'kho_van'],
  kudos_per_manager_month: 8, kudos_per_receiver_month: 3,
  manual_tokens_month: 60, manual_second_over: 5, voucher_days: 7, voucher_per_week: 2, kho_window: '16:30-17:30', salary_month_max: 300_000,
}

async function createSchema(sql: Sql) {
  await sql.begin(async tx => {
    const t = tx as unknown as Sql
    await t`SELECT pg_advisory_xact_lock(4242077)`
    await t`
      CREATE TABLE IF NOT EXISTS sc_prizes (
        id SERIAL PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        label TEXT NOT NULL,
        kind TEXT NOT NULL,
        value INT NOT NULL DEFAULT 0 CHECK (value >= 0),
        weight INT NOT NULL DEFAULT 10 CHECK (weight >= 0),
        color TEXT NOT NULL DEFAULT '#d1fae5',
        active BOOLEAN NOT NULL DEFAULT TRUE,
        sort INT NOT NULL DEFAULT 0
      )`
    await t`
      CREATE TABLE IF NOT EXISTS sc_spin_tokens (
        id SERIAL PRIMARY KEY,
        staff_id INT NOT NULL,
        source TEXT NOT NULL,
        source_key TEXT NOT NULL UNIQUE,
        note TEXT NOT NULL DEFAULT '',
        granted_by INT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        spin_id INT
      )`
    await t`ALTER TABLE sc_spin_tokens ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ`
    await t`ALTER TABLE sc_spin_tokens ADD COLUMN IF NOT EXISTS revoked_by INT`
    await t`ALTER TABLE sc_spin_tokens DROP CONSTRAINT IF EXISTS sc_spin_tokens_source_check`
    await t`ALTER TABLE sc_spin_tokens ADD CONSTRAINT sc_spin_tokens_source_check CHECK (source IN ('ca', 'moc_chuoi', 'thuong_nong', 'cap_tay'))`
    await t`CREATE INDEX IF NOT EXISTS sc_spin_tokens_open_idx ON sc_spin_tokens (staff_id) WHERE spin_id IS NULL`
    await t`
      CREATE TABLE IF NOT EXISTS sc_spins (
        id SERIAL PRIMARY KEY,
        staff_id INT NOT NULL,
        token_id INT NOT NULL UNIQUE REFERENCES sc_spin_tokens(id),
        prize_id INT REFERENCES sc_prizes(id),
        label TEXT NOT NULL,
        kind TEXT NOT NULL,
        value INT NOT NULL DEFAULT 0,
        capped BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`
    await t`
      CREATE TABLE IF NOT EXISTS sc_wallet (
        id SERIAL PRIMARY KEY,
        staff_id INT NOT NULL,
        delta INT NOT NULL CHECK (delta <> 0),
        reason TEXT NOT NULL,
        source_key TEXT UNIQUE,
        counts_budget BOOLEAN NOT NULL DEFAULT FALSE,
        created_by INT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`
    await t`CREATE INDEX IF NOT EXISTS sc_wallet_staff_idx ON sc_wallet (staff_id)`
    await t`
      CREATE TABLE IF NOT EXISTS sc_items (
        id SERIAL PRIMARY KEY,
        staff_id INT NOT NULL,
        kind TEXT NOT NULL,
        code TEXT NOT NULL,
        label TEXT NOT NULL,
        spin_id INT REFERENCES sc_spins(id),
        status TEXT NOT NULL DEFAULT 'con' CHECK (status IN ('con', 'da_dung', 'cho_duyet', 'da_doi', 'het_cho')),
        used_ref TEXT,
        used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`
    await t`CREATE INDEX IF NOT EXISTS sc_items_staff_idx ON sc_items (staff_id, status)`
    await t`
      CREATE TABLE IF NOT EXISTS sc_shield_uses (
        assignment_id INT PRIMARY KEY,
        staff_id INT NOT NULL,
        item_id INT NOT NULL UNIQUE REFERENCES sc_items(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`
    await t`
      CREATE TABLE IF NOT EXISTS sc_redemptions (
        id SERIAL PRIMARY KEY,
        staff_id INT NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('luong', 'hang_haco', 'vat_pham')),
        amount INT NOT NULL DEFAULT 0 CHECK (amount >= 0),
        item_id INT REFERENCES sc_items(id),
        note TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'cho_duyet' CHECK (status IN ('cho_duyet', 'da_duyet', 'tu_choi')),
        code TEXT,
        reviewed_by INT,
        reviewed_at TIMESTAMPTZ,
        review_note TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`
    await t`
      CREATE TABLE IF NOT EXISTS sc_kudos (
        id SERIAL PRIMARY KEY,
        from_staff INT NOT NULL,
        to_staff INT NOT NULL,
        reason TEXT NOT NULL,
        message TEXT NOT NULL DEFAULT '',
        tokens INT NOT NULL DEFAULT 0 CHECK (tokens BETWEEN 0 AND 2),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CHECK (from_staff <> to_staff)
      )`
    await t`ALTER TABLE sc_prizes ADD COLUMN IF NOT EXISTS letter TEXT`
    await t`ALTER TABLE sc_prizes ADD COLUMN IF NOT EXISTS short TEXT NOT NULL DEFAULT ''`
    await t`ALTER TABLE sc_prizes DROP CONSTRAINT IF EXISTS sc_prizes_kind_check`
    await t`ALTER TABLE sc_prizes ADD CONSTRAINT sc_prizes_kind_check CHECK (kind IN ('tien', 'chu', 'khien', 'vat_pham'))`
    await t`ALTER TABLE sc_items ADD COLUMN IF NOT EXISTS letter TEXT`
    await t`ALTER TABLE sc_items DROP CONSTRAINT IF EXISTS sc_items_kind_check`
    await t`ALTER TABLE sc_items ADD CONSTRAINT sc_items_kind_check CHECK (kind IN ('chu', 'khien', 'vat_pham'))`
    // Voucher mua hàng nội bộ (khung hình B2 bài 12 · 4:06): mã vạch, hạn dùng, đổi ở kho HACO; hết hạn tự hoàn về ví
    await t`
      CREATE TABLE IF NOT EXISTS sc_vouchers (
        id SERIAL PRIMARY KEY,
        staff_id INT NOT NULL,
        code TEXT NOT NULL UNIQUE,
        amount INT NOT NULL CHECK (amount > 0),
        status TEXT NOT NULL DEFAULT 'con_han' CHECK (status IN ('con_han', 'da_dung', 'het_han_hoan')),
        expires_at TIMESTAMPTZ NOT NULL,
        used_at TIMESTAMPTZ,
        used_by INT,
        used_note TEXT NOT NULL DEFAULT '',
        refunded_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`
    // Ghép đủ cụm chữ: mỗi cụm 1 lần/người/tháng; hết ngân sách thì xếp hàng trả tuần sau (CEO vòng 2)
    await t`
      CREATE TABLE IF NOT EXISTS sc_word_claims (
        id SERIAL PRIMARY KEY,
        staff_id INT NOT NULL,
        word TEXT NOT NULL,
        month TEXT NOT NULL,
        amount INT NOT NULL,
        status TEXT NOT NULL DEFAULT 'cho_tra' CHECK (status IN ('cho_tra', 'da_tra')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        paid_at TIMESTAMPTZ,
        UNIQUE (staff_id, word, month)
      )`
    // Cấp / Bỏ lượt tay (CEO vòng 2): quỹ tháng, lý do chọn sẵn, quá 5 lượt cần người thứ hai duyệt; bỏ lượt là dòng âm
    await t`
      CREATE TABLE IF NOT EXISTS sc_grants (
        id SERIAL PRIMARY KEY,
        staff_id INT NOT NULL,
        tokens INT NOT NULL CHECK (tokens <> 0),
        reason TEXT NOT NULL,
        note TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'da_duyet' CHECK (status IN ('cho_duyet', 'da_duyet', 'tu_choi')),
        created_by INT NOT NULL,
        approved_by INT,
        approved_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`
    await t`INSERT INTO app_settings (key, value) VALUES ('san_choi', ${t.json(DEFAULT_SETTINGS as never)}) ON CONFLICT (key) DO NOTHING`
    // Nâng bộ ô quà một lần theo phiên bản (giữ chỉnh tay của quản trị ở các lần khởi động sau)
    const cur = (await t`SELECT value FROM app_settings WHERE key = 'san_choi'`)[0]?.value as Partial<SanChoiSettings> | undefined
    if ((cur?.prize_version ?? 1) < PRIZE_VERSION) {
      for (const [i, p] of DEFAULT_PRIZES.entries()) {
        await t`INSERT INTO sc_prizes (code, label, short, kind, value, letter, weight, sort, active)
                VALUES (${p.code}, ${p.label}, ${p.short}, ${p.kind}, ${p.value}, ${p.letter ?? null}, ${p.weight}, ${i}, TRUE)
                ON CONFLICT (code) DO UPDATE SET label = EXCLUDED.label, short = EXCLUDED.short, kind = EXCLUDED.kind, value = EXCLUDED.value,
                  letter = EXCLUDED.letter, weight = EXCLUDED.weight, sort = EXCLUDED.sort, active = TRUE`
      }
      await t`UPDATE sc_prizes SET active = FALSE, weight = 0 WHERE NOT (code = ANY(${DEFAULT_PRIZES.map(p => p.code)}::text[]))`
      await t`UPDATE app_settings SET value = value || ${t.json({ ...DEFAULT_SETTINGS, ...cur, prize_version: PRIZE_VERSION } as never)} WHERE key = 'san_choi'`
    }
  })
}

export async function getSettings(sql: Sql = getDb()): Promise<SanChoiSettings> {
  await ensureSanChoiSchema(sql)
  const r = (await sql`SELECT value FROM app_settings WHERE key = 'san_choi'`)[0]
  return { ...DEFAULT_SETTINGS, ...((r?.value ?? {}) as Partial<SanChoiSettings>) }
}

// ───────────────────────── Chuỗi tay nghề (4 cấp — dễ nhớ cho cô chú ở bếp) ─────────────────────────
export const LEVELS = [
  { min: 0, name: 'Phụ bếp', bonus: 0, icon: '🥄' },
  { min: 5, name: 'Đầu bếp', bonus: 1000, icon: '🍳' },
  { min: 15, name: 'Bếp trưởng', bonus: 2000, icon: '👨‍🍳' },
  { min: 40, name: 'Đầu bếp Vàng', bonus: 3000, icon: '🏆' },
] as const
export function levelFor(streak: number) {
  let i = 0
  for (let k = 0; k < LEVELS.length; k++) if (streak >= LEVELS[k].min) i = k
  return { ...LEVELS[i], index: i, next: LEVELS[i + 1] ?? null }
}
/** Mốc chuỗi thưởng thêm lượt (khớp đề xuất "chuỗi 10 ca" của COO). */
export const MILESTONES: Record<number, number> = { 10: 2, 30: 2 }
/** Khiên: giữ tối đa 1, dùng tối đa 1 lần/tháng; không đỡ được vắng không phép. */
export const SHIELD_MAX_HOLD = 1

/** Trạng thái làm đứt chuỗi. Muộn 1 phút là đứt (không ân hạn) — kiểm riêng bằng giờ vào so với đầu ca. */
const BREAKS = new Set(['di_muon', 've_som', 'muon_som', 'thieu_cham', 'vang'])
const SHIELDABLE = new Set(['di_muon', 've_som', 'muon_som', 'thieu_cham'])

export interface CaRow { assignment_id: number; day_status: string; start_at: Date; end_at: Date; in_at: Date | null; out_at: Date | null }

/** Trạng thái ca theo luật Sân chơi: đủ công mà vào sau giờ bắt đầu (kể cả trong ân hạn của bảng công) vẫn là muộn. */
export function streakStatus(r: CaRow): string {
  if (r.day_status === 'du_cong' && r.in_at && +r.in_at > +r.start_at) return 'di_muon'
  return r.day_status
}

/**
 * Đi qua các ca đã kết thúc (cũ → mới), tính chuỗi có khiên. Trả về chuỗi hiện tại, các ca đúng giờ đủ công
 * kèm độ dài chuỗi tại ca đó, và các khiên cần dùng. Khiên tự dùng khi ca bị đứt (kiểu Duolingo), tối đa 1 lần/tháng.
 */
export function walkStreak(rows: CaRow[], shielded: Map<number, Date>, shieldsAvailable: { id: number; created_at: Date }[]) {
  let n = 0
  const good: { assignment_id: number; streak: number; end_at: Date; out_at: Date | null }[] = []
  const useShields: { assignment_id: number; item_id: number }[] = []
  const pool = [...shieldsAvailable].sort((a, b) => +a.created_at - +b.created_at)
  const monthOf = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: TZ }).slice(0, 7)
  const usedMonths = new Set([...shielded.values()].map(monthOf))
  for (const r of rows) {
    const st = streakStatus(r)
    if (st === 'du_cong') { n++; good.push({ assignment_id: r.assignment_id, streak: n, end_at: r.end_at, out_at: r.out_at }); continue }
    if (!BREAKS.has(st)) continue // nghỉ có phép, chưa đến, đang làm: không tính, không đứt
    if (shielded.has(r.assignment_id)) continue
    if (n > 0 && SHIELDABLE.has(st) && !usedMonths.has(monthOf(r.end_at))) {
      const k = pool.findIndex(s => +s.created_at < +r.end_at)
      if (k >= 0) {
        useShields.push({ assignment_id: r.assignment_id, item_id: pool[k].id })
        usedMonths.add(monthOf(r.end_at)); pool.splice(k, 1); continue
      }
    }
    n = 0
  }
  return { streak: n, good, useShields }
}

// ───────────────────────── Ngân sách ─────────────────────────
/** Tiền đã cộng vào ví trong tháng (mọi khoản tính ngân sách: vòng quay + tiền chuỗi). */
export async function paidThisMonth(sql: Sql = getDb()): Promise<number> {
  const r = await sql`SELECT COALESCE(SUM(delta), 0)::int AS s FROM sc_wallet WHERE counts_budget
                      AND created_at >= date_trunc('month', NOW() AT TIME ZONE ${TZ}) AT TIME ZONE ${TZ}`
  return r[0].s
}
/** Ngân sách đã mở tới hôm nay: 750k × số tuần đã bắt đầu trong tháng (ngày 1, 8, 15, 22, 29), không quá trần tháng. */
export function budgetOpened(s: Pick<SanChoiSettings, 'monthly_budget' | 'weekly_budget'>, dayOfMonth: number): number {
  return Math.min(s.monthly_budget, s.weekly_budget * Math.ceil(dayOfMonth / 7))
}
export async function budgetLeft(sql: Sql = getDb()) {
  const s = await getSettings(sql)
  const day = Number(new Date().toLocaleDateString('en-CA', { timeZone: TZ }).slice(8, 10))
  const opened = budgetOpened(s, day)
  const paid = await paidThisMonth(sql)
  return { opened, paid, left: Math.max(0, opened - paid), monthly: s.monthly_budget, weekly: s.weekly_budget }
}

// ───────────────────────── Kiếm lượt ─────────────────────────
const ymd = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: TZ })

/** Người này có trong bộ phận đang chơi không. */
export async function inGame(staffId: number, sql: Sql = getDb()) {
  const s = await getSettings(sql)
  const r = (await sql`SELECT department, role FROM staff WHERE id = ${staffId}`)[0]
  return { playing: !!r && (r.role === 'admin' || s.departments.includes(String(r.department))), department: r?.department ?? null, departments: s.departments }
}

/**
 * Tính lại phần thưởng kiếm được của một người trong 60 ngày gần nhất. Chạy lại bao nhiêu lần cũng không trùng.
 *  - Ca hoàn hảo (+1 lượt, tối đa 1/ngày): đúng giờ tuyệt đối + đủ ca + mọi việc kho việc của ca đã xong (hoặc bỏ qua có lý do)
 *    VÀ đã được quản lý duyệt. Chưa duyệt thì chờ — lượt sẽ về khi quản lý duyệt.
 *  - Tiền giữ chuỗi theo cấp: chỉ cho ca kết thúc trong 3 ngày gần nhất và còn ngân sách (không truy thưởng dồn).
 *  - Mốc chuỗi 10 và 30 ca: +2 lượt.
 */
export async function syncEarnings(staffId: number, sql: Sql = getDb()) {
  await ensureSanChoiSchema(sql)
  const game = await inGame(staffId, sql)
  const now = new Date()
  const rows: CaRow[] = (await timesheet(ymd(new Date(Date.now() - 60 * 86400000)), ymd(new Date(Date.now() + 86400000)), staffId, sql))
    .map(r => ({ assignment_id: Number(r.assignment_id), day_status: String(r.day_status), start_at: new Date(r.start_at), end_at: new Date(r.end_at),
      in_at: r.in_at ? new Date(r.in_at) : null, out_at: r.out_at ? new Date(r.out_at) : null }))
    .filter(r => +r.end_at < +now || (r.day_status === 'du_cong' && !!r.out_at))
  const shieldedRows = await sql`SELECT u.assignment_id, u.created_at FROM sc_shield_uses u WHERE u.staff_id = ${staffId}`
  const shields = await sql`SELECT id, created_at FROM sc_items WHERE staff_id = ${staffId} AND kind = 'khien' AND status = 'con' ORDER BY created_at`
  const { streak, good, useShields } = walkStreak(rows, new Map(shieldedRows.map(r => [Number(r.assignment_id), new Date(r.created_at)])),
    shields.map(s => ({ id: Number(s.id), created_at: new Date(s.created_at) })))
  if (!game.playing) return { streak, level: levelFor(streak), newTokens: 0, waitingReview: 0, playing: false }

  let newTokens = 0, waitingReview = 0
  await sql.begin(async tx => {
    const t = tx as unknown as Sql
    await t`SELECT pg_advisory_xact_lock(4242078)` // cùng khoá với vòng quay: ngân sách được kiểm nhất quán
    await expireVouchers(t, staffId)
    await payQueuedWords(t, staffId)
    for (const u of useShields) {
      const ok = await t`UPDATE sc_items SET status = 'da_dung', used_at = NOW(), used_ref = ${'ca:' + u.assignment_id}
                         WHERE id = ${u.item_id} AND status = 'con' RETURNING id`
      if (ok.length) await t`INSERT INTO sc_shield_uses (assignment_id, staff_id, item_id) VALUES (${u.assignment_id}, ${staffId}, ${u.item_id}) ON CONFLICT DO NOTHING`
    }
    if (!good.length) return
    const ids = good.map(g => g.assignment_id)
    const tasks = await t`
      SELECT split_part(auto_key, ':', 3)::int AS asg,
             COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE status NOT IN ('xong', 'bo_qua'))::int AS not_done,
             COUNT(*) FILTER (WHERE reviewed_at IS NULL)::int AS not_reviewed,
             MAX(done_at) AS last_done
      FROM crm_tasks WHERE assigned_staff_id = ${staffId} AND source = 'kho_viec' AND auto_key LIKE 'kv:ca:%'
        AND split_part(auto_key, ':', 3) ~ '^[0-9]+$' AND split_part(auto_key, ':', 3)::int = ANY(${ids}::int[])
      GROUP BY 1`
    const byAsg = new Map(tasks.map(o => [Number(o.asg), o]))
    const { left: budget0 } = await budgetLeft(t)
    let budget = budget0
    const recent = Date.now() - 3 * 86400000
    for (const g of good) {
      const lv = levelFor(g.streak)
      if (lv.bonus > 0 && +g.end_at > recent && budget >= lv.bonus) {
        const r = await t`INSERT INTO sc_wallet (staff_id, delta, reason, source_key, counts_budget)
                          VALUES (${staffId}, ${lv.bonus}, ${'Giữ chuỗi · ' + lv.name}, ${'tn:' + g.assignment_id}, TRUE)
                          ON CONFLICT (source_key) DO NOTHING RETURNING id`
        if (r.length) budget -= lv.bonus
      }
      const o = byAsg.get(g.assignment_id)
      // Bộ phận chưa có việc kho việc cho ca này thì chưa có "ca hoàn hảo" (CEO: chưa có danh sách việc chính thì chưa vào chơi)
      const finished = !!o && o.total > 0 && o.not_done === 0 && (!g.out_at || !o.last_done || +new Date(o.last_done) <= +g.out_at + 15 * 60000)
      if (finished && o.not_reviewed > 0) waitingReview++
      if (finished && o.not_reviewed === 0) {
        const day = ymd(g.end_at)
        const r = await t`INSERT INTO sc_spin_tokens (staff_id, source, source_key, note)
                          VALUES (${staffId}, 'ca', ${'ngay:' + staffId + ':' + day}, ${'Ca hoàn hảo ' + day.split('-').reverse().slice(0, 2).join('/')})
                          ON CONFLICT (source_key) DO NOTHING RETURNING id`
        newTokens += r.length
      }
      const m = MILESTONES[g.streak]
      if (m) for (let i = 0; i < m; i++) {
        const r = await t`INSERT INTO sc_spin_tokens (staff_id, source, source_key, note)
                          VALUES (${staffId}, 'moc_chuoi', ${'moc:' + g.assignment_id + ':' + i}, ${'Chuỗi ' + g.streak + ' ca'})
                          ON CONFLICT (source_key) DO NOTHING RETURNING id`
        newTokens += r.length
      }
    }
  })
  return { streak, level: levelFor(streak), newTokens, waitingReview, playing: true }
}

// ───────────────────────── Quay ─────────────────────────
/** Chọn ô theo trọng số bằng số ngẫu nhiên mật mã (người dùng không đoán/ép được). */
export function pickWeighted<T extends { weight: number }>(items: T[], rnd: (max: number) => number = randomInt): T {
  const total = items.reduce((s, x) => s + x.weight, 0)
  if (total <= 0) throw new SanChoiError('Chưa có ô quà nào đang bật')
  let r = rnd(total)
  for (const x of items) { if (r < x.weight) return x; r -= x.weight }
  return items[items.length - 1]
}

export interface SpinResult { spinId: number; prizeId: number; code: string; label: string; kind: string; value: number; capped: boolean; letter: string | null }

export async function spin(staffId: number, sql: Sql = getDb(), rnd?: (max: number) => number): Promise<SpinResult> {
  await ensureSanChoiSchema(sql)
  return sql.begin(async tx => {
    const t = tx as unknown as Sql
    // Một khoá chung: 2 lượt quay đồng thời không cùng vượt trần ngân sách
    await t`SELECT pg_advisory_xact_lock(4242078)`
    const token = (await t`SELECT id FROM sc_spin_tokens WHERE staff_id = ${staffId} AND spin_id IS NULL AND revoked_at IS NULL ORDER BY created_at, id LIMIT 1 FOR UPDATE`)[0]
    if (!token) throw new SanChoiError('Bạn chưa có lượt quay. Làm một ca hoàn hảo để nhận lượt nhé!')
    const { left } = await budgetLeft(t)
    const holding = (await t`SELECT COUNT(*)::int AS n FROM sc_items WHERE staff_id = ${staffId} AND kind = 'khien' AND status = 'con'`)[0].n
    const all = (await t`SELECT id, code, label, kind, value, weight, letter FROM sc_prizes WHERE active AND weight > 0 ORDER BY sort, id`)
      .map(p => ({ id: Number(p.id), code: String(p.code), label: String(p.label), kind: String(p.kind), value: Number(p.value), weight: Number(p.weight), letter: p.letter ? String(p.letter) : null }))
    // Hết ngân sách tuần: chỉ ra quà không tốn tiền. Đang giữ khiên rồi thì không ra thêm khiên.
    const ok = all.filter(p => (p.kind !== 'tien' || p.value <= left) && (p.kind !== 'khien' || holding < SHIELD_MAX_HOLD))
    const capped = ok.some(p => p.kind === 'tien') ? ok.length < all.length && all.some(p => p.kind === 'tien' && p.value > left) : true
    const pool = ok.length ? ok : all.filter(p => p.kind === 'vat_pham')
    const prize = pickWeighted(pool, rnd)
    const s = (await t`
      INSERT INTO sc_spins (staff_id, token_id, prize_id, label, kind, value, capped)
      VALUES (${staffId}, ${token.id}, ${prize.id}, ${prize.label}, ${prize.kind}, ${prize.value}, ${capped}) RETURNING id`)[0]
    await t`UPDATE sc_spin_tokens SET spin_id = ${s.id} WHERE id = ${token.id}`
    if (prize.kind === 'tien') {
      await t`INSERT INTO sc_wallet (staff_id, delta, reason, source_key, counts_budget) VALUES (${staffId}, ${prize.value}, 'Vòng quay', ${'sp:' + s.id}, TRUE)`
    } else {
      await t`INSERT INTO sc_items (staff_id, kind, code, label, letter, spin_id) VALUES (${staffId}, ${prize.kind}, ${prize.code}, ${prize.label}, ${prize.letter}, ${s.id})`
      if (prize.kind === 'chu') { await claimWords(t, staffId); await payQueuedWords(t, staffId) }
    }
    return { spinId: s.id, prizeId: prize.id, code: prize.code, label: prize.label, kind: prize.kind, value: prize.value, capped, letter: prize.letter }
  })
}

// ───────────────────────── Ví & đổi thưởng ─────────────────────────
export const REDEEM = {
  hang_haco: { label: 'Lấy hàng HACO tại kho (bản cũ)', min: 20000 },
  luong: { label: 'Cộng vào lương tháng', min: 100000 },
  vat_pham: { label: 'Dùng quà', min: 0 },
} as const
export type RedeemKind = keyof typeof REDEEM

export async function balance(staffId: number, sql: Sql = getDb()): Promise<number> {
  const r = await sql`SELECT COALESCE(SUM(delta), 0)::int AS b FROM sc_wallet WHERE staff_id = ${staffId}`
  return r[0].b
}

/** Gửi yêu cầu đổi. Tiền trừ ngay (giữ chỗ); bị từ chối thì hoàn lại. Quà hiện vật chuyển sang chờ duyệt. */
export async function requestRedeem(staffId: number, b: { kind: string; amount?: number; item_id?: number; note?: string }, sql: Sql = getDb()) {
  await ensureSanChoiSchema(sql)
  const note = String(b.note || '').trim().slice(0, 300)
  return sql.begin(async tx => {
    const t = tx as unknown as Sql
    await t`SELECT pg_advisory_xact_lock(4242079, ${staffId})`
    if (b.kind === 'hang_haco') throw new SanChoiError('Lấy hàng HACO: bấm "Đổi voucher" rồi đưa mã cho thủ kho')
    if (b.kind === 'luong') {
      const amount = Math.floor(Number(b.amount))
      const min = REDEEM[b.kind].min
      if (!Number.isInteger(amount) || amount < min) throw new SanChoiError(`${REDEEM[b.kind].label}: tối thiểu ${min.toLocaleString('vi-VN')}đ`)
      if (amount > await balance(staffId, t)) throw new SanChoiError('Ví không đủ tiền')
      const { salary_month_max } = await getSettings(t)
      const used = (await t`SELECT COALESCE(SUM(amount), 0)::int AS s FROM sc_redemptions WHERE staff_id = ${staffId} AND kind = 'luong'
                            AND status <> 'tu_choi' AND created_at >= date_trunc('month', NOW() AT TIME ZONE ${TZ}) AT TIME ZONE ${TZ}`)[0].s
      if (used + amount > salary_month_max) throw new SanChoiError(`Cộng lương tối đa ${salary_month_max.toLocaleString('vi-VN')}đ/tháng (tháng này đã gửi ${used.toLocaleString('vi-VN')}đ)`)
      const r = (await t`INSERT INTO sc_redemptions (staff_id, kind, amount, note) VALUES (${staffId}, ${b.kind}, ${amount}, ${note}) RETURNING *`)[0]
      await t`INSERT INTO sc_wallet (staff_id, delta, reason, source_key, created_by) VALUES (${staffId}, ${-amount}, ${'Đổi: ' + REDEEM[b.kind].label}, ${'rd:' + r.id}, ${staffId})`
      await logAction({ actorId: staffId, action: 'REDEEM_REQUEST', table: 'sc_redemptions', recordId: r.id, after: r }, t)
      return r
    }
    if (b.kind === 'vat_pham') {
      const item = (await t`UPDATE sc_items SET status = 'cho_duyet' WHERE id = ${Number(b.item_id)} AND staff_id = ${staffId}
                            AND kind = 'vat_pham' AND status = 'con' RETURNING *`)[0]
      if (!item) throw new SanChoiError('Không tìm thấy quà này trong túi của bạn')
      const r = (await t`INSERT INTO sc_redemptions (staff_id, kind, item_id, note) VALUES (${staffId}, 'vat_pham', ${item.id}, ${note || item.label}) RETURNING *`)[0]
      await logAction({ actorId: staffId, action: 'REDEEM_REQUEST', table: 'sc_redemptions', recordId: r.id, after: r }, t)
      return r
    }
    throw new SanChoiError('Chọn cách đổi')
  })
}

export async function reviewRedeem(id: number, reviewerId: number, approve: boolean, note: string, ip: string, sql: Sql = getDb()) {
  await ensureSanChoiSchema(sql)
  return sql.begin(async tx => {
    const t = tx as unknown as Sql
    const before = (await t`SELECT * FROM sc_redemptions WHERE id = ${id} FOR UPDATE`)[0]
    if (!before) throw new SanChoiError('Không tìm thấy yêu cầu')
    if (before.status !== 'cho_duyet') throw new SanChoiError('Yêu cầu này đã được xử lý')
    if (before.staff_id === reviewerId) throw new SanChoiError('Không tự duyệt yêu cầu của mình')
    if (!approve && !note.trim()) throw new SanChoiError('Từ chối thì ghi lý do')
    const code = approve && before.kind === 'hang_haco' ? 'NV' + String(before.staff_id).padStart(3, '0') + '-' + id.toString(36).toUpperCase() : null
    const after = (await t`UPDATE sc_redemptions SET status = ${approve ? 'da_duyet' : 'tu_choi'}, reviewed_by = ${reviewerId}, reviewed_at = NOW(),
                             review_note = ${note.slice(0, 500)}, code = ${code} WHERE id = ${id} RETURNING *`)[0]
    if (!approve && before.amount > 0) {
      await t`INSERT INTO sc_wallet (staff_id, delta, reason, source_key, created_by) VALUES (${before.staff_id}, ${before.amount}, 'Hoàn lại: yêu cầu đổi bị từ chối', ${'rd-hoan:' + id}, ${reviewerId})
              ON CONFLICT (source_key) DO NOTHING`
    }
    if (before.item_id) await t`UPDATE sc_items SET status = ${approve ? 'da_doi' : 'con'}, used_at = ${approve ? new Date() : null}, used_ref = ${'rd:' + id} WHERE id = ${before.item_id}`
    await logAction({ actorId: reviewerId, action: approve ? 'APPROVE' : 'REJECT', table: 'sc_redemptions', recordId: id, before, after, reason: note, ip }, t)
    return after
  })
}

// ───────────────────────── Thưởng nóng (khen công khai tại chỗ) ─────────────────────────
/** Lý do chọn từ danh sách, hiện công khai trên bảng tin (CEO: chống thưởng cho người thân). */
export const KUDOS_REASONS = {
  giup_dong_doi: 'Giúp đồng đội',
  cuu_don: 'Cứu một đơn / một mẻ hàng',
  khach_khen: 'Được khách khen',
  sang_kien: 'Sáng kiến làm nhanh hơn',
  tang_ca_gap: 'Ở lại xử lý việc gấp',
  sach_se: 'Giữ bếp/kho sạch đẹp',
} as const
export type KudosReason = keyof typeof KUDOS_REASONS

export async function giveKudos(fromId: number, toId: number, reason: string, message: string, tokens: number, ip: string, sql: Sql = getDb()) {
  await ensureSanChoiSchema(sql)
  if (!(reason in KUDOS_REASONS)) throw new SanChoiError('Chọn lý do khen')
  if (fromId === toId) throw new SanChoiError('Không tự khen mình được')
  if (!Number.isInteger(tokens) || tokens < 0 || tokens > 2) throw new SanChoiError('Thưởng 0–2 lượt quay')
  const msg = message.trim().slice(0, 200)
  return sql.begin(async tx => {
    const t = tx as unknown as Sql
    await t`SELECT pg_advisory_xact_lock(4242080)`
    if (tokens > 0) {
      const s = await getSettings(t)
      const month = t`date_trunc('month', NOW() AT TIME ZONE ${TZ}) AT TIME ZONE ${TZ}`
      const given = (await t`SELECT COALESCE(SUM(tokens), 0)::int AS n FROM sc_kudos WHERE from_staff = ${fromId} AND created_at >= ${month}`)[0].n
      if (given + tokens > s.kudos_per_manager_month) throw new SanChoiError(`Tháng này bạn chỉ còn ${Math.max(0, s.kudos_per_manager_month - given)} lượt để thưởng nóng`)
      const got = (await t`SELECT COALESCE(SUM(tokens), 0)::int AS n FROM sc_kudos WHERE to_staff = ${toId} AND created_at >= ${month}`)[0].n
      if (got + tokens > s.kudos_per_receiver_month) throw new SanChoiError(`Người này đã nhận đủ ${s.kudos_per_receiver_month} lượt thưởng nóng tháng này. Vẫn khen được (0 lượt).`)
    }
    const k = (await t`INSERT INTO sc_kudos (from_staff, to_staff, reason, message, tokens) VALUES (${fromId}, ${toId}, ${reason}, ${msg}, ${tokens}) RETURNING *`)[0]
    for (let i = 0; i < tokens; i++) {
      await t`INSERT INTO sc_spin_tokens (staff_id, source, source_key, note, granted_by)
              VALUES (${toId}, 'thuong_nong', ${'kd:' + k.id + ':' + i}, ${KUDOS_REASONS[reason as KudosReason]}, ${fromId})`
    }
    await logAction({ actorId: fromId, action: 'KUDOS', table: 'sc_kudos', recordId: k.id, after: k, reason: KUDOS_REASONS[reason as KudosReason], ip }, t)
    return k
  })
}

// ───────────────────────── Trạng thái người chơi, bảng vàng, bảng tin ─────────────────────────
export async function playerState(staffId: number, sql: Sql = getDb()) {
  const earn = await syncEarnings(staffId, sql)
  const [tokens, bal, items, spins, reds, led] = await Promise.all([
    sql`SELECT COUNT(*)::int AS n FROM sc_spin_tokens WHERE staff_id = ${staffId} AND spin_id IS NULL AND revoked_at IS NULL`,
    balance(staffId, sql),
    sql`SELECT id, kind, code, label, status, created_at FROM sc_items WHERE staff_id = ${staffId} AND status IN ('con', 'cho_duyet') ORDER BY created_at`,
    sql`SELECT id, label, kind, value, capped, created_at FROM sc_spins WHERE staff_id = ${staffId} ORDER BY id DESC LIMIT 8`,
    sql`SELECT r.id, r.kind, r.amount, r.status, r.code, r.review_note, r.created_at, i.label AS item_label FROM sc_redemptions r
        LEFT JOIN sc_items i ON i.id = r.item_id WHERE r.staff_id = ${staffId} ORDER BY r.id DESC LIMIT 8`,
    ledger(staffId, 40, sql),
  ])
  return {
    ...earn, tokens: tokens[0].n, balance: bal,
    shields: items.filter(i => i.kind === 'khien' && i.status === 'con').length,
    gifts: items.filter(i => i.kind === 'vat_pham'), spins, redemptions: reds, ledger: led,
    letters: items.filter(i => i.kind === 'chu' && i.status === 'con').length,
  }
}

/**
 * Bảng vàng tháng. Bộ phận xếp theo % ca đúng giờ đủ công (không theo tổng → bộ phận ít người không thiệt).
 * Cá nhân chỉ trả top 3 mỗi bảng (không bêu người cuối).
 */
export async function leaderboard(sql: Sql = getDb()) {
  await ensureSanChoiSchema(sql)
  const s = await getSettings(sql)
  const staff = await sql`SELECT id, name, department FROM staff WHERE status = 'active' AND role <> 'admin' AND department = ANY(${s.departments}::text[])`
  const from = new Date().toLocaleDateString('en-CA', { timeZone: TZ }).slice(0, 8) + '01'
  const to = ymd(new Date())
  const people: { id: number; name: string; department: string; streak: number; level: ReturnType<typeof levelFor>; onTime: number; shifts: number; perfect: number }[] = []
  const month = sql`date_trunc('month', NOW() AT TIME ZONE ${TZ}) AT TIME ZONE ${TZ}`
  for (const p of staff) {
    const earn = await syncEarnings(Number(p.id), sql).catch(() => null)
    const ts = (await timesheet(from, to, Number(p.id), sql)).map(r => ({ assignment_id: Number(r.assignment_id), day_status: String(r.day_status),
      start_at: new Date(r.start_at), end_at: new Date(r.end_at), in_at: r.in_at ? new Date(r.in_at) : null, out_at: r.out_at ? new Date(r.out_at) : null }))
    const counted = ts.filter(r => BREAKS.has(streakStatus(r)) || streakStatus(r) === 'du_cong')
    const perfect = (await sql`SELECT COUNT(*)::int AS n FROM sc_spin_tokens WHERE staff_id = ${p.id} AND source = 'ca' AND created_at >= ${month}`)[0].n
    people.push({ id: Number(p.id), name: String(p.name), department: String(p.department), streak: earn?.streak ?? 0, level: levelFor(earn?.streak ?? 0),
      onTime: counted.filter(r => streakStatus(r) === 'du_cong').length, shifts: counted.length, perfect })
  }
  const teams = s.departments.map(d => {
    const ps = people.filter(p => p.department === d)
    const shifts = ps.reduce((a, p) => a + p.shifts, 0), onTime = ps.reduce((a, p) => a + p.onTime, 0)
    return { department: d, people: ps.length, shifts, onTime, pct: shifts ? Math.round(onTime / shifts * 100) : null }
  }).sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1))
  return {
    teams,
    topStreak: [...people].filter(p => p.streak > 0).sort((a, b) => b.streak - a.streak).slice(0, 3),
    topPerfect: [...people].filter(p => p.perfect > 0).sort((a, b) => b.perfect - a.perfect || b.streak - a.streak).slice(0, 3),
  }
}

/** Bảng tin công khai: lời khen (ai khen ai, lý do) và quà lớn. */
export async function feed(limit = 15, sql: Sql = getDb()) {
  await ensureSanChoiSchema(sql)
  return sql`
    (SELECT 'khen' AS type, k.created_at, f.name AS who, t.name AS to_name, k.reason AS code, k.message AS text, k.tokens
       FROM sc_kudos k JOIN staff f ON f.id = k.from_staff JOIN staff t ON t.id = k.to_staff)
    UNION ALL
    (SELECT 'quay', sp.created_at, s.name, NULL, NULL, sp.label, 0 FROM sc_spins sp JOIN staff s ON s.id = sp.staff_id WHERE sp.kind = 'tien' AND sp.value >= 50000)
    ORDER BY created_at DESC LIMIT ${limit}`
}

/** 3 chỉ số CEO xem mỗi tuần (phản biện CEO): % ca đúng giờ theo bộ phận, % việc ca xong & được duyệt, tiền thực chi so với trần. */
export async function weeklyReport(sql: Sql = getDb()) {
  await ensureSanChoiSchema(sql)
  const s = await getSettings(sql)
  const monday = (offsetWeeks: number) => {
    const d = new Date(new Date().toLocaleDateString('en-CA', { timeZone: TZ }) + 'T00:00:00Z')
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + 7 * offsetWeeks)
    return d.toISOString().slice(0, 10)
  }
  const week = async (off: number) => {
    const from = monday(off)
    const sunday = new Date(monday(off + 1) + 'T00:00:00Z')
    sunday.setUTCDate(sunday.getUTCDate() - 1)
    const to = off === 0 ? ymd(new Date()) : sunday.toISOString().slice(0, 10)
    const ts = (await timesheet(from, to, null, sql)).map(r => ({ dept: String(r.department), st: streakStatus({ assignment_id: Number(r.assignment_id), day_status: String(r.day_status),
      start_at: new Date(r.start_at), end_at: new Date(r.end_at), in_at: r.in_at ? new Date(r.in_at) : null, out_at: r.out_at ? new Date(r.out_at) : null }) }))
    const by: Record<string, { shifts: number; onTime: number }> = {}
    for (const r of ts) {
      if (!BREAKS.has(r.st) && r.st !== 'du_cong') continue
      by[r.dept] ??= { shifts: 0, onTime: 0 }
      by[r.dept].shifts++
      if (r.st === 'du_cong') by[r.dept].onTime++
    }
    return { from, to, by }
  }
  const [cur, prev] = await Promise.all([week(0), week(-1)])
  const [tasks] = await sql`
    SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status = 'xong' AND done_at <= due_at + INTERVAL '15 minutes')::int AS on_time,
           COUNT(*) FILTER (WHERE status = 'xong' AND reviewed_at IS NOT NULL)::int AS reviewed
    FROM crm_tasks WHERE source = 'kho_viec' AND due_at >= ${monday(0)}::date AND due_at < NOW()`
  const [paid] = await sql`SELECT COALESCE(SUM(delta), 0)::int AS paid, COUNT(DISTINCT staff_id)::int AS people FROM sc_wallet
                           WHERE counts_budget AND created_at >= (${monday(0)}::date)::timestamp AT TIME ZONE ${TZ}`
  const [spins] = await sql`SELECT COUNT(*)::int AS n FROM sc_spins WHERE created_at >= (${monday(0)}::date)::timestamp AT TIME ZONE ${TZ}`
  const kudos = await sql`
    SELECT f.name AS giver, t.name AS receiver, COUNT(*)::int AS times, SUM(k.tokens)::int AS tokens FROM sc_kudos k
    JOIN staff f ON f.id = k.from_staff JOIN staff t ON t.id = k.to_staff
    WHERE k.created_at >= date_trunc('month', NOW() AT TIME ZONE ${TZ}) AT TIME ZONE ${TZ}
    GROUP BY 1, 2 ORDER BY tokens DESC, times DESC LIMIT 3`
  const onTimeShifts = Object.values(cur.by).reduce((a, x) => a + x.onTime, 0)
  return { settings: s, cur, prev, tasks, paid: paid.paid, paidPeople: paid.people, spins: spins.n, kudos,
    costPerOnTimeShift: onTimeShifts ? Math.round(paid.paid / onTimeShifts) : null, budget: await budgetLeft(sql) }
}

// ───────────────────────── Linh vật Cốm (câu ≤ 12 chữ) ─────────────────────────
export type MascotKey = 'vao_dung' | 'vao_muon' | 'vao_khien' | 'ra_xong' | 'ra_con_viec' | 'ra_cho_duyet' | 'ra_binh' | 'co' | 'chua_choi'
export const MASCOT_MOOD: Record<MascotKey, 'vui' | 'tu_hao' | 'buon' | 'gian' | 'binh'> = {
  vao_dung: 'vui', vao_muon: 'buon', vao_khien: 'binh', ra_xong: 'tu_hao', ra_con_viec: 'gian', ra_cho_duyet: 'vui', ra_binh: 'vui', co: 'binh', chua_choi: 'vui',
}
const LINES: Record<MascotKey, string[]> = {
  vao_dung: ['Đúng giờ như xôi chín tới! Chuỗi {streak} ca 🔥', 'Bếp mở là có bạn. Cốm thương lắm!', 'Chuẩn giờ! Hôm nay {open} việc, làm gọn nhé.'],
  vao_muon: ['Muộn rồi… chuỗi rơi vào nồi mất 😭', 'Cốm chờ mãi. Mai đến sớm nối chuỗi nha!'],
  vao_khien: ['Muộn, nhưng khiên đã đỡ chuỗi cho bạn!'],
  ra_xong: ['XONG HẾT VIỆC! Ngôi sao của bếp hôm nay ⭐', 'Ca hoàn hảo! Cốm muốn đóng khung bạn 🖼️', 'Gọn, sạch, đúng giờ. Cô Hạ khen nức nở!'],
  ra_con_viec: ['Khoan! Còn {open} việc mà định về à? 😤', 'Còn {open} việc nằm đó kìa. Xong hẵng về!', 'Cốm thấy hết: còn {open} việc. Chưa có lượt đâu!'],
  ra_cho_duyet: ['Xong việc rồi! Quản lý duyệt là lượt về ví.'],
  ra_binh: ['Hết ca rồi. Về nghỉ ngơi nhé!'],
  co: ['Lượt chấm bị gắn cờ. Chờ quản lý xem nhé.'],
  chua_choi: ['Bộ phận bạn sắp vào Sân chơi. Chờ Cốm nhé!'],
}
export function mascotLine(key: MascotKey, vars: Record<string, string | number> = {}, rnd: (max: number) => number = randomInt): string {
  const pool = LINES[key]
  return pool[rnd(pool.length)].replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''))
}

// ───────────────────────── Kho chữ HACO FOOD (Easymart: "Kho chữ EASYMART") ─────────────────────────
/** Cụm chữ và tiền thưởng (CEO vòng 2): chữ lẻ không có giá trị tiền; mỗi cụm 1 lần/người/tháng; đủ cả 2 cụm thêm 70k. */
export const WORDS = [{ word: 'HACO', reward: 30_000 }, { word: 'FOOD', reward: 30_000 }] as const
export const FULL_WORD = { word: 'HACOFOOD', reward: 70_000 }
const monthKey = () => new Date().toLocaleDateString('en-CA', { timeZone: TZ }).slice(0, 7)
/** Chữ chỉ có hạn trong quý (cuối quý reset, không hoàn tiền chữ — khác Easymart). */
const quarterStart = (t: Sql) => t`date_trunc('quarter', NOW() AT TIME ZONE ${TZ}) AT TIME ZONE ${TZ}`

/** Chọn các chữ để ghép một từ từ danh sách chữ đang có (mỗi chữ dùng 1 lần). Trả null nếu thiếu. */
export function pickLetters(have: { id: number; letter: string }[], word: string): number[] | null {
  const pool = [...have]
  const out: number[] = []
  for (const ch of word) {
    const k = pool.findIndex(p => p.letter === ch)
    if (k < 0) return null
    out.push(pool[k].id); pool.splice(k, 1)
  }
  return out
}

async function claimWords(t: Sql, staffId: number) {
  const month = monthKey()
  const claimed = new Set((await t`SELECT word FROM sc_word_claims WHERE staff_id = ${staffId} AND month = ${month}`).map(r => String(r.word)))
  for (const w of WORDS) {
    if (claimed.has(w.word)) continue
    const have = (await t`SELECT id, letter FROM sc_items WHERE staff_id = ${staffId} AND kind = 'chu' AND status = 'con'
                          AND created_at >= ${quarterStart(t)} ORDER BY created_at, id FOR UPDATE`).map(r => ({ id: Number(r.id), letter: String(r.letter) }))
    const ids = pickLetters(have, w.word)
    if (!ids) continue
    await t`UPDATE sc_items SET status = 'da_doi', used_at = NOW(), used_ref = ${'tu:' + w.word + ':' + month} WHERE id = ANY(${ids}::int[])`
    await t`INSERT INTO sc_word_claims (staff_id, word, month, amount) VALUES (${staffId}, ${w.word}, ${month}, ${w.reward}) ON CONFLICT DO NOTHING`
    claimed.add(w.word)
  }
  if (WORDS.every(w => claimed.has(w.word)) && !claimed.has(FULL_WORD.word)) {
    await t`INSERT INTO sc_word_claims (staff_id, word, month, amount) VALUES (${staffId}, ${FULL_WORD.word}, ${month}, ${FULL_WORD.reward}) ON CONFLICT DO NOTHING`
  }
}

/** Trả tiền ghép chữ đang chờ khi còn ngân sách (không bao giờ vượt trần). */
async function payQueuedWords(t: Sql, staffId: number) {
  const queued = await t`SELECT id, word, amount FROM sc_word_claims WHERE staff_id = ${staffId} AND status = 'cho_tra' ORDER BY id`
  for (const q of queued) {
    const { left } = await budgetLeft(t)
    if (left < q.amount) break
    await t`UPDATE sc_word_claims SET status = 'da_tra', paid_at = NOW() WHERE id = ${q.id}`
    await t`INSERT INTO sc_wallet (staff_id, delta, reason, source_key, counts_budget)
            VALUES (${staffId}, ${q.amount}, ${q.word === FULL_WORD.word ? 'Ghép đủ HACO FOOD' : 'Ghép đủ chữ ' + q.word}, ${'tu:' + q.id}, TRUE)
            ON CONFLICT (source_key) DO NOTHING`
  }
}

export async function letterWallet(staffId: number, sql: Sql = getDb()) {
  await ensureSanChoiSchema(sql)
  const [letters, claims] = await Promise.all([
    sql`SELECT letter, COUNT(*)::int AS n FROM sc_items WHERE staff_id = ${staffId} AND kind = 'chu' AND status = 'con'
        AND created_at >= ${quarterStart(sql)} GROUP BY letter`,
    sql`SELECT word, amount, status, month FROM sc_word_claims WHERE staff_id = ${staffId} ORDER BY id DESC LIMIT 12`,
  ])
  const have: Record<string, number> = {}
  for (const l of letters) have[String(l.letter)] = l.n
  const month = monthKey()
  return {
    have, total: letters.reduce((a, l) => a + l.n, 0),
    words: WORDS.map(w => ({ ...w, claimed: claims.find(c => c.word === w.word && c.month === month) ?? null })),
    full: claims.find(c => c.word === FULL_WORD.word && c.month === month) ?? null,
    claims,
  }
}

// ───────────────────────── Voucher mua hàng nội bộ (đổi ở kho HACO) ─────────────────────────
export const VOUCHER_AMOUNTS = [20_000, 50_000, 100_000] as const
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

async function expireVouchers(t: Sql, staffId?: number) {
  const rows = await t`UPDATE sc_vouchers SET status = 'het_han_hoan', refunded_at = NOW()
                       WHERE status = 'con_han' AND expires_at < NOW() AND (${staffId ?? null}::int IS NULL OR staff_id = ${staffId ?? null})
                       RETURNING id, staff_id, amount, code`
  for (const v of rows) {
    await t`INSERT INTO sc_wallet (staff_id, delta, reason, source_key) VALUES (${v.staff_id}, ${v.amount}, ${'Hoàn voucher hết hạn ' + v.code}, ${'vc-hoan:' + v.id})
            ON CONFLICT (source_key) DO NOTHING`
  }
}

/** Đổi tiền ví lấy voucher (CEO vòng 2): 20k/50k/100k, hạn 7 ngày, tối đa 2 cái/tuần, vừa bị hoàn vì hết hạn thì chờ 7 ngày. */
export async function exchangeVoucher(staffId: number, amount: number, sql: Sql = getDb()) {
  await ensureSanChoiSchema(sql)
  if (!(VOUCHER_AMOUNTS as readonly number[]).includes(amount)) throw new SanChoiError('Chọn mệnh giá 20.000đ, 50.000đ hoặc 100.000đ')
  return sql.begin(async tx => {
    const t = tx as unknown as Sql
    await t`SELECT pg_advisory_xact_lock(4242079, ${staffId})`
    await expireVouchers(t, staffId)
    const s = await getSettings(t)
    const week = (await t`SELECT COUNT(*)::int AS n FROM sc_vouchers WHERE staff_id = ${staffId}
                          AND created_at >= date_trunc('week', NOW() AT TIME ZONE ${TZ}) AT TIME ZONE ${TZ}`)[0].n
    if (week >= s.voucher_per_week) throw new SanChoiError(`Mỗi tuần đổi tối đa ${s.voucher_per_week} voucher`)
    const cool = (await t`SELECT MAX(refunded_at) AS at FROM sc_vouchers WHERE staff_id = ${staffId} AND refunded_at > NOW() - INTERVAL '7 days'`)[0].at
    if (cool) throw new SanChoiError(`Voucher trước đã hết hạn và được hoàn. Đổi lại được từ ${new Date(+new Date(cool) + 7 * 86400000).toLocaleDateString('vi-VN', { timeZone: TZ })}`)
    if (amount > await balance(staffId, t)) throw new SanChoiError('Ví không đủ tiền')
    let code = ''
    for (let i = 0; i < 5; i++) {
      code = `HV${amount / 1000}K-` + Array.from({ length: 5 }, () => CODE_CHARS[randomInt(CODE_CHARS.length)]).join('')
      if (!(await t`SELECT 1 FROM sc_vouchers WHERE code = ${code}`).length) break
    }
    const v = (await t`INSERT INTO sc_vouchers (staff_id, code, amount, expires_at) VALUES (${staffId}, ${code}, ${amount}, NOW() + make_interval(days => ${s.voucher_days}))
                       RETURNING *`)[0]
    await t`INSERT INTO sc_wallet (staff_id, delta, reason, source_key, created_by) VALUES (${staffId}, ${-amount}, ${'Đổi voucher ' + code}, ${'vc:' + v.id}, ${staffId})`
    await logAction({ actorId: staffId, action: 'VOUCHER_EXCHANGE', table: 'sc_vouchers', recordId: v.id, after: v }, t)
    return v
  })
}

export async function myVouchers(staffId: number, sql: Sql = getDb()) {
  await ensureSanChoiSchema(sql)
  await sql.begin(tx => expireVouchers(tx as unknown as Sql, staffId))
  return sql`SELECT id, code, amount, status, expires_at, used_at, created_at FROM sc_vouchers WHERE staff_id = ${staffId} ORDER BY id DESC LIMIT 30`
}

/** "16:30-17:30" → đang trong giờ nhận voucher không (giờ Việt Nam). Chuỗi rỗng = cả ngày. */
export function inWindow(window: string, now = new Date()): boolean {
  const m = /^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/.exec(window.trim())
  if (!m) return true
  const hm = now.toLocaleTimeString('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false })
  const [h, mi] = hm.split(':').map(Number)
  const x = h * 60 + mi, a = +m[1] * 60 + +m[2], b = +m[3] * 60 + +m[4]
  return x >= a && x <= b
}

/** Ai được nhận voucher: kho & đóng gói, ban giám đốc, quản trị. */
export function isKho(u: { role: string; department: string | null; permissions: readonly string[] }) {
  return u.role === 'admin' || u.department === 'ban_giam_doc' || u.department === 'kho_van' || u.permissions.includes('cai_dat.sua')
}

/** Thủ kho nhận voucher: kiểm mã, khung giờ, hạn; đánh dấu đã dùng + nhật ký (là phiếu xuất voucher cho kế toán). */
export async function redeemVoucherAtKho(code: string, actor: { id: number; boss: boolean }, note: string, ip: string, sql: Sql = getDb()) {
  await ensureSanChoiSchema(sql)
  const c = code.trim().toUpperCase()
  if (!c) throw new SanChoiError('Nhập hoặc quét mã voucher')
  const s = await getSettings(sql)
  if (!actor.boss && !inWindow(s.kho_window)) throw new SanChoiError(`Kho nhận voucher trong khung ${s.kho_window}`)
  return sql.begin(async tx => {
    const t = tx as unknown as Sql
    await expireVouchers(t)
    const v = (await t`SELECT v.*, s.name AS staff_name FROM sc_vouchers v JOIN staff s ON s.id = v.staff_id WHERE v.code = ${c} FOR UPDATE`)[0]
    if (!v) throw new SanChoiError('Không có voucher mã này')
    if (v.staff_id === actor.id) throw new SanChoiError('Không tự nhận voucher của mình — nhờ người khác quét')
    if (v.status === 'da_dung') throw new SanChoiError(`Voucher đã dùng lúc ${new Date(v.used_at).toLocaleString('vi-VN', { timeZone: TZ })}`)
    if (v.status !== 'con_han') throw new SanChoiError('Voucher đã hết hạn (tiền đã hoàn về ví người đổi)')
    const after = (await t`UPDATE sc_vouchers SET status = 'da_dung', used_at = NOW(), used_by = ${actor.id}, used_note = ${note.slice(0, 300)}
                           WHERE id = ${v.id} RETURNING *`)[0]
    await logAction({ actorId: actor.id, action: 'VOUCHER_USE', table: 'sc_vouchers', recordId: v.id, before: v, after, reason: note, ip }, t)
    return { ...after, staff_name: v.staff_name }
  })
}

// ───────────────────────── Cấp / Bỏ lượt tay (chốt chặn CEO vòng 2) ─────────────────────────
export const GRANT_REASONS = {
  bu_loi: 'Bù lỗi hệ thống / chấm công',
  thi_dua: 'Giải thi đua tháng',
  su_kien: 'Sự kiện công ty',
  thu_hoi_sai: 'Thu hồi do cấp sai',
  vi_pham: 'Vi phạm: tick khống, gian lận',
} as const
export type GrantReason = keyof typeof GRANT_REASONS

async function manualUsedThisMonth(t: Sql) {
  return (await t`SELECT COALESCE(SUM(tokens), 0)::int AS n FROM sc_grants WHERE tokens > 0 AND status IN ('da_duyet', 'cho_duyet')
                  AND created_at >= date_trunc('month', NOW() AT TIME ZONE ${TZ}) AT TIME ZONE ${TZ}`)[0].n as number
}

async function mintGrant(t: Sql, row: Record<string, unknown>) {
  const g = { id: Number(row.id), staff_id: Number(row.staff_id), tokens: Number(row.tokens), reason: String(row.reason), created_by: Number(row.created_by) }
  for (let i = 0; i < g.tokens; i++) {
    await t`INSERT INTO sc_spin_tokens (staff_id, source, source_key, note, granted_by)
            VALUES (${g.staff_id}, 'cap_tay', ${'cap:' + g.id + ':' + i}, ${GRANT_REASONS[g.reason as GrantReason] ?? g.reason}, ${g.created_by}) ON CONFLICT DO NOTHING`
  }
}

/** Cấp lượt: không tự cấp; trừ vào Quỹ lượt tháng; quá N lượt/lần thì chờ người thứ hai duyệt. */
export async function grantTokens(actorId: number, toId: number, tokens: number, reason: string, note: string, ip: string, sql: Sql = getDb()) {
  await ensureSanChoiSchema(sql)
  if (!(reason in GRANT_REASONS) || reason === 'thu_hoi_sai' || reason === 'vi_pham') throw new SanChoiError('Chọn lý do cấp lượt')
  if (actorId === toId) throw new SanChoiError('Không tự cấp lượt cho mình')
  if (!Number.isInteger(tokens) || tokens < 1 || tokens > 20) throw new SanChoiError('Cấp 1–20 lượt mỗi lần')
  if (!note.trim()) throw new SanChoiError('Ghi chú cụ thể (vd: bù ca 25/10 máy chấm công lỗi)')
  return sql.begin(async tx => {
    const t = tx as unknown as Sql
    await t`SELECT pg_advisory_xact_lock(4242081)`
    const s = await getSettings(t)
    const used = await manualUsedThisMonth(t)
    if (used + tokens > s.manual_tokens_month) throw new SanChoiError(`Quỹ lượt tháng này còn ${Math.max(0, s.manual_tokens_month - used)}/${s.manual_tokens_month} lượt`)
    const needSecond = tokens > s.manual_second_over
    const g = (await t`INSERT INTO sc_grants (staff_id, tokens, reason, note, status, created_by)
                       VALUES (${toId}, ${tokens}, ${reason}, ${note.slice(0, 300)}, ${needSecond ? 'cho_duyet' : 'da_duyet'}, ${actorId}) RETURNING *`)[0]
    if (!needSecond) await mintGrant(t, g)
    await logAction({ actorId, action: 'GRANT_TOKENS', table: 'sc_grants', recordId: g.id, after: g, reason: note, ip }, t)
    return g
  })
}

export async function reviewGrant(id: number, approverId: number, approve: boolean, ip: string, sql: Sql = getDb()) {
  await ensureSanChoiSchema(sql)
  return sql.begin(async tx => {
    const t = tx as unknown as Sql
    const g = (await t`SELECT * FROM sc_grants WHERE id = ${id} FOR UPDATE`)[0]
    if (!g || g.status !== 'cho_duyet') throw new SanChoiError('Không còn chờ duyệt')
    if (g.created_by === approverId || g.staff_id === approverId) throw new SanChoiError('Người thứ hai duyệt: không phải người tạo, không phải người nhận')
    const after = (await t`UPDATE sc_grants SET status = ${approve ? 'da_duyet' : 'tu_choi'}, approved_by = ${approverId}, approved_at = NOW() WHERE id = ${id} RETURNING *`)[0]
    if (approve) await mintGrant(t, after)
    await logAction({ actorId: approverId, action: approve ? 'APPROVE' : 'REJECT', table: 'sc_grants', recordId: id, before: g, after, ip }, t)
    return after
  })
}

/** Bỏ lượt: chỉ thu hồi lượt CHƯA quay; ghi dòng âm, không xoá gì. */
export async function revokeTokens(actorId: number, toId: number, tokens: number, reason: string, note: string, ip: string, sql: Sql = getDb()) {
  await ensureSanChoiSchema(sql)
  if (reason !== 'thu_hoi_sai' && reason !== 'vi_pham') throw new SanChoiError('Chọn lý do thu hồi')
  if (actorId === toId) throw new SanChoiError('Không tự thao tác lượt của mình')
  if (!note.trim()) throw new SanChoiError('Ghi chú cụ thể lý do thu hồi')
  return sql.begin(async tx => {
    const t = tx as unknown as Sql
    const open = await t`SELECT id FROM sc_spin_tokens WHERE staff_id = ${toId} AND spin_id IS NULL AND revoked_at IS NULL ORDER BY created_at DESC, id DESC LIMIT ${Math.max(1, Math.min(tokens, 50))} FOR UPDATE`
    if (!open.length) throw new SanChoiError('Người này không còn lượt chưa quay để thu hồi')
    await t`UPDATE sc_spin_tokens SET revoked_at = NOW(), revoked_by = ${actorId} WHERE id = ANY(${open.map(o => o.id)}::int[])`
    const g = (await t`INSERT INTO sc_grants (staff_id, tokens, reason, note, status, created_by, approved_by, approved_at)
                       VALUES (${toId}, ${-open.length}, ${reason}, ${note.slice(0, 300)}, 'da_duyet', ${actorId}, ${actorId}, NOW()) RETURNING *`)[0]
    await logAction({ actorId, action: 'REVOKE_TOKENS', table: 'sc_grants', recordId: g.id, after: g, reason: note, ip }, t)
    return g
  })
}

export async function grantList(sql: Sql = getDb()) {
  await ensureSanChoiSchema(sql)
  const s = await getSettings(sql)
  const [rows, used] = await Promise.all([
    sql`SELECT g.*, s.name AS staff_name, c.name AS by_name, a.name AS approver_name FROM sc_grants g JOIN staff s ON s.id = g.staff_id
        LEFT JOIN staff c ON c.id = g.created_by LEFT JOIN staff a ON a.id = g.approved_by ORDER BY g.id DESC LIMIT 60`,
    manualUsedThisMonth(sql),
  ])
  return { rows, used, fund: s.manual_tokens_month, secondOver: s.manual_second_over }
}

// ───────────────────────── Sổ giao dịch (có số dư sau từng dòng), chuỗi, tổ đội ─────────────────────────
export async function ledger(staffId: number, limit = 40, sql: Sql = getDb()) {
  return sql`
    SELECT * FROM (SELECT id, delta, reason, source_key, created_at, SUM(delta) OVER (ORDER BY id) AS after FROM sc_wallet WHERE staff_id = ${staffId}) x
    ORDER BY id DESC LIMIT ${limit}`
}

/** Lịch 5 tuần gần nhất: mỗi ca một ô màu theo luật Sân chơi (đúng giờ / muộn / khiên đỡ / nghỉ phép / vắng). */
export async function streakCalendar(staffId: number, days = 35, sql: Sql = getDb()) {
  await ensureSanChoiSchema(sql)
  const rows = await timesheet(ymd(new Date(Date.now() - days * 86400000)), ymd(new Date()), staffId, sql)
  const shielded = new Set((await sql`SELECT assignment_id FROM sc_shield_uses WHERE staff_id = ${staffId}`).map(r => Number(r.assignment_id)))
  const perfect = new Set((await sql`SELECT source_key FROM sc_spin_tokens WHERE staff_id = ${staffId} AND source = 'ca'`).map(r => String(r.source_key).split(':').pop()))
  return rows.map(r => {
    const st = streakStatus({ assignment_id: Number(r.assignment_id), day_status: String(r.day_status), start_at: new Date(r.start_at), end_at: new Date(r.end_at),
      in_at: r.in_at ? new Date(r.in_at) : null, out_at: r.out_at ? new Date(r.out_at) : null })
    return { day: String(r.work_date), shift: String(r.shift_name), status: shielded.has(Number(r.assignment_id)) ? 'khien' : st, perfect: perfect.has(String(r.work_date)) }
  })
}

/** Tổ đội = bộ phận: thành viên, chuỗi, ca hoàn hảo tháng, % đúng giờ tháng. */
export async function teamBoard(department: string, sql: Sql = getDb()) {
  await ensureSanChoiSchema(sql)
  const members = await sql`SELECT id, name, title FROM staff WHERE status = 'active' AND role <> 'admin' AND department = ${department} ORDER BY name`
  const from = new Date().toLocaleDateString('en-CA', { timeZone: TZ }).slice(0, 8) + '01'
  const out = []
  for (const m of members) {
    const earn = await syncEarnings(Number(m.id), sql).catch(() => null)
    const ts = (await timesheet(from, ymd(new Date()), Number(m.id), sql)).map(r => streakStatus({ assignment_id: Number(r.assignment_id), day_status: String(r.day_status),
      start_at: new Date(r.start_at), end_at: new Date(r.end_at), in_at: r.in_at ? new Date(r.in_at) : null, out_at: r.out_at ? new Date(r.out_at) : null }))
    const counted = ts.filter(st => BREAKS.has(st) || st === 'du_cong')
    const perfect = (await sql`SELECT COUNT(*)::int AS n FROM sc_spin_tokens WHERE staff_id = ${m.id} AND source = 'ca'
                               AND created_at >= date_trunc('month', NOW() AT TIME ZONE ${TZ}) AT TIME ZONE ${TZ}`)[0].n
    out.push({ id: Number(m.id), name: String(m.name), title: String(m.title ?? ''), streak: earn?.streak ?? 0, level: levelFor(earn?.streak ?? 0),
      shifts: counted.length, onTime: counted.filter(st => st === 'du_cong').length, perfect })
  }
  const shifts = out.reduce((a, x) => a + x.shifts, 0), onTime = out.reduce((a, x) => a + x.onTime, 0)
  return { members: out.sort((a, b) => b.streak - a.streak), pct: shifts ? Math.round(onTime / shifts * 100) : null, shifts, onTime }
}
