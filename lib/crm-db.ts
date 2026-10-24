import { getDb } from './db'

export const OPP_STAGES = ['moi', 'tu_van', 'bao_gia', 'dam_phan', 'da_chot', 'khong_chot'] as const
export type OppStage = typeof OPP_STAGES[number]

export interface Opportunity {
  id: number
  customer_id: number
  customer_name: string
  customer_phone: string
  title: string
  stage: OppStage
  value: number
  product_interest: string
  assigned_staff_id: number | null
  note: string
  created_at: string
  updated_at: string
  closed_at: string | null
}

export interface CrmTask {
  id: number
  customer_id: number | null
  customer_name: string | null
  opportunity_id: number | null
  title: string
  due_at: string | null
  done_at: string | null
  assigned_staff_id: number | null
  created_at: string
}

export async function listOpportunities(): Promise<Opportunity[]> {
  const sql = getDb()
  const rows = await sql`
    SELECT o.id, o.customer_id, o.title, o.stage, o.value::float8 AS value, o.product_interest,
           o.assigned_staff_id, o.note, o.created_at, o.updated_at, o.closed_at,
           c.name AS customer_name, c.phone AS customer_phone
    FROM opportunities o JOIN customers c ON c.id = o.customer_id
    ORDER BY o.updated_at DESC
  `
  return rows as unknown as Opportunity[]
}

export async function createOpportunity(d: {
  customerId: number; title: string; value?: number; productInterest?: string; assignedStaffId?: number | null; note?: string
}) {
  const sql = getDb()
  const rows = await sql`
    INSERT INTO opportunities (customer_id, title, value, product_interest, assigned_staff_id, note)
    VALUES (${d.customerId}, ${d.title}, ${d.value ?? 0}, ${d.productInterest ?? ''}, ${d.assignedStaffId ?? null}, ${d.note ?? ''})
    RETURNING id
  `
  return rows[0].id as number
}

export async function updateOpportunity(id: number, d: {
  stage?: OppStage; title?: string; value?: number; assignedStaffId?: number | null; note?: string
}) {
  const sql = getDb()
  const closing = d.stage === 'da_chot' || d.stage === 'khong_chot'
  const rows = await sql`
    UPDATE opportunities SET
      stage = COALESCE(${d.stage ?? null}, stage),
      title = COALESCE(${d.title ?? null}, title),
      value = COALESCE(${d.value ?? null}, value),
      note = COALESCE(${d.note ?? null}, note),
      assigned_staff_id = ${d.assignedStaffId === undefined ? sql`assigned_staff_id` : d.assignedStaffId},
      closed_at = ${d.stage === undefined ? sql`closed_at` : closing ? sql`COALESCE(closed_at, NOW())` : null},
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING id, customer_id, stage
  `
  return rows[0] as { id: number; customer_id: number; stage: OppStage } | undefined
}

export async function listTasks(opts: { includeDone?: boolean } = {}): Promise<CrmTask[]> {
  const sql = getDb()
  const rows = opts.includeDone
    ? await sql`SELECT t.*, c.name AS customer_name FROM crm_tasks t LEFT JOIN customers c ON c.id = t.customer_id ORDER BY t.done_at IS NOT NULL, t.due_at NULLS LAST, t.id DESC LIMIT 300`
    : await sql`SELECT t.*, c.name AS customer_name FROM crm_tasks t LEFT JOIN customers c ON c.id = t.customer_id WHERE t.done_at IS NULL ORDER BY t.due_at NULLS LAST, t.id DESC LIMIT 300`
  return rows as unknown as CrmTask[]
}

export async function createTask(d: {
  customerId?: number | null; opportunityId?: number | null; title: string; dueAt?: string | null; assignedStaffId?: number | null; createdBy: number
}) {
  const sql = getDb()
  const rows = await sql`
    INSERT INTO crm_tasks (customer_id, opportunity_id, title, due_at, assigned_staff_id, created_by)
    VALUES (${d.customerId ?? null}, ${d.opportunityId ?? null}, ${d.title}, ${d.dueAt ?? null}, ${d.assignedStaffId ?? null}, ${d.createdBy})
    RETURNING id
  `
  return rows[0].id as number
}

export async function setTaskDone(id: number, done: boolean) {
  const sql = getDb()
  const rows = await sql`UPDATE crm_tasks SET done_at = ${done ? sql`NOW()` : null} WHERE id = ${id} RETURNING id, customer_id`
  return rows[0] as { id: number; customer_id: number | null } | undefined
}

export async function addActivity(customerId: number, kind: string, content: string, staffId: number | null) {
  const sql = getDb()
  await sql`INSERT INTO customer_activities (customer_id, kind, content, staff_id) VALUES (${customerId}, ${kind}, ${content}, ${staffId})`
}

export async function getOverview() {
  const sql = getDb()
  const [c, o, t, byStage, sources] = await Promise.all([
    sql`SELECT
          COUNT(*) FILTER (WHERE first_seen_at >= date_trunc('month', NOW()))::int AS new_this_month,
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE assigned_staff_id IS NULL AND stage = 'moi')::int AS unassigned_new,
          COUNT(*) FILTER (WHERE order_count >= 1 AND total_spent > 0 AND opted_out_at IS NULL AND last_order_at <= NOW() - INTERVAL '30 days')::int AS need_care
        FROM customers`,
    sql`SELECT
          COUNT(*) FILTER (WHERE stage NOT IN ('da_chot','khong_chot'))::int AS open_count,
          COALESCE(SUM(value) FILTER (WHERE stage NOT IN ('da_chot','khong_chot')), 0)::float8 AS open_value,
          COUNT(*) FILTER (WHERE stage = 'da_chot' AND closed_at >= date_trunc('month', NOW()))::int AS won_month,
          COALESCE(SUM(value) FILTER (WHERE stage = 'da_chot' AND closed_at >= date_trunc('month', NOW())), 0)::float8 AS won_value_month,
          COUNT(*) FILTER (WHERE stage = 'da_chot')::int AS won_all,
          COUNT(*) FILTER (WHERE stage = 'khong_chot')::int AS lost_all
        FROM opportunities`,
    sql`SELECT
          COUNT(*) FILTER (WHERE done_at IS NULL)::int AS open_tasks,
          COUNT(*) FILTER (WHERE done_at IS NULL AND due_at < NOW())::int AS overdue_tasks
        FROM crm_tasks`,
    sql`SELECT stage, COUNT(*)::int AS count, COALESCE(SUM(value),0)::float8 AS value FROM opportunities GROUP BY stage`,
    sql`SELECT COALESCE(NULLIF(source,''),'local') AS source, COUNT(*)::int AS count FROM customers GROUP BY 1`,
  ])
  return { customers: c[0], opportunities: o[0], tasks: t[0], byStage, sources }
}

export async function getStaffPerformance() {
  const sql = getDb()
  return await sql`
    SELECT s.id, s.name,
      COUNT(o.id) FILTER (WHERE o.stage NOT IN ('da_chot','khong_chot'))::int AS open_count,
      COUNT(o.id) FILTER (WHERE o.stage = 'da_chot')::int AS won,
      COUNT(o.id) FILTER (WHERE o.stage = 'khong_chot')::int AS lost,
      COALESCE(SUM(o.value) FILTER (WHERE o.stage = 'da_chot'), 0)::float8 AS won_value,
      (SELECT COUNT(*)::int FROM crm_tasks t WHERE t.assigned_staff_id = s.id AND t.done_at IS NULL AND t.due_at < NOW()) AS overdue
    FROM staff s LEFT JOIN opportunities o ON o.assigned_staff_id = s.id
    WHERE s.status = 'active' GROUP BY s.id, s.name ORDER BY won_value DESC
  `
}
