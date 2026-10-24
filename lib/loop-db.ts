import { randomBytes } from 'crypto'
import { getDb } from './db'
import { normalizePhone } from './phone'
import { generateReferralCode, taskTitle, type Segment, type SheetLead } from './loop'

type Q = ReturnType<typeof getDb>

const SITE = process.env.SITE_URL || 'https://khoaduacamuoi.hacofood.vn'
const HOLDOUT_DAYS = 120

/** Điều kiện "được phép liên hệ" cho bảng customers đặt bí danh c: chưa từ chối (cờ + sổ email) và không thuộc nhóm đối chứng. */
function contactable(sql: Q) {
  return sql`
    c.opted_out_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM email_optouts o WHERE o.email = lower(c.email))
    AND NOT EXISTS (
      SELECT 1 FROM care_campaign_members m JOIN care_campaigns k ON k.id = m.campaign_id
      WHERE m.customer_id = c.id AND m.arm = 'holdout' AND k.created_at > NOW() - make_interval(days => ${HOLDOUT_DAYS})
    )`
}

/** Gộp lead nhận quà vào bảng khách (CRM chung) theo số điện thoại: tạo khách mới hoặc bổ sung tên/email/nhóm còn thiếu. */
export async function mergeGiftLeadsIntoCustomers(limit = 500): Promise<number> {
  const sql = getDb()
  // Khoá các dòng sẽ xử lý ngay trong câu SELECT: 2 lần loop-run chồng lấn không cùng lấy 1 lead (đếm merged không bị trùng)
  const leads = await sql`SELECT id, name, email, phone, segment_answer FROM gift_leads WHERE merged_at IS NULL ORDER BY id LIMIT ${limit} FOR UPDATE SKIP LOCKED`
  let merged = 0
  for (const l of leads) {
    const phone = normalizePhone(l.phone as string)
    if (/^0[35789]\d{8}$/.test(phone)) {
      const seg = l.segment_answer ? [String(l.segment_answer)] : []
      await sql`
        INSERT INTO customers (phone, name, email, source, segments)
        VALUES (${phone}, ${l.name}, ${l.email}, 'local', ${seg}::text[])
        ON CONFLICT (phone) DO UPDATE SET
          name = CASE WHEN customers.name = '' THEN EXCLUDED.name ELSE customers.name END,
          email = CASE WHEN customers.email = '' THEN EXCLUDED.email ELSE customers.email END,
          segments = ARRAY(SELECT DISTINCT unnest(customers.segments || EXCLUDED.segments) ORDER BY 1),
          updated_at = NOW()
      `
      merged++
    }
    await sql`UPDATE gift_leads SET merged_at = NOW() WHERE id = ${l.id}`
  }
  return merged
}

/** Nhập lead từ bảng tính (Google Sheet → CRM). Chỉ bổ sung: không ghi đè tên/email đã có, không đụng số đơn/tiền. */
export async function upsertSheetLeads(leads: SheetLead[]): Promise<number> {
  const sql = getDb()
  let n = 0
  for (const l of leads) {
    await sql`
      INSERT INTO customers (phone, name, email, source, segments)
      VALUES (${l.phone}, ${l.name}, ${l.email}, 'local', ${l.segments}::text[])
      ON CONFLICT (phone) DO UPDATE SET
        name = CASE WHEN customers.name = '' THEN EXCLUDED.name ELSE customers.name END,
        email = CASE WHEN customers.email = '' THEN EXCLUDED.email ELSE customers.email END,
        segments = ARRAY(SELECT DISTINCT unnest(customers.segments || EXCLUDED.segments) ORDER BY 1),
        updated_at = NOW()
    `
    n++
  }
  return n
}

/** Cập nhật nhóm: đã trả tiền khóa học → C; khách đã mua mà chưa có nhóm → A. Không bao giờ bỏ nhóm khách đã tự chọn. */
export async function refreshSegments(): Promise<number> {
  const sql = getDb()
  const a = await sql`
    UPDATE customers c SET segments = ARRAY(SELECT DISTINCT unnest(c.segments || ARRAY['C']::text[]) ORDER BY 1), updated_at = NOW()
    WHERE NOT ('C' = ANY(c.segments)) AND EXISTS (
      SELECT 1 FROM course_leads l WHERE l.payment_status = 'paid'
        AND right(regexp_replace(l.phone, '[^0-9]', '', 'g'), 9) = right(c.phone, 9))
  `
  const b = await sql`UPDATE customers SET segments = ARRAY['A']::text[] WHERE segments = '{}' AND total_spent > 0`
  return a.count + b.count
}

/** Cấp mã giới thiệu cho khách đã trả tiền mà chưa có mã. */
export async function ensureReferralCodes(limit = 500): Promise<number> {
  const sql = getDb()
  const rows = await sql`SELECT id FROM customers WHERE referral_code IS NULL AND total_spent > 0 AND order_count >= 1 ORDER BY id LIMIT ${limit}`
  let n = 0
  for (const r of rows) {
    for (let attempt = 0; attempt < 6; attempt++) {
      const code = generateReferralCode(randomBytes(16))   // rejection sampling: dư byte để chắc đủ 6 ký tự
      try {
        const u = await sql`UPDATE customers SET referral_code = ${code} WHERE id = ${r.id} AND referral_code IS NULL`
        if (u.count > 0) n++
        break
      } catch (e) {
        if ((e as { code?: string }).code !== '23505') throw e   // trùng mã: thử mã khác
      }
    }
  }
  return n
}

/** Ghi nhận ai giới thiệu ai: khớp mã trên lead quà / lead khóa học với số điện thoại của khách. Không tự giới thiệu mình. */
export async function resolveReferrals(): Promise<number> {
  const sql = getDb()
  const r = await sql`
    UPDATE customers c SET referred_by = x.rid, updated_at = NOW()
    FROM (
      -- Loại tự giới thiệu NGAY TRONG subquery (so khớp khách đích cu.id <> người giới thiệu ref.id) trước khi
      -- chọn dòng sớm nhất bằng DISTINCT ON: nếu không, 1 dòng tự giới thiệu tạo trước sẽ "chiếm chỗ" vĩnh viễn
      -- và các lượt giới thiệu hợp lệ tạo sau cho cùng số điện thoại sẽ không bao giờ được xét lại.
      SELECT DISTINCT ON (p9) p9, rid FROM (
        SELECT right(regexp_replace(g.phone, '[^0-9]', '', 'g'), 9) AS p9, ref.id AS rid, g.created_at
        FROM gift_leads g
        JOIN customers ref ON ref.referral_code = upper(g.referred_by_code)
        JOIN customers cu ON right(cu.phone, 9) = right(regexp_replace(g.phone, '[^0-9]', '', 'g'), 9)
        WHERE g.referred_by_code IS NOT NULL AND cu.id <> ref.id
          AND char_length(regexp_replace(g.phone, '[^0-9]', '', 'g')) >= 9
        UNION ALL
        SELECT right(regexp_replace(l.phone, '[^0-9]', '', 'g'), 9), ref.id, l.created_at
        FROM course_leads l
        JOIN customers ref ON ref.referral_code = upper(l.referred_by_code)
        JOIN customers cu ON right(cu.phone, 9) = right(regexp_replace(l.phone, '[^0-9]', '', 'g'), 9)
        WHERE l.referred_by_code IS NOT NULL AND cu.id <> ref.id
          AND char_length(regexp_replace(l.phone, '[^0-9]', '', 'g')) >= 9
      ) t ORDER BY p9, created_at
    ) x
    WHERE c.referred_by IS NULL AND right(c.phone, 9) = x.p9 AND c.id <> x.rid
  `
  return r.count
}

/** Khách được giới thiệu đã MUA thật → tạo 1 việc thưởng cho người giới thiệu (mỗi người được giới thiệu chỉ 1 lần). */
export async function createReferralRewardTasks(limit = 100): Promise<number> {
  const sql = getDb()
  const fresh = await sql`
    INSERT INTO referral_rewards (referrer_id, referred_id)
    SELECT c.referred_by, c.id FROM customers c
    WHERE c.referred_by IS NOT NULL AND c.total_spent > 0 AND c.order_count >= 1
      AND NOT EXISTS (SELECT 1 FROM referral_rewards w WHERE w.referred_id = c.id)
    ORDER BY c.id LIMIT ${limit}
    ON CONFLICT (referred_id) DO NOTHING
    RETURNING referrer_id, referred_id
  `
  let n = 0
  for (const f of fresh) {
    const ref = (await sql`SELECT id, name, assigned_staff_id FROM customers c WHERE c.id = ${f.referrer_id} AND ${contactable(sql)}`)[0]
    if (!ref) continue   // người giới thiệu đã từ chối/đối chứng: giữ bản ghi thưởng, không tạo việc liên hệ
    const name = (ref.name as string) || `khách #${ref.id}`
    // Mặc định: giảm 10% đơn tiếp theo cho người giới thiệu (Cô Hạ duyệt 27/09/2026). Đổi qua env REFERRAL_REWARD_TEXT khi cần.
    const reward = `Quà: ${process.env.REFERRAL_REWARD_TEXT || 'Giảm 10% cho đơn hàng tiếp theo của người giới thiệu'}`
    const t = await sql`
      INSERT INTO crm_tasks (customer_id, title, due_at, assigned_staff_id, created_by, auto_key)
      VALUES (${ref.id}, ${taskTitle('referral_reward', name, reward)}, NOW() + INTERVAL '2 days', ${ref.assigned_staff_id}, 0, ${'ref:' + f.referred_id})
      ON CONFLICT (auto_key) WHERE auto_key IS NOT NULL DO NOTHING
    `
    n += t.count
  }
  return n
}

/**
 * Sinh việc tự động cho nhân viên theo mốc vòng đời của khách (mỗi khách/mốc đúng 1 việc nhờ auto_key).
 * Chỉ khách ĐƯỢC PHÉP liên hệ (chưa từ chối, không thuộc nhóm đối chứng).
 */
export async function createLifecycleTasks(perKind = 100): Promise<Record<string, number>> {
  const sql = getDb()
  const out: Record<string, number> = {}
  const ok = contactable(sql)
  const nm = sql`COALESCE(NULLIF(trim(c.name), ''), 'khách #' || c.id)`
  const url = sql`${SITE + '/dua-ca-muoi?ref='} || COALESCE(c.referral_code, '')`

  // Mỗi loại việc trong khối try/catch riêng: 1 loại lỗi (vd cột thiếu, khoá đụng độ) không được chặn các loại còn lại trong cùng lần chạy.
  const run = async (key: string, fn: () => Promise<{ count: number }>) => {
    try { out[key] = (await fn()).count } catch (e) {
      out[key] = 0
      console.error(`[loop-db] createLifecycleTasks:${key} lỗi:`, e instanceof Error ? e.message : e)
    }
  }

  // Ngày 7: mua lần đầu cách đây 6–20 ngày → hỏi thăm, xin ảnh, gửi link giới thiệu
  await run('d7', () => sql`
    INSERT INTO crm_tasks (customer_id, title, due_at, assigned_staff_id, created_by, auto_key)
    SELECT c.id, ${taskTitle('d7', '{{NAME}}', '{{URL}}')}, NOW() + INTERVAL '1 day', c.assigned_staff_id, 0, 'd7:' || c.id
    FROM customers c
    WHERE c.order_count = 1 AND c.total_spent > 0 AND c.last_order_at BETWEEN NOW() - INTERVAL '20 days' AND NOW() - INTERVAL '6 days' AND ${ok}
    ORDER BY c.id LIMIT ${perKind}
    ON CONFLICT (auto_key) WHERE auto_key IS NOT NULL DO NOTHING`)
  if (out.d7) await sql`
    UPDATE crm_tasks t SET title = replace(replace(t.title, '{{NAME}}', ${nm}), '{{URL}}', 'Link giới thiệu: ' || ${url})
    FROM customers c WHERE t.customer_id = c.id AND t.auto_key = 'd7:' || c.id AND t.title LIKE '%{{NAME}}%'`.catch(e => console.error('[loop-db] điền tên d7 lỗi:', e))

  // Ngày 12–30: vẫn chỉ mua 1 lần → gợi ý sản phẩm/khóa kế tiếp
  await run('next', () => sql`
    INSERT INTO crm_tasks (customer_id, title, due_at, assigned_staff_id, created_by, auto_key)
    SELECT c.id, ${taskTitle('next', '{{NAME}}')}, NOW() + INTERVAL '1 day', c.assigned_staff_id, 0, 'nx:' || c.id
    FROM customers c
    WHERE c.order_count = 1 AND c.total_spent > 0 AND c.last_order_at BETWEEN NOW() - INTERVAL '30 days' AND NOW() - INTERVAL '12 days' AND ${ok}
    ORDER BY c.id LIMIT ${perKind}
    ON CONFLICT (auto_key) WHERE auto_key IS NOT NULL DO NOTHING`)
  if (out.next) await sql`
    UPDATE crm_tasks t SET title = replace(t.title, '{{NAME}}', ${nm})
    FROM customers c WHERE t.customer_id = c.id AND t.auto_key = 'nx:' || c.id AND t.title LIKE '%{{NAME}}%'`.catch(e => console.error('[loop-db] điền tên next lỗi:', e))

  // Học viên mới (trả tiền khóa 3–14 ngày trước)
  await run('course_welcome', () => sql`
    INSERT INTO crm_tasks (customer_id, title, due_at, assigned_staff_id, created_by, auto_key)
    SELECT c.id, ${taskTitle('course_welcome', '{{NAME}}')}, NOW() + INTERVAL '1 day', c.assigned_staff_id, 0, 'cw:' || c.id
    FROM customers c
    WHERE EXISTS (
      SELECT 1 FROM course_leads l WHERE l.payment_status = 'paid'
        AND l.paid_at BETWEEN NOW() - INTERVAL '14 days' AND NOW() - INTERVAL '3 days'
        AND char_length(regexp_replace(l.phone, '[^0-9]', '', 'g')) >= 9
        AND right(regexp_replace(l.phone, '[^0-9]', '', 'g'), 9) = right(c.phone, 9)) AND ${ok}
    ORDER BY c.id LIMIT ${perKind}
    ON CONFLICT (auto_key) WHERE auto_key IS NOT NULL DO NOTHING`)
  if (out.course_welcome) await sql`
    UPDATE crm_tasks t SET title = replace(t.title, '{{NAME}}', ${nm})
    FROM customers c WHERE t.customer_id = c.id AND t.auto_key = 'cw:' || c.id AND t.title LIKE '%{{NAME}}%'`.catch(e => console.error('[loop-db] điền tên course_welcome lỗi:', e))

  // VIP: chi tiêu lớn + mua nhiều lần + còn gần đây (mỗi khách 1 việc mỗi quý)
  const vipSpent = Number(process.env.LOOP_VIP_SPENT) || 3_000_000
  await run('vip', () => sql`
    INSERT INTO crm_tasks (customer_id, title, due_at, assigned_staff_id, created_by, auto_key)
    SELECT c.id, ${taskTitle('vip', '{{NAME}}')}, NOW() + INTERVAL '2 days', c.assigned_staff_id, 0,
           'vip:' || c.id || ':' || to_char(NOW(), 'YYYY') || 'Q' || to_char(NOW(), 'Q')
    FROM customers c
    WHERE c.total_spent >= ${vipSpent} AND c.order_count >= 3 AND c.last_order_at > NOW() - INTERVAL '90 days' AND ${ok}
    ORDER BY c.total_spent DESC LIMIT ${perKind}
    ON CONFLICT (auto_key) WHERE auto_key IS NOT NULL DO NOTHING`)
  if (out.vip) await sql`
    UPDATE crm_tasks t SET title = replace(t.title, '{{NAME}}', ${nm})
    FROM customers c WHERE t.customer_id = c.id AND t.auto_key LIKE 'vip:' || c.id || ':%' AND t.title LIKE '%{{NAME}}%'`.catch(e => console.error('[loop-db] điền tên vip lỗi:', e))

  return out
}

export type { Segment }
