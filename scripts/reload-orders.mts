// Nạp lại đơn từ bản xuất HACO-LOOP/data/orders.jsonl vào database PHÁT TRIỂN (tính lại doanh thu/nhóm/sỉ theo quy tắc mới).
// Chạy: npx tsx --env-file=.env.local scripts/reload-orders.mts
import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getDb } from '../lib/db'
import { ensureCrmSchema } from '../lib/crm/schema'
import { fromExportRow, upsertOrders, recomputeCustomerStats, type OrderRow } from '../lib/crm/orders'

if (!/127\.0\.0\.1|localhost/.test(process.env.DATABASE_URL || '')) { console.error('Chỉ chạy trên database máy'); process.exit(1) }
await ensureCrmSchema()
const file = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'HACO-LOOP', 'data', 'orders.jsonl')
let batch: OrderRow[] = [], n = 0
for await (const line of createInterface({ input: createReadStream(file) })) {
  if (!line.trim()) continue
  const r = fromExportRow(JSON.parse(line)); if (r) batch.push(r)
  if (batch.length >= 2000) { n += await upsertOrders(batch); batch = [] }
}
if (batch.length) n += await upsertOrders(batch)
await recomputeCustomerStats()
console.log('Đã nạp lại', n, 'đơn')
await getDb().end()
