import { requireCrm, handle, HttpError, clientIp } from '@/lib/crm/session'
import { parseEventInput, createEvent, updateEvent, setEventStatus, EventInputError, EVENT_STATUS, type EventStatus } from '@/lib/crm/events'

const asHttp = (e: unknown): never => { if (e instanceof EventInputError) throw new HttpError(400, e.message); throw e }

/** Tạo sự kiện (luôn ở trạng thái nháp). */
export const POST = handle(async (req: Request) => {
  const user = await requireCrm('su_kien.quan_ly')
  const b = await req.json().catch(() => ({}))
  const id = await createEvent(parseEventInput(b), user.id, clientIp(req)).catch(asHttp)
  return Response.json({ ok: true, id })
})

/** Sửa nội dung, hoặc đổi trạng thái (action: 'status'). */
export const PATCH = handle(async (req: Request) => {
  const user = await requireCrm('su_kien.quan_ly')
  const b = await req.json().catch(() => ({}))
  const id = Number(b.id)
  if (!Number.isInteger(id)) throw new HttpError(400, 'Thiếu sự kiện')
  if (b.action === 'status') {
    if (!Object.hasOwn(EVENT_STATUS, String(b.status))) throw new HttpError(400, 'Trạng thái không hợp lệ')
    const reason = String(b.reason || '').trim().slice(0, 500)
    if (b.status === 'huy' && !reason) throw new HttpError(400, 'Ghi lý do huỷ sự kiện')
    const r = await setEventStatus(id, b.status as EventStatus, { notify: !!b.notify, reason }, user.id, clientIp(req))
    if (!r) throw new HttpError(404, 'Không tìm thấy sự kiện')
    return Response.json({ ok: true, notification_id: r.notificationId })
  }
  const r = await updateEvent(id, parseEventInput(b), user.id, clientIp(req)).catch(asHttp)
  if (!r) throw new HttpError(404, 'Không tìm thấy sự kiện')
  return Response.json({ ok: true })
})
