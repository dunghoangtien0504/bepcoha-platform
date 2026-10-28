import { getDb } from '@/lib/db'
import { requireCrm, handle, HttpError, can, clientIp } from '@/lib/crm/session'
import { managesDept } from '@/lib/crm/permissions'
import { logAction } from '@/lib/crm/audit'
import { isTaskResult, TASK_RESULTS } from '@/lib/crm/tasks'

type Ctx = { params: Promise<{ id: string }> }

/**
 * Cập nhật việc:
 *  - người được giao: bắt đầu / hoàn thành (kèm kết quả, ghi chú, LÝ DO nếu làm khác gợi ý — B2 Z04) / bỏ qua (bắt buộc lý do)
 *  - quản lý (viec.giao): giao lại người khác, duyệt kết quả trong 24h
 */
export const PATCH = handle(async (req: Request, ctx: Ctx) => {
  const user = await requireCrm('viec.cua_toi')
  const id = Number((await ctx.params).id)
  if (!Number.isInteger(id)) throw new HttpError(400, 'Mã việc không hợp lệ')
  const b = await req.json().catch(() => ({}))
  const sql = getDb()
  const ip = clientIp(req)

  return sql.begin(async tx => {
    const t = tx as unknown as typeof sql
    const task = (await t`SELECT * FROM crm_tasks WHERE id = ${id} FOR UPDATE`)[0]
    if (!task) throw new HttpError(404, 'Không tìm thấy việc')
    const isOwner = task.assigned_staff_id === user.id
    // Quản lý chỉ thao tác việc của bộ phận mình (theo bộ phận ghi trên việc, không có thì theo người được giao)
    const taskDept = task.department ?? (task.assigned_staff_id ? (await t`SELECT department FROM staff WHERE id = ${task.assigned_staff_id}`)[0]?.department : null)
    const isManager = can(user, 'viec.giao') && managesDept(user, taskDept)
    if (!isOwner && !isManager) throw new HttpError(403, 'Việc này không giao cho bạn và không thuộc bộ phận bạn quản lý')
    const internal = task.source === 'kho_viec' || task.kind === 'noi_bo'

    const action = String(b.action || '')
    if (action === 'checklist') {
      // Lưu từng dấu tick ngay khi bấm (tải lại trang không mất)
      if (!isOwner) throw new HttpError(403, 'Chỉ người làm việc này được đánh dấu')
      if (!Array.isArray(b.checklist)) throw new HttpError(400, 'Thiếu danh sách')
      const list = b.checklist.slice(0, 30).map((c: { text?: unknown; done?: unknown }) => ({ text: String(c?.text ?? '').slice(0, 300), done: !!c?.done }))
      await t`UPDATE crm_tasks SET checklist = ${t.json(list)}, status = CASE WHEN status = 'can_lam' THEN 'dang_lam' ELSE status END WHERE id = ${id}`
    } else if (action === 'start') {
      await t`UPDATE crm_tasks SET status = 'dang_lam' WHERE id = ${id} AND status = 'can_lam'`
    } else if (action === 'done' || action === 'skip') {
      const note = String(b.result_note || '').trim().slice(0, 2000)
      const reason = String(b.edit_reason || '').trim().slice(0, 1000)
      if (action === 'skip' && !reason) throw new HttpError(400, 'Bỏ qua việc cần ghi lý do')
      if (b.deviated && !reason) throw new HttpError(400, 'Bạn làm khác gợi ý: ghi lý do để hệ thống học lại')
      // Việc trong ca (kho việc / nội bộ) không có "kết quả với khách": xong là xong
      const result = action === 'done' ? (internal && !b.result ? 'da_xong' : b.result) : null
      if (action === 'done' && !isTaskResult(result)) throw new HttpError(400, 'Chọn kết quả')
      const checklist = Array.isArray(b.checklist) ? b.checklist.slice(0, 30) : task.checklist
      const missing = (checklist as { done?: boolean }[]).filter(c => !c?.done).length
      if (action === 'done' && missing && !reason) throw new HttpError(400, `Còn ${missing} mục chưa đánh dấu: làm đủ, hoặc ghi lý do`)
      await t`UPDATE crm_tasks SET status = ${action === 'done' ? 'xong' : 'bo_qua'}, result = ${result}, result_note = ${note},
                edit_reason = ${reason}, done_at = NOW(), checklist = ${t.json(checklist)} WHERE id = ${id}`
      if (action === 'done' && result === 'hen_lai') {
        // Hẹn gọi lại phải có giờ, và sinh ngay việc kế tiếp cho chính người này (không để rơi khách)
        const at = new Date(String(b.callback_at || ''))
        if (isNaN(at.getTime()) || at.getTime() < Date.now() - 60_000) throw new HttpError(400, 'Hẹn gọi lại: chọn ngày giờ gọi lại')
        await t`INSERT INTO crm_tasks (customer_id, title, kind, priority, due_at, assigned_staff_id, created_by, source, suggestion, department, auto_key)
                VALUES (${task.customer_id}, ${'Gọi lại: ' + String(task.title).replace(/^Gọi lại: /, '')}, ${task.kind}, 1, ${at}, ${task.assigned_staff_id ?? user.id},
                        ${user.id}, 'hen_lai', ${note ? 'Lần trước: ' + note : ''}, ${task.department}, ${'hen:' + id})
                ON CONFLICT (auto_key) WHERE auto_key IS NOT NULL DO NOTHING`
      }
      if (task.customer_id) {
        const content = `[${action === 'done' ? 'Xong' : 'Bỏ qua'}] ${task.title}${result ? ' → ' + TASK_RESULTS[result as keyof typeof TASK_RESULTS] : ''}${note ? ': ' + note : ''}${reason ? ' (lý do: ' + reason + ')' : ''}`
        await t`INSERT INTO customer_activities (customer_id, kind, content, staff_id) VALUES (${task.customer_id}, 'viec', ${content}, ${user.id})`
        if (result && result !== 'khong_nghe') await t`UPDATE customers SET last_contact_at = NOW() WHERE id = ${task.customer_id}`
        if (result === 'tu_choi') await t`UPDATE customers SET opted_out_at = COALESCE(opted_out_at, NOW()) WHERE id = ${task.customer_id}`
        if (result === 'chot_don') await t`UPDATE customers SET stage = 'da_chot', updated_at = NOW() WHERE id = ${task.customer_id}`
      }
    } else if (action === 'reassign') {
      if (!isManager) throw new HttpError(403, 'Chỉ quản lý được giao lại việc')
      const to = Number(b.staff_id)
      const ok = (await t`SELECT department FROM staff WHERE id = ${to} AND status = 'active'`)[0]
      if (!ok) throw new HttpError(400, 'Nhân viên không hợp lệ')
      if (!managesDept(user, ok.department)) throw new HttpError(403, 'Chỉ giao được cho nhân viên bộ phận mình')
      await t`UPDATE crm_tasks SET assigned_staff_id = ${to} WHERE id = ${id}`
    } else if (action === 'review') {
      if (!isManager) throw new HttpError(403, 'Chỉ quản lý được duyệt việc')
      if (task.status !== 'xong' && task.status !== 'bo_qua') throw new HttpError(400, 'Việc chưa hoàn thành')
      await t`UPDATE crm_tasks SET reviewed_by = ${user.id}, reviewed_at = NOW(), review_note = ${String(b.review_note || '').slice(0, 1000)} WHERE id = ${id}`
    } else if (action === 'reopen') {
      if (!isManager) throw new HttpError(403, 'Chỉ quản lý được mở lại việc')
      await t`UPDATE crm_tasks SET status = 'can_lam', done_at = NULL, result = NULL WHERE id = ${id}`
    } else {
      throw new HttpError(400, 'Thao tác không hợp lệ')
    }
    const after = (await t`SELECT id, status, result, assigned_staff_id, edit_reason, reviewed_at FROM crm_tasks WHERE id = ${id}`)[0]
    await logAction({ actorId: user.id, action: 'TASK_' + action.toUpperCase(), table: 'crm_tasks', recordId: id,
      before: { status: task.status, result: task.result, assigned_staff_id: task.assigned_staff_id }, after, reason: b.edit_reason || null, ip }, t)
    return Response.json({ ok: true, task: after })
  })
})
