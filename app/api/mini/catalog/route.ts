import { publicCatalog } from '@/lib/mini/catalog'
import { miniRoute } from '@/lib/mini/http'
import { redeemRules } from '@/lib/mini/orders'

/** Hàng bán trong Mini App, giá do máy chủ quyết (chưa gồm ship). redeem = null khi chưa bật đổi Hạt Cốm. */
export const GET = miniRoute(async () => {
  return Response.json({ items: publicCatalog(), redeem: await redeemRules() }, { headers: { 'Cache-Control': 'no-store' } })
})
