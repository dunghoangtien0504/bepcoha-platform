import { requireCrm, handle, HttpError, clientIp } from '@/lib/crm/session'
import { parseNotificationInput, createNotification, expireNotification, EventInputError } from '@/lib/crm/events'

/** Soạn thông báo vào hộp thư Mini App (gửi ngay hoặc hẹn giờ). */
export const POST = handle(async (req: Request) => {
  const user = await requireCrm('su_kien.quan_ly')
  const b = await req.json().catch(() => ({}))
  try {
    const id = await createNotification(parseNotificationInput(b), user.id, clientIp(req))
    return Response.json({ ok: true, id })
  } catch (e) {
    if (e instanceof EventInputError) throw new HttpError(400, e.message)
    throw e
  }
})

/** Thu hồi (hết hạn ngay). */
export const PATCH = handle(async (req: Request) => {
  const user = await requireCrm('su_kien.quan_ly')
  const b = await req.json().catch(() => ({}))
  if (b.action !== 'expire') throw new HttpError(400, 'Thao tác không hợp lệ')
  const ok = await expireNotification(Number(b.id), user.id, clientIp(req))
  if (!ok) throw new HttpError(404, 'Thông báo không tồn tại hoặc đã hết hạn')
  return Response.json({ ok: true })
})
