// Dự án & hạn chót (Asana/Monday thu gọn cho HACO; phản biện CEO 27/10: chỉ giữ dự án = nhóm việc có hạn chót,
// % xong, số việc trễ, và mẫu "Chiến dịch Tết").
// Việc của dự án là việc thường trong crm_tasks (source 'du_an') → tự hiện ở "Việc của tôi", "Hôm nay" khi tới hạn
// và hộp duyệt 24h. Không có hệ thống việc thứ hai. Bảng nối project_tasks, không thêm cột vào crm_tasks.
import { getDb } from '../db'
import { logAction } from './audit'
import { DEPARTMENTS, DEPARTMENT_LABEL, type Department } from './permissions'
import { TZ } from './attendance'

type Sql = ReturnType<typeof getDb>

export class DuAnError extends Error {}

let ready: Promise<void> | null = null
export function ensureDuAnSchema(sql: Sql = getDb()): Promise<void> {
  if (!ready) ready = (async () => {
    await sql.begin(async tx => {
      const t = tx as unknown as Sql
      await t`SELECT pg_advisory_xact_lock(4242090)`
      await t`
        CREATE TABLE IF NOT EXISTS projects (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          goal TEXT NOT NULL DEFAULT '',
          department TEXT,
          owner_id INT,
          start_date DATE NOT NULL DEFAULT CURRENT_DATE,
          deadline DATE NOT NULL,
          status TEXT NOT NULL DEFAULT 'dang_chay' CHECK (status IN ('dang_chay', 'xong', 'tam_dung')),
          template TEXT,
          created_by INT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`
      await t`
        CREATE TABLE IF NOT EXISTS project_tasks (
          project_id INT NOT NULL REFERENCES projects(id),
          task_id INT NOT NULL UNIQUE REFERENCES crm_tasks(id),
          PRIMARY KEY (project_id, task_id)
        )`
    })
  })().catch(e => { ready = null; throw e })
  return ready
}

// ───────────────────────── Mẫu dự án ─────────────────────────
export interface TemplateTask { department: Department; title: string; daysBefore: number; checklist?: string[] }
export interface ProjectTemplate { key: string; name: string; goal: string; hint: string; tasks: TemplateTask[] }

/**
 * Chiến dịch Tết: hạn chót = ngày chốt đơn giao trước Tết (Tết Đinh Mùi 6/2/2027 → gợi ý 28/1/2027).
 * Hạn từng việc = hạn chót − N ngày. Gồm cả bán lẻ (bếp, kho, sale, sàn, marketing) và đào tạo (lớp nấu ăn mùa Tết).
 */
export const TEMPLATES: Record<string, ProjectTemplate> = {
  tet: {
    key: 'tet', name: 'Chiến dịch Tết', goal: 'Bán quà Tết (sét xôi, cốm, dưa cà, sốt) + mở lớp nấu ăn mùa Tết; giao xong trước Tết.',
    hint: 'Hạn chót = ngày chốt đơn cuối giao trước Tết (gợi ý 28/01/2027).',
    tasks: [
      { department: 'ban_giam_doc', title: 'Chốt danh mục quà Tết và giá bán', daysBefore: 90, checklist: ['Danh sách sét quà', 'Giá lẻ, giá sỉ', 'Giá vốn từng sét'] },
      { department: 'ban_giam_doc', title: 'Chốt mục tiêu doanh thu và ngân sách Tết', daysBefore: 80 },
      { department: 'bep', title: 'Làm mẫu sét quà Tết để chụp ảnh', daysBefore: 75 },
      { department: 'bep', title: 'Kế hoạch nguyên liệu Tết, đặt nhà cung cấp (nếp, cốm, đỗ…)', daysBefore: 45, checklist: ['Ước số lượng theo mục tiêu', 'Báo giá 2 nhà cung cấp', 'Đặt cọc'] },
      { department: 'bep', title: 'Sản xuất đợt 1', daysBefore: 20 },
      { department: 'bep', title: 'Sản xuất đợt 2 (cao điểm)', daysBefore: 10 },
      { department: 'kho_van', title: 'Đặt hộp, túi, thiệp, tem Tết', daysBefore: 60 },
      { department: 'kho_van', title: 'Kiểm kho bao bì và vật tư Tết', daysBefore: 30 },
      { department: 'kho_van', title: 'Chuẩn bị khu đóng gói cao điểm, chốt đơn vị vận chuyển', daysBefore: 15 },
      { department: 'marketing', title: 'Chụp ảnh, quay video sét quà Tết', daysBefore: 70 },
      { department: 'marketing', title: 'Lịch nội dung Tết (Facebook, TikTok, Zalo OA)', daysBefore: 60 },
      { department: 'marketing', title: 'Mở bán sớm: ưu đãi đặt trước', daysBefore: 45 },
      { department: 'marketing', title: 'Đẩy truyền thông cao điểm', daysBefore: 14 },
      { department: 'sale_cskh', title: 'Kịch bản tư vấn và bảng giá quà Tết doanh nghiệp', daysBefore: 50 },
      { department: 'sale_cskh', title: 'Gọi khách lớn, khách doanh nghiệp năm trước', daysBefore: 40 },
      { department: 'sale_cskh', title: 'Chốt danh sách đơn giao trước Tết, báo khách lịch nghỉ', daysBefore: 7 },
      { department: 'san_tmdt', title: 'Đăng ký chương trình Tết trên Shopee, TikTok', daysBefore: 45 },
      { department: 'san_tmdt', title: 'Lên sản phẩm sét quà Tết trên sàn', daysBefore: 30 },
      { department: 'san_tmdt', title: 'Cài lịch nghỉ Tết trên sàn', daysBefore: 5 },
      { department: 'dao_tao', title: 'Thiết kế lớp nấu ăn mùa Tết (bánh chưng, mứt, xôi gấc)', daysBefore: 60 },
      { department: 'dao_tao', title: 'Tuyển sinh, chốt lịch lớp Tết', daysBefore: 30 },
      { department: 'dao_tao', title: 'Chuẩn bị nguyên liệu và bài giảng lớp Tết', daysBefore: 14 },
    ],
  },
}

// ───────────────────────── Tạo / sửa ─────────────────────────
export interface Actor { id: number; role: string; department: string | null }
const isBoss = (u: Actor) => u.role === 'admin' || u.department === 'ban_giam_doc'

function parseDate(v: unknown, label: string): string {
  const s = String(v || '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || isNaN(Date.parse(s + 'T00:00:00Z'))) throw new DuAnError(`${label} không hợp lệ`)
  return s
}

/** Hạn của việc: 17:00 giờ Việt Nam, ngày = hạn chót − N ngày (không sớm hơn hôm nay). */
export function dueFor(deadline: string, daysBefore: number, today: string): string {
  const d = new Date(deadline + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - daysBefore)
  const day = d.toISOString().slice(0, 10)
  return (day < today ? today : day) + 'T17:00:00+07:00'
}

async function defaultAssignee(t: Sql, department: string): Promise<number | null> {
  const r = (await t`SELECT id FROM staff WHERE status = 'active' AND department = ${department} ORDER BY (role = 'quan_ly') DESC, id LIMIT 1`)[0]
  return r ? Number(r.id) : null
}

export async function createProject(user: Actor, b: Record<string, unknown>, ip: string, sql: Sql = getDb()) {
  await ensureDuAnSchema(sql)
  const name = String(b.name || '').trim().slice(0, 150)
  if (!name) throw new DuAnError('Nhập tên dự án')
  const deadline = parseDate(b.deadline, 'Hạn chót')
  const today = new Date().toLocaleDateString('en-CA', { timeZone: TZ })
  if (deadline < today) throw new DuAnError('Hạn chót phải từ hôm nay trở đi')
  const department = (DEPARTMENTS as readonly string[]).includes(String(b.department)) ? String(b.department) : user.department
  if (!isBoss(user) && department !== user.department) throw new DuAnError('Chỉ tạo dự án cho bộ phận mình')
  const tpl = b.template ? TEMPLATES[String(b.template)] : null
  if (b.template && !tpl) throw new DuAnError('Không có mẫu này')
  // Mẫu có việc cho nhiều bộ phận → chỉ ban giám đốc/quản trị dùng được
  if (tpl && !isBoss(user)) throw new DuAnError('Mẫu liên phòng ban chỉ ban giám đốc tạo được')
  return sql.begin(async tx => {
    const t = tx as unknown as Sql
    const p = (await t`
      INSERT INTO projects (name, goal, department, owner_id, deadline, template, created_by)
      VALUES (${name}, ${String(b.goal || tpl?.goal || '').slice(0, 500)}, ${department}, ${Number(b.owner_id) || user.id}, ${deadline}, ${tpl?.key ?? null}, ${user.id})
      RETURNING *`)[0]
    let created = 0
    for (const task of tpl?.tasks ?? []) {
      await insertTask(t, p.id, name, {
        title: task.title, department: task.department, due_at: dueFor(deadline, task.daysBefore, today),
        assigned_staff_id: await defaultAssignee(t, task.department), checklist: task.checklist ?? [],
      }, user.id)
      created++
    }
    await logAction({ actorId: user.id, action: 'INSERT', table: 'projects', recordId: p.id, after: { ...p, tasks: created }, ip }, t)
    return { project: p, tasks: created }
  })
}

interface TaskInput { title: string; department: string; due_at: string; assigned_staff_id: number | null; checklist: string[]; description?: string }

async function insertTask(t: Sql, projectId: number, projectName: string, x: TaskInput, by: number) {
  const row = (await t`
    INSERT INTO crm_tasks (title, kind, priority, due_at, assigned_staff_id, created_by, source, checklist, department, description)
    VALUES (${x.title}, 'noi_bo', 2, ${x.due_at}, ${x.assigned_staff_id}, ${by}, 'du_an',
            ${t.json(x.checklist.map(text => ({ text, done: false })) as never)}, ${x.department},
            ${('Dự án: ' + projectName + (x.description ? '\n' + x.description : '')).slice(0, 2000)})
    RETURNING id`)[0]
  await t`INSERT INTO project_tasks (project_id, task_id) VALUES (${projectId}, ${row.id})`
  return row.id as number
}

export async function addTask(user: Actor, projectId: number, b: Record<string, unknown>, ip: string, sql: Sql = getDb()) {
  await ensureDuAnSchema(sql)
  const p = (await sql`SELECT * FROM projects WHERE id = ${projectId}`)[0]
  if (!p) throw new DuAnError('Không tìm thấy dự án')
  const title = String(b.title || '').trim().slice(0, 300)
  if (!title) throw new DuAnError('Nhập tên việc')
  const department = String(b.department || p.department || user.department || '')
  if (!(DEPARTMENTS as readonly string[]).includes(department)) throw new DuAnError('Chọn bộ phận làm')
  if (!isBoss(user) && department !== user.department) throw new DuAnError('Chỉ giao việc cho bộ phận mình')
  const day = parseDate(b.due_date, 'Hạn')
  if (day > new Date(p.deadline).toISOString().slice(0, 10)) throw new DuAnError('Hạn việc không được sau hạn chót dự án')
  const assignee = b.assigned_staff_id ? Number(b.assigned_staff_id) : null
  if (assignee) {
    const s = (await sql`SELECT department FROM staff WHERE id = ${assignee} AND status = 'active'`)[0]
    if (!s) throw new DuAnError('Người làm không hợp lệ')
    if (!isBoss(user) && s.department !== user.department) throw new DuAnError('Chỉ giao cho người trong bộ phận mình')
  }
  const checklist = String(b.checklist || '').split('\n').map(s => s.trim()).filter(Boolean).slice(0, 15)
  return sql.begin(async tx => {
    const t = tx as unknown as Sql
    const id = await insertTask(t, projectId, p.name, { title, department, due_at: day + 'T17:00:00+07:00', assigned_staff_id: assignee, checklist,
      description: String(b.description || '').slice(0, 1500) }, user.id)
    await logAction({ actorId: user.id, action: 'INSERT', table: 'crm_tasks', recordId: id, after: { project: projectId, title, department, assignee, due: day }, ip }, t)
    return id
  })
}

/** Đổi hạn chót / trạng thái dự án: chỉ ban giám đốc (CEO: hạn chốt lúc giao, chỉ CEO được lùi). Bắt buộc lý do. */
export async function updateProject(user: Actor, id: number, b: Record<string, unknown>, ip: string, sql: Sql = getDb()) {
  await ensureDuAnSchema(sql)
  const before = (await sql`SELECT * FROM projects WHERE id = ${id}`)[0]
  if (!before) throw new DuAnError('Không tìm thấy dự án')
  const reason = String(b.reason || '').trim()
  const status = b.status ? String(b.status) : before.status
  if (!['dang_chay', 'xong', 'tam_dung'].includes(status)) throw new DuAnError('Trạng thái không hợp lệ')
  const deadline = b.deadline ? parseDate(b.deadline, 'Hạn chót') : new Date(before.deadline).toISOString().slice(0, 10)
  const moved = deadline !== new Date(before.deadline).toISOString().slice(0, 10)
  if (moved && !isBoss(user)) throw new DuAnError('Chỉ ban giám đốc được dời hạn chót')
  if (!isBoss(user) && before.department !== user.department) throw new DuAnError('Không phải dự án bộ phận mình')
  if (moved && !reason) throw new DuAnError('Dời hạn chót phải ghi lý do')
  const after = (await sql`UPDATE projects SET deadline = ${deadline}, status = ${status} WHERE id = ${id} RETURNING *`)[0]
  await logAction({ actorId: user.id, action: 'UPDATE', table: 'projects', recordId: id, before, after, reason, ip }, sql)
  return after
}

// ───────────────────────── Xem ─────────────────────────
const taskStats = (sql: Sql) => sql`
  COUNT(t.id)::int AS total,
  COUNT(t.id) FILTER (WHERE t.status IN ('xong', 'bo_qua'))::int AS done,
  COUNT(t.id) FILTER (WHERE t.status IN ('can_lam', 'dang_lam') AND t.due_at < NOW())::int AS late,
  COUNT(t.id) FILTER (WHERE t.status IN ('can_lam', 'dang_lam') AND t.due_at >= NOW() AND t.due_at < NOW() + INTERVAL '3 days')::int AS soon,
  COUNT(t.id) FILTER (WHERE t.assigned_staff_id IS NULL AND t.status IN ('can_lam', 'dang_lam'))::int AS unassigned`

export async function listProjects(sql: Sql = getDb()) {
  await ensureDuAnSchema(sql)
  return sql`
    SELECT p.*, p.deadline::text AS deadline_text, o.name AS owner_name, ${taskStats(sql)},
      (p.deadline - (NOW() AT TIME ZONE ${TZ})::date)::int AS days_left
    FROM projects p LEFT JOIN staff o ON o.id = p.owner_id
    LEFT JOIN project_tasks pt ON pt.project_id = p.id LEFT JOIN crm_tasks t ON t.id = pt.task_id
    GROUP BY p.id, o.name
    ORDER BY (p.status = 'dang_chay') DESC, COUNT(t.id) FILTER (WHERE t.status IN ('can_lam', 'dang_lam') AND t.due_at < NOW()) DESC, p.deadline`
}

export async function projectDetail(id: number, sql: Sql = getDb()) {
  await ensureDuAnSchema(sql)
  const p = (await sql`
    SELECT p.*, p.deadline::text AS deadline_text, o.name AS owner_name, (p.deadline - (NOW() AT TIME ZONE ${TZ})::date)::int AS days_left
    FROM projects p LEFT JOIN staff o ON o.id = p.owner_id WHERE p.id = ${id}`)[0]
  if (!p) return null
  const tasks = await sql`
    SELECT t.id, t.title, t.status, t.due_at, t.done_at, t.department, t.assigned_staff_id, t.reviewed_at, t.checklist, s.name AS assignee_name,
           (t.status IN ('can_lam', 'dang_lam') AND t.due_at < NOW()) AS is_late,
           (t.status IN ('can_lam', 'dang_lam') AND t.due_at >= NOW() AND t.due_at < NOW() + INTERVAL '3 days') AS is_soon
    FROM project_tasks pt JOIN crm_tasks t ON t.id = pt.task_id LEFT JOIN staff s ON s.id = t.assigned_staff_id
    WHERE pt.project_id = ${id} ORDER BY t.due_at NULLS LAST, t.id`
  const byDept = DEPARTMENTS.map(d => ({ department: d, label: DEPARTMENT_LABEL[d], tasks: tasks.filter(t => t.department === d) }))
    .filter(g => g.tasks.length)
  return { project: p, tasks, byDept }
}

/** Việc dự án của một người còn mở (để hiện riêng trên "Hôm nay": 7 ngày tới + trễ). */
export async function myProjectTasks(staffId: number, sql: Sql = getDb()) {
  await ensureDuAnSchema(sql)
  return sql`
    SELECT t.id, t.title, t.due_at, t.status, t.due_at < NOW() AS is_late, p.id AS project_id, p.name AS project_name
    FROM project_tasks pt JOIN crm_tasks t ON t.id = pt.task_id JOIN projects p ON p.id = pt.project_id
    WHERE t.assigned_staff_id = ${staffId} AND t.status IN ('can_lam', 'dang_lam') AND p.status = 'dang_chay'
      AND t.due_at < NOW() + INTERVAL '7 days'
    ORDER BY t.due_at LIMIT 8`
}
