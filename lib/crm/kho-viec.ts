// Kho việc (Buổi 2 · Easymart, phần 11–12): kho việc cha → việc con → bộ phận → từng người theo ca.
// Nhân viên vừa chấm công vào ca là có danh sách việc của ca (5–10 việc), mỗi việc là một checklist.
// Biết trước hôm nay có mấy việc thì người ta tự sắp xếp làm đủ (định luật Parkinson, phút 1:59).
import { getDb } from '../db'
import { logAction } from './audit'
import { DEPARTMENTS, type Department } from './permissions'

type Sql = ReturnType<typeof getDb>
const TZ = 'Asia/Ho_Chi_Minh'

export const REPEAT_LABEL = { moi_ca: 'Mỗi ca', hang_ngay: 'Mỗi ngày (1 lần)', hang_tuan: 'Mỗi tuần (1 lần)' } as const
export type Repeat = keyof typeof REPEAT_LABEL

export class KhoViecError extends Error {}

export interface TemplateInput {
  department: Department; group_name: string; title: string; checklist: string[]
  repeat: Repeat; due_offset_min: number | null; shift_code: string | null; sort: number
}

export function parseTemplate(b: Record<string, unknown>): TemplateInput {
  const department = String(b.department || '') as Department
  if (!(DEPARTMENTS as readonly string[]).includes(department)) throw new KhoViecError('Chọn bộ phận')
  const title = String(b.title || '').trim().slice(0, 200)
  if (!title) throw new KhoViecError('Nhập tên việc')
  const repeat = String(b.repeat || 'moi_ca') as Repeat
  if (!(repeat in REPEAT_LABEL)) throw new KhoViecError('Chọn tần suất')
  const items = (Array.isArray(b.checklist) ? b.checklist : String(b.checklist || '').split('\n'))
    .map(x => String(x).trim()).filter(Boolean).slice(0, 15)
  const off = b.due_offset_min === '' || b.due_offset_min == null ? null : Number(b.due_offset_min)
  if (off !== null && (!Number.isInteger(off) || off < 0 || off > 1440)) throw new KhoViecError('Hạn trong ca: số phút 0–1440 tính từ đầu ca')
  return {
    department, title, repeat, checklist: items, due_offset_min: off,
    group_name: String(b.group_name || '').trim().slice(0, 80),
    shift_code: String(b.shift_code || '').trim() || null,
    sort: Number.isInteger(Number(b.sort)) ? Number(b.sort) : 0,
  }
}

export async function listTemplates(sql: Sql = getDb()) {
  return sql`SELECT t.*, s.name AS updated_by_name FROM task_templates t LEFT JOIN staff s ON s.id = t.updated_by
             ORDER BY t.department, t.group_name, t.sort, t.id`
}

export async function saveTemplate(id: number | null, input: TemplateInput, staffId: number, ip: string, sql: Sql = getDb()) {
  const checklist = sql.json(input.checklist.map(text => ({ text, done: false })) as never)
  const row = id
    ? (await sql`UPDATE task_templates SET department = ${input.department}, group_name = ${input.group_name}, title = ${input.title},
                   checklist = ${checklist}, repeat = ${input.repeat}, due_offset_min = ${input.due_offset_min}, shift_code = ${input.shift_code},
                   sort = ${input.sort}, updated_by = ${staffId}, updated_at = NOW() WHERE id = ${id} RETURNING id`)[0]
    : (await sql`INSERT INTO task_templates (department, group_name, title, checklist, repeat, due_offset_min, shift_code, sort, active, source, updated_by)
                 VALUES (${input.department}, ${input.group_name}, ${input.title}, ${checklist}, ${input.repeat}, ${input.due_offset_min},
                         ${input.shift_code}, ${input.sort}, TRUE, 'tay', ${staffId}) RETURNING id`
        .catch(e => { if (String(e?.code) === '23505') throw new KhoViecError('Bộ phận này đã có việc trùng tên'); throw e }))[0]
  if (!row) throw new KhoViecError('Không tìm thấy việc trong kho')
  await logAction({ actorId: staffId, action: id ? 'UPDATE' : 'INSERT', table: 'task_templates', recordId: row.id, after: input, ip }, sql)
  return row.id as number
}

/** Bật (duyệt việc đề xuất) hoặc tắt một việc trong kho. */
export async function setTemplateActive(id: number, active: boolean, staffId: number, ip: string, sql: Sql = getDb()) {
  const r = await sql`UPDATE task_templates SET active = ${active}, source = 'tay', updated_by = ${staffId}, updated_at = NOW() WHERE id = ${id} RETURNING title`
  if (!r.length) throw new KhoViecError('Không tìm thấy việc trong kho')
  await logAction({ actorId: staffId, action: active ? 'ACTIVATE' : 'DEACTIVATE', table: 'task_templates', recordId: id, recordKey: r[0].title, ip }, sql)
}

/**
 * Sinh việc của ca cho một người (gọi khi chấm công vào ca). Chạy lại bao nhiêu lần cũng không trùng (auto_key):
 * mỗi ca → khoá theo lượt xếp ca; mỗi ngày → theo ngày; mỗi tuần → theo thứ Hai đầu tuần.
 */
export async function generateShiftTasks(staffId: number, assignmentId: number | null, sql: Sql = getDb()) {
  const ctx = (await sql`
    SELECT s.department, a.id AS assignment_id, a.work_date::text AS work_date, st.code AS shift_code,
           ((a.work_date + st.start_time) AT TIME ZONE ${TZ}) AS start_at,
           ((a.work_date + st.end_time + CASE WHEN st.end_time <= st.start_time THEN INTERVAL '1 day' ELSE INTERVAL '0' END) AT TIME ZONE ${TZ}) AS end_at
    FROM staff s
    LEFT JOIN shift_assignments a ON a.id = ${assignmentId} AND a.staff_id = s.id
    LEFT JOIN shift_templates st ON st.id = a.template_id
    WHERE s.id = ${staffId}`)[0]
  if (!ctx?.department) return 0
  const today = (await sql`SELECT (NOW() AT TIME ZONE ${TZ})::date::text AS d, date_trunc('week', NOW() AT TIME ZONE ${TZ})::date::text AS w`)[0]
  const day = ctx.work_date ?? today.d
  const start: Date = ctx.start_at ?? new Date()
  const end: Date = ctx.end_at ?? new Date(Date.now() + 8 * 3600_000)
  const rows = await sql`
    INSERT INTO crm_tasks (title, kind, priority, due_at, assigned_staff_id, created_by, source, checklist, department, auto_key, description)
    SELECT t.title, 'noi_bo', 2,
           CASE WHEN t.due_offset_min IS NULL THEN ${end}::timestamptz ELSE ${start}::timestamptz + make_interval(mins => t.due_offset_min) END,
           ${staffId}, 0, 'kho_viec', t.checklist, t.department,
           CASE t.repeat WHEN 'moi_ca' THEN ${'kv:ca:' + (ctx.assignment_id ?? 'x' + day) + ':' + staffId + ':'} || t.id
                         WHEN 'hang_ngay' THEN ${'kv:ngay:' + day + ':' + staffId + ':'} || t.id
                         ELSE ${'kv:tuan:' + today.w + ':' + staffId + ':'} || t.id END,
           COALESCE(NULLIF(t.group_name, ''), 'Kho việc')
    FROM task_templates t
    WHERE t.active AND t.department = ${ctx.department} AND (t.shift_code IS NULL OR t.shift_code = ${ctx.shift_code ?? null})
    ORDER BY t.group_name, t.sort, t.id
    ON CONFLICT (auto_key) WHERE auto_key IS NOT NULL DO NOTHING
    RETURNING id`
  return rows.length
}

// Thứ tự ưu tiên việc chăm khách khi phải chọn (phản biện CEO/COO 27/10): sau giao → kết quả → khách lớn → khách hỏi → đánh thức
const CARE_ORDER = ['sau_giao', 'hoi_ket_qua', 'ai_gui_tin', 'goi_vip', 'khach_hoi', 'goi_y_tiep', 'sinh_nhat', 'gioi_thieu', 'danh_thuc']
/** Trần việc chăm khách hiện trên "Hôm nay" mỗi người (phần dư vẫn nằm ở trang Việc). Tuần đầu 15, đo thật rồi mới nâng. */
export const CARE_CAP_PER_DAY = 15

/** Bảng "Hôm nay" của một người: việc mở tới hết hôm nay (kể cả quá hạn) + việc xong hôm nay. Đếm trên toàn bộ, chỉ hiện phần cần làm. */
export async function todayBoard(staffId: number, sql: Sql = getDb()) {
  const endToday = sql`(date_trunc('day', NOW() AT TIME ZONE ${TZ}) + INTERVAL '1 day') AT TIME ZONE ${TZ}`
  const startToday = sql`date_trunc('day', NOW() AT TIME ZONE ${TZ}) AT TIME ZONE ${TZ}`
  const [counts] = await sql`
    SELECT COUNT(*) FILTER (WHERE status IN ('can_lam', 'dang_lam'))::int AS open,
           COUNT(*) FILTER (WHERE status IN ('can_lam', 'dang_lam') AND due_at < NOW())::int AS overdue,
           COUNT(*) FILTER (WHERE status IN ('can_lam', 'dang_lam') AND customer_id IS NOT NULL AND source <> 'kho_viec')::int AS care_open,
           COUNT(*) FILTER (WHERE status = 'xong' AND done_at >= ${startToday})::int AS done
    FROM crm_tasks
    WHERE assigned_staff_id = ${staffId} AND (
      (status IN ('can_lam', 'dang_lam') AND (due_at IS NULL OR due_at < ${endToday})) OR (status = 'xong' AND done_at >= ${startToday}))`
  const sel = sql`t.*, c.name AS customer_name, c.phone AS customer_phone, c.phone_verified_at, s.name AS assignee_name, r.name AS reviewer_name`
  const from = sql`crm_tasks t LEFT JOIN customers c ON c.id = t.customer_id LEFT JOIN staff s ON s.id = t.assigned_staff_id LEFT JOIN staff r ON r.id = t.reviewed_by`
  const [inShift, care, other, doneToday] = await Promise.all([
    sql`SELECT ${sel} FROM ${from} WHERE t.assigned_staff_id = ${staffId} AND t.status IN ('can_lam', 'dang_lam') AND t.customer_id IS NULL
          AND (t.due_at IS NULL OR t.due_at < ${endToday}) ORDER BY (t.source = 'kho_viec') DESC, t.due_at NULLS LAST, t.id LIMIT 30`,
    sql`SELECT ${sel} FROM ${from} WHERE t.assigned_staff_id = ${staffId} AND t.status IN ('can_lam', 'dang_lam') AND t.customer_id IS NOT NULL
          AND (t.due_at IS NULL OR t.due_at < ${endToday})
        ORDER BY array_position(${CARE_ORDER}::text[], t.kind) NULLS LAST, t.priority, t.due_at NULLS LAST, t.id LIMIT ${CARE_CAP_PER_DAY}`,
    Promise.resolve([]),
    sql`SELECT ${sel} FROM ${from} WHERE t.assigned_staff_id = ${staffId} AND t.status IN ('xong', 'bo_qua') AND t.done_at >= ${startToday} ORDER BY t.done_at DESC LIMIT 30`,
  ])
  const shown = inShift.length + care.length
  return {
    inShift, care, other, doneToday,
    open: counts.open, done: counts.done, overdue: counts.overdue, careOpen: counts.care_open,
    // Tiến độ tính trên phần việc thật sự được giao hôm nay (việc ca + tối đa 15 việc khách), không tính tồn đọng cũ
    total: shown + counts.done, hiddenCare: Math.max(0, counts.care_open - care.length),
  }
}
