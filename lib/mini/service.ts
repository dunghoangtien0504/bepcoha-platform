// Nghiệp vụ /api/mini/* (Mini App cho khách). Hợp đồng: Mini-App/THIET-KE-MINI-APP-v1.md mục 6.
// Quy tắc cốt lõi:
//  - SĐT tự gõ (web) = phiên CHƯA xác minh. Phiên chưa xác minh không chạm hồ sơ khách đang có:
//    các bảng con (funnel_events, order_claims, lesson_progress, consents, reward_ledger) chỉ có customer_id khi phiên đã xác minh.
//  - SĐT mới (chưa có trong customers): vẫn tạo khách (source 'mini', phone_verified_at NULL) và cấp voucher khoá theo SĐT.
//  - SĐT đã có của khách khác mà chưa xác minh: KHÔNG cấp voucher lúc gõ số — chỉ cấp khi xác minh. Nếu cấp sớm, người gõ số
//    của người khác sẽ "đốt" lượt quà duy nhất của khách thật (mỗi SĐT 1 lần, unique index trên reward_ledger).
//  - Xác minh: zalo_phone_token, hoặc order_match (mã đơn + SĐT khớp đúng 1 đơn Pancake) → promoteMiniSession (lib/crm/mini).
//  - Giới hạn nghiệp vụ đếm trong DB (rate limit trong bộ nhớ chỉ chống flood).
import { randomBytes } from 'node:crypto'
import { getDb } from '../db'
import { logAction } from '../crm/audit'
import { CLAIM_LIMIT_PER_PHONE, CLAIM_LIMIT_PER_SESSION, lookupOrderRef, promoteMiniSession, type VerifiedVia } from '../crm/mini'
import { normalizeRef } from '../crm/orders'
import { normalizePhone } from '../phone'
import { CONSENT_CHANNELS, CONSENT_PURPOSES, consentHash, consentText, type ConsentChannel } from '../mini-consent'
import { MiniError, badRequest, noSession, rateLimited } from './errors'

type Sql = ReturnType<typeof getDb>

export const LESSON_COUNT = 8
export const COMPLETE_PCT = 90
const EVENTS_PER_MINUTE = 60
const MAX_EVENTS_PER_REQUEST = 20
const SESSIONS_PER_ANON_PER_DAY = 5
const DAY_MS = 24 * 3600 * 1000
const VN_OFFSET_MS = 7 * 3600 * 1000

/** Event khách được tự gửi (bước theo Funnel Map). qr_scan / identified / claim_attempt do server tự ghi. */
export const CLIENT_EVENTS: Record<string, number> = {
  welcome_view: 3,
  identify_submit: 4,
  oa_follow_click: 4,
  lesson_open: 5,
  lesson_complete: 5,
  combo_click: 7,
  chat_click: 2,
  share_click: 9,
  claim_submit: 3,
  consent_revoke: 6,
  // v2-A: trang chủ, công thức, điểm danh
  checkin: 6,
  recipe_open: 5,
  recipe_save: 5,
  cook_mode: 5,
  product_click: 7,
  group_click: 6,
  // v2-B: giỏ hàng (order_placed do máy chủ tự ghi)
  cart_add: 7,
  checkout_view: 7,
  // v3-A: danh sách đi chợ, hẹn giờ khi nấu, thêm vào màn hình chính, sự kiện, thông báo
  shopping_add: 5,
  cook_timer: 5,
  cook_done: 5,
  add_to_home: 6,
  event_open: 6,
  notification_open: 6,
  event_remind: 6,
  event_calendar: 6,
  event_join: 6,
  // v4 (học Starbucks / Luckin / McDonald's): đặt lại 1 chạm, ví ưu đãi, gửi tặng
  reorder: 7,
  wallet_use: 7,
  gift_order: 7,
  gift_share: 9,
  // v6 (phản biện khách + CEO): đo phễu xem trang chủ / tab Đặt hàng / banner, kế hoạch đi chợ tuần, gợi ý mua kèm
  home_view: 3,
  shop_view: 7,
  banner_click: 5,
  week_plan_view: 5,
  week_plan_share: 9,
  upsell_add: 7,
}

export interface SessionRow {
  id: number
  anon_id: string
  phone: string | null
  verified: boolean
  verified_via: VerifiedVia | null
  verified_at: Date | null
  customer_id: number | null
  created_customer: boolean
  batch_code: string | null
  claim_locked_until: Date | null
  created_at: Date
}

export interface PublicSession {
  id: number
  verified: boolean
  verified_via: VerifiedVia | null
  phone_masked: string
  started_at: string
}

// ── tiện ích ────────────────────────────────────────────────────────────────

export function isValidMobile(phone: string): boolean {
  return /^0(3|5|7|8|9)\d{8}$/.test(phone)
}

export function maskPhone(phone: string | null): string {
  if (!phone) return ''
  return phone.length < 4 ? phone : phone.slice(0, 2) + '*'.repeat(phone.length - 4) + phone.slice(-2)
}

/** Bài 1 mở lúc đăng ký; bài n mở lúc 00:00 giờ VN của ngày đăng ký + (n − 1). */
export function unlockAt(started: Date, no: number): Date {
  if (no <= 1) return started
  const vnMidnight = Math.floor((started.getTime() + VN_OFFSET_MS) / DAY_MS) * DAY_MS - VN_OFFSET_MS
  return new Date(vnMidnight + (no - 1) * DAY_MS)
}

export function unlockedLessons(started: Date, now: Date = new Date()) {
  const out: { no: number; unlocked_at: string }[] = []
  for (let no = 1; no <= LESSON_COUNT; no++) {
    const at = unlockAt(started, no)
    if (at <= now) out.push({ no, unlocked_at: at.toISOString() })
  }
  return out
}

export function publicSession(s: SessionRow): PublicSession {
  return {
    id: s.id,
    verified: s.verified,
    verified_via: s.verified_via,
    phone_masked: maskPhone(s.phone),
    started_at: new Date(s.created_at).toISOString(),
  }
}

/** customer_id được phép ghi vào bảng con: chỉ khi phiên đã xác minh. */
const childCustomer = (s: SessionRow) => (s.verified ? s.customer_id : null)

export async function loadSession(id: number | null, sql: Sql = getDb()): Promise<SessionRow | null> {
  if (!id) return null
  const rows = await sql<SessionRow[]>`SELECT * FROM mini_sessions WHERE id = ${id}`
  return rows[0] ?? null
}

async function requireSession(id: number | null, sql: Sql): Promise<SessionRow> {
  const s = await loadSession(id, sql)
  if (!s) throw noSession()
  return s
}

function validAnonId(v: unknown): string {
  if (typeof v !== 'string' || !/^[A-Za-z0-9_-]{8,64}$/.test(v)) throw badRequest()
  return v
}

/** Ngày bắt đầu khoá học: phiên đã xác minh tính từ phiên sớm nhất của khách (học tiếp trên máy khác không bị mở lại từ đầu). */
async function courseStart(s: SessionRow, sql: Sql): Promise<Date> {
  if (!s.verified || !s.customer_id) return new Date(s.created_at)
  const r = await sql`SELECT MIN(created_at) AS t FROM mini_sessions WHERE customer_id = ${s.customer_id} AND verified`
  return new Date(r[0]?.t ?? s.created_at)
}

// ── /session ───────────────────────────────────────────────────────────────

export async function startSession(input: { anon_id: unknown; batch?: unknown; ref?: unknown }, sessionId: number | null, sql: Sql = getDb()) {
  const anon = validAnonId(input.anon_id)
  const code = typeof input.batch === 'string' ? input.batch.trim().toUpperCase().slice(0, 40) : ''
  const ref = typeof input.ref === 'string' ? input.ref.trim().slice(0, 32) : ''
  let batch = null
  if (code) {
    const rows = await sql`SELECT code, channel, cta, landing_variant FROM qr_batches WHERE code = ${code}`
    batch = rows[0] ?? null
  }
  const s = await loadSession(sessionId, sql)
  if (batch) {
    // Bảng chỉ số đếm lượt quét theo step 1 (COUNT DISTINCT anon_id). Không ghi lặp khi khách mở lại trong 30 phút.
    await sql`
      INSERT INTO funnel_events (mini_session_id, customer_id, anon_id, step, name, batch_code, props)
      SELECT ${s?.id ?? null}, ${s ? childCustomer(s) : null}, ${anon}, 1, 'qr_scan', ${batch.code}, ${sql.json(ref ? { ref } : {})}
      WHERE NOT EXISTS (SELECT 1 FROM funnel_events WHERE anon_id = ${anon} AND name = 'qr_scan' AND batch_code = ${batch.code}
                        AND created_at > NOW() - INTERVAL '30 minutes')`
  }
  return { batch, session: s ? publicSession(s) : null }
}

// ── /event ─────────────────────────────────────────────────────────────────

export async function recordEvents(input: { anon_id: unknown; events?: unknown }, sessionId: number | null, sql: Sql = getDb()): Promise<number> {
  const anon = validAnonId(input.anon_id)
  if (!Array.isArray(input.events) || input.events.length > MAX_EVENTS_PER_REQUEST) throw badRequest()
  const now = Date.now()
  const s = await loadSession(sessionId, sql)
  const rows = []
  for (const raw of input.events) {
    if (!raw || typeof raw !== 'object') continue
    const e = raw as Record<string, unknown>
    const name = typeof e.name === 'string' ? e.name : ''
    if (!(name in CLIENT_EVENTS)) continue
    let at = now
    if (typeof e.at === 'string') {
      const t = Date.parse(e.at)
      if (!Number.isFinite(t) || Math.abs(t - now) > DAY_MS) continue // lệch quá 24 giờ: bỏ
      at = t
    }
    let props: Record<string, unknown> = {}
    if (e.props && typeof e.props === 'object' && !Array.isArray(e.props) && JSON.stringify(e.props).length <= 2000) props = e.props as Record<string, unknown>
    const batch = typeof e.batch_code === 'string' ? e.batch_code.slice(0, 40) : s?.batch_code ?? null
    rows.push({ name, step: CLIENT_EVENTS[name], at: new Date(at), props, batch })
  }
  if (!rows.length) return 0
  const recent = await sql`SELECT COUNT(*)::int AS n FROM funnel_events WHERE anon_id = ${anon} AND created_at > NOW() - INTERVAL '1 minute'`
  const room = Math.max(0, EVENTS_PER_MINUTE - recent[0].n)
  const keep = rows.slice(0, room)
  for (const r of keep) {
    await sql`
      INSERT INTO funnel_events (mini_session_id, customer_id, anon_id, step, name, batch_code, props, created_at)
      VALUES (${s?.id ?? null}, ${s ? childCustomer(s) : null}, ${anon}, ${r.step}, ${r.name}, ${r.batch}, ${sql.json(r.props as never)}, ${r.at})`
  }
  return keep.length
}

// ── voucher ────────────────────────────────────────────────────────────────

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function voucherCode(): string {
  const b = randomBytes(8)
  let out = 'CH'
  for (let i = 0; i < 8; i++) out += CODE_ALPHABET[b[i] % CODE_ALPHABET.length]
  return out
}

interface VoucherConfig { program: string; amount: number; valid_days: number }

/** Cấu hình voucher Đợt A nằm ở app_settings key 'mini_voucher' (Cô Hạ quyết số tiền). Chưa có giá trị → không cấp. */
export async function voucherConfig(sql: Sql): Promise<VoucherConfig | null> {
  const r = await sql`SELECT value FROM app_settings WHERE key = 'mini_voucher'`
  const v = r[0]?.value as Partial<VoucherConfig> | undefined
  if (!v || typeof v.program !== 'string' || !v.program) return null
  if (!Number.isInteger(v.amount) || (v.amount as number) <= 0) return null
  if (!Number.isInteger(v.valid_days) || (v.valid_days as number) <= 0) return null
  return { program: v.program, amount: v.amount as number, valid_days: v.valid_days as number }
}

export interface PublicReward {
  code: string
  kind: string
  program: string
  amount: number
  expires_at: string | null
  status: string
  phone_masked: string
}

function publicReward(r: Record<string, unknown>): PublicReward {
  const expires = r.expires_at ? new Date(r.expires_at as string) : null
  const status = r.status === 'da_cap' && expires && expires < new Date() ? 'het_han' : (r.status as string)
  return {
    code: r.code as string,
    kind: r.kind as string,
    program: r.program as string,
    amount: Number(r.amount),
    expires_at: expires ? expires.toISOString() : null,
    status,
    phone_masked: maskPhone(r.locked_phone as string | null),
  }
}

/** Cấp voucher (nếu có cấu hình) cho phiên, khoá theo SĐT của phiên. Mỗi SĐT một lần cho mỗi chương trình. */
export async function grantVoucher(sessionId: number, sql: Sql = getDb()): Promise<PublicReward[]> {
  const cfg = await voucherConfig(sql)
  const s = await loadSession(sessionId, sql)
  if (!cfg || !s?.phone) return []
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const rows = await sql`
        INSERT INTO reward_ledger (mini_session_id, customer_id, kind, program, amount, code, locked_phone, expires_at, status)
        SELECT ${s.id}, ${childCustomer(s)}, 'voucher', ${cfg.program}, ${cfg.amount}, ${voucherCode()}, ${s.phone},
               NOW() + make_interval(days => ${cfg.valid_days}), 'da_cap'
        WHERE NOT EXISTS (SELECT 1 FROM reward_ledger WHERE locked_phone = ${s.phone} AND program = ${cfg.program} AND status <> 'huy')
        RETURNING *`
      return rows.map(publicReward)
    } catch (e) {
      const err = e as { code?: string; constraint_name?: string }
      if (err.code !== '23505') throw e
      if (err.constraint_name === 'reward_ledger_once_uq') return [] // SĐT đã nhận (tranh chấp song song)
      // trùng mã voucher: thử mã khác
    }
  }
  return []
}

// ── /identify ──────────────────────────────────────────────────────────────

export interface IdentifyInput {
  anon_id: unknown
  batch_code?: unknown
  name?: unknown
  consents?: unknown
  /** SĐT đã chuẩn hoá; nếu verifiedVia có giá trị thì SĐT đến từ nguồn đã xác minh (Zalo). */
  phone: string
  verifiedVia?: Extract<VerifiedVia, 'zalo_phone_token' | 'otp'>
}

function parseConsents(v: unknown) {
  if (v === undefined || v === null) return []
  if (!Array.isArray(v) || v.length > 5) throw badRequest()
  const seen = new Set<string>()
  const out: { channel: ConsentChannel; purpose: string; version: string; text: string }[] = []
  for (const raw of v) {
    const c = (raw ?? {}) as Record<string, unknown>
    const channel = c.channel as ConsentChannel
    const purpose = c.purpose as string
    const version = c.text_version as string
    const text = typeof version === 'string' ? consentText(version) : null
    if (!CONSENT_CHANNELS.includes(channel) || !(CONSENT_PURPOSES as readonly string[]).includes(purpose) || !text) {
      throw new MiniError(400, 'invalid_consent', 'Nội dung đồng ý không hợp lệ, chị tải lại trang giúp Cô nhé.')
    }
    if (seen.has(channel)) continue
    seen.add(channel)
    out.push({ channel, purpose, version, text })
  }
  return out
}

export async function identify(input: IdentifyInput, ctx: { ip: string; ua: string }, sql: Sql = getDb()) {
  const anon = validAnonId(input.anon_id)
  const phone = normalizePhone(input.phone)
  if (!isValidMobile(phone)) throw new MiniError(400, 'invalid_phone', 'Số điện thoại chưa đúng, chị kiểm tra lại giúp Cô nhé.')
  const consents = parseConsents(input.consents)
  const name = typeof input.name === 'string' ? input.name.trim().slice(0, 60) : ''
  const verified = !!input.verifiedVia

  const recent = await sql`SELECT COUNT(*)::int AS n FROM mini_sessions WHERE anon_id = ${anon} AND created_at > NOW() - INTERVAL '24 hours'`
  if (recent[0].n >= SESSIONS_PER_ANON_PER_DAY) throw rateLimited()

  let batchCode: string | null = null
  if (typeof input.batch_code === 'string' && input.batch_code) {
    const b = await sql`SELECT code FROM qr_batches WHERE code = ${input.batch_code.trim().toUpperCase().slice(0, 40)}`
    batchCode = b[0]?.code ?? null
  }

  const { sessionId, createdCustomer } = await sql.begin(async tx => {
    const t = tx as unknown as Sql
    let createdId: number | null = null
    if (!verified) {
      // SĐT mới → tạo khách ngay (phương án B có giới hạn). SĐT đã có → không đụng hồ sơ đó.
      const ins = await t`
        INSERT INTO customers (phone, name, source, stage, phone_verified_at)
        VALUES (${phone}, ${name}, 'mini', 'moi', NULL)
        ON CONFLICT (phone) DO NOTHING RETURNING id`
      createdId = ins[0]?.id ?? null
    }
    const sess = (await t`
      INSERT INTO mini_sessions (anon_id, phone, verified, customer_id, created_customer, batch_code)
      VALUES (${anon}, ${phone}, FALSE, ${createdId}, ${createdId !== null}, ${batchCode})
      RETURNING id`)[0]
    const sid = sess.id as number
    // Gom các event ẩn danh trước bước đăng ký vào phiên này (chưa gắn khách: promote sẽ gắn khi xác minh).
    await t`UPDATE funnel_events SET mini_session_id = ${sid} WHERE anon_id = ${anon} AND mini_session_id IS NULL AND customer_id IS NULL`
    await t`
      INSERT INTO funnel_events (mini_session_id, anon_id, step, name, batch_code, props)
      VALUES (${sid}, ${anon}, 4, 'identified', ${batchCode}, ${t.json({ consent: consents.length > 0, created_customer: createdId !== null, zalo: verified })})`
    for (const c of consents) {
      await t`
        INSERT INTO consents (mini_session_id, customer_id, channel, purpose, text_version, text_hash, verified, source, evidence)
        VALUES (${sid}, NULL, ${c.channel}, ${c.purpose}, ${c.version}, ${consentHash(c.text)}, FALSE, 'mini_app',
                ${t.json({ ip: ctx.ip, ua: ctx.ua, anon_id: anon, batch: batchCode, phone_source: verified ? 'zalo' : 'tu_nhap' })})`
    }
    if (createdId !== null) {
      await t`
        INSERT INTO customer_activities (customer_id, kind, content, staff_id)
        VALUES (${createdId}, 'mini_dang_ky', ${'Đăng ký khoá học qua Mini App, SĐT chưa xác minh' + (batchCode ? ', lô QR ' + batchCode : '')}, NULL)`
    }
    await logAction(
      { actorType: 'customer', actorId: null, action: 'IDENTIFY', table: 'mini_sessions', recordId: sid, after: { phone: maskPhone(phone), created_customer: createdId !== null, batch: batchCode, consents: consents.map(c => c.channel) }, ip: ctx.ip },
      t,
    )
    return { sessionId: sid, createdCustomer: createdId !== null }
  })

  if (verified) await promoteMiniSession(sessionId, input.verifiedVia!, { type: 'customer', id: null }, sql)
  const rewards = verified || createdCustomer ? await grantVoucher(sessionId, sql) : []
  const s = (await loadSession(sessionId, sql))!
  return { session: publicSession(s), rewards }
}

// ── /claim-order ───────────────────────────────────────────────────────────

export async function claimOrder(sessionId: number | null, rawCode: unknown, ctx: { ip: string }, sql: Sql = getDb()) {
  const s = await requireSession(sessionId, sql)
  const code = typeof rawCode === 'string' ? rawCode.trim().slice(0, 64) : ''
  if (normalizeRef(code).length < 4) throw new MiniError(400, 'invalid_code', 'Mã đơn chưa đủ, chị kiểm tra lại giúp Cô nhé.')

  const locked = () =>
    new MiniError(429, 'claim_locked', 'Chị đã nhập nhiều lần. Chị thử lại sau, hoặc nhắn Cô Hạ để Cô kiểm tra giúp nhé.', {
      until: new Date(Date.now() + DAY_MS).toISOString(),
    })
  if (s.claim_locked_until && new Date(s.claim_locked_until) > new Date()) {
    const e = locked()
    e.extra.until = new Date(s.claim_locked_until).toISOString()
    throw e
  }
  const byPhone = await sql`
    SELECT COUNT(*)::int AS n FROM order_claims oc JOIN mini_sessions m ON m.id = oc.mini_session_id
    WHERE m.phone = ${s.phone} AND oc.created_at > NOW() - INTERVAL '24 hours'`
  if (byPhone[0].n >= CLAIM_LIMIT_PER_PHONE) {
    await sql`UPDATE mini_sessions SET claim_locked_until = NOW() + INTERVAL '24 hours' WHERE id = ${s.id}`
    throw locked()
  }

  const lookup = await lookupOrderRef(code, s.phone, sql)
  let status: 'da_khop' | 'cho_duyet' = lookup.result === 'khop_sdt' ? 'da_khop' : 'cho_duyet'
  const insert = (st: 'da_khop' | 'cho_duyet') => sql`
    INSERT INTO order_claims (mini_session_id, customer_id, order_ref_raw, order_ref_norm, ref_kind, platform, matched_pancake_order_id, lookup_result, status)
    VALUES (${s.id}, ${childCustomer(s)}, ${code}, ${normalizeRef(code)}, ${lookup.refKind}, ${lookup.platform}, ${lookup.orderId}, ${lookup.result}, ${st})
    RETURNING id`
  let claimId: number
  try {
    claimId = (await insert(status))[0].id
  } catch (e) {
    // Đơn đã được phiên khác nhận (unique da_khop) → để nhân viên duyệt, không báo lý do cho khách.
    if ((e as { code?: string }).code !== '23505' || status !== 'da_khop') throw e
    status = 'cho_duyet'
    claimId = (await insert(status))[0].id
  }
  await sql`
    INSERT INTO funnel_events (mini_session_id, customer_id, anon_id, step, name, batch_code, props)
    VALUES (${s.id}, ${childCustomer(s)}, ${s.anon_id}, 3, 'claim_attempt', ${s.batch_code}, ${sql.json({ matched: status === 'da_khop', lookup: lookup.result, platform: lookup.platform })})`

  if (status === 'da_khop') {
    if (!s.verified) await promoteMiniSession(s.id, 'order_match', { type: 'system', id: null }, sql)
    const after = (await loadSession(s.id, sql))!
    await sql`UPDATE order_claims SET customer_id = ${after.customer_id} WHERE id = ${claimId}`
    await sql`
      INSERT INTO customer_activities (customer_id, kind, content, staff_id)
      VALUES (${after.customer_id}, 'order_claim_matched', ${'Khách tự ghép đơn ' + lookup.orderId + ' qua Mini App'}, NULL)`
    await grantVoucher(s.id, sql)
  } else {
    const fails = await sql`
      SELECT COUNT(*)::int AS n FROM order_claims
      WHERE mini_session_id = ${s.id} AND status <> 'da_khop' AND created_at > NOW() - INTERVAL '24 hours'`
    if (fails[0].n >= CLAIM_LIMIT_PER_SESSION) await sql`UPDATE mini_sessions SET claim_locked_until = NOW() + INTERVAL '24 hours' WHERE id = ${s.id}`
  }
  await logAction({ actorType: 'customer', actorId: null, action: 'CLAIM', table: 'order_claims', recordId: claimId, after: { status, lookup: lookup.result }, ip: ctx.ip }, sql)
  const fresh = (await loadSession(s.id, sql))!
  return { claim_id: claimId, status, session: publicSession(fresh) }
}

// ── /me ────────────────────────────────────────────────────────────────────

export async function getMe(sessionId: number | null, sql: Sql = getDb()) {
  const s = await requireSession(sessionId, sql)
  const cid = s.verified ? s.customer_id : null
  const started = await courseStart(s, sql)

  const rewards = cid
    ? await sql`SELECT * FROM reward_ledger WHERE customer_id = ${cid} OR mini_session_id = ${s.id} ORDER BY created_at DESC`
    : await sql`SELECT * FROM reward_ledger WHERE mini_session_id = ${s.id} ORDER BY created_at DESC`

  // Tiến độ: phiên đã xác minh gộp mọi phiên cùng khách (MAX watched_pct) — chỉ khi đã xác minh.
  const progress = cid
    ? await sql`SELECT lesson_no, MAX(watched_pct)::int AS watched_pct, MIN(completed_at) AS completed_at
                FROM lesson_progress WHERE customer_id = ${cid} OR mini_session_id = ${s.id} GROUP BY lesson_no`
    : await sql`SELECT lesson_no, watched_pct, completed_at FROM lesson_progress WHERE mini_session_id = ${s.id}`
  const byNo = new Map(progress.map(p => [Number(p.lesson_no), p]))
  const lessons = unlockedLessons(started).map(l => {
    const p = byNo.get(l.no)
    return { no: l.no, unlocked_at: l.unlocked_at, watched_pct: p ? Number(p.watched_pct) : 0, completed_at: p?.completed_at ? new Date(p.completed_at).toISOString() : null }
  })

  const claims = cid
    ? await sql`SELECT id, status, created_at FROM order_claims WHERE customer_id = ${cid} OR mini_session_id = ${s.id} ORDER BY created_at DESC LIMIT 20`
    : await sql`SELECT id, status, created_at FROM order_claims WHERE mini_session_id = ${s.id} ORDER BY created_at DESC LIMIT 20`

  let referral: string | null = null
  if (cid) referral = (await sql`SELECT referral_code FROM customers WHERE id = ${cid}`)[0]?.referral_code ?? null

  return {
    session: publicSession(s),
    rewards: rewards.map(publicReward),
    lessons,
    claims: claims.map(c => ({ id: c.id, status: c.status, created_at: new Date(c.created_at).toISOString() })),
    referral_code: referral,
  }
}

// ── /lesson/:no/progress ───────────────────────────────────────────────────

export async function recordProgress(sessionId: number | null, noRaw: unknown, pctRaw: unknown, sql: Sql = getDb()) {
  const s = await requireSession(sessionId, sql)
  const no = Number(noRaw)
  const pct = Number(pctRaw)
  if (!Number.isInteger(no) || no < 1 || no > LESSON_COUNT || !Number.isFinite(pct) || pct < 0 || pct > 100) throw badRequest()
  const started = await courseStart(s, sql)
  const unlocked = unlockedLessons(started)
  const open = unlocked.find(l => l.no === no)
  if (!open) throw new MiniError(403, 'not_unlocked', 'Bài này chưa mở, chị chờ tới ngày học nhé.')
  const value = Math.round(pct)

  const before = (await sql`SELECT completed_at FROM lesson_progress WHERE mini_session_id = ${s.id} AND lesson_no = ${no}`)[0]
  const row = (await sql`
    INSERT INTO lesson_progress (mini_session_id, lesson_no, customer_id, unlocked_at, watched_pct, completed_at)
    VALUES (${s.id}, ${no}, ${childCustomer(s)}, ${open.unlocked_at}, ${value}, ${value >= COMPLETE_PCT ? sql`NOW()` : null})
    ON CONFLICT (mini_session_id, lesson_no) DO UPDATE SET
      watched_pct = GREATEST(lesson_progress.watched_pct, EXCLUDED.watched_pct),
      completed_at = COALESCE(lesson_progress.completed_at, CASE WHEN GREATEST(lesson_progress.watched_pct, EXCLUDED.watched_pct) >= ${COMPLETE_PCT} THEN NOW() END),
      customer_id = COALESCE(lesson_progress.customer_id, EXCLUDED.customer_id)
    RETURNING watched_pct, completed_at`)[0]

  const justCompleted = !before?.completed_at && !!row.completed_at
  if (justCompleted && s.verified && s.customer_id) {
    await sql`INSERT INTO customer_activities (customer_id, kind, content, staff_id) VALUES (${s.customer_id}, 'lesson_done', ${'Học xong bài ' + no + ' khoá xôi cốm (Mini App)'}, NULL)`
  }
  return { no, watched_pct: Number(row.watched_pct), completed_at: row.completed_at ? new Date(row.completed_at).toISOString() : null, unlocked }
}

// ── /consent/revoke ────────────────────────────────────────────────────────

export async function revokeConsent(sessionId: number | null, channelRaw: unknown, ctx: { ip: string }, sql: Sql = getDb()) {
  const s = await requireSession(sessionId, sql)
  let channel: ConsentChannel | null = null
  if (channelRaw !== undefined && channelRaw !== null) {
    if (!CONSENT_CHANNELS.includes(channelRaw as ConsentChannel)) throw badRequest()
    channel = channelRaw as ConsentChannel
  }
  await sql.begin(async tx => {
    const t = tx as unknown as Sql
    await t`UPDATE consents SET revoked_at = NOW()
            WHERE mini_session_id = ${s.id} AND revoked_at IS NULL AND (${channel}::text IS NULL OR channel = ${channel})`
    if (s.verified && s.customer_id) {
      // Đã xác minh: rút lại mọi lượt đồng ý của khách và bật cờ "không liên hệ" (không bao giờ tự tắt).
      await t`UPDATE consents SET revoked_at = NOW()
              WHERE customer_id = ${s.customer_id} AND revoked_at IS NULL AND (${channel}::text IS NULL OR channel = ${channel})`
      await t`UPDATE customers SET opted_out_at = COALESCE(opted_out_at, NOW()), updated_at = NOW() WHERE id = ${s.customer_id}`
      await t`INSERT INTO customer_activities (customer_id, kind, content, staff_id)
              VALUES (${s.customer_id}, 'mini_huy_nhan_tin', ${'Khách tự ngừng nhận tin chăm sóc trên Mini App' + (channel ? ' (' + channel + ')' : '')}, NULL)`
    }
    await logAction({ actorType: 'customer', actorId: null, action: 'REVOKE_CONSENT', table: 'mini_sessions', recordId: s.id, after: { channel, verified: s.verified }, ip: ctx.ip }, t)
  })
}
