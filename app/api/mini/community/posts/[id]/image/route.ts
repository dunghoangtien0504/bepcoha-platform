import { postImage } from '@/lib/mini/community'
import { miniRoute, sessionIdFrom } from '@/lib/mini/http'

/** Ảnh bài đăng: bài đã duyệt cho mọi người (cache 1 ngày); bài chưa duyệt chỉ chủ bài xem được. */
export const GET = miniRoute(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params
  const img = await postImage(Number(id), await sessionIdFrom(req))
  return new Response(new Uint8Array(img.bytes), {
    headers: {
      'Content-Type': img.mime,
      'Cache-Control': img.isPublic ? 'public, max-age=86400' : 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
})
