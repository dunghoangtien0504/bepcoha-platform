import { getDb } from '@/lib/db'
import { requireCrm, handle, HttpError, clientIp } from '@/lib/crm/session'
import { logAction } from '@/lib/crm/audit'
import { generateDailyTasks, isTaskKind, listTasks } from '@/lib/crm/tasks'

/** Danh sách việc (dùng cho agent/AI gọi bằng quyền của người dùng). */
export const GET = handle(async (req: Request) => {
  const user = await requireCrm('viec.cua_toi')
  const u = new URL(req.url)
  const mine = u.searchParams.get('scope') !== 'all'
  if (!mine) await requireCrm('viec.giao')
  const rows = await listTasks({ staffId: mine ? user.id : null, status: (u.searchParams.get('status') as 'mo' | 'xong' | 'tat_ca') || 'mo' })
  return Response.json({ tasks: rows })
})

/** Tạo việc tay, hoặc chạy bộ sinh việc tự động (action = 'generate'). */
export const POST = handle(async (req: Request) => {
  const b = await req.json().catch(() => ({}))
  const ip = clientIp(req)
  if (b.action === 'generate') {
    const user = await requireCrm('viec.giao')
    const out = await generateDailyTasks()
    await logAction({ actorId: user.id, action: 'GENERATE_TASKS_MANUAL', table: 'crm_tasks', after: out, ip })
    return Response.json({ ok: true, created: out })
  }
  const user = await requireCrm('viec.cua_toi')
  const title = String(b.title || '').trim().slice(0, 300)
  if (!title) throw new HttpError(400, 'Nhập tên việc')
  const kind = isTaskKind(b.kind) ? b.kind : 'noi_bo'
  // Nhân viên thường chỉ tự tạo việc cho mình; quản lý giao được cho người khác
  const assignee = Number(b.assigned_staff_id) || user.id
  if (assignee !== user.id) await requireCrm('viec.giao')
  const sql = getDb()
  const customerId = b.customer_id ? Number(b.customer_id) : null
  const due = b.due_at ? new Date(b.due_at) : null
  if (due && isNaN(due.getTime())) throw new HttpError(400, 'Hạn không hợp lệ')
  const row = (await sql`
    INSERT INTO crm_tasks (customer_id, title, kind, priority, due_at, assigned_staff_id, created_by, source, description, department)
    VALUES (${customerId}, ${title}, ${kind}, ${[1, 2, 3].includes(Number(b.priority)) ? Number(b.priority) : 2}, ${due}, ${assignee},
            ${user.id}, 'tay', ${String(b.description || '').slice(0, 2000)}, ${user.department})
    RETURNING id`)[0]
  await logAction({ actorId: user.id, action: 'INSERT', table: 'crm_tasks', recordId: row.id, after: { title, assignee, customerId }, ip })
  return Response.json({ ok: true, id: row.id })
})
