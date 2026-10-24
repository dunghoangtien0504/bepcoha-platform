import { miniRoute, readJson, sessionIdFrom } from '@/lib/mini/http'
import { recordProgress } from '@/lib/mini/service'

/** Ghi tiến độ xem bài (chỉ bài đã mở; hoàn thành khi ≥ 90%). */
export const POST = miniRoute(async (req: Request, ctx: { params: Promise<{ no: string }> }) => {
  const { no } = await ctx.params
  const body = await readJson(req)
  return Response.json(await recordProgress(await sessionIdFrom(req), no, body.watched_pct))
})
