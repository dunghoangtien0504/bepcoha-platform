import { myPosts } from '@/lib/mini/community'
import { miniRoute, sessionIdFrom } from '@/lib/mini/http'

/** Bài của chính khách (chờ duyệt / đã đăng / bị từ chối kèm lý do). */
export const GET = miniRoute(async (req: Request) => {
  return Response.json(await myPosts(await sessionIdFrom(req)), { headers: { 'Cache-Control': 'no-store' } })
})
