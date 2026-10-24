// Đồng bộ đơn Pancake POS → pancake_orders (CHỈ ĐỌC từ Pancake, không ghi gì lên Pancake).
// Lấy các trang đơn mới nhất cho tới khi gặp đơn cũ hơn cửa sổ (mặc định 14 ngày) — đủ để cập nhật trạng thái giao/huỷ.
import { getDb } from '../db'
import { fromPancakeRaw, upsertOrders, recomputeCustomerStats, type OrderRow } from './orders'
import { lookupOrderRef, promoteMiniSession } from './mini'

const PAGE_SIZE = 200
const MAX_PAGES = 40

export async function syncRecentOrders(windowDays = 14): Promise<{ orders: number; pages: number }> {
  const key = process.env.PANCAKE_API_KEY
  const shop = process.env.PANCAKE_SHOP_ID
  if (!key || !shop) throw new Error('Thiếu PANCAKE_API_KEY hoặc PANCAKE_SHOP_ID')
  const sql = getDb()
  const run = (await sql`INSERT INTO sync_runs (kind) VALUES ('pancake_orders') RETURNING id`)[0].id as number
  const cutoff = Date.now() - windowDays * 86400000
  let total = 0, page = 1
  try {
    for (; page <= MAX_PAGES; page++) {
      // Sắp xếp mới nhất trước (bản xuất đã dùng inserted_at_asc nên tên tham số theo cùng kiểu; nếu Pancake bỏ qua, MAX_PAGES chặn vòng lặp)
      const url = `https://pos.pages.fm/api/v1/shops/${shop}/orders?api_key=${key}&page_number=${page}&page_size=${PAGE_SIZE}&option_sort=inserted_at_desc`
      const res = await fetch(url, { signal: AbortSignal.timeout(60_000) })
      if (!res.ok) throw new Error(`Pancake HTTP ${res.status}`)
      const json = await res.json()
      const list = (json?.data || []) as Record<string, unknown>[]
      const rows = list.map(fromPancakeRaw).filter((r): r is OrderRow => r !== null)
      total += await upsertOrders(rows)
      const oldest = Math.min(...rows.map(r => new Date(r.insertedAt).getTime()))
      if (list.length < PAGE_SIZE || oldest < cutoff) break
    }
    const ids = (await sql`SELECT DISTINCT customer_id FROM pancake_orders WHERE synced_at > NOW() - INTERVAL '1 hour' AND customer_id IS NOT NULL`).map(r => r.customer_id as number)
    await recomputeCustomerStats(ids)
    await retryPendingClaims()
    await sql`UPDATE sync_runs SET finished_at = NOW(), ok = TRUE, rows = ${total}, detail = ${`${page} trang`} WHERE id = ${run}`
    return { orders: total, pages: page }
  } catch (e) {
    await sql`UPDATE sync_runs SET finished_at = NOW(), ok = FALSE, rows = ${total}, detail = ${String(e instanceof Error ? e.message : e).slice(0, 500)} WHERE id = ${run}`
    throw e
  }
}

/** Yêu cầu ghép đơn "chưa thấy" còn hạn 24h: tra lại sau mỗi lần đồng bộ (đơn mới có thể vừa được đồng bộ). */
export async function retryPendingClaims(): Promise<number> {
  const sql = getDb()
  const pending = await sql`
    SELECT oc.id, oc.order_ref_raw, oc.mini_session_id, m.phone FROM order_claims oc JOIN mini_sessions m ON m.id = oc.mini_session_id
    WHERE oc.status = 'cho_duyet' AND oc.lookup_result = 'chua_thay' AND oc.retry_until > NOW() LIMIT 200`
  let matched = 0
  for (const c of pending) {
    const r = await lookupOrderRef(c.order_ref_raw, c.phone)
    if (r.result === 'chua_thay') continue
    if (r.result === 'khop_sdt') {
      const ok = await sql`UPDATE order_claims SET status = 'da_khop', lookup_result = 'khop_sdt', matched_pancake_order_id = ${r.orderId}, ref_kind = ${r.refKind}, platform = ${r.platform}
        WHERE id = ${c.id} AND status = 'cho_duyet' AND NOT EXISTS (SELECT 1 FROM order_claims x WHERE x.matched_pancake_order_id = ${r.orderId} AND x.status = 'da_khop')`
      if (ok.count) { matched++; await promoteMiniSession(c.mini_session_id, 'order_match', { type: 'system', id: null }).catch(() => {}) }
    } else {
      await sql`UPDATE order_claims SET lookup_result = ${r.result}, matched_pancake_order_id = ${r.orderId}, ref_kind = ${r.refKind}, platform = ${r.platform} WHERE id = ${c.id}`
    }
  }
  return matched
}
