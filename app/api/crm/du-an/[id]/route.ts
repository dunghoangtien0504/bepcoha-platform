import { requireCrm, handle, HttpError, clientIp } from '@/lib/crm/session'
import { addTask, updateProject, projectDetail, DuAnError } from '@/lib/crm/du-an'

type Ctx = { params: Promise<{ id: string }> }

const wrap = async <T>(fn: () => Promise<T>) => {
  try { return await fn() } catch (e) { if (e instanceof DuAnError) throw new HttpError(400, e.message); throw e }
}

export const GET = handle(async (_req: Request, ctx: Ctx) => {
  await requireCrm('viec.cua_toi')
  const d = await projectDetail(Number((await ctx.params).id))
  if (!d) throw new HttpError(404, 'Không tìm thấy dự án')
  return Response.json(d)
})

/** Thêm việc vào dự án. */
export const POST = handle(async (req: Request, ctx: Ctx) => {
  const user = await requireCrm('viec.giao')
  const b = await req.json().catch(() => ({}))
  const id = Number((await ctx.params).id) || 0
  return Response.json({ id: await wrap(() => addTask(user, id, b, clientIp(req))) })
})

/** Đổi trạng thái / dời hạn chót (dời hạn: chỉ ban giám đốc, bắt buộc lý do). */
export const PATCH = handle(async (req: Request, ctx: Ctx) => {
  const user = await requireCrm('viec.giao')
  const b = await req.json().catch(() => ({}))
  const id = Number((await ctx.params).id)
  return Response.json(await wrap(() => updateProject(user, id, b, clientIp(req))))
})
