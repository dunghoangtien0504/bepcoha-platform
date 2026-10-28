import { requireCrm, handle, HttpError, clientIp } from '@/lib/crm/session'
import { createProject, listProjects, DuAnError } from '@/lib/crm/du-an'

export const GET = handle(async () => {
  await requireCrm('viec.cua_toi')
  return Response.json({ projects: await listProjects() })
})

/** Tạo dự án (trống hoặc từ mẫu). Quản lý tạo cho bộ phận mình; mẫu liên phòng ban chỉ ban giám đốc. */
export const POST = handle(async (req: Request) => {
  const user = await requireCrm('viec.giao')
  const b = await req.json().catch(() => ({}))
  try {
    return Response.json(await createProject(user, b, clientIp(req)))
  } catch (e) {
    if (e instanceof DuAnError) throw new HttpError(400, e.message)
    throw e
  }
})
