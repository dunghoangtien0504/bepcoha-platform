import { rateLimit } from '@/lib/ratelimit'
import { rateLimited } from '@/lib/mini/errors'
import { clientInfo, miniRoute, readJson, sessionIdFrom } from '@/lib/mini/http'
import { listOrders, placeOrder } from '@/lib/mini/orders'

/** Đơn của tôi (trạng thái lấy từ đơn POScake đã đồng bộ). */
export const GET = miniRoute(async (req: Request) => {
  return Response.json(await listOrders(await sessionIdFrom(req)), { headers: { 'Cache-Control': 'no-store' } })
})

/**
 * Đặt đơn. Body: { items: [{ sku, qty }], name, address, note?, payment: 'cod' | 'chuyen_khoan', voucher_code?, use_points?, expected_total? }.
 * Giới hạn số đơn đếm trong DB (lib/mini/orders.ts); rate limit ở đây chỉ chống flood.
 */
export const POST = miniRoute(async (req: Request) => {
  const info = clientInfo(req)
  if (!rateLimit('mini-order:' + info.ip, 10, 10 * 60 * 1000)) throw rateLimited()
  return Response.json(await placeOrder(await sessionIdFrom(req), await readJson(req), { zalo: info.zalo }))
})
