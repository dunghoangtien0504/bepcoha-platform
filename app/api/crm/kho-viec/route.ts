import { requireCrm, handle, HttpError, clientIp } from '@/lib/crm/session'
import { getDb } from '@/lib/db'
import { managesDept } from '@/lib/crm/permissions'
import { parseTemplate, saveTemplate, setTemplateActive, KhoViecError } from '@/lib/crm/kho-viec'

const asHttp = (e: unknown): never => { if (e instanceof KhoViecError) throw new HttpError(400, e.message); throw e }

/** Thêm việc vào kho. */
export const POST = handle(async (req: Request) => {
  const user = await requireCrm('viec.giao')
  const b = await req.json().catch(() => ({}))
  if (!managesDept(user, String(b.department || ''))) throw new HttpError(403, 'Chỉ sửa kho việc của bộ phận mình')
  const id = await (async () => saveTemplate(null, parseTemplate(b), user.id, clientIp(req)))().catch(asHttp)
  return Response.json({ ok: true, id })
})

/** Sửa việc, hoặc bật/tắt (action: 'active'). */
export const PATCH = handle(async (req: Request) => {
  const user = await requireCrm('viec.giao')
  const b = await req.json().catch(() => ({}))
  const id = Number(b.id)
  if (!Number.isInteger(id)) throw new HttpError(400, 'Thiếu việc')
  const cur = (await getDb()`SELECT department FROM task_templates WHERE id = ${id}`)[0]
  if (!cur) throw new HttpError(404, 'Không tìm thấy việc trong kho')
  if (!managesDept(user, cur.department) || (b.department && !managesDept(user, String(b.department)))) throw new HttpError(403, 'Chỉ sửa kho việc của bộ phận mình')
  if (b.action === 'active') { await setTemplateActive(id, !!b.active, user.id, clientIp(req)).catch(asHttp); return Response.json({ ok: true }) }
  await (async () => saveTemplate(id, parseTemplate(b), user.id, clientIp(req)))().catch(asHttp)
  return Response.json({ ok: true })
})
