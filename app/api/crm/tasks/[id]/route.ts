import { getDb } from '@/lib/db'
import { requireCrm, handle, HttpError, can, clientIp } from '@/lib/crm/session'
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
    const isManager = can(user, 'viec.giao')
    if (!isOwner && !isManager) throw new HttpError(403, 'Việc này không giao cho bạn')

    const action = String(b.action || '')
    if (action === 'start') {
      await t`UPDATE crm_tasks SET status = 'dang_lam' WHERE id = ${id} AND status = 'can_lam'`
    } else if (action === 'done' || action === 'skip') {
      const note = String(b.result_note || '').trim().slice(0, 2000)
      const reason = String(b.edit_reason || '').trim().slice(0, 1000)
      if (action === 'skip' && !reason) throw new HttpError(400, 'Bỏ qua việc cần ghi lý do')
      if (b.deviated && !reason) throw new HttpError(400, 'Bạn làm khác gợi ý: ghi lý do để hệ thống học lại')
      const result = action === 'done' ? b.result : null
      if (action === 'done' && !isTaskResult(result)) throw new HttpError(400, 'Chọn kết quả')
      const checklist = Array.isArray(b.checklist) ? b.checklist.slice(0, 30) : task.checklist
      await t`UPDATE crm_tasks SET status = ${action === 'done' ? 'xong' : 'bo_qua'}, result = ${result}, result_note = ${note},
                edit_reason = ${reason}, done_at = NOW(), checklist = ${t.json(checklist)} WHERE id = ${id}`
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
      const ok = (await t`SELECT 1 FROM staff WHERE id = ${to} AND status = 'active'`)[0]
      if (!ok) throw new HttpError(400, 'Nhân viên không hợp lệ')
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
