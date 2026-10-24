// Điểm danh hằng ngày, chuỗi ngày, Hạt Cốm và Sổ tay của Mini App (đợt v2-A).
// Thiết kế: Mini-App/NGHIEN-CUU-TOP5-VA-THIET-KE-v2.md (mục 2, 5). Bảng: daily_checkins, points_ledger, saved_recipes (schema của phiên CRM).
// Quy tắc:
//  - Ngày tính theo giờ VN. Phiên chưa xác minh: tính theo phiên. Đã xác minh: tính theo khách (mọi phiên/máy của khách).
//  - Hạt Cốm là sổ cái (points_ledger), không cộng thẳng số dư. Mỗi khoản cộng có khoá (reason, ref) để gọi lặp không cộng trùng.
//  - Quà theo mốc là CỐ ĐỊNH, không may rủi (vòng quay/bốc thăm phải đăng ký khuyến mại với Sở Công Thương).
//  - v2-A chỉ cộng điểm; tiêu điểm (delta âm) chỉ dành cho phiên đã xác minh, làm ở đợt sau.
// Thuật toán chuỗi ngày giống Mini-App/app/src/lib/streak.ts — sửa một bên thì sửa cả hai.
import { getDb } from '../db'
import { MiniError, badRequest, noSession } from './errors'
import { loadSession, type SessionRow } from './service'

type Sql = ReturnType<typeof getDb>

const DAY_MS = 86400000
const VN_OFFSET_MS = 7 * 3600 * 1000
export const MILESTONES = [3, 7, 14, 30] as const
const MAX_SAVED = 200

export interface PointsRules {
  checkin: number
  milestones: Record<string, number>
}

/** Mặc định khi Cô Hạ chưa chốt (ghi đè bằng app_settings key 'mini_points'). */
export const DEFAULT_POINTS: PointsRules = { checkin: 5, milestones: { '3': 10, '7': 30, '14': 60, '30': 150 } }

export function vnDay(d: Date = new Date()): string {
  return new Date(d.getTime() + VN_OFFSET_MS).toISOString().slice(0, 10)
}

const dayNum = (s: string) => Math.round(Date.parse(s + 'T00:00:00Z') / DAY_MS)

export interface StreakState {
  streak: number
  today_done: boolean
  chain_start: string | null
  freeze_available: boolean
  next_milestone: number | null
}

/** Chuỗi ngày liên tiếp; được lỡ 1 ngày không đứt chuỗi, tối đa 1 lần trong 7 ngày. */
export function computeStreak(days: string[], today: string): StreakState {
  const uniq = [...new Set(days)].map(dayNum).sort((a, b) => b - a)
  const t = dayNum(today)
  const empty: StreakState = { streak: 0, today_done: false, chain_start: null, freeze_available: true, next_milestone: MILESTONES[0] }
  if (!uniq.length || uniq[0] > t) return empty
  let lastFreeze: number | null = null
  const freezeOk = (at: number) => lastFreeze === null || lastFreeze - at >= 7
  const gapToToday = t - uniq[0]
  if (gapToToday === 2) lastFreeze = t - 1
  else if (gapToToday > 2) return { ...empty }
  let streak = 1
  let start = uniq[0]
  for (let i = 1; i < uniq.length; i++) {
    const gap = uniq[i - 1] - uniq[i]
    if (gap === 1) {
      streak++
      start = uniq[i]
    } else if (gap === 2 && freezeOk(uniq[i - 1] - 1)) {
      lastFreeze = uniq[i - 1] - 1
      streak++
      start = uniq[i]
    } else break
  }
  return {
    streak,
    today_done: uniq[0] === t,
    chain_start: new Date(start * DAY_MS).toISOString().slice(0, 10),
    freeze_available: freezeOk(t),
    next_milestone: MILESTONES.find(m => m > streak) ?? null,
  }
}

export async function pointsRules(sql: Sql = getDb()): Promise<PointsRules> {
  const r = await sql`SELECT value FROM app_settings WHERE key = 'mini_points'`
  const v = r[0]?.value as Partial<PointsRules> | undefined
  if (!v || !Number.isInteger(v.checkin) || (v.checkin as number) < 0 || !v.milestones || typeof v.milestones !== 'object') return DEFAULT_POINTS
  const milestones: Record<string, number> = {}
  for (const m of MILESTONES) {
    const pts = (v.milestones as Record<string, unknown>)[String(m)]
    if (Number.isInteger(pts) && (pts as number) >= 0) milestones[String(m)] = pts as number
  }
  return { checkin: v.checkin as number, milestones }
}

/** Khách đã xác minh → gộp theo khách; chưa → chỉ phiên này. */
const scopeCustomer = (s: SessionRow) => (s.verified && s.customer_id ? s.customer_id : null)
const childCustomer = scopeCustomer

// Đọc theo quy tắc chung với CRM: khách đã xác minh = các dòng có customer_id của khách (KHÔNG cộng thêm dòng của phiên:
// promoteMiniSession để customer_id NULL cho dòng trùng ngày/mốc giữa 2 máy, cộng vào sẽ tính trùng điểm);
// phiên chưa xác minh = các dòng của phiên.

async function checkinDays(s: SessionRow, sql: Sql): Promise<string[]> {
  const cid = scopeCustomer(s)
  const rows = cid
    ? await sql`SELECT to_char(day, 'YYYY-MM-DD') AS d FROM daily_checkins WHERE customer_id = ${cid} ORDER BY day DESC LIMIT 400`
    : await sql`SELECT to_char(day, 'YYYY-MM-DD') AS d FROM daily_checkins WHERE mini_session_id = ${s.id} ORDER BY day DESC LIMIT 400`
  return rows.map(r => r.d as string)
}

export async function pointsBalance(s: SessionRow, sql: Sql = getDb()): Promise<number> {
  const cid = scopeCustomer(s)
  const r = cid
    ? await sql`SELECT COALESCE(SUM(delta), 0)::int AS n FROM points_ledger WHERE customer_id = ${cid}`
    : await sql`SELECT COALESCE(SUM(delta), 0)::int AS n FROM points_ledger WHERE mini_session_id = ${s.id}`
  return r[0].n
}

/** Tổng Hạt Cốm đã TÍCH (để xếp hạng thành viên): chỉ khoản cộng, bỏ khoản trả lại khi huỷ đơn. Tiêu điểm không làm tụt hạng. */
export async function pointsEarned(s: SessionRow, sql: Sql = getDb()): Promise<number> {
  const cid = scopeCustomer(s)
  const r = cid
    ? await sql`SELECT COALESCE(SUM(delta), 0)::int AS n FROM points_ledger WHERE customer_id = ${cid} AND delta > 0 AND reason <> 'hoan_don'`
    : await sql`SELECT COALESCE(SUM(delta), 0)::int AS n FROM points_ledger WHERE mini_session_id = ${s.id} AND delta > 0 AND reason <> 'hoan_don'`
  return r[0].n
}

export async function savedRecipes(s: SessionRow, sql: Sql = getDb()): Promise<string[]> {
  const cid = scopeCustomer(s)
  const rows = cid
    ? await sql`SELECT recipe_slug, MAX(created_at) AS t FROM saved_recipes WHERE customer_id = ${cid} GROUP BY recipe_slug ORDER BY t DESC`
    : await sql`SELECT recipe_slug FROM saved_recipes WHERE mini_session_id = ${s.id} ORDER BY created_at DESC`
  return rows.map(r => r.recipe_slug as string)
}

export function publicCheckin(st: StreakState) {
  return { today_done: st.today_done, streak: st.streak, next_milestone: st.next_milestone, freeze_available: st.freeze_available }
}

/** Phần v2-A gắn vào /me: điểm, luật điểm, trạng thái điểm danh, Sổ tay. */
export async function homeState(s: SessionRow, sql: Sql = getDb()) {
  try {
    const [rules, days, points, earned, saved] = await Promise.all([
      pointsRules(sql), checkinDays(s, sql), pointsBalance(s, sql), pointsEarned(s, sql), savedRecipes(s, sql),
    ])
    return { points, points_earned: earned, points_rules: rules, checkin: publicCheckin(computeStreak(days, vnDay())), saved_recipes: saved }
  } catch (e) {
    // Bảng v2-A chưa được tạo (phiên CRM giữ migration): /me vẫn chạy với giá trị rỗng thay vì lỗi cả trang.
    if ((e as { code?: string }).code !== '42P01') throw e
    return { points: 0, points_earned: 0, points_rules: DEFAULT_POINTS, checkin: publicCheckin(computeStreak([], vnDay())), saved_recipes: [] as string[] }
  }
}

const isUniqueViolation = (e: unknown) => (e as { code?: string }).code === '23505'

/** Ghi một khoản Hạt Cốm; trùng khoá (reason, ref) thì bỏ qua. Trả true nếu đã ghi. */
async function addPoints(s: SessionRow, reason: 'diem_danh' | 'moc_chuoi', ref: string, delta: number, sql: Sql): Promise<boolean> {
  if (delta <= 0) return false
  try {
    const r = await sql`
      INSERT INTO points_ledger (mini_session_id, customer_id, delta, reason, ref)
      VALUES (${s.id}, ${childCustomer(s)}, ${delta}, ${reason}, ${ref})
      ON CONFLICT (mini_session_id, reason, ref) DO NOTHING RETURNING id`
    return r.length > 0
  } catch (e) {
    if (isUniqueViolation(e)) return false // khách đã nhận khoản này ở phiên/máy khác
    throw e
  }
}

export async function checkin(sessionId: number | null, sql: Sql = getDb()) {
  const s = await loadSession(sessionId, sql)
  if (!s) throw noSession()
  const today = vnDay()
  let inserted = false
  try {
    const r = await sql`
      INSERT INTO daily_checkins (mini_session_id, customer_id, day)
      VALUES (${s.id}, ${childCustomer(s)}, ${today})
      ON CONFLICT (mini_session_id, day) DO NOTHING RETURNING id`
    inserted = r.length > 0
  } catch (e) {
    if (!isUniqueViolation(e)) throw e // khách đã điểm danh hôm nay bằng máy khác
  }

  const rules = await pointsRules(sql)
  const earned: { reason: 'diem_danh' | 'moc_chuoi'; points: number; milestone?: number }[] = []
  const st = computeStreak(await checkinDays(s, sql), today)
  if (inserted) {
    if (await addPoints(s, 'diem_danh', today, rules.checkin, sql)) earned.push({ reason: 'diem_danh', points: rules.checkin })
    const bonus = rules.milestones[String(st.streak)]
    if (bonus && st.chain_start && (await addPoints(s, 'moc_chuoi', `${st.streak}@${st.chain_start}`, bonus, sql))) {
      earned.push({ reason: 'moc_chuoi', points: bonus, milestone: st.streak })
    }
  }
  return { checkin: publicCheckin(st), earned, points: await pointsBalance(s, sql) }
}

export async function saveRecipe(sessionId: number | null, slugRaw: unknown, savedRaw: unknown, sql: Sql = getDb()) {
  const s = await loadSession(sessionId, sql)
  if (!s) throw noSession()
  const slug = typeof slugRaw === 'string' ? slugRaw : ''
  if (!/^[a-z0-9-]{2,60}$/.test(slug) || typeof savedRaw !== 'boolean') throw badRequest()
  if (savedRaw) {
    const n = await sql`SELECT COUNT(*)::int AS n FROM saved_recipes WHERE mini_session_id = ${s.id}`
    if (n[0].n >= MAX_SAVED) throw new MiniError(400, 'too_many_saved', 'Sổ tay đã đầy, chị bỏ bớt món cũ giúp Cô nhé.')
    await sql`
      INSERT INTO saved_recipes (mini_session_id, customer_id, recipe_slug)
      VALUES (${s.id}, ${childCustomer(s)}, ${slug})
      ON CONFLICT (mini_session_id, recipe_slug) DO NOTHING`
  } else {
    const cid = scopeCustomer(s)
    if (cid) await sql`DELETE FROM saved_recipes WHERE recipe_slug = ${slug} AND (customer_id = ${cid} OR mini_session_id = ${s.id})`
    else await sql`DELETE FROM saved_recipes WHERE recipe_slug = ${slug} AND mini_session_id = ${s.id}`
  }
  return { saved_recipes: await savedRecipes(s, sql) }
}
