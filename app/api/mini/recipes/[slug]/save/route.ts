import { saveRecipe } from '@/lib/mini/checkin'
import { miniRoute, readJson, sessionIdFrom } from '@/lib/mini/http'

/** Lưu / bỏ lưu công thức vào Sổ tay. Body: { saved: boolean }. */
export const POST = miniRoute(async (req: Request, ctx: { params: Promise<{ slug: string }> }) => {
  const { slug } = await ctx.params
  const body = await readJson(req)
  return Response.json(await saveRecipe(await sessionIdFrom(req), slug, body.saved))
})
