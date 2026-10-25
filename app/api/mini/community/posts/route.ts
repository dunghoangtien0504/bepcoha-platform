import { createPost, listApproved } from '@/lib/mini/community'
import { MiniError, badRequest } from '@/lib/mini/errors'
import { miniRoute, sessionIdFrom } from '@/lib/mini/http'

/** Bài đã duyệt của Góc bếp chị em (không cần đăng ký mới xem được). */
export const GET = miniRoute(async (req: Request) => {
  const limit = Number(new URL(req.url).searchParams.get('limit') || 30)
  return Response.json(await listApproved(limit), { headers: { 'Cache-Control': 'no-store' } })
})

const MAX_POST_BODY = 1200 * 1024 // ảnh ≤ 800KB sau khi đổi base64 + caption

/** Khách gửi ảnh món + caption. Bài vào trạng thái chờ duyệt; Bếp duyệt trên CRM (/crm/cong-dong) rồi mới hiện. */
export const POST = miniRoute(async (req: Request) => {
  const len = Number(req.headers.get('content-length') || 0)
  if (len > MAX_POST_BODY) throw new MiniError(413, 'too_large', 'Ảnh hơi lớn, chị chọn ảnh khác giúp Cô nhé.')
  const text = await req.text()
  if (text.length > MAX_POST_BODY) throw new MiniError(413, 'too_large', 'Ảnh hơi lớn, chị chọn ảnh khác giúp Cô nhé.')
  let body: Record<string, unknown>
  try {
    body = JSON.parse(text)
  } catch {
    throw badRequest()
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw badRequest()
  return Response.json(await createPost(await sessionIdFrom(req), body))
})
