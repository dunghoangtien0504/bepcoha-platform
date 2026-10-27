// Cầu nối CRM HACO → Zalo CRM của HACO (thư mục HACO-ZL-CRM, bản HACO của ZL-CRM/TAKI).
// Sau mỗi lần đồng bộ Pancake, đơn đã chốt có SĐT thật được gửi sang webhook đơn hàng (ký HMAC-SHA256
// trên `${timestamp}.${rawBody}`, đúng hợp đồng order-webhook-public.ts). Bên Zalo CRM: tìm/tạo khách theo SĐT,
// gắn tag "Đã mua", dừng chuỗi chào hàng, chạy trigger order_success (chăm sóc sau mua, bán thêm).
// Chỉ gửi đơn từ ZL_CRM_PUSH_SINCE trở đi để không dội cả lịch sử 48 nghìn đơn vào Zalo CRM.
import { createHmac } from 'node:crypto'
import { getDb } from '../db'
import { lineBreakdown } from './orders'
import type { OrderItem, Platform } from './orders'

type Sql = ReturnType<typeof getDb>

export function zlBridgeConfig() {
  const url = process.env.ZL_CRM_ORDER_WEBHOOK_URL || ''
  const secret = process.env.ZL_CRM_ORDER_WEBHOOK_SECRET || ''
  const since = process.env.ZL_CRM_PUSH_SINCE || ''
  const sinceDate = /^\d{4}-\d{2}-\d{2}/.test(since) ? new Date(since) : null
  return url && secret && sinceDate && !Number.isNaN(sinceDate.getTime()) ? { url, secret, since: sinceDate } : null
}

export function signZlPayload(secret: string, timestamp: string, rawBody: string): string {
  return `sha256=${createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex')}`
}

interface PendingRow {
  pos_order_id: string; phone_norm: string; name: string | null; platform: Platform; status_name: string | null
  revenue: string | number; items: OrderItem[]; cod: string | number; prepaid: string | number; discount: string | number; seller_name: string | null
}

export function zlOrderBody(o: PendingRow) {
  const lines = lineBreakdown({ platform: o.platform, cod: Number(o.cod), prepaid: Number(o.prepaid), discount: Number(o.discount), items: o.items, seller: o.seller_name })
  return {
    orderId: `pancake:${o.pos_order_id}`,
    phone: o.phone_norm,
    name: o.name || undefined,
    amount: Number(o.revenue),
    currency: 'VND',
    productName: lines.map(l => l.group).filter((g, i, a) => a.indexOf(g) === i).join(', ').slice(0, 200),
    items: lines.map(l => ({ sku: l.sku, name: l.name, group: l.group, qty: l.qty })),
    metadata: { source: 'haco-crm', platform: o.platform, status: o.status_name, seller: o.seller_name },
  }
}

/** Gửi tối đa `limit` đơn chưa gửi. Lỗi mạng/5xx thì dừng lượt này (lần đồng bộ sau thử lại); 4xx thì ghi lỗi vào đơn. */
export async function pushOrdersToZl(limit = 200, sql: Sql = getDb(), fetchImpl: typeof fetch = fetch) {
  const cfg = zlBridgeConfig()
  if (!cfg) return { skipped: 'chưa cấu hình ZL_CRM_ORDER_WEBHOOK_URL / _SECRET / ZL_CRM_PUSH_SINCE' as const }
  const rows = await sql<PendingRow[]>`
    SELECT pos_order_id, phone_norm, name, platform, status_name, revenue, items, cod, prepaid, discount, seller_name
    FROM pancake_orders
    WHERE zl_pushed_at IS NULL AND counts_revenue AND NOT phone_masked AND phone_norm <> ''
      AND zl_push_error IS NULL AND inserted_at >= ${cfg.since}
    ORDER BY inserted_at LIMIT ${limit}`
  let sent = 0, failed = 0
  for (const o of rows) {
    const raw = JSON.stringify(zlOrderBody(o))
    const ts = String(Math.floor(Date.now() / 1000))
    let res: Response
    try {
      res = await fetchImpl(cfg.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Timestamp': ts, 'X-Signature': signZlPayload(cfg.secret, ts, raw) },
        body: raw, signal: AbortSignal.timeout(10_000),
      })
    } catch (e) {
      console.warn('[zl-bridge] không gọi được Zalo CRM, thử lại lần sau:', e instanceof Error ? e.message : e)
      break
    }
    if (res.ok) {
      await sql`UPDATE pancake_orders SET zl_pushed_at = NOW() WHERE pos_order_id = ${o.pos_order_id}`
      sent++
    } else if (res.status >= 500 || res.status === 429 || res.status === 401) {
      // 401: sai URL/secret — dừng cả lượt để không đánh dấu lỗi hàng loạt; 5xx/429: thử lại lần sau
      console.warn('[zl-bridge] Zalo CRM trả', res.status, '— dừng lượt này')
      break
    } else {
      const detail = (await res.text().catch(() => '')).slice(0, 200)
      await sql`UPDATE pancake_orders SET zl_push_error = ${`${res.status} ${detail}`} WHERE pos_order_id = ${o.pos_order_id}`
      failed++
    }
  }
  return { pending: rows.length, sent, failed }
}
