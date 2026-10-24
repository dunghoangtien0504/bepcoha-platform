// Nhật ký thao tác (viên gạch "Nhật ký" — B2 Z03, Z06): mọi thay đổi qua CRM ghi ai, làm gì, trên bản ghi nào, lý do.
import { getDb } from '../db'

type Sql = ReturnType<typeof getDb>

export interface AuditEntry {
  actorType?: 'staff' | 'customer' | 'system' | 'agent'
  actorId: number | null
  action: string
  table: string
  recordId?: number | null
  recordKey?: string | null
  before?: unknown
  after?: unknown
  reason?: string | null
  ip?: string
}

export async function logAction(e: AuditEntry, sql: Sql = getDb()): Promise<void> {
  await sql`
    INSERT INTO audit_logs (user_id, actor_type, action, table_name, record_id, record_key, old_value, new_value, reason, ip_address)
    VALUES (${e.actorId}, ${e.actorType ?? 'staff'}, ${e.action}, ${e.table}, ${e.recordId ?? null}, ${e.recordKey ?? null},
            ${e.before === undefined ? null : sql.json(e.before as never)}, ${e.after === undefined ? null : sql.json(e.after as never)},
            ${e.reason ?? null}, ${e.ip ?? ''})
  `
}

export async function listAudit(opts: { table?: string; actorId?: number; limit?: number; before?: number } = {}) {
  const sql = getDb()
  const limit = Math.min(opts.limit ?? 100, 500)
  return sql`
    SELECT a.id, a.created_at, a.actor_type, a.user_id, COALESCE(s.name, CASE a.actor_type WHEN 'system' THEN 'Hệ thống' WHEN 'customer' THEN 'Khách' ELSE '—' END) AS actor_name,
           a.action, a.table_name, a.record_id, a.record_key, a.old_value, a.new_value, a.reason, a.ip_address
    FROM audit_logs a LEFT JOIN staff s ON s.id = a.user_id AND a.actor_type IN ('staff', 'agent')
    WHERE (${opts.table ?? null}::text IS NULL OR a.table_name = ${opts.table ?? null})
      AND (${opts.actorId ?? null}::int IS NULL OR a.user_id = ${opts.actorId ?? null})
      AND (${opts.before ?? null}::int IS NULL OR a.id < ${opts.before ?? null})
    ORDER BY a.id DESC LIMIT ${limit}
  `
}
