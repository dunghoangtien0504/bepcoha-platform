import type { CampaignCriteria, Arm } from './campaigns'
import postgres from 'postgres'
import { normalizePhone } from './phone'

// Dùng DATABASE_URL từ env – URL-encode ký tự đặc biệt trong password
const connectionString = process.env.DATABASE_URL || ''

// Giữ kết nối + trạng thái init trên globalThis để không bị tạo lại mỗi lần HMR/route khởi tạo module.
const g = globalThis as unknown as { __hacoSql?: ReturnType<typeof postgres>; __hacoInit3?: Promise<void>; __hacoInitKey?: string }

export function getDb() {
  if (!g.__hacoSql) {
    g.__hacoSql = postgres(connectionString, {
      // Mặc định bật SSL (Supabase). Chỉ tắt được khi thử trên PostgreSQL cục bộ: DB_SSL=off
      ssl: process.env.DB_SSL === 'off' ? false : { rejectUnauthorized: false },
      max: 5,
      idle_timeout: 20,
      // Supabase/pgbouncer (transaction pooler) không hỗ trợ prepared statement -> lỗi 26000 "prepared statement does not exist"
      prepare: false,
      // DDL "IF NOT EXISTS" sinh NOTICE mỗi lần chạy lại — không phải lỗi, không cần in ra log.
      onnotice: () => {},
    })
  }
  return g.__hacoSql
}

export const DEFAULT_QC_RULES = `Tiêu chí chấm chất lượng tư vấn bán hàng:
1. Chào hỏi và phản hồi khách trong vòng 5 phút (giờ làm việc); chào lịch sự, xưng hô đúng.
2. Trả lời đúng nhu cầu, thông tin sản phẩm/giá/phí ship chính xác, không bỏ sót câu hỏi của khách.
3. Chủ động hỏi thông tin cần thiết (SĐT, địa chỉ, số lượng) và dẫn dắt tới chốt đơn.
4. Thái độ nhã nhặn, không tranh cãi, không bỏ lơ khách; xử lý phàn nàn có trách nhiệm.
5. Kết thúc hội thoại bằng lời cảm ơn/hẹn chăm sóc.`

// ── Schema init ─────────────────────────────────────────────────────────────
export function initDb(): Promise<void> {
  // Khoá theo nội dung hàm khởi tạo: sửa DDL (thêm bảng/cột) thì lần gọi kế tiếp tự chạy lại, không phải restart server.
  const key = simpleHash(runInitDb.toString() + schemaUpToDate.toString())
  if (!g.__hacoInit3 || g.__hacoInitKey !== key) {
    g.__hacoInitKey = key
    const p = runInitDb().catch(err => { if (g.__hacoInit3 === p) g.__hacoInit3 = undefined; throw err })
    g.__hacoInit3 = p
  }
  return g.__hacoInit3
}

function simpleHash(str: string): string {
  let h = 5381
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0
  return String(h)
}

// Schema đã đầy đủ thì bỏ qua ~50 câu DDL (mỗi câu là 1 vòng mạng tới DB từ xa, và ALTER TABLE có thể chờ khoá rất lâu).
// Khi thêm bảng/cột mới vào initDb, thêm dấu hiệu tương ứng vào câu kiểm tra dưới đây.
async function schemaUpToDate(sql: ReturnType<typeof postgres>): Promise<boolean> {
  try {
    const r = await sql`
      SELECT
        to_regclass('public.notification_logs') IS NOT NULL
        AND to_regclass('public.system_logs') IS NOT NULL
        AND to_regclass('public.ai_usage_logs') IS NOT NULL
        AND to_regclass('public.ai_jobs') IS NOT NULL
        AND to_regclass('public.opportunities') IS NOT NULL
        AND to_regclass('public.crm_tasks') IS NOT NULL
        AND to_regclass('public.customer_activities') IS NOT NULL
        AND to_regclass('public.payment_followups') IS NOT NULL
        AND to_regclass('public.care_campaigns') IS NOT NULL
        AND to_regclass('public.care_campaign_members') IS NOT NULL
        AND to_regclass('public.care_campaign_exports') IS NOT NULL
        AND to_regclass('public.email_optouts') IS NOT NULL
        AND to_regclass('public.referral_rewards') IS NOT NULL
        AND to_regclass('public.customer_care_logs') IS NOT NULL
        AND (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'public' AND (
              (table_name = 'conversation_evaluations' AND column_name IN ('score100', 'verdict', 'violations', 'job_id', 'tags', 'analysis'))
           OR (table_name = 'conversations' AND column_name IN ('page_id', 'last_message_at', 'messages_synced_at', 'alerted_at', 'assignees', 'is_unread', 'unread_count'))
           OR (table_name = 'customers' AND column_name IN ('stage', 'assigned_staff_id', 'internal_note', 'last_care_sent_at', 'opted_out_at', 'segments', 'referral_code', 'referred_by', 'phone_verified_at'))
           OR (table_name = 'gift_leads' AND column_name IN ('consent_at', 'consent_text', 'confirmed_at', 'segment_answer', 'referred_by_code', 'merged_at'))
           OR (table_name = 'course_leads' AND column_name = 'referred_by_code')
           OR (table_name = 'crm_tasks' AND column_name = 'auto_key')
        )) = 30 AS ok
    `
    return r[0]?.ok === true
  } catch { return false }
}

/**
 * Tạo/cập nhật lược đồ trong MỘT giao dịch có khoá: nhiều instance khởi động cùng lúc (Vercel) không được
 * cùng chạy DDL (dễ lỗi "duplicate key ... pg_class_relname_nsp_index"). Người vào sau chờ khoá, kiểm tra lại rồi bỏ qua.
 */
async function runInitDb() {
  const base = getDb()
  if (await schemaUpToDate(base)) return
  await base.begin(async tx => {
    await tx`SELECT pg_advisory_xact_lock(4242000)`
    if (await schemaUpToDate(tx as unknown as typeof base)) return
    await runInitDbBody(tx as unknown as typeof base)
  })
}

async function runInitDbBody(sql: ReturnType<typeof getDb>) {
  await sql`
    CREATE TABLE IF NOT EXISTS gift_leads (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      email_sent BOOLEAN DEFAULT FALSE,
      email_sequence_status TEXT DEFAULT 'pending_email1',
      next_email_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 day'),
      email_sequence_paused BOOLEAN DEFAULT FALSE,
      last_email_sent_at TIMESTAMPTZ
    )
  `
  // Migration: thêm cột email sequence nếu bảng cũ chưa có
  await sql`ALTER TABLE gift_leads ADD COLUMN IF NOT EXISTS email_sequence_status TEXT DEFAULT 'pending_email1'`
  await sql`ALTER TABLE gift_leads ADD COLUMN IF NOT EXISTS next_email_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 day')`
  await sql`ALTER TABLE gift_leads ADD COLUMN IF NOT EXISTS email_sequence_paused BOOLEAN DEFAULT FALSE`
  await sql`ALTER TABLE gift_leads ADD COLUMN IF NOT EXISTS last_email_sent_at TIMESTAMPTZ`
  await sql`
    CREATE TABLE IF NOT EXISTS course_leads (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      payment_ref TEXT UNIQUE,
      payment_status TEXT DEFAULT 'pending',
      amount INTEGER DEFAULT 299000,
      paid_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      email_sent BOOLEAN DEFAULT FALSE,
      telegram_sent BOOLEAN DEFAULT FALSE
    )
  `
  // Migration: sửa default amount cũ (138000) thành 299000
  await sql`ALTER TABLE course_leads ALTER COLUMN amount SET DEFAULT 299000`
  await sql`
    CREATE TABLE IF NOT EXISTS staff (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'staff')),
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      last_login TIMESTAMPTZ
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id SERIAL PRIMARY KEY,
      user_id INT NOT NULL,
      action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
      table_name TEXT NOT NULL CHECK (table_name IN ('gift_leads', 'course_leads', 'staff')),
      record_id INT NOT NULL,
      old_value JSONB,
      new_value JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      ip_address TEXT
    )
  `
  // Migration: drop FK constraint trên audit_logs.user_id (admin backdoor dùng id=0, không có trong staff)
  await sql`
    DO $$
    DECLARE
      con_name text;
    BEGIN
      SELECT conname INTO con_name
      FROM pg_constraint
      WHERE conrelid = 'audit_logs'::regclass
        AND contype = 'f'
        AND pg_get_constraintdef(oid) LIKE '%user_id%';
      IF con_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE audit_logs DROP CONSTRAINT %I', con_name);
      END IF;
    END $$;
  `
  // Migration: audit_logs.table_name CHECK constraint — drop + re-add trong 1 block
  // để tránh race condition khi nhiều request gọi initDb() đồng thời.
  await sql`
    DO $$
    DECLARE
      con_name text;
    BEGIN
      -- khoá chống đua: 2 instance khởi động cùng lúc không được cùng ADD CONSTRAINT
      PERFORM pg_advisory_xact_lock(4242001);
      SELECT conname INTO con_name
      FROM pg_constraint
      WHERE conrelid = 'audit_logs'::regclass
        AND contype = 'c'
        AND pg_get_constraintdef(oid) LIKE '%table_name%';
      IF con_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE audit_logs DROP CONSTRAINT %I', con_name);
      END IF;
      ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_table_name_check
        CHECK (table_name IN ('gift_leads', 'course_leads', 'staff', 'customers'));
    END $$;
  `
  await sql`
    CREATE TABLE IF NOT EXISTS ai_orders (
      id SERIAL PRIMARY KEY,
      poscake_order_id TEXT,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      customer_address TEXT,
      items JSONB NOT NULL DEFAULT '[]',
      raw_conversation TEXT,
      confidence REAL,
      status TEXT NOT NULL DEFAULT 'created',
      source TEXT DEFAULT 'meta_ai',
      note TEXT,
      poscake_response JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS course_settings (
      id SERIAL PRIMARY KEY,
      course_name TEXT DEFAULT 'Khóa học Dưa Cà Muối',
      course_price INTEGER DEFAULT 1095000,
      discount_price INTEGER DEFAULT 299000,
      course_description TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS conversations (
      id SERIAL PRIMARY KEY,
      pancake_conversation_id TEXT,
      customer_name TEXT NOT NULL DEFAULT '',
      customer_phone TEXT DEFAULT '',
      customer_avatar TEXT,
      platform TEXT DEFAULT 'facebook',
      page_name TEXT DEFAULT '',
      messages JSONB NOT NULL DEFAULT '[]',
      ai_summary TEXT,
      evaluation_score INTEGER CHECK (evaluation_score BETWEEN 1 AND 5),
      evaluation_label TEXT,
      evaluation_note TEXT,
      evaluated_at TIMESTAMPTZ,
      has_order BOOLEAN DEFAULT FALSE,
      ai_order_id INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS conversations_pancake_id_unique
    ON conversations (pancake_conversation_id)
    WHERE pancake_conversation_id IS NOT NULL
  `
  await sql`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS page_id TEXT`
  await sql`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS pancake_customer_id TEXT`
  await sql`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS last_message_preview TEXT NOT NULL DEFAULT ''`
  await sql`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ`
  await sql`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS messages_synced_at TIMESTAMPTZ`
  await sql`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS alerted_at TIMESTAMPTZ`
  await sql`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS assignees JSONB NOT NULL DEFAULT '[]'`
  await sql`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS is_unread BOOLEAN NOT NULL DEFAULT FALSE`
  await sql`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS unread_count INTEGER NOT NULL DEFAULT 0`
  await sql`
    CREATE TABLE IF NOT EXISTS conversation_evaluations (
      id SERIAL PRIMARY KEY,
      pancake_conversation_id TEXT NOT NULL UNIQUE,
      customer_name TEXT,
      page_name TEXT,
      ai_summary TEXT,
      customer_needs TEXT,
      sales_name TEXT,
      sales_evaluation TEXT,
      ai_score INTEGER,
      evaluation_score INTEGER CHECK (evaluation_score BETWEEN 1 AND 5),
      evaluation_label TEXT,
      evaluation_note TEXT,
      analyzed_at TIMESTAMPTZ,
      evaluated_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  // Migration: thêm cột phân tích AI cho bảng cũ
  await sql`ALTER TABLE conversation_evaluations ADD COLUMN IF NOT EXISTS customer_needs TEXT`
  await sql`ALTER TABLE conversation_evaluations ADD COLUMN IF NOT EXISTS sales_name TEXT`
  await sql`ALTER TABLE conversation_evaluations ADD COLUMN IF NOT EXISTS sales_evaluation TEXT`
  await sql`ALTER TABLE conversation_evaluations ADD COLUMN IF NOT EXISTS ai_score INTEGER`
  await sql`ALTER TABLE conversation_evaluations ADD COLUMN IF NOT EXISTS analyzed_at TIMESTAMPTZ`
  await sql`ALTER TABLE conversation_evaluations ADD COLUMN IF NOT EXISTS needs_attention BOOLEAN DEFAULT FALSE`
  await sql`ALTER TABLE conversation_evaluations ADD COLUMN IF NOT EXISTS issue TEXT`
  await sql`ALTER TABLE conversation_evaluations ADD COLUMN IF NOT EXISTS tags TEXT`
  await sql`
    CREATE TABLE IF NOT EXISTS sot_tron_nom_orders (
      id SERIAL PRIMARY KEY,
      ref_code TEXT UNIQUE NOT NULL,
      pancake_order_id TEXT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT DEFAULT '',
      address TEXT NOT NULL,
      product TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      total_price INTEGER NOT NULL,
      payment_status TEXT NOT NULL DEFAULT 'pending',
      paid_at TIMESTAMPTZ,
      note TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS khan_do_xoi_orders (
      id SERIAL PRIMARY KEY,
      ref_code TEXT UNIQUE NOT NULL,
      pancake_order_id TEXT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT DEFAULT '',
      address TEXT NOT NULL,
      product TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      total_price INTEGER NOT NULL,
      payment_status TEXT NOT NULL DEFAULT 'pending',
      paid_at TIMESTAMPTZ,
      note TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS set_xoi_com_orders (
      id SERIAL PRIMARY KEY,
      ref_code TEXT UNIQUE NOT NULL,
      pancake_order_id TEXT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT DEFAULT '',
      address TEXT NOT NULL,
      product TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      total_price INTEGER NOT NULL,
      payment_status TEXT NOT NULL DEFAULT 'pending',
      paid_at TIMESTAMPTZ,
      note TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS sot_xa_xiu_orders (
      id SERIAL PRIMARY KEY,
      ref_code TEXT UNIQUE NOT NULL,
      pancake_order_id TEXT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT DEFAULT '',
      address TEXT NOT NULL,
      product TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      total_price INTEGER NOT NULL,
      payment_status TEXT NOT NULL DEFAULT 'pending',
      paid_at TIMESTAMPTZ,
      note TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS customers (
      id SERIAL PRIMARY KEY,
      phone TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      pancake_customer_id TEXT,
      tags JSONB NOT NULL DEFAULT '[]',
      source TEXT NOT NULL DEFAULT 'local' CHECK (source IN ('pancake', 'local')),
      order_count INTEGER NOT NULL DEFAULT 0,
      total_spent BIGINT NOT NULL DEFAULT 0,
      last_order_at TIMESTAMPTZ,
      first_seen_at TIMESTAMPTZ DEFAULT NOW(),
      synced_from_pancake_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_care_sent_at TIMESTAMPTZ`
  await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS opted_out_at TIMESTAMPTZ`
  await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS stage TEXT NOT NULL DEFAULT 'moi'`
  await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS assigned_staff_id INT`
  await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS internal_note TEXT NOT NULL DEFAULT ''`
  await sql`
    CREATE TABLE IF NOT EXISTS customer_care_logs (
      id SERIAL PRIMARY KEY,
      customer_id INT NOT NULL REFERENCES customers(id),
      staff_id INT NOT NULL,
      channel TEXT NOT NULL DEFAULT 'email',
      kind TEXT NOT NULL CHECK (kind IN ('manual', 'auto_reminder')),
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      success BOOLEAN NOT NULL DEFAULT TRUE,
      error TEXT,
      sent_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS opportunities (
      id SERIAL PRIMARY KEY,
      customer_id INT NOT NULL REFERENCES customers(id),
      title TEXT NOT NULL,
      stage TEXT NOT NULL DEFAULT 'moi' CHECK (stage IN ('moi', 'tu_van', 'bao_gia', 'dam_phan', 'da_chot', 'khong_chot')),
      value BIGINT NOT NULL DEFAULT 0,
      product_interest TEXT NOT NULL DEFAULT '',
      assigned_staff_id INT,
      note TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      closed_at TIMESTAMPTZ
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS crm_tasks (
      id SERIAL PRIMARY KEY,
      customer_id INT REFERENCES customers(id),
      opportunity_id INT REFERENCES opportunities(id),
      title TEXT NOT NULL,
      due_at TIMESTAMPTZ,
      done_at TIMESTAMPTZ,
      assigned_staff_id INT,
      created_by INT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS customer_activities (
      id SERIAL PRIMARY KEY,
      customer_id INT NOT NULL REFERENCES customers(id),
      kind TEXT NOT NULL,
      content TEXT NOT NULL,
      staff_id INT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`ALTER TABLE conversation_evaluations ADD COLUMN IF NOT EXISTS score100 INTEGER`
  await sql`ALTER TABLE conversation_evaluations ADD COLUMN IF NOT EXISTS verdict TEXT`
  await sql`ALTER TABLE conversation_evaluations ADD COLUMN IF NOT EXISTS violations JSONB NOT NULL DEFAULT '[]'`
  await sql`ALTER TABLE conversation_evaluations ADD COLUMN IF NOT EXISTS job_id INTEGER`
  await sql`ALTER TABLE conversation_evaluations ADD COLUMN IF NOT EXISTS analysis JSONB`
  await sql`
    CREATE TABLE IF NOT EXISTS ai_jobs (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      rules_prompt TEXT NOT NULL DEFAULT '',
      pass_threshold INTEGER NOT NULL DEFAULT 70,
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      batch_size INTEGER NOT NULL DEFAULT 3,
      last_run_at TIMESTAMPTZ,
      last_result JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS ai_usage_logs (
      id SERIAL PRIMARY KEY,
      job_id INTEGER,
      kind TEXT NOT NULL DEFAULT 'quality',
      model TEXT NOT NULL,
      conversations INTEGER NOT NULL DEFAULT 1,
      input_tokens INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0,
      cost_vnd NUMERIC(14,2) NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS system_logs (
      id SERIAL PRIMARY KEY,
      level TEXT NOT NULL DEFAULT 'info',
      source TEXT NOT NULL,
      message TEXT NOT NULL,
      meta JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS notification_logs (
      id SERIAL PRIMARY KEY,
      channel TEXT NOT NULL,
      kind TEXT NOT NULL,
      subject TEXT NOT NULL,
      success BOOLEAN NOT NULL DEFAULT TRUE,
      error TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS payment_followups (
      id SERIAL PRIMARY KEY,
      kind TEXT NOT NULL,
      ref_code TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      attempts INT NOT NULL DEFAULT 0,
      last_error TEXT,
      next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      escalated BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      done_at TIMESTAMPTZ,
      UNIQUE (kind, ref_code)
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS email_optouts (
      email TEXT PRIMARY KEY,
      source TEXT NOT NULL DEFAULT 'link',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`ALTER TABLE gift_leads ADD COLUMN IF NOT EXISTS consent_at TIMESTAMPTZ`
  await sql`ALTER TABLE gift_leads ADD COLUMN IF NOT EXISTS consent_text TEXT`
  await sql`ALTER TABLE gift_leads ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ`
  await sql`ALTER TABLE gift_leads ADD COLUMN IF NOT EXISTS segment_answer TEXT`
  await sql`ALTER TABLE gift_leads ADD COLUMN IF NOT EXISTS referred_by_code TEXT`
  await sql`ALTER TABLE gift_leads ADD COLUMN IF NOT EXISTS merged_at TIMESTAMPTZ`
  await sql`ALTER TABLE course_leads ADD COLUMN IF NOT EXISTS referred_by_code TEXT`
  await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS segments TEXT[] NOT NULL DEFAULT '{}'`
  await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS referral_code TEXT`
  await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS referred_by INT`
  // SĐT đã xác minh (đơn thật / nhân viên nhập / Zalo / OTP). Khách tạo từ Mini App chưa xác minh thì NULL → không liên hệ chủ động.
  await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ`
  // Mặc định = đã xác minh (khách từ đơn Pancake, form cũ, nhân viên nhập). Mini App tạo khách chưa xác minh phải ghi NULL TƯỜNG MINH.
  await sql`ALTER TABLE customers ALTER COLUMN phone_verified_at SET DEFAULT NOW()`
  await sql`UPDATE customers SET phone_verified_at = COALESCE(created_at, NOW()) WHERE phone_verified_at IS NULL AND source <> 'mini'`
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS uq_customers_referral_code ON customers(referral_code) WHERE referral_code IS NOT NULL`
  await sql`ALTER TABLE crm_tasks ADD COLUMN IF NOT EXISTS auto_key TEXT`
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS uq_crm_tasks_auto_key ON crm_tasks(auto_key) WHERE auto_key IS NOT NULL`
  await sql`
    CREATE TABLE IF NOT EXISTS referral_rewards (
      id SERIAL PRIMARY KEY,
      referrer_id INT NOT NULL REFERENCES customers(id),
      referred_id INT NOT NULL UNIQUE REFERENCES customers(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS care_campaigns (
      id SERIAL PRIMARY KEY,
      key TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      criteria JSONB NOT NULL,
      created_by INT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS care_campaign_members (
      campaign_id INT NOT NULL REFERENCES care_campaigns(id),
      customer_id INT NOT NULL REFERENCES customers(id),
      arm TEXT NOT NULL CHECK (arm IN ('treatment', 'holdout')),
      order_count_at_start INT NOT NULL,
      total_spent_at_start BIGINT NOT NULL,
      exported_at TIMESTAMPTZ,
      PRIMARY KEY (campaign_id, customer_id)
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_care_members_customer ON care_campaign_members(customer_id)`
  await sql`
    CREATE TABLE IF NOT EXISTS care_campaign_exports (
      id SERIAL PRIMARY KEY,
      campaign_id INT NOT NULL REFERENCES care_campaigns(id),
      user_id INT NOT NULL,
      row_count INT NOT NULL,
      ip_address TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  const jobCount = await sql`SELECT COUNT(*)::int AS n FROM ai_jobs`
  if (jobCount[0].n === 0) {
    await sql`
      INSERT INTO ai_jobs (name, rules_prompt)
      VALUES ('Chấm chất lượng chăm sóc khách', ${DEFAULT_QC_RULES})
    `
  }
  // Insert default course settings if not exists
  const settings = await sql`SELECT COUNT(*) as count FROM course_settings`
  if (parseInt(settings[0].count) === 0) {
    await sql`
      INSERT INTO course_settings (course_name, course_price, discount_price)
      VALUES ('Khóa học Dưa Cà Muối', 1095000, 299000)
    `
  }
}

// ── Việc phải làm lại sau thanh toán (thông báo/POS/email hỏng) ───────────────
export interface PaymentFollowup {
  id: number; kind: string; ref_code: string; status: string
  attempts: number; last_error: string | null; escalated: boolean
}

/** Thêm việc cần thử lại. Trùng (kind, ref) thì bỏ qua — không tạo nhiều bản. */
export async function enqueueFollowup(kind: string, refCode: string, delayMinutes = 0): Promise<void> {
  const sql = getDb()
  await sql`
    INSERT INTO payment_followups (kind, ref_code, next_attempt_at)
    VALUES (${kind}, ${refCode}, NOW() + make_interval(mins => ${delayMinutes}))
    ON CONFLICT (kind, ref_code) DO NOTHING
  `
}

/** Đánh dấu xong theo (loại, mã đơn) — dùng khi việc được làm xong ngay tại chỗ, không cần chờ lần thử lại. */
export async function markFollowupDoneByRef(kind: string, refCode: string): Promise<void> {
  const sql = getDb()
  await sql`UPDATE payment_followups SET status = 'done', done_at = NOW(), last_error = NULL WHERE kind = ${kind} AND ref_code = ${refCode}`
}

/**
 * Lấy các việc đến hạn và TĂNG số lần thử ngay lúc lấy (để hàm bị cắt giữa chừng vẫn tiến tới ngưỡng bỏ cuộc).
 * Cũng lấy các việc đã 'failed' mà chưa báo động được, để báo lại.
 * Khoá dòng để 2 lần chạy chồng nhau không lấy trùng.
 */
export async function claimDueFollowups(limit: number): Promise<PaymentFollowup[]> {
  const sql = getDb()
  const rows = await sql`
    UPDATE payment_followups
    SET next_attempt_at = NOW() + INTERVAL '10 minutes',
        attempts = attempts + CASE WHEN status = 'pending' THEN 1 ELSE 0 END
    WHERE id IN (
      SELECT id FROM payment_followups
      WHERE (status = 'pending' OR (status = 'failed' AND escalated = FALSE))
        AND next_attempt_at <= NOW()
      ORDER BY id LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, kind, ref_code, status, attempts, last_error, escalated
  `
  return rows as unknown as PaymentFollowup[]
}

export async function markFollowupDone(id: number): Promise<void> {
  const sql = getDb()
  await sql`UPDATE payment_followups SET status = 'done', done_at = NOW(), last_error = NULL WHERE id = ${id}`
}

/** Ghi lỗi + hẹn lần sau (lùi dần: 10, 20, 40… phút, tối đa 6 giờ). `attempts` đã tính lần vừa thử. */
export async function markFollowupFailed(id: number, error: string, attempts: number, giveUp: boolean): Promise<void> {
  const sql = getDb()
  const delayMin = Math.min(5 * 2 ** attempts, 360)
  await sql`
    UPDATE payment_followups
    SET attempts = ${attempts}, last_error = ${error.replace(/[^\s@]+@[^\s@]+/g, '***@***').slice(0, 500)},
        status = ${giveUp ? 'failed' : 'pending'},
        next_attempt_at = NOW() + make_interval(mins => ${delayMin})
    WHERE id = ${id}
  `
}

export async function markFollowupEscalated(id: number): Promise<void> {
  const sql = getDb()
  await sql`UPDATE payment_followups SET escalated = TRUE WHERE id = ${id}`
}

// ── Gift leads ───────────────────────────────────────────────────────────────
export async function insertGiftLead(data: { name: string; email: string; phone: string; consentText?: string; segmentAnswer?: string | null; referredByCode?: string | null }) {
  const sql = getDb()
  // Có consentText nghĩa là khách đã TỰ TICK đồng ý nhận tin chăm sóc; lưu thời điểm + nội dung đã hiển thị để làm bằng chứng
  const rows = await sql`
    INSERT INTO gift_leads (name, email, phone, consent_at, consent_text, email_sequence_status, email_sequence_paused, segment_answer, referred_by_code)
    VALUES (${data.name}, ${data.email}, ${data.phone}, ${data.consentText ? sql`NOW()` : null}, ${data.consentText ?? null},
            ${data.consentText ? 'pending_confirm' : 'no_consent'}, TRUE, ${data.segmentAnswer ?? null}, ${data.referredByCode ?? null})
    RETURNING id
  `
  return rows[0].id as number
}

/** Khách đã tick nhưng CHƯA chứng minh là chủ email: chờ họ bấm link xác nhận trong thư quà, rồi mới vào chuỗi. */
export async function markGiftPendingConfirm(id: number) {
  const sql = getDb()
  await sql`UPDATE gift_leads SET email_sequence_status = 'pending_confirm', email_sequence_paused = TRUE WHERE id = ${id}`
}

/**
 * Chủ email bấm xác nhận: mở chuỗi (email 1 sau 1 ngày). Chỉ áp cho người đã tick, chưa xác nhận.
 * Nếu email từng hủy nhưng lần đồng ý NÀY mới hơn lần hủy, coi là đăng ký lại có chủ ý: gỡ sổ hủy.
 */
export async function confirmGiftOptIn(email: string): Promise<boolean> {
  const sql = getDb()
  const e = email.trim().toLowerCase()
  return await sql.begin(async tx => {
    const rows = await tx`
      UPDATE gift_leads
      SET confirmed_at = NOW(), email_sequence_paused = FALSE, email_sequence_status = 'pending_email1',
          next_email_at = NOW() + INTERVAL '1 day'
      WHERE lower(email) = ${e} AND consent_at IS NOT NULL AND confirmed_at IS NULL
        AND email_sequence_status = 'pending_confirm'
        AND consent_at > COALESCE((SELECT created_at FROM email_optouts WHERE email = ${e}), '-infinity'::timestamptz)
    `
    if (rows.count > 0) await tx`DELETE FROM email_optouts WHERE email = ${e}`
    return rows.count > 0
  })
}

/** Khách không tick đồng ý: vẫn nhận quà đã hứa, nhưng KHÔNG vào chuỗi email chăm sóc. */
export async function markGiftNoConsent(id: number) {
  const sql = getDb()
  await sql`UPDATE gift_leads SET email_sequence_status = 'no_consent', email_sequence_paused = TRUE WHERE id = ${id}`
}

export async function isEmailOptedOut(email: string): Promise<boolean> {
  const sql = getDb()
  const e = email.trim().toLowerCase()
  const rows = await sql`
    SELECT 1 FROM email_optouts WHERE email = ${e}
    UNION ALL SELECT 1 FROM customers WHERE lower(email) = ${e} AND opted_out_at IS NOT NULL
    LIMIT 1
  `
  return rows.length > 0
}

/** Hủy nhận tin cho 1 email: ghi sổ + đánh dấu khách + dừng chuỗi email quà. Mọi luồng gửi đều đọc các dấu này. */
export async function unsubscribeEmail(email: string, source = 'link'): Promise<void> {
  const sql = getDb()
  const e = email.trim().toLowerCase()
  await sql.begin(async tx => {
    await tx`INSERT INTO email_optouts (email, source) VALUES (${e}, ${source}) ON CONFLICT (email) DO NOTHING`
    await tx`UPDATE customers SET opted_out_at = COALESCE(opted_out_at, NOW()), updated_at = NOW() WHERE lower(email) = ${e}`
    await tx`UPDATE gift_leads SET email_sequence_paused = TRUE WHERE lower(email) = ${e}`
  })
}

export async function getGiftLeadForSheet(id: number) {
  const sql = getDb()
  const rows = await sql`SELECT id, name, email, phone, segment_answer, referred_by_code, consent_at, created_at FROM gift_leads WHERE id = ${id}`
  return rows[0] as { id: number; name: string; email: string; phone: string; segment_answer: string | null; referred_by_code: string | null; consent_at: string | null; created_at: string } | undefined
}

export async function markGiftEmailSent(id: number) {
  const sql = getDb()
  await sql`UPDATE gift_leads SET email_sent = TRUE WHERE id = ${id}`
}

export async function getAllGiftLeads() {
  const sql = getDb()
  const rows = await sql`SELECT * FROM gift_leads ORDER BY created_at DESC`
  return rows as unknown as GiftLead[]
}

export async function getGiftLeadsPendingEmails() {
  const sql = getDb()
  const rows = await sql`
    SELECT * FROM gift_leads
    WHERE next_email_at <= NOW()
      AND email_sequence_paused = FALSE
      AND email_sequence_status NOT IN ('completed', 'converted')
      AND NOT EXISTS (SELECT 1 FROM email_optouts o WHERE o.email = lower(gift_leads.email))
      AND NOT EXISTS (
        SELECT 1 FROM customers cu
        WHERE char_length(regexp_replace(gift_leads.phone, '[^0-9]', '', 'g')) >= 9
          AND right(regexp_replace(gift_leads.phone, '[^0-9]', '', 'g'), 9) = right(regexp_replace(cu.phone, '[^0-9]', '', 'g'), 9)
          AND (
            cu.opted_out_at IS NOT NULL
            OR EXISTS (
              SELECT 1 FROM care_campaign_members m JOIN care_campaigns k ON k.id = m.campaign_id
              WHERE m.customer_id = cu.id AND m.arm = 'holdout' AND k.created_at > NOW() - INTERVAL '120 days'
            )
          )
      )
    ORDER BY next_email_at ASC
  `
  return rows as unknown as GiftLead[]
}

export async function updateGiftLeadSequence(
  id: number,
  status: string,
  nextEmailAt?: Date
) {
  const sql = getDb()
  if (nextEmailAt) {
    await sql`
      UPDATE gift_leads
      SET email_sequence_status = ${status},
          next_email_at = ${nextEmailAt},
          last_email_sent_at = NOW()
      WHERE id = ${id}
    `
  } else {
    await sql`
      UPDATE gift_leads
      SET email_sequence_status = ${status},
          last_email_sent_at = NOW()
      WHERE id = ${id}
    `
  }
}

// Chỉ dừng chuỗi email khi email người mua KHỚP email của gift lead (id do phía khách gửi lên nên không được tin tưởng)
export async function pauseEmailSequenceForEmail(id: number, email: string): Promise<boolean> {
  const sql = getDb()
  const rows = await sql`
    UPDATE gift_leads
    SET email_sequence_paused = TRUE, email_sequence_status = 'converted'
    WHERE id = ${id} AND lower(email) = lower(${email.trim()})
  `
  return rows.count > 0
}

export async function pauseEmailSequence(id: number) {
  const sql = getDb()
  await sql`
    UPDATE gift_leads
    SET email_sequence_paused = TRUE, email_sequence_status = 'converted'
    WHERE id = ${id}
  `
}

// ── Course leads ─────────────────────────────────────────────────────────────
export async function insertCourseLead(data: {
  name: string; email: string; phone: string; paymentRef: string; amount?: number; referredByCode?: string | null
}) {
  const sql = getDb()
  const amount = data.amount ?? 299000
  const rows = await sql`
    INSERT INTO course_leads (name, email, phone, payment_ref, amount, referred_by_code)
    VALUES (${data.name}, ${data.email}, ${data.phone}, ${data.paymentRef}, ${amount}, ${data.referredByCode ?? null})
    ON CONFLICT (payment_ref) DO UPDATE
      SET name = EXCLUDED.name, email = EXCLUDED.email, phone = EXCLUDED.phone, amount = EXCLUDED.amount,
          referred_by_code = COALESCE(course_leads.referred_by_code, EXCLUDED.referred_by_code)
    RETURNING id
  `
  return rows[0].id as number
}

// Nguyên tử: chỉ trả true cho request ĐẦU TIÊN chuyển đơn sang 'paid' (webhook SePay có thể gọi trùng)
export async function confirmPayment(paymentRef: string): Promise<boolean> {
  const sql = getDb()
  const rows = await sql`
    UPDATE course_leads
    SET payment_status = 'paid', paid_at = NOW()
    WHERE payment_ref = ${paymentRef} AND payment_status IS DISTINCT FROM 'paid'
  `
  return rows.count > 0
}

export async function getLeadByRef(paymentRef: string) {
  const sql = getDb()
  const rows = await sql`SELECT * FROM course_leads WHERE payment_ref = ${paymentRef}`
  return rows[0] as CourseLead | undefined
}

export async function markCourseEmailSent(id: number) {
  const sql = getDb()
  await sql`UPDATE course_leads SET email_sent = TRUE WHERE id = ${id}`
}

export async function markTelegramSent(id: number) {
  const sql = getDb()
  await sql`UPDATE course_leads SET telegram_sent = TRUE WHERE id = ${id}`
}

export async function getAllCourseLeads() {
  const sql = getDb()
  const rows = await sql`SELECT * FROM course_leads ORDER BY created_at DESC`
  return rows as unknown as CourseLead[]
}

// Compat shim
export async function markEmailSent(table: 'gift_leads' | 'course_leads', id: number) {
  if (table === 'gift_leads') return markGiftEmailSent(id)
  return markCourseEmailSent(id)
}

// ── Staff Management ─────────────────────────────────────────────────────────
export async function insertStaff(
  name: string,
  email: string,
  passwordHash: string,
  role: 'admin' | 'staff' = 'staff'
) {
  const sql = getDb()
  const rows = await sql`
    INSERT INTO staff (name, email, password_hash, role)
    VALUES (${name}, ${email}, ${passwordHash}, ${role})
    RETURNING id, name, email, role, status, created_at, last_login
  `
  return rows[0] as Staff
}

export async function updateStaffStatus(id: number, status: 'active' | 'inactive') {
  const sql = getDb()
  const rows = await sql`
    UPDATE staff
    SET status = ${status}
    WHERE id = ${id}
    RETURNING id, name, email, role, status, created_at, last_login
  `
  return rows[0] as Staff | undefined
}

export async function updateStaffRole(id: number, role: 'admin' | 'staff') {
  const sql = getDb()
  const rows = await sql`
    UPDATE staff
    SET role = ${role}
    WHERE id = ${id}
    RETURNING id, name, email, role, status, created_at, last_login
  `
  return rows[0] as Staff | undefined
}

export async function deleteStaff(id: number) {
  const sql = getDb()
  await sql`
    UPDATE staff
    SET status = 'inactive'
    WHERE id = ${id}
  `
}

export async function getStaffByEmail(email: string) {
  const sql = getDb()
  const rows = await sql`SELECT * FROM staff WHERE email = ${email}`
  return rows[0] as StaffWithPassword | undefined
}

export async function getStaffById(id: number) {
  const sql = getDb()
  const rows = await sql`SELECT id, name, email, role, status, created_at, last_login FROM staff WHERE id = ${id}`
  return rows[0] as Staff | undefined
}

export async function getAllStaff() {
  const sql = getDb()
  const rows = await sql`
    SELECT id, name, email, role, status, created_at, last_login FROM staff
    WHERE status = 'active'
    ORDER BY created_at DESC
  `
  return rows as unknown as Staff[]
}

export async function updateLastLogin(id: number) {
  const sql = getDb()
  await sql`
    UPDATE staff
    SET last_login = NOW()
    WHERE id = ${id}
  `
}

// ── Audit Logs ────────────────────────────────────────────────────────────────
export async function insertAuditLog(
  userId: number,
  action: 'INSERT' | 'UPDATE' | 'DELETE',
  tableName: 'gift_leads' | 'course_leads' | 'staff' | 'customers',
  recordId: number,
  oldValue: Record<string, any> | null,
  newValue: Record<string, any> | null,
  ipAddress: string
) {
  const sql = getDb()
  const rows = await sql`
    INSERT INTO audit_logs (user_id, action, table_name, record_id, old_value, new_value, ip_address)
    VALUES (${userId}, ${action}, ${tableName}, ${recordId}, ${JSON.stringify(oldValue)}, ${JSON.stringify(newValue)}, ${ipAddress})
    RETURNING id, user_id, action, table_name, record_id, old_value, new_value, created_at, ip_address
  `
  return rows[0] as AuditLog
}

export async function getAuditLogs(limit: number = 100, offset: number = 0) {
  const sql = getDb()
  const rows = await sql`
    SELECT al.id, al.user_id, COALESCE(s.name, 'Admin') as user_name, al.action, al.table_name, al.record_id, al.old_value, al.new_value, al.created_at, al.ip_address
    FROM audit_logs al
    LEFT JOIN staff s ON al.user_id = s.id
    ORDER BY al.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `
  return rows as unknown as AuditLogWithStaff[]
}

export async function getAuditLogsByFilters(
  action?: string,
  tableName?: string,
  startDate?: Date,
  endDate?: Date,
  limit: number = 100,
  offset: number = 0
) {
  const sql = getDb()
  let query = `
    SELECT al.id, al.user_id, COALESCE(s.name, 'Admin') as user_name, al.action, al.table_name, al.record_id, al.old_value, al.new_value, al.created_at, al.ip_address
    FROM audit_logs al
    LEFT JOIN staff s ON al.user_id = s.id
    WHERE 1=1
  `
  const params: any[] = []

  if (action) {
    query += ` AND al.action = $${params.length + 1}`
    params.push(action)
  }
  if (tableName) {
    query += ` AND al.table_name = $${params.length + 1}`
    params.push(tableName)
  }
  if (startDate) {
    query += ` AND al.created_at >= $${params.length + 1}`
    params.push(startDate)
  }
  if (endDate) {
    query += ` AND al.created_at <= $${params.length + 1}`
    params.push(endDate)
  }

  query += ` ORDER BY al.created_at DESC LIMIT ${limit} OFFSET ${offset}`
  const rows = (await sql.unsafe(query, params)) as any[]
  return rows as unknown as AuditLogWithStaff[]
}

// ── Conversations ─────────────────────────────────────────────────────────────
export async function insertConversation(data: {
  pancakeConversationId?: string
  customerName: string
  customerPhone?: string
  customerAvatar?: string
  platform?: string
  pageName?: string
  messages: ConversationMessage[]
  aiSummary?: string
  hasOrder?: boolean
  aiOrderId?: number
}) {
  const sql = getDb()
  const rows = await sql`
    INSERT INTO conversations (
      pancake_conversation_id, customer_name, customer_phone, customer_avatar,
      platform, page_name, messages, ai_summary, has_order, ai_order_id
    ) VALUES (
      ${data.pancakeConversationId || null},
      ${data.customerName},
      ${data.customerPhone || ''},
      ${data.customerAvatar || null},
      ${data.platform || 'facebook'},
      ${data.pageName || ''},
      ${JSON.stringify(data.messages)},
      ${data.aiSummary || null},
      ${data.hasOrder || false},
      ${data.aiOrderId || null}
    )
    RETURNING id
  `
  return rows[0].id as number
}

export async function updateConversationEvaluation(id: number, data: {
  score?: number
  label?: string
  note?: string
}) {
  const sql = getDb()
  await sql`
    UPDATE conversations SET
      evaluation_score = ${data.score ?? null},
      evaluation_label = ${data.label ?? null},
      evaluation_note  = ${data.note ?? null},
      evaluated_at     = NOW(),
      updated_at       = NOW()
    WHERE id = ${id}
  `
}

export async function getAllConversations(limit = 200) {
  const sql = getDb()
  const rows = await sql`
    SELECT * FROM conversations ORDER BY created_at DESC LIMIT ${limit}
  `
  return rows as unknown as Conversation[]
}

export async function getConversationById(id: number) {
  const sql = getDb()
  const rows = await sql`SELECT * FROM conversations WHERE id = ${id}`
  return rows[0] as Conversation | undefined
}

// ── Conversation Evaluations (live-fetch mode) ────────────────────────────────
export async function saveConversationAnalysis(pancakeId: string, data: {
  customerNeeds: string
  salesName: string
  salesEvaluation: string
  aiScore: number | null
  label: string | null
  summary: string
  needsAttention: boolean
  issue: string | null
  tags: string[]
  customerName?: string
  pageName?: string
}) {
  const sql = getDb()
  const tagsJson = JSON.stringify(data.tags || [])
  await sql`
    INSERT INTO conversation_evaluations (
      pancake_conversation_id, customer_name, page_name,
      ai_summary, customer_needs, sales_name, sales_evaluation, ai_score, evaluation_label,
      needs_attention, issue, tags, analyzed_at
    ) VALUES (
      ${pancakeId},
      ${data.customerName ?? null},
      ${data.pageName ?? null},
      ${data.summary},
      ${data.customerNeeds},
      ${data.salesName},
      ${data.salesEvaluation},
      ${data.aiScore},
      ${data.label},
      ${data.needsAttention},
      ${data.issue},
      ${tagsJson},
      NOW()
    )
    ON CONFLICT (pancake_conversation_id) DO UPDATE SET
      ai_summary       = ${data.summary},
      customer_needs   = ${data.customerNeeds},
      sales_name       = ${data.salesName},
      sales_evaluation = ${data.salesEvaluation},
      ai_score         = ${data.aiScore},
      evaluation_label = COALESCE(conversation_evaluations.evaluation_label, ${data.label}),
      needs_attention  = ${data.needsAttention},
      issue            = ${data.issue},
      tags             = ${tagsJson},
      customer_name    = COALESCE(${data.customerName ?? null}, conversation_evaluations.customer_name),
      page_name        = COALESCE(${data.pageName ?? null}, conversation_evaluations.page_name),
      analyzed_at      = NOW(),
      updated_at       = NOW()
  `
}

export async function saveConversationEvaluation(pancakeId: string, data: {
  score?: number | null
  label?: string | null
  note?: string | null
  customerName?: string
  pageName?: string
}) {
  const sql = getDb()
  await sql`
    INSERT INTO conversation_evaluations (
      pancake_conversation_id, customer_name, page_name,
      evaluation_score, evaluation_label, evaluation_note, evaluated_at
    ) VALUES (
      ${pancakeId},
      ${data.customerName ?? null},
      ${data.pageName ?? null},
      ${data.score ?? null},
      ${data.label ?? null},
      ${data.note ?? null},
      NOW()
    )
    ON CONFLICT (pancake_conversation_id) DO UPDATE SET
      customer_name    = COALESCE(${data.customerName ?? null}, conversation_evaluations.customer_name),
      page_name        = COALESCE(${data.pageName ?? null}, conversation_evaluations.page_name),
      evaluation_score = ${data.score ?? null},
      evaluation_label = ${data.label ?? null},
      evaluation_note  = ${data.note ?? null},
      evaluated_at     = NOW(),
      updated_at       = NOW()
  `
}

export async function getAllConversationEvaluations() {
  const sql = getDb()
  const rows = await sql`SELECT * FROM conversation_evaluations`
  const map: Record<string, ConversationEvaluation> = {}
  for (const row of rows) {
    map[String(row.pancake_conversation_id)] = row as ConversationEvaluation
  }
  return map
}

export async function getConversationEvaluation(pancakeId: string) {
  const sql = getDb()
  const rows = await sql`SELECT * FROM conversation_evaluations WHERE pancake_conversation_id = ${pancakeId}`
  return rows[0] as ConversationEvaluation | undefined
}

// ── AI Orders ────────────────────────────────────────────────────────────────
export async function insertAiOrder(data: {
  poscakeOrderId?: string
  customerName: string
  customerPhone: string
  customerAddress?: string
  items: Array<{ variation_id: string; product_name: string; quantity: number }>
  rawConversation?: string
  confidence?: number
  status: 'created' | 'failed' | 'pending'
  source?: string
  note?: string
  poscakeResponse?: Record<string, unknown>
}) {
  const sql = getDb()
  const rows = await sql`
    INSERT INTO ai_orders (
      poscake_order_id, customer_name, customer_phone, customer_address,
      items, raw_conversation, confidence, status, source, note, poscake_response
    ) VALUES (
      ${data.poscakeOrderId || null},
      ${data.customerName},
      ${data.customerPhone},
      ${data.customerAddress || null},
      ${JSON.stringify(data.items)},
      ${data.rawConversation || null},
      ${data.confidence || null},
      ${data.status},
      ${data.source || 'meta_ai'},
      ${data.note || null},
      ${data.poscakeResponse ? JSON.stringify(data.poscakeResponse) : null}
    )
    RETURNING id
  `
  return rows[0].id as number
}

export async function getAllAiOrders(limit = 100) {
  const sql = getDb()
  const rows = await sql`
    SELECT * FROM ai_orders ORDER BY created_at DESC LIMIT ${limit}
  `
  return rows as unknown as AiOrder[]
}

// ── All Orders Queries ────────────────────────────────────────────────────────
export async function getAllStnOrders() {
  const sql = getDb()
  const rows = await sql`SELECT * FROM sot_tron_nom_orders ORDER BY created_at DESC`
  return rows as unknown as StnOrder[]
}

export async function getAllKdxOrders() {
  const sql = getDb()
  const rows = await sql`SELECT * FROM khan_do_xoi_orders ORDER BY created_at DESC`
  return rows as unknown as KdxOrder[]
}

// ── Course Settings ───────────────────────────────────────────────────────────
export async function getCourseSettings() {
  const sql = getDb()
  const rows = await sql`SELECT * FROM course_settings LIMIT 1`
  return rows[0] as CourseSettings | undefined
}

export async function updateCourseSettings(
  courseName?: string,
  coursePrice?: number,
  discountPrice?: number,
  courseDescription?: string
) {
  const sql = getDb()
  const updates: string[] = []
  const values: any[] = []

  if (courseName !== undefined) {
    updates.push(`course_name = $${values.length + 1}`)
    values.push(courseName)
  }
  if (coursePrice !== undefined) {
    updates.push(`course_price = $${values.length + 1}`)
    values.push(coursePrice)
  }
  if (discountPrice !== undefined) {
    updates.push(`discount_price = $${values.length + 1}`)
    values.push(discountPrice)
  }
  if (courseDescription !== undefined) {
    updates.push(`course_description = $${values.length + 1}`)
    values.push(courseDescription)
  }

  updates.push('updated_at = NOW()')

  if (updates.length === 1) return getCourseSettings()

  const query = `UPDATE course_settings SET ${updates.join(', ')} WHERE id = 1 RETURNING *`
  const rows = (await sql.unsafe(query, values)) as any[]
  return rows[0] as CourseSettings | undefined
}

// ── Sốt Trộn Nộm Orders ──────────────────────────────────────────────────────
export async function insertStnOrder(data: {
  refCode: string
  pancakeOrderId?: string
  name: string; phone: string; email: string; address: string
  product: string; quantity: number; totalPrice: number; note?: string
}) {
  const sql = getDb()
  const rows = await sql`
    INSERT INTO sot_tron_nom_orders
      (ref_code, pancake_order_id, name, phone, email, address, product, quantity, total_price, note)
    VALUES
      (${data.refCode}, ${data.pancakeOrderId || null}, ${data.name}, ${data.phone},
       ${data.email || ''}, ${data.address}, ${data.product}, ${data.quantity},
       ${data.totalPrice}, ${data.note || ''})
    RETURNING id
  `
  return rows[0].id as number
}

export async function getStnOrderByRef(refCode: string) {
  const sql = getDb()
  const rows = await sql`SELECT * FROM sot_tron_nom_orders WHERE ref_code = ${refCode}`
  return rows[0] as StnOrder | undefined
}

export async function confirmStnPayment(refCode: string): Promise<boolean> {
  const sql = getDb()
  const rows = await sql`
    UPDATE sot_tron_nom_orders
    SET payment_status = 'paid', paid_at = NOW()
    WHERE ref_code = ${refCode} AND payment_status IS DISTINCT FROM 'paid'
  `
  return rows.count > 0
}

export async function updateStnPancakeId(refCode: string, pancakeOrderId: string) {
  const sql = getDb()
  await sql`
    UPDATE sot_tron_nom_orders SET pancake_order_id = ${pancakeOrderId} WHERE ref_code = ${refCode}
  `
}

// ── Khăn Đồ Xôi Orders ───────────────────────────────────────────────────────
export async function insertKdxOrder(data: {
  refCode: string
  pancakeOrderId?: string
  name: string; phone: string; email: string; address: string
  product: string; quantity: number; totalPrice: number; note?: string
}) {
  const sql = getDb()
  const rows = await sql`
    INSERT INTO khan_do_xoi_orders
      (ref_code, pancake_order_id, name, phone, email, address, product, quantity, total_price, note)
    VALUES
      (${data.refCode}, ${data.pancakeOrderId || null}, ${data.name}, ${data.phone},
       ${data.email || ''}, ${data.address}, ${data.product}, ${data.quantity},
       ${data.totalPrice}, ${data.note || ''})
    RETURNING id
  `
  return rows[0].id as number
}

export async function getKdxOrderByRef(refCode: string) {
  const sql = getDb()
  const rows = await sql`SELECT * FROM khan_do_xoi_orders WHERE ref_code = ${refCode}`
  return rows[0] as KdxOrder | undefined
}

export async function confirmKdxPayment(refCode: string): Promise<boolean> {
  const sql = getDb()
  const rows = await sql`
    UPDATE khan_do_xoi_orders
    SET payment_status = 'paid', paid_at = NOW()
    WHERE ref_code = ${refCode} AND payment_status IS DISTINCT FROM 'paid'
  `
  return rows.count > 0
}

// ── Sét Xôi Cốm Orders ───────────────────────────────────────────────────────
export async function insertSxcOrder(data: {
  refCode: string
  pancakeOrderId?: string
  name: string; phone: string; email: string; address: string
  product: string; quantity: number; totalPrice: number; note?: string
}) {
  const sql = getDb()
  const rows = await sql`
    INSERT INTO set_xoi_com_orders
      (ref_code, pancake_order_id, name, phone, email, address, product, quantity, total_price, note)
    VALUES
      (${data.refCode}, ${data.pancakeOrderId || null}, ${data.name}, ${data.phone},
       ${data.email || ''}, ${data.address}, ${data.product}, ${data.quantity},
       ${data.totalPrice}, ${data.note || ''})
    RETURNING id
  `
  return rows[0].id as number
}

export async function getSxcOrderByRef(refCode: string) {
  const sql = getDb()
  const rows = await sql`SELECT * FROM set_xoi_com_orders WHERE ref_code = ${refCode}`
  return rows[0] as SxcOrder | undefined
}

export async function confirmSxcPayment(refCode: string): Promise<boolean> {
  const sql = getDb()
  const rows = await sql`
    UPDATE set_xoi_com_orders
    SET payment_status = 'paid', paid_at = NOW()
    WHERE ref_code = ${refCode} AND payment_status IS DISTINCT FROM 'paid'
  `
  return rows.count > 0
}

export async function getAllSxcOrders() {
  const sql = getDb()
  const rows = await sql`SELECT * FROM set_xoi_com_orders ORDER BY created_at DESC`
  return rows as unknown as SxcOrder[]
}

// ── Sốt Xá Xíu Orders ────────────────────────────────────────────────────────
export async function insertSxxOrder(data: {
  refCode: string
  pancakeOrderId?: string
  name: string; phone: string; email: string; address: string
  product: string; quantity: number; totalPrice: number; note?: string
}) {
  const sql = getDb()
  const rows = await sql`
    INSERT INTO sot_xa_xiu_orders
      (ref_code, pancake_order_id, name, phone, email, address, product, quantity, total_price, note)
    VALUES
      (${data.refCode}, ${data.pancakeOrderId || null}, ${data.name}, ${data.phone},
       ${data.email || ''}, ${data.address}, ${data.product}, ${data.quantity},
       ${data.totalPrice}, ${data.note || ''})
    RETURNING id
  `
  return rows[0].id as number
}

export async function getSxxOrderByRef(refCode: string) {
  const sql = getDb()
  const rows = await sql`SELECT * FROM sot_xa_xiu_orders WHERE ref_code = ${refCode}`
  return rows[0] as SxxOrder | undefined
}

export async function confirmSxxPayment(refCode: string): Promise<boolean> {
  const sql = getDb()
  const rows = await sql`
    UPDATE sot_xa_xiu_orders
    SET payment_status = 'paid', paid_at = NOW()
    WHERE ref_code = ${refCode} AND payment_status IS DISTINCT FROM 'paid'
  `
  return rows.count > 0
}

export async function updateSxxPancakeId(refCode: string, pancakeOrderId: string) {
  const sql = getDb()
  await sql`
    UPDATE sot_xa_xiu_orders SET pancake_order_id = ${pancakeOrderId} WHERE ref_code = ${refCode}
  `
}

export async function getAllSxxOrders() {
  const sql = getDb()
  const rows = await sql`SELECT * FROM sot_xa_xiu_orders ORDER BY created_at DESC`
  return rows as unknown as SxxOrder[]
}

// ── Customers (hồ sơ khách hàng hợp nhất) ──────────────────────────────────────
export interface PancakeCustomerInput {
  pancakeCustomerId: string
  name: string
  phone: string
  email?: string
  address?: string
  tags?: string[]
  orderCount?: number
  totalSpent?: number
  lastOrderAt?: string | null
}

/** Ghi/cập nhật 1 khách hàng lấy từ Pancake. Không ghi đè tên/email/địa chỉ đã có bằng chuỗi rỗng. */
export async function upsertCustomerFromPancake(data: PancakeCustomerInput) {
  const sql = getDb()
  const phone = normalizePhone(data.phone)
  if (!phone) return null
  const name = data.name || ''
  const email = data.email || ''
  const address = data.address || ''
  const tagsJson = sql.json(data.tags || [])
  const orderCount = data.orderCount || 0
  const totalSpent = data.totalSpent || 0
  const lastOrderAt = data.lastOrderAt || null
  const rows = await sql`
    INSERT INTO customers (
      phone, name, email, address, pancake_customer_id, tags, source,
      order_count, total_spent, last_order_at, first_seen_at, synced_from_pancake_at
    ) VALUES (
      ${phone}, ${name}, ${email}, ${address}, ${data.pancakeCustomerId}, ${tagsJson}, 'pancake',
      ${orderCount}, ${totalSpent}, ${lastOrderAt}, NOW(), NOW()
    )
    ON CONFLICT (phone) DO UPDATE SET
      name = CASE WHEN ${name} != '' THEN ${name} ELSE customers.name END,
      email = CASE WHEN ${email} != '' THEN ${email} ELSE customers.email END,
      address = CASE WHEN ${address} != '' THEN ${address} ELSE customers.address END,
      pancake_customer_id = ${data.pancakeCustomerId},
      tags = ${tagsJson},
      source = 'pancake',
      order_count = GREATEST(customers.order_count, ${orderCount}),
      total_spent = GREATEST(customers.total_spent, ${totalSpent}),
      last_order_at = GREATEST(customers.last_order_at, ${lastOrderAt}::timestamptz),
      synced_from_pancake_at = NOW(),
      updated_at = NOW()
    RETURNING id
  `
  return rows[0]?.id as number | undefined
}

/**
 * Quét lại 7 bảng đơn hàng nội bộ, gộp theo SĐT đã chuẩn hoá, tính lại
 * order_count/total_spent/last_order_at. Tự tạo khách hàng mới nếu chỉ có
 * trong đơn hàng nội bộ (chưa từng đồng bộ từ Pancake). Không ghi đè dữ liệu
 * đã có từ Pancake (chỉ cập nhật tên khi customers.name đang rỗng).
 */
export async function recomputeCustomerStatsFromLocalOrders() {
  const sql = getDb()
  type SourceRow = { phone: string; price: number | string | null; created_at: string; name: string | null; paid: boolean }

  const [courseLeads, giftLeads, stn, kdx, sxc, sxx, aiOrders] = await Promise.all([
    sql`SELECT phone, amount AS price, created_at, name, (payment_status = 'paid') AS paid FROM course_leads`,
    sql`SELECT phone, 0 AS price, created_at, name, FALSE AS paid FROM gift_leads`,
    sql`SELECT phone, total_price AS price, created_at, name, (payment_status = 'paid') AS paid FROM sot_tron_nom_orders`,
    sql`SELECT phone, total_price AS price, created_at, name, (payment_status = 'paid') AS paid FROM khan_do_xoi_orders`,
    sql`SELECT phone, total_price AS price, created_at, name, (payment_status = 'paid') AS paid FROM set_xoi_com_orders`,
    sql`SELECT phone, total_price AS price, created_at, name, (payment_status = 'paid') AS paid FROM sot_xa_xiu_orders`,
    sql`SELECT customer_phone AS phone, 0 AS price, created_at, customer_name AS name, FALSE AS paid FROM ai_orders`,
  ]) as unknown as SourceRow[][]

  const byPhone = new Map<string, { count: number; total: number; last: string | null; first: string; name: string }>()
  for (const row of [...courseLeads, ...giftLeads, ...stn, ...kdx, ...sxc, ...sxx, ...aiOrders]) {
    const phone = normalizePhone(row.phone)
    if (!phone) continue
    const existing = byPhone.get(phone)
    const price = Number(row.price) || 0
    // Chỉ đơn đã trả tiền mới tính là "đã mua". Quà miễn phí, đơn chưa trả, đơn huỷ không được làm khách trông như vừa mua lại.
    const paid = !!row.paid
    if (!existing) {
      byPhone.set(phone, { count: paid ? 1 : 0, total: paid ? price : 0, last: paid ? row.created_at : null, first: row.created_at, name: row.name || '' })
    } else {
      if (paid) {
        existing.count += 1
        existing.total += price
        if (!existing.last || new Date(row.created_at) > new Date(existing.last)) existing.last = row.created_at
      }
      if (new Date(row.created_at) < new Date(existing.first)) existing.first = row.created_at
      if (!existing.name && row.name) existing.name = row.name
    }
  }

  let touched = 0
  for (const [phone, stats] of byPhone) {
    await sql`
      INSERT INTO customers (phone, name, source, order_count, total_spent, last_order_at, first_seen_at)
      VALUES (${phone}, ${stats.name}, 'local', ${stats.count}, ${stats.total}, ${stats.last}, ${stats.first})
      ON CONFLICT (phone) DO UPDATE SET
        order_count = CASE WHEN customers.source = 'local' THEN ${stats.count} ELSE GREATEST(customers.order_count, ${stats.count}) END,
        total_spent = CASE WHEN customers.source = 'local' THEN ${stats.total} ELSE GREATEST(customers.total_spent, ${stats.total}) END,
        last_order_at = CASE WHEN customers.source = 'local' THEN ${stats.last}::timestamptz ELSE GREATEST(customers.last_order_at, ${stats.last}::timestamptz) END,
        name = CASE WHEN customers.name = '' THEN ${stats.name} ELSE customers.name END,
        updated_at = NOW()
    `
    touched++
  }
  return touched
}

export const CUSTOMER_STAGES = ['moi', 'dang_tu_van', 'da_chot', 'can_cham_soc', 'khong_chot'] as const
export type CustomerStage = typeof CUSTOMER_STAGES[number]

export async function updateCustomerCrm(id: number, data: { stage?: CustomerStage; assignedStaffId?: number | null; internalNote?: string; optedOut?: boolean }) {
  const sql = getDb()
  const rows = await sql`
    UPDATE customers SET
      stage = COALESCE(${data.stage ?? null}, stage),
      assigned_staff_id = ${data.assignedStaffId === undefined ? sql`assigned_staff_id` : data.assignedStaffId},
      internal_note = COALESCE(${data.internalNote ?? null}, internal_note),
      opted_out_at = CASE
        WHEN ${data.optedOut ?? null}::boolean IS NULL THEN opted_out_at
        WHEN ${data.optedOut ?? null}::boolean THEN COALESCE(opted_out_at, NOW())
        ELSE NULL END,
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `
  const row = rows[0] as Customer | undefined
  return row ? normalizeCustomerRow(row) : undefined
}

/** Chịu được dữ liệu cũ lỡ ghi tags dạng chuỗi JSON thay vì mảng (bug đã fix ở upsertCustomerFromPancake). */
function normalizeCustomerRow(row: Customer): Customer {
  if (typeof row.tags === 'string') {
    try { row.tags = JSON.parse(row.tags) } catch { row.tags = [] }
  }
  if (!Array.isArray(row.tags)) row.tags = []
  return row
}

export async function getAllCustomers(opts: { search?: string; tag?: string } = {}) {
  const sql = getDb()
  const search = opts.search?.trim()
  const tag = opts.tag?.trim()
  let rows
  if (search && tag) {
    const like = `%${search}%`
    rows = await sql`
      SELECT * FROM customers
      WHERE (name ILIKE ${like} OR phone ILIKE ${like} OR email ILIKE ${like})
        AND tags @> ${JSON.stringify([tag])}
      ORDER BY last_order_at DESC NULLS LAST
    `
  } else if (search) {
    const like = `%${search}%`
    rows = await sql`
      SELECT * FROM customers
      WHERE name ILIKE ${like} OR phone ILIKE ${like} OR email ILIKE ${like}
      ORDER BY last_order_at DESC NULLS LAST
    `
  } else if (tag) {
    rows = await sql`
      SELECT * FROM customers WHERE tags @> ${JSON.stringify([tag])}
      ORDER BY last_order_at DESC NULLS LAST
    `
  } else {
    rows = await sql`SELECT * FROM customers ORDER BY last_order_at DESC NULLS LAST`
  }
  return (rows as unknown as Customer[]).map(normalizeCustomerRow)
}

export async function getCustomerById(id: number) {
  const sql = getDb()
  const rows = await sql`SELECT * FROM customers WHERE id = ${id}`
  const row = rows[0] as Customer | undefined
  return row ? normalizeCustomerRow(row) : undefined
}

/** Lịch sử đơn hàng hợp nhất từ 7 bảng, so khớp theo 9 số cuối để chịu được khác biệt định dạng SĐT. */
export async function getCustomerOrderHistory(phone: string) {
  const sql = getDb()
  const rows = await sql`
    SELECT 'course_leads' AS source, payment_ref AS order_ref, 'Khóa học' AS product_label,
           amount AS total_price, payment_status, created_at, paid_at
    FROM course_leads WHERE right(regexp_replace(phone, '[^0-9]', '', 'g'), 9) = right(${phone}, 9)
    UNION ALL
    SELECT 'gift_leads', NULL::text, 'Quà tặng miễn phí', NULL::integer,
           CASE WHEN email_sent THEN 'sent' ELSE 'pending' END, created_at, NULL::timestamptz
    FROM gift_leads WHERE right(regexp_replace(phone, '[^0-9]', '', 'g'), 9) = right(${phone}, 9)
    UNION ALL
    SELECT 'sot_tron_nom_orders', ref_code, 'Sốt Trộn Nộm - ' || product, total_price, payment_status, created_at, paid_at
    FROM sot_tron_nom_orders WHERE right(regexp_replace(phone, '[^0-9]', '', 'g'), 9) = right(${phone}, 9)
    UNION ALL
    SELECT 'khan_do_xoi_orders', ref_code, 'Khăn Đồ Xôi - ' || product, total_price, payment_status, created_at, paid_at
    FROM khan_do_xoi_orders WHERE right(regexp_replace(phone, '[^0-9]', '', 'g'), 9) = right(${phone}, 9)
    UNION ALL
    SELECT 'set_xoi_com_orders', ref_code, 'Sét Xôi Cốm - ' || product, total_price, payment_status, created_at, paid_at
    FROM set_xoi_com_orders WHERE right(regexp_replace(phone, '[^0-9]', '', 'g'), 9) = right(${phone}, 9)
    UNION ALL
    SELECT 'sot_xa_xiu_orders', ref_code, 'Sốt Xá Xíu - ' || product, total_price, payment_status, created_at, paid_at
    FROM sot_xa_xiu_orders WHERE right(regexp_replace(phone, '[^0-9]', '', 'g'), 9) = right(${phone}, 9)
    UNION ALL
    SELECT 'ai_orders', poscake_order_id, 'Đơn AI (' || source || ')', NULL::integer, status, created_at, NULL::timestamptz
    FROM ai_orders WHERE right(regexp_replace(customer_phone, '[^0-9]', '', 'g'), 9) = right(${phone}, 9)
    ORDER BY created_at DESC
  `
  return rows as unknown as CustomerOrderHistoryRow[]
}

/** Lịch sử hội thoại Pancake của khách hàng, kèm phân tích AI đã có (không phân tích lại). */
export interface CustomerConversationRow {
  id: number
  pancake_conversation_id: string | null
  customer_name: string
  page_name: string
  platform: string
  ai_summary: string | null
  evaluation_score: number | null
  evaluation_label: string | null
  created_at: string
  customer_needs: string | null
  sales_name: string | null
  sales_evaluation: string | null
  ai_score: number | null
  needs_attention: boolean | null
  issue: string | null
}

export async function getCustomerConversations(phone: string) {
  const sql = getDb()
  const rows = await sql`
    SELECT c.id, c.pancake_conversation_id, c.customer_name, c.page_name, c.platform,
           c.ai_summary, c.evaluation_score, c.evaluation_label, c.created_at,
           ce.customer_needs, ce.sales_name, ce.sales_evaluation, ce.ai_score,
           ce.needs_attention, ce.issue
    FROM conversations c
    LEFT JOIN conversation_evaluations ce
      ON ce.pancake_conversation_id = c.pancake_conversation_id
    WHERE right(regexp_replace(c.customer_phone, '[^0-9]', '', 'g'), 9) = right(${phone}, 9)
    ORDER BY c.created_at DESC
  `
  return rows as unknown as CustomerConversationRow[]
}

// ── Chăm sóc khách hàng (loyalty / nhắc tái mua) ───────────────────────────────
export async function insertCustomerCareLog(data: {
  customerId: number
  staffId: number
  kind: 'manual' | 'auto_reminder'
  subject: string
  message: string
  success?: boolean
  error?: string
}) {
  const sql = getDb()
  const rows = await sql`
    INSERT INTO customer_care_logs (customer_id, staff_id, kind, subject, message, success, error)
    VALUES (${data.customerId}, ${data.staffId}, ${data.kind}, ${data.subject}, ${data.message}, ${data.success ?? true}, ${data.error ?? null})
    RETURNING id, customer_id, staff_id, channel, kind, subject, message, success, error, sent_at
  `
  return rows[0] as CustomerCareLog
}

export async function updateCustomerLastCareSent(customerId: number, sentAt: Date = new Date()) {
  const sql = getDb()
  await sql`UPDATE customers SET last_care_sent_at = ${sentAt} WHERE id = ${customerId}`
}

export async function getCustomerCareLogs(customerId: number) {
  const sql = getDb()
  const rows = await sql`
    SELECT id, customer_id, staff_id, channel, kind, subject, message, success, error, sent_at
    FROM customer_care_logs
    WHERE customer_id = ${customerId}
    ORDER BY sent_at DESC
  `
  return rows as unknown as CustomerCareLog[]
}

/** Khách đủ điều kiện nhắc tái mua tự động: đã từng mua, lâu ngày chưa quay lại, chưa được nhắc gần đây, có email. */
export async function getCustomersNeedingReminder(careDaysThreshold: number, cooldownDays: number) {
  const sql = getDb()
  const rows = await sql`
    SELECT * FROM customers
    WHERE order_count >= 1
      AND total_spent > 0
      AND opted_out_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM email_optouts o WHERE o.email = lower(customers.email))
      AND email <> ''
      AND last_order_at IS NOT NULL
      AND last_order_at <= NOW() - (${careDaysThreshold} || ' days')::interval
      AND (last_care_sent_at IS NULL OR last_care_sent_at <= NOW() - (${cooldownDays} || ' days')::interval)
      AND NOT EXISTS (
        SELECT 1 FROM care_campaign_members m JOIN care_campaigns k ON k.id = m.campaign_id
        WHERE m.customer_id = customers.id AND m.arm = 'holdout' AND k.created_at > NOW() - INTERVAL '120 days'
      )
    ORDER BY last_order_at ASC
  `
  return rows as unknown as Customer[]
}

// ── Chiến dịch chăm sóc có nhóm đối chứng ───────────────────────────────────
export interface CampaignCandidate { id: number; name: string; phone: string; order_count: number; total_spent: number; last_order_at: string | null }

type Q = ReturnType<typeof getDb>

/** Truy vấn chọn khách (dùng chung cho xem trước và tạo thật). Khách đã từ chối nhận tin, hoặc chưa từng trả tiền, bị loại. */
async function selectCampaignCandidates(sql: Q, c: CampaignCriteria): Promise<CampaignCandidate[]> {
  const rows = await sql`
    SELECT id, name, phone, order_count, total_spent::float8 AS total_spent, last_order_at
    FROM customers cu
    WHERE cu.total_spent > 0
      AND cu.opted_out_at IS NULL
      AND cu.phone_verified_at IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM email_optouts o WHERE o.email = lower(cu.email))
      AND cu.order_count BETWEEN ${c.minOrders} AND ${c.maxOrders}
      AND cu.phone ~ '^0[0-9]{9}$'
      AND (${c.goal} <> 'course' OR NOT EXISTS (
        SELECT 1 FROM course_leads cl
        WHERE cl.payment_status = 'paid'
          AND right(regexp_replace(cl.phone, '[^0-9]', '', 'g'), 9) = right(cu.phone, 9)
      ))
      AND cu.last_order_at IS NOT NULL
      AND cu.last_order_at <= NOW() - make_interval(days => ${c.minDaysSinceLastOrder})
      AND cu.last_order_at >= NOW() - make_interval(days => ${c.maxDaysSinceLastOrder})
      AND (cu.last_care_sent_at IS NULL OR cu.last_care_sent_at <= NOW() - make_interval(days => ${c.contactCooldownDays}))
      AND NOT EXISTS (
        SELECT 1 FROM care_campaign_members m JOIN care_campaigns k ON k.id = m.campaign_id
        WHERE m.customer_id = cu.id AND k.created_at > NOW() - make_interval(days => ${c.excludeRecentCampaignDays})
      )
    ORDER BY md5(cu.id::text)
    LIMIT ${c.cap}
  `
  return rows as unknown as CampaignCandidate[]
}

/** Xem trước (chỉ đọc). */
export async function findCampaignCandidates(c: CampaignCriteria): Promise<CampaignCandidate[]> {
  return selectCampaignCandidates(getDb(), c)
}

/**
 * Tạo chiến dịch thật. Khoá toàn cục + chọn khách + ghi nằm chung MỘT giao dịch: hai admin bấm cùng lúc
 * không thể đưa cùng 1 khách vào 2 chiến dịch (sẽ làm hỏng phép đo).
 */
export async function createCampaignAtomic(
  key: string, name: string, criteria: CampaignCriteria, createdBy: number, assign: (customerId: number) => Arm,
): Promise<{ id: number; treatment: number; holdout: number } | null> {
  const sql = getDb()
  return await sql.begin(async tx => {
    await tx`SELECT pg_advisory_xact_lock(4242002)`
    const candidates = await selectCampaignCandidates(tx as unknown as Q, criteria)
    if (candidates.length === 0) return null
    const [camp] = await tx`
      INSERT INTO care_campaigns (key, name, criteria, created_by)
      VALUES (${key}, ${name}, ${tx.json(criteria as never)}, ${createdBy})
      RETURNING id
    `
    const arms = candidates.map(c => assign(c.id))
    // một câu lệnh cho cả lô (không lặp hàng nghìn lần qua mạng)
    await tx`
      INSERT INTO care_campaign_members (campaign_id, customer_id, arm, order_count_at_start, total_spent_at_start)
      SELECT ${camp.id}::int, x.cid, x.arm, x.oc, x.ts
      FROM unnest(
        ${candidates.map(c => c.id)}::int[], ${arms}::text[],
        ${candidates.map(c => c.order_count)}::int[], ${candidates.map(c => Math.round(c.total_spent))}::bigint[]
      ) AS x(cid, arm, oc, ts)
    `
    const holdout = arms.filter(a => a === 'holdout').length
    return { id: camp.id as number, treatment: arms.length - holdout, holdout }
  })
}

/** Mọi khách đang nằm nhóm đối chứng của chiến dịch còn trong thời gian đo. */
export async function getAllActiveHoldoutIds(windowDays = 120): Promise<Set<number>> {
  const sql = getDb()
  const rows = await sql`
    SELECT DISTINCT m.customer_id FROM care_campaign_members m JOIN care_campaigns k ON k.id = m.campaign_id
    WHERE m.arm = 'holdout' AND k.created_at > NOW() - make_interval(days => ${windowDays})
  `
  return new Set(rows.map(r => r.customer_id as number))
}

/** Trong các id này, ai đang nằm nhóm đối chứng của chiến dịch còn trong thời gian đo (không được liên hệ qua bất kỳ kênh nào). */
export async function getActiveHoldoutIds(customerIds: number[], windowDays = 120): Promise<Set<number>> {
  if (customerIds.length === 0) return new Set()
  const sql = getDb()
  const rows = await sql`
    SELECT m.customer_id FROM care_campaign_members m JOIN care_campaigns k ON k.id = m.campaign_id
    WHERE m.arm = 'holdout' AND m.customer_id = ANY(${customerIds}::int[])
      AND k.created_at > NOW() - make_interval(days => ${windowDays})
  `
  return new Set(rows.map(r => r.customer_id as number))
}

export async function listCampaigns() {
  const sql = getDb()
  return await sql`
    SELECT k.id, k.key, k.name, k.criteria, k.criteria->>'goal' AS goal, k.created_at,
           COUNT(m.*) FILTER (WHERE m.arm = 'treatment')::int AS treatment_n,
           COUNT(m.*) FILTER (WHERE m.arm = 'holdout')::int AS holdout_n
    FROM care_campaigns k LEFT JOIN care_campaign_members m ON m.campaign_id = k.id
    GROUP BY k.id ORDER BY k.id DESC
  `
}

/**
 * Kết quả theo nhóm.
 * - goal = repeat: số người đã mua thêm sản phẩm SAU khi chiến dịch được tạo (đơn đã trả tiền).
 * - goal = course: số người đã trả tiền khoá học SAU khi chiến dịch được tạo (theo số điện thoại).
 */
export async function getCampaignArmStats(campaignId: number): Promise<Record<Arm, { n: number; hits: number; revenue: number }>> {
  const sql = getDb()
  const g = await sql`SELECT criteria->>'goal' AS goal FROM care_campaigns WHERE id = ${campaignId}`
  const goal = (g[0]?.goal as string | undefined) === 'course' ? 'course' : 'repeat'
  const rows = goal === 'course'
    ? await sql`
        SELECT m.arm, COUNT(*)::int AS n,
          COUNT(*) FILTER (WHERE cl.total > 0)::int AS hits,
          COALESCE(SUM(cl.total), 0)::float8 AS revenue
        FROM care_campaign_members m
        JOIN care_campaigns k ON k.id = m.campaign_id
        JOIN customers c ON c.id = m.customer_id
        LEFT JOIN LATERAL (
          SELECT COALESCE(SUM(l.amount), 0) AS total FROM course_leads l
          WHERE l.payment_status = 'paid' AND l.paid_at > k.created_at
            AND right(regexp_replace(l.phone, '[^0-9]', '', 'g'), 9) = right(c.phone, 9)
        ) cl ON TRUE
        WHERE m.campaign_id = ${campaignId}
        GROUP BY m.arm
      `
    : await sql`
        SELECT m.arm,
          COUNT(*)::int AS n,
          COUNT(*) FILTER (WHERE c.order_count > m.order_count_at_start AND c.last_order_at > k.created_at)::int AS hits,
          COALESCE(SUM(GREATEST(c.total_spent - m.total_spent_at_start, 0)) FILTER (WHERE c.order_count > m.order_count_at_start AND c.last_order_at > k.created_at), 0)::float8 AS revenue
        FROM care_campaign_members m
        JOIN care_campaigns k ON k.id = m.campaign_id
        JOIN customers c ON c.id = m.customer_id
        WHERE m.campaign_id = ${campaignId}
        GROUP BY m.arm
      `
  const out = { treatment: { n: 0, hits: 0, revenue: 0 }, holdout: { n: 0, hits: 0, revenue: 0 } }
  for (const r of rows) out[r.arm as Arm] = { n: r.n, hits: r.hits, revenue: r.revenue }
  return out
}

/** Danh sách để nhân viên liên hệ: CHỈ nhóm treatment. Nhóm đối chứng không bao giờ được xuất. */
export async function getCampaignTreatmentForExport(campaignId: number) {
  const sql = getDb()
  return await sql`
    SELECT c.id, c.name, c.phone, c.order_count, c.total_spent::float8 AS total_spent, c.last_order_at
    FROM care_campaign_members m JOIN customers c ON c.id = m.customer_id
    WHERE m.campaign_id = ${campaignId} AND m.arm = 'treatment' AND c.opted_out_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM email_optouts o WHERE o.email = lower(c.email))
    ORDER BY c.last_order_at ASC
  `
}

export async function campaignExists(campaignId: number): Promise<boolean> {
  const sql = getDb()
  const rows = await sql`SELECT 1 FROM care_campaigns WHERE id = ${campaignId}`
  return rows.length > 0
}

/** Số lần người này đã xuất trong 24 giờ qua (giới hạn dùng chung mọi instance, không theo IP). */
export async function countRecentExports(userId: number): Promise<number> {
  const sql = getDb()
  const rows = await sql`SELECT COUNT(*)::int AS n FROM care_campaign_exports WHERE user_id = ${userId} AND created_at > NOW() - INTERVAL '24 hours'`
  return rows[0].n as number
}

/** Ghi 1 lượt xuất, nhưng chỉ khi người này chưa quá `maxPer24h` lượt (kiểm tra + ghi cùng khoá nên 2 yêu cầu đồng thời không lách được). Trả false nếu vượt. */
export async function recordCampaignExport(campaignId: number, userId: number, rowCount: number, ip: string, maxPer24h = 10): Promise<boolean> {
  const sql = getDb()
  return await sql.begin(async tx => {
    await tx`SELECT pg_advisory_xact_lock(4242003, ${userId})`
    const c = await tx`SELECT COUNT(*)::int AS n FROM care_campaign_exports WHERE user_id = ${userId} AND created_at > NOW() - INTERVAL '24 hours'`
    if ((c[0].n as number) >= maxPer24h) return false
    await tx`INSERT INTO care_campaign_exports (campaign_id, user_id, row_count, ip_address) VALUES (${campaignId}, ${userId}, ${rowCount}, ${ip})`
    await tx`UPDATE care_campaign_members SET exported_at = NOW() WHERE campaign_id = ${campaignId} AND arm = 'treatment' AND exported_at IS NULL`
    return true
  })
}

// ── Types ────────────────────────────────────────────────────────────────────
export interface GiftLead {
  id: number; name: string; email: string; phone: string
  created_at: string; email_sent: boolean
  email_sequence_status: string; next_email_at: string; email_sequence_paused: boolean
  last_email_sent_at: string | null
}
export interface CourseLead {
  id: number; name: string; email: string; phone: string
  payment_ref: string; payment_status: string; amount: number
  paid_at: string | null; created_at: string
  email_sent: boolean; telegram_sent: boolean
}
export interface Staff {
  id: number; name: string; email: string; role: 'admin' | 'staff'
  status: 'active' | 'inactive'; created_at: string; last_login: string | null
}
export interface StaffWithPassword extends Staff {
  password_hash: string
}
export interface AuditLog {
  id: number; user_id: number; action: string; table_name: string
  record_id: number; old_value: Record<string, any> | null; new_value: Record<string, any> | null
  created_at: string; ip_address: string
}
export interface AuditLogWithStaff extends AuditLog {
  user_name: string
}
export interface CourseSettings {
  id: number; course_name: string; course_price: number; discount_price: number
  course_description: string | null; updated_at: string
}
export interface ConversationMessage {
  id?: string
  from_customer: boolean
  sender_name?: string
  content: string
  timestamp?: string
  type?: string
}
export interface Conversation {
  id: number
  pancake_conversation_id: string | null
  customer_name: string
  customer_phone: string
  customer_avatar: string | null
  platform: string
  page_name: string
  messages: ConversationMessage[]
  ai_summary: string | null
  evaluation_score: number | null
  evaluation_label: string | null
  evaluation_note: string | null
  evaluated_at: string | null
  has_order: boolean
  ai_order_id: number | null
  created_at: string
  updated_at: string
}
export interface ConversationEvaluation {
  id: number
  pancake_conversation_id: string
  customer_name: string | null
  page_name: string | null
  ai_summary: string | null
  customer_needs: string | null
  sales_name: string | null
  sales_evaluation: string | null
  ai_score: number | null
  needs_attention: boolean | null
  issue: string | null
  tags: string | null
  evaluation_score: number | null
  evaluation_label: string | null
  evaluation_note: string | null
  analyzed_at: string | null
  evaluated_at: string | null
  created_at: string
  updated_at: string
}
export interface StnOrder {
  id: number; ref_code: string; pancake_order_id: string | null
  name: string; phone: string; email: string; address: string
  product: string; quantity: number; total_price: number
  payment_status: string; paid_at: string | null; note: string; created_at: string
}
export interface KdxOrder {
  id: number; ref_code: string; pancake_order_id: string | null
  name: string; phone: string; email: string; address: string
  product: string; quantity: number; total_price: number
  payment_status: string; paid_at: string | null; note: string; created_at: string
}
export interface SxcOrder {
  id: number; ref_code: string; pancake_order_id: string | null
  name: string; phone: string; email: string; address: string
  product: string; quantity: number; total_price: number
  payment_status: string; paid_at: string | null; note: string; created_at: string
}
export interface SxxOrder {
  id: number; ref_code: string; pancake_order_id: string | null
  name: string; phone: string; email: string; address: string
  product: string; quantity: number; total_price: number
  payment_status: string; paid_at: string | null; note: string; created_at: string
}
export interface AiOrder {
  id: number
  poscake_order_id: string | null
  customer_name: string
  customer_phone: string
  customer_address: string | null
  items: Array<{ variation_id: string; product_name: string; quantity: number }>
  raw_conversation: string | null
  confidence: number | null
  status: 'created' | 'failed' | 'pending'
  source: string
  note: string | null
  poscake_response: Record<string, unknown> | null
  created_at: string
}
export interface Customer {
  id: number
  phone: string
  name: string
  email: string
  address: string
  pancake_customer_id: string | null
  tags: string[]
  source: 'pancake' | 'local'
  order_count: number
  total_spent: number
  last_order_at: string | null
  first_seen_at: string
  synced_from_pancake_at: string | null
  last_care_sent_at: string | null
  opted_out_at?: string | null
  do_not_contact?: boolean
  stage: CustomerStage
  assigned_staff_id: number | null
  internal_note: string
  created_at: string
  updated_at: string
}
export interface CustomerOrderHistoryRow {
  source: string
  order_ref: string | null
  product_label: string
  total_price: number | null
  payment_status: string | null
  created_at: string
  paid_at: string | null
}
export interface CustomerCareLog {
  id: number
  customer_id: number
  staff_id: number
  channel: string
  kind: 'manual' | 'auto_reminder'
  subject: string
  message: string
  success: boolean
  error: string | null
  sent_at: string
}
