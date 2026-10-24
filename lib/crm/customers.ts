// Khách hàng 360: danh sách có lọc theo nhóm A/B/C/D, vòng đời (F: số lần mua, R: độ mới), giai đoạn, người phụ trách.
import { getDb } from '../db'
export { LIFECYCLE, CUSTOMER_STAGE_LABEL, SEGMENT_LABEL, type Lifecycle } from './labels'

type Sql = ReturnType<typeof getDb>

export function lifecycleSql(sql: Sql) {
  return sql`CASE
    WHEN c.order_count = 0 OR c.last_order_at IS NULL THEN 'lead'
    WHEN c.last_order_at < NOW() - INTERVAL '120 days' THEN 'ngu_dong'
    WHEN c.last_order_at < NOW() - INTERVAL '60 days' THEN 'sap_ngu'
    WHEN c.order_count >= 2 THEN 'mua_lai'
    ELSE 'moi_mua' END`
}

export function maskPhone(p: string): string {
  return p && p.length >= 7 ? p.slice(0, 3) + '****' + p.slice(-3) : p
}

export interface CustomerFilter {
  q?: string; segment?: string; lifecycle?: string; stage?: string; channel?: string; assigned?: number | 'none' | null
  verified?: 'yes' | 'no'; sort?: 'last_order' | 'spent' | 'new'; page?: number; pageSize?: number
}

export async function listCustomers(f: CustomerFilter, sql: Sql = getDb()) {
  const size = Math.min(f.pageSize ?? 50, 200)
  const offset = Math.max(0, ((f.page ?? 1) - 1) * size)
  const q = (f.q || '').trim()
  const qDigits = q.replace(/\D/g, '')
  const lc = lifecycleSql(sql)
  const assignedCond = f.assigned === 'none' ? sql`c.assigned_staff_id IS NULL`
    : typeof f.assigned === 'number' ? sql`c.assigned_staff_id = ${f.assigned}` : sql`TRUE`
  const verifiedCond = f.verified === 'yes' ? sql`c.phone_verified_at IS NOT NULL`
    : f.verified === 'no' ? sql`c.phone_verified_at IS NULL` : sql`TRUE`
  const where = sql`
    (${q === ''} OR c.name ILIKE ${'%' + q + '%'} OR (${qDigits.length >= 3} AND c.phone LIKE ${'%' + qDigits + '%'}) OR c.referral_code = ${q.toUpperCase()})
    AND (${f.segment ?? null}::text IS NULL OR ${f.segment ?? null} = ANY(c.segments))
    AND (${f.lifecycle ?? null}::text IS NULL OR ${lc} = ${f.lifecycle ?? null})
    AND (${f.stage ?? null}::text IS NULL OR c.stage = ${f.stage ?? null})
    AND (${f.channel ?? null}::text IS NULL OR c.main_channel = ${f.channel ?? null})
    AND ${assignedCond} AND ${verifiedCond}`
  const order = f.sort === 'spent' ? sql`c.total_spent DESC, c.id DESC` : f.sort === 'new' ? sql`c.created_at DESC, c.id DESC` : sql`c.last_order_at DESC NULLS LAST, c.id DESC`
  const rows = await sql`
    SELECT c.id, c.name, c.phone, c.segments, c.stage, c.order_count, c.total_spent, c.last_order_at, c.first_order_at, c.main_channel,
           c.province, c.stars, c.opted_out_at, c.phone_verified_at, c.source, c.is_wholesale, c.assigned_staff_id, s.name AS assignee_name,
           ${lc} AS lifecycle
    FROM customers c LEFT JOIN staff s ON s.id = c.assigned_staff_id
    WHERE ${where} ORDER BY ${order} LIMIT ${size} OFFSET ${offset}`
  const [cnt] = await sql`SELECT COUNT(*)::int AS n FROM customers c WHERE ${where}`
  return { rows, total: cnt.n as number, page: f.page ?? 1, pageSize: size }
}

export async function lifecycleCounts(sql: Sql = getDb()) {
  const lc = lifecycleSql(sql)
  return sql`SELECT ${lc} AS lifecycle, COUNT(*)::int AS n FROM customers c GROUP BY 1`
}

export async function getCustomer360(id: number, sql: Sql = getDb()) {
  const lc = lifecycleSql(sql)
  const c = (await sql`
    SELECT c.*, ${lc} AS lifecycle, s.name AS assignee_name, r.name AS referrer_name
    FROM customers c LEFT JOIN staff s ON s.id = c.assigned_staff_id LEFT JOIN customers r ON r.id = c.referred_by
    WHERE c.id = ${id}`)[0]
  if (!c) return null
  const [orders, tasks, activities, opps, consents, claims, rewards, mini, referred] = await Promise.all([
    sql`SELECT pos_order_id, platform, status, status_name, is_real, total, revenue, items, product_lines, inserted_at, tracking_code, seller_name
        FROM pancake_orders WHERE customer_id = ${id} ORDER BY inserted_at DESC LIMIT 100`,
    sql`SELECT t.id, t.title, t.kind, t.status, t.result, t.result_note, t.edit_reason, t.due_at, t.done_at, t.created_at, s.name AS assignee_name
        FROM crm_tasks t LEFT JOIN staff s ON s.id = t.assigned_staff_id WHERE t.customer_id = ${id} ORDER BY t.created_at DESC LIMIT 50`,
    sql`SELECT a.id, a.kind, a.content, a.created_at, s.name AS staff_name FROM customer_activities a LEFT JOIN staff s ON s.id = a.staff_id
        WHERE a.customer_id = ${id} ORDER BY a.created_at DESC LIMIT 100`,
    sql`SELECT id, title, pipeline, stage, value, product_interest, updated_at, next_step_at FROM opportunities WHERE customer_id = ${id} ORDER BY updated_at DESC`,
    sql`SELECT channel, purpose, text_version, verified, granted_at, revoked_at, source FROM consents WHERE customer_id = ${id} ORDER BY granted_at DESC`,
    sql`SELECT id, order_ref_raw, platform, status, lookup_result, created_at FROM order_claims WHERE customer_id = ${id} ORDER BY created_at DESC`,
    sql`SELECT kind, program, amount, code, status, expires_at, created_at FROM reward_ledger WHERE customer_id = ${id} ORDER BY created_at DESC`,
    sql`SELECT m.id, m.batch_code, m.verified, m.verified_via, m.created_at,
          (SELECT MAX(lesson_no) FROM lesson_progress lp WHERE lp.mini_session_id = m.id AND lp.completed_at IS NOT NULL) AS lessons_done
        FROM mini_sessions m WHERE m.customer_id = ${id} ORDER BY m.created_at DESC`,
    sql`SELECT id, name, order_count FROM customers WHERE referred_by = ${id} ORDER BY id DESC LIMIT 20`,
  ])
  const lineCounts = new Map<string, number>()
  for (const o of orders) if (o.is_real) for (const l of (o.product_lines as string[])) lineCounts.set(l, (lineCounts.get(l) ?? 0) + 1)
  return { customer: c, orders, tasks, activities, opportunities: opps, consents, claims, rewards, mini, referred, lines: [...lineCounts.entries()].sort((a, b) => b[1] - a[1]) }
}
