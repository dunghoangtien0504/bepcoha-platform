import { requireCrm, handle, HttpError, clientIp } from '@/lib/crm/session'
import { moderatePost, type ModerateAction } from '@/lib/mini/community'
import { MiniError } from '@/lib/mini/errors'

const ACTIONS: ModerateAction[] = ['duyet', 'khen', 'tu_choi', 'an', 'ghim', 'bo_ghim']

/** Duyệt bài Góc bếp chị em: duyet | khen (duyệt + Cô Hạ khen) | tu_choi (bắt buộc lý do) | an | ghim | bo_ghim. */
export const PATCH = handle(async (req: Request) => {
  const user = await requireCrm('su_kien.quan_ly')
  const b = await req.json().catch(() => ({}))
  if (!ACTIONS.includes(b.action)) throw new HttpError(400, 'Thao tác không hợp lệ')
  try {
    const r = await moderatePost(Number(b.id), b.action, user.id, String(b.reason || ''), clientIp(req))
    if (!r) throw new HttpError(404, 'Không tìm thấy bài')
    return Response.json({ ok: true, post: r })
  } catch (e) {
    if (e instanceof MiniError) throw new HttpError(e.status, e.message)
    throw e
  }
})
