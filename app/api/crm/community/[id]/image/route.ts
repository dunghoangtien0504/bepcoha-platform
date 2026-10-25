import { requireCrm, handle, HttpError } from '@/lib/crm/session'
import { postImageForStaff } from '@/lib/mini/community'

/** Ảnh bài (mọi trạng thái) cho nhân viên duyệt. */
export const GET = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireCrm('su_kien.quan_ly')
  const { id } = await ctx.params
  const img = await postImageForStaff(Number(id))
  if (!img) throw new HttpError(404, 'Không tìm thấy ảnh')
  return new Response(new Uint8Array(img.bytes), { headers: { 'Content-Type': img.mime, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } })
})
