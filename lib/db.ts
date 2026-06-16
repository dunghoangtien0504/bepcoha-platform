import postgres from 'postgres'

// Dùng DATABASE_URL từ env – URL-encode ký tự đặc biệt trong password
const connectionString = process.env.DATABASE_URL || ''

let _sql: ReturnType<typeof postgres> | null = null

export function getDb() {
  if (!_sql) {
    _sql = postgres(connectionString, {
      ssl: { rejectUnauthorized: false },
      max: 5,
      idle_timeout: 20,
    })
  }
  return _sql
}

// ── Schema init ─────────────────────────────────────────────────────────────
export async function initDb() {
  const sql = getDb()
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
      user_id INT NOT NULL REFERENCES staff(id),
      action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
      table_name TEXT NOT NULL CHECK (table_name IN ('gift_leads', 'course_leads', 'staff')),
      record_id INT NOT NULL,
      old_value JSONB,
      new_value JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      ip_address TEXT
    )
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
  // Insert default course settings if not exists
  const settings = await sql`SELECT COUNT(*) as count FROM course_settings`
  if (parseInt(settings[0].count) === 0) {
    await sql`
      INSERT INTO course_settings (course_name, course_price, discount_price)
      VALUES ('Khóa học Dưa Cà Muối', 1095000, 299000)
    `
  }
}

// ── Gift leads ───────────────────────────────────────────────────────────────
export async function insertGiftLead(data: { name: string; email: string; phone: string }) {
  const sql = getDb()
  const rows = await sql`
    INSERT INTO gift_leads (name, email, phone)
    VALUES (${data.name}, ${data.email}, ${data.phone})
    RETURNING id
  `
  return rows[0].id as number
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
  name: string; email: string; phone: string; paymentRef: string; amount?: number
}) {
  const sql = getDb()
  const amount = data.amount ?? 299000
  const rows = await sql`
    INSERT INTO course_leads (name, email, phone, payment_ref, amount)
    VALUES (${data.name}, ${data.email}, ${data.phone}, ${data.paymentRef}, ${amount})
    ON CONFLICT (payment_ref) DO UPDATE
      SET name = EXCLUDED.name, email = EXCLUDED.email, phone = EXCLUDED.phone, amount = EXCLUDED.amount
    RETURNING id
  `
  return rows[0].id as number
}

export async function confirmPayment(paymentRef: string) {
  const sql = getDb()
  await sql`
    UPDATE course_leads
    SET payment_status = 'paid', paid_at = NOW()
    WHERE payment_ref = ${paymentRef}
  `
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
  tableName: 'gift_leads' | 'course_leads' | 'staff',
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
    SELECT al.id, al.user_id, s.name as user_name, al.action, al.table_name, al.record_id, al.old_value, al.new_value, al.created_at, al.ip_address
    FROM audit_logs al
    JOIN staff s ON al.user_id = s.id
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
    SELECT al.id, al.user_id, s.name as user_name, al.action, al.table_name, al.record_id, al.old_value, al.new_value, al.created_at, al.ip_address
    FROM audit_logs al
    JOIN staff s ON al.user_id = s.id
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
  customerName?: string
  pageName?: string
}) {
  const sql = getDb()
  await sql`
    INSERT INTO conversation_evaluations (
      pancake_conversation_id, customer_name, page_name,
      ai_summary, customer_needs, sales_name, sales_evaluation, ai_score, evaluation_label,
      needs_attention, issue, analyzed_at
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
export async function initAiOrdersTable() {
  const sql = getDb()
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
    CREATE TABLE IF NOT EXISTS ai_orders (
      id SERIAL PRIMARY KEY,
      poscake_order_id TEXT,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      customer_address TEXT,
      items JSONB NOT NULL DEFAULT '[]',
      raw_conversation TEXT,
      confidence REAL,
      status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'failed', 'pending')),
      source TEXT DEFAULT 'meta_ai',
      note TEXT,
      poscake_response JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
}

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
  evaluation_score: number | null
  evaluation_label: string | null
  evaluation_note: string | null
  analyzed_at: string | null
  evaluated_at: string | null
  created_at: string
  updated_at: string
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
