// Kho việc & việc tự sinh mỗi sáng (HACO-LOOP 02, 15; B2 Z10; B4 Z04–Z05).
// Nguyên tắc: máy chỉ TẠO VIỆC cho người thật, không tự nhắn khách. Mỗi khách tối đa 2 lần liên hệ chủ động/tuần.
// Khách đã từ chối, khách thuộc nhóm đối chứng đang chạy, hồ sơ chưa xác minh SĐT: không sinh việc liên hệ.
import { getDb } from '../db'
import { PRODUCT_LINES } from './orders'
import { logAction } from './audit'
import { TASK_KINDS, TASK_RESULTS, NEXT_OFFER, type TaskKind, type TaskResult } from './labels'
export { TASK_KINDS, TASK_RESULTS, NEXT_OFFER, type TaskKind, type TaskResult } from './labels'

type Sql = ReturnType<typeof getDb>

/** Khách được phép liên hệ chủ động. */
export function contactableSql(sql: Sql) {
  return sql`
    c.opted_out_at IS NULL AND c.phone_verified_at IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM care_campaign_members m JOIN care_campaigns k ON k.id = m.campaign_id
      WHERE m.customer_id = c.id AND m.arm = 'holdout' AND k.created_at > NOW() - INTERVAL '120 days')
    AND (SELECT COUNT(*) FROM crm_tasks t2 WHERE t2.customer_id = c.id AND t2.created_at > NOW() - INTERVAL '7 days'
         AND t2.kind IN ('sau_giao','hoi_ket_qua','goi_y_tiep','goi_vip','danh_thuc','khach_hoi')) < 2`
}

/** Người nhận việc: người phụ trách khách nếu có, không thì chia vòng cho nhân viên Sale & CSKH đang hoạt động. */
async function saleStaff(sql: Sql): Promise<number[]> {
  const r = await sql`SELECT id FROM staff WHERE status = 'active' AND department = 'sale_cskh' ORDER BY id`
  return r.map(x => x.id as number)
}

async function assignRoundRobin(sql: Sql, keyPrefix: string) {
  const staff = await saleStaff(sql)
  if (!staff.length) return
  await sql`
    WITH t AS (
      SELECT t.id, ROW_NUMBER() OVER (ORDER BY t.id) - 1 AS rn FROM crm_tasks t
      WHERE t.assigned_staff_id IS NULL AND t.auto_key LIKE ${keyPrefix + '%'} AND t.status = 'can_lam'
    )
    UPDATE crm_tasks x SET assigned_staff_id = (${staff}::int[])[(t.rn % ${staff.length}) + 1]
    FROM t WHERE x.id = t.id
  `
}

/** "Khách lớn" (Cô Hạ chốt 27/10/2026): mua từ 3 lần trở lên VÀ chi trên 3 triệu trong 12 tháng gần nhất. Dùng với bí danh c. */
export const VIP_MIN_ORDERS = 3
export const VIP_MIN_SPENT_12M = 3_000_000
export const VIP_CALLS_PER_SALE_PER_DAY = 5
export function vipSql(sql: Sql) {
  return sql`(c.order_count >= ${VIP_MIN_ORDERS} AND (SELECT COALESCE(SUM(o.revenue), 0) FROM pancake_orders o
    WHERE o.customer_id = c.id AND o.counts_revenue AND o.inserted_at > NOW() - INTERVAL '365 days') > ${VIP_MIN_SPENT_12M})`
}

export interface GenerateLimits { perKind?: number; winbackPerDay?: number }

/** Chạy mỗi sáng (cron 8h). Trả về số việc mới theo loại. Mỗi loại độc lập: 1 loại lỗi không chặn loại khác. */
export async function generateDailyTasks(limits: GenerateLimits = {}, sql: Sql = getDb()): Promise<Record<string, number>> {
  const per = limits.perKind ?? 150
  const winback = limits.winbackPerDay ?? 60
  const out: Record<string, number> = {}
  const ok = contactableSql(sql)
  const name = sql`COALESCE(NULLIF(trim(c.name), ''), 'khách #' || c.id)`
  const run = async (kind: string, fn: () => Promise<{ count: number }>) => {
    try { out[kind] = (await fn()).count } catch (e) {
      out[kind] = 0
      console.error(`[crm/tasks] ${kind} lỗi:`, e instanceof Error ? e.message : e)
    }
  }

  // ① Khách mua LẦN ĐẦU vừa nhận hàng (1–3 ngày): hướng dẫn dùng + hỏi "nấu ra sao rồi ạ?" (luồng ③ trong 02-MOT-TRANG)
  await run('sau_giao', () => sql`
    INSERT INTO crm_tasks (customer_id, title, kind, priority, due_at, assigned_staff_id, created_by, auto_key, source, suggestion, department)
    SELECT c.id, 'Hỏi thăm sau giao: ' || ${name}, 'sau_giao', 1, NOW() + INTERVAL '4 hours', c.assigned_staff_id, 0,
           'sg:' || o.pos_order_id, 'tu_dong',
           'Gửi hướng dẫn dùng ' || array_to_string(o.product_lines, ', ') || '. Hỏi: "Chị nấu thử ra sao rồi ạ?" — người thật trả lời, không gửi tự động.',
           'sale_cskh'
    FROM pancake_orders o JOIN customers c ON c.id = o.customer_id
    WHERE o.status = 3 AND o.is_real AND c.order_count = 1
      AND COALESCE(o.updated_at, o.inserted_at) BETWEEN NOW() - INTERVAL '3 days' AND NOW() - INTERVAL '1 day' AND ${ok}
    ORDER BY o.inserted_at DESC LIMIT ${per}
    ON CONFLICT (auto_key) WHERE auto_key IS NOT NULL DO NOTHING`)

  // ② D+7: hỏi kết quả, xin ảnh/review, gửi mã giới thiệu
  await run('hoi_ket_qua', () => sql`
    INSERT INTO crm_tasks (customer_id, title, kind, priority, due_at, assigned_staff_id, created_by, auto_key, source, suggestion, department)
    SELECT c.id, 'Hỏi kết quả + xin ảnh: ' || ${name}, 'hoi_ket_qua', 2, NOW() + INTERVAL '1 day', c.assigned_staff_id, 0,
           'kq:' || c.id, 'tu_dong',
           'Xin ảnh món chị nấu (đưa lên trang bán làm bằng chứng nếu chị đồng ý). Gửi mã giới thiệu: ' || COALESCE(c.referral_code, '(chưa có)'),
           'sale_cskh'
    FROM customers c
    WHERE c.order_count = 1 AND c.last_order_at BETWEEN NOW() - INTERVAL '12 days' AND NOW() - INTERVAL '6 days' AND ${ok}
    ORDER BY c.last_order_at DESC LIMIT ${per}
    ON CONFLICT (auto_key) WHERE auto_key IS NOT NULL DO NOTHING`)

  // ③ D+14–30 vẫn mới mua 1 lần: gợi ý món kế tiếp theo dòng sản phẩm đã mua
  const offers = sql.json(NEXT_OFFER as never)
  await run('goi_y_tiep', () => sql`
    INSERT INTO crm_tasks (customer_id, title, kind, priority, due_at, assigned_staff_id, created_by, auto_key, source, suggestion, department)
    SELECT c.id, 'Gợi ý món kế tiếp: ' || ${name}, 'goi_y_tiep', 2, NOW() + INTERVAL '1 day', c.assigned_staff_id, 0,
           'gy:' || c.id, 'tu_dong',
           'Đã mua: ' || COALESCE(l.lines, '?') || '. Gợi ý: ' || COALESCE(l.offer, 'hỏi nhu cầu, giới thiệu sản phẩm bán chạy'),
           'sale_cskh'
    FROM customers c
    LEFT JOIN LATERAL (
      SELECT string_agg(DISTINCT x.line, ', ') AS lines, string_agg(DISTINCT ${offers}::jsonb ->> x.line, '; ') AS offer
      FROM pancake_orders o, unnest(o.product_lines) AS x(line)
      WHERE o.customer_id = c.id AND o.is_real
    ) l ON TRUE
    WHERE c.order_count = 1 AND c.last_order_at BETWEEN NOW() - INTERVAL '30 days' AND NOW() - INTERVAL '14 days' AND ${ok}
    ORDER BY c.last_order_at DESC LIMIT ${per}
    ON CONFLICT (auto_key) WHERE auto_key IS NOT NULL DO NOTHING`)

  // ④ Khách lớn (Cô Hạ chốt 27/10): mua từ 3 lần VÀ chi trên 3 triệu trong 12 tháng → gọi mời khoá offline/combo sỉ (mỗi quý 1 lần).
  //    Mức 2, không "Gấp". Việc được rải dần tối đa 5 khách/sale/ngày bằng scheduleVipBacklog().
  await run('goi_vip', () => sql`
    INSERT INTO crm_tasks (customer_id, title, kind, priority, due_at, assigned_staff_id, created_by, auto_key, source, suggestion, department)
    SELECT c.id, 'Gọi khách lớn: ' || ${name}, 'goi_vip', 2, NOW() + INTERVAL '2 days', c.assigned_staff_id, 0,
           'vip:' || c.id || ':' || to_char(NOW(), 'YYYY"Q"Q'), 'tu_dong',
           CASE WHEN c.is_wholesale THEN 'Khách sỉ: mời combo sỉ theo bảng giá hiện hành.' ELSE 'Mời khoá offline (chốt bằng điện thoại).' END
             || ' Chi 12 tháng: ' || replace(to_char(v.spent12, 'FM999,999,999'), ',', '.') || 'đ, ' || c.order_count || ' lần mua.',
           'sale_cskh'
    FROM customers c JOIN LATERAL (
      SELECT COALESCE(SUM(o.revenue), 0) AS spent12 FROM pancake_orders o
      WHERE o.customer_id = c.id AND o.counts_revenue AND o.inserted_at > NOW() - INTERVAL '365 days') v ON TRUE
    WHERE ${vipSql(sql)} AND ${ok}
    ORDER BY v.spent12 DESC LIMIT ${per}
    ON CONFLICT (auto_key) WHERE auto_key IS NOT NULL DO NOTHING`)

  // ⑤ Đánh thức: đã mua, > 120 ngày chưa quay lại (tệp ngủ đông / khách Tết). Giới hạn mỗi ngày, ưu tiên chi tiêu cao.
  await run('danh_thuc', () => sql`
    INSERT INTO crm_tasks (customer_id, title, kind, priority, due_at, assigned_staff_id, created_by, auto_key, source, suggestion, department)
    SELECT c.id, 'Đánh thức khách cũ: ' || ${name}, 'danh_thuc', 3, NOW() + INTERVAL '2 days', c.assigned_staff_id, 0,
           'dt:' || c.id || ':' || to_char(NOW(), 'YYYY-MM'), 'tu_dong',
           'Lần cuối mua ' || to_char(c.last_order_at AT TIME ZONE 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY') ||
           '. Hỏi thăm + ưu đãi riêng (giá theo bảng Cô Hạ duyệt, không tự ghi giá).',
           'sale_cskh'
    FROM customers c
    WHERE c.order_count >= 1 AND c.last_order_at < NOW() - INTERVAL '120 days' AND ${ok}
    ORDER BY c.total_spent DESC LIMIT ${winback}
    ON CONFLICT (auto_key) WHERE auto_key IS NOT NULL DO NOTHING`)

  // ⑥ Khách nhắn hỏi chưa chốt (bản ghi Pancake "Mới") trong 3–30 ngày, chưa từng mua
  await run('khach_hoi', () => sql`
    INSERT INTO crm_tasks (customer_id, title, kind, priority, due_at, assigned_staff_id, created_by, auto_key, source, suggestion, department)
    SELECT DISTINCT ON (c.id) c.id, 'Khách hỏi chưa chốt: ' || ${name}, 'khach_hoi', 2, NOW() + INTERVAL '1 day', c.assigned_staff_id, 0,
           'kh:' || c.id || ':' || to_char(NOW(), 'YYYY-MM'), 'tu_dong',
           'Khách nhắn hỏi ngày ' || to_char(o.inserted_at AT TIME ZONE 'Asia/Ho_Chi_Minh', 'DD/MM') || ' (' || o.platform || ') nhưng chưa chốt. Hỏi lại nhu cầu.',
           'sale_cskh'
    FROM pancake_orders o JOIN customers c ON c.id = o.customer_id
    WHERE o.status = 0 AND o.inserted_at BETWEEN NOW() - INTERVAL '30 days' AND NOW() - INTERVAL '3 days' AND c.order_count = 0 AND ${ok}
    ORDER BY c.id, o.inserted_at DESC LIMIT ${per}
    ON CONFLICT (auto_key) WHERE auto_key IS NOT NULL DO NOTHING`)

  // ⑦ Sinh nhật hôm nay (B4 K05): chúc + quà nhỏ vô điều kiện
  await run('sinh_nhat', () => sql`
    INSERT INTO crm_tasks (customer_id, title, kind, priority, due_at, assigned_staff_id, created_by, auto_key, source, suggestion, department)
    SELECT c.id, 'Chúc sinh nhật: ' || ${name}, 'sinh_nhat', 1, NOW() + INTERVAL '6 hours', c.assigned_staff_id, 0,
           'sn:' || c.id || ':' || to_char(NOW(), 'YYYY'), 'tu_dong', 'Gọi chúc mừng, gửi quà nhỏ vô điều kiện.', 'sale_cskh'
    FROM customers c
    WHERE c.birthday IS NOT NULL AND to_char(c.birthday, 'MM-DD') = to_char(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh', 'MM-DD')
      AND c.opted_out_at IS NULL AND c.phone_verified_at IS NOT NULL
    LIMIT ${per}
    ON CONFLICT (auto_key) WHERE auto_key IS NOT NULL DO NOTHING`)

  // ⑧ Ghép đơn sàn chờ duyệt đã hết thời gian tự tra lại → việc cho bộ phận vận hành sàn
  await run('ghep_don', () => sql`
    INSERT INTO crm_tasks (title, kind, priority, due_at, created_by, auto_key, source, suggestion, department, assigned_staff_id)
    SELECT 'Duyệt ' || COUNT(*) || ' yêu cầu ghép đơn từ Mini App', 'ghep_don', 1, NOW() + INTERVAL '4 hours', 0,
           'gd:' || to_char(NOW(), 'YYYY-MM-DD'), 'tu_dong', 'Mở mục QR & Mini App → Ghép đơn chờ duyệt.', 'san_tmdt',
           (SELECT id FROM staff WHERE status = 'active' AND department = 'san_tmdt' ORDER BY (role = 'quan_ly') DESC, id LIMIT 1)
    FROM order_claims WHERE status = 'cho_duyet' AND (lookup_result <> 'chua_thay' OR retry_until < NOW())
    HAVING COUNT(*) > 0
    ON CONFLICT (auto_key) WHERE auto_key IS NOT NULL DO NOTHING`)

  for (const p of ['sg:', 'kq:', 'gy:', 'vip:', 'dt:', 'kh:', 'sn:']) await assignRoundRobin(sql, p)
  await logAction({ actorType: 'system', actorId: null, action: 'GENERATE_TASKS', table: 'crm_tasks', after: out }, sql).catch(() => {})
  return out
}

export interface TaskFilter { staffId?: number | null; status?: 'mo' | 'xong' | 'tat_ca'; kind?: string; department?: string; customerId?: number; limit?: number }

export async function listTasks(f: TaskFilter, sql: Sql = getDb()) {
  const status = f.status ?? 'mo'
  return sql`
    SELECT t.id, t.title, t.kind, t.priority, t.status, t.due_at, t.done_at, t.created_at, t.source, t.description, t.suggestion,
           t.result, t.result_note, t.edit_reason, t.department, t.checklist, t.reviewed_at, t.review_note,
           t.customer_id, c.name AS customer_name, c.phone AS customer_phone, c.phone_verified_at, c.stage AS customer_stage,
           t.assigned_staff_id, s.name AS assignee_name, r.name AS reviewer_name
    FROM crm_tasks t
    LEFT JOIN customers c ON c.id = t.customer_id
    LEFT JOIN staff s ON s.id = t.assigned_staff_id
    LEFT JOIN staff r ON r.id = t.reviewed_by
    WHERE (${f.staffId ?? null}::int IS NULL OR t.assigned_staff_id = ${f.staffId ?? null})
      AND (${status} = 'tat_ca' OR (${status} = 'mo' AND t.status IN ('can_lam', 'dang_lam')) OR (${status} = 'xong' AND t.status IN ('xong', 'bo_qua')))
      AND (${f.kind ?? null}::text IS NULL OR t.kind = ${f.kind ?? null})
      AND (${f.department ?? null}::text IS NULL OR t.department = ${f.department ?? null})
      AND (${f.customerId ?? null}::int IS NULL OR t.customer_id = ${f.customerId ?? null})
    ORDER BY CASE WHEN t.status IN ('can_lam','dang_lam') THEN 0 ELSE 1 END, t.priority, t.due_at NULLS LAST, t.id DESC
    LIMIT ${Math.min(f.limit ?? 200, 1000)}
  `
}

export function isTaskResult(v: unknown): v is TaskResult { return typeof v === 'string' && v in TASK_RESULTS }
export function isTaskKind(v: unknown): v is TaskKind { return typeof v === 'string' && v in TASK_KINDS }

export { PRODUCT_LINES }

/**
 * Việc máy tự sinh quá hạn N ngày mà chưa ai làm → đóng "bỏ qua", ghi lý do, để danh sách không dồn ứ (phản biện CEO/COO 27/10).
 * CHỈ chạy khi quản trị bật app_settings 'task_auto_expire_days' (đóng hàng loạt là quyết định của CEO). Không đụng việc người giao tay.
 */
export async function expireStaleAutoTasks(sql: Sql = getDb()): Promise<number | null> {
  const r = (await sql`SELECT value FROM app_settings WHERE key = 'task_auto_expire_days'`)[0]
  const days = Number(r?.value)
  if (!Number.isInteger(days) || days < 1) return null
  // Giữ lại việc gọi khách lớn đúng định nghĩa (rải dần bằng scheduleVipBacklog), không cho hết hạn
  const rows = await sql`
    UPDATE crm_tasks t SET status = 'bo_qua', done_at = NOW(), edit_reason = ${'Hết hạn tự động (quá ' + days + ' ngày chưa làm)'}
    WHERE t.status = 'can_lam' AND t.source = 'tu_dong' AND t.due_at < NOW() - make_interval(days => ${days})
      AND NOT (t.kind = 'goi_vip' AND EXISTS (SELECT 1 FROM customers c WHERE c.id = t.customer_id AND ${vipSql(sql)}))
    RETURNING t.id`
  return rows.length
}

/**
 * Rải dần việc gọi khách lớn còn mở: chia đều cho Sale đang làm (giữ người đã được giao nếu là Sale),
 * mỗi người tối đa 5 khách/ngày — khách chi nhiều gọi trước. Đặt lại hạn từng ngày nên "Hôm nay" chỉ hiện 5 việc.
 */
export async function scheduleVipBacklog(sql: Sql = getDb()): Promise<number> {
  const staff = await saleStaff(sql)
  if (!staff.length) return 0
  const rows = await sql`
    WITH v AS (
      SELECT t.id, t.assigned_staff_id,
        (SELECT COALESCE(SUM(o.revenue), 0) FROM pancake_orders o WHERE o.customer_id = t.customer_id AND o.counts_revenue
           AND o.inserted_at > NOW() - INTERVAL '365 days') AS spent12
      FROM crm_tasks t JOIN customers c ON c.id = t.customer_id
      WHERE t.kind = 'goi_vip' AND t.status = 'can_lam' AND ${vipSql(sql)}
    ), a AS (
      SELECT v.id, v.spent12,
        CASE WHEN v.assigned_staff_id = ANY(${staff}::int[]) THEN v.assigned_staff_id
             ELSE (${staff}::int[])[((ROW_NUMBER() OVER (ORDER BY v.spent12 DESC, v.id) - 1) % ${staff.length}) + 1] END AS who
      FROM v
    ), r AS (
      SELECT a.id, a.who, (ROW_NUMBER() OVER (PARTITION BY a.who ORDER BY a.spent12 DESC, a.id) - 1) / ${VIP_CALLS_PER_SALE_PER_DAY} AS day_no FROM a
    )
    UPDATE crm_tasks x SET assigned_staff_id = r.who,
      due_at = (date_trunc('day', NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh') + make_interval(days => r.day_no::int) + INTERVAL '17 hours') AT TIME ZONE 'Asia/Ho_Chi_Minh'
    FROM r WHERE x.id = r.id
    RETURNING x.id`
  return rows.length
}
