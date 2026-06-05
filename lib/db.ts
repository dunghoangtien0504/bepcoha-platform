import postgres from 'postgres'

// Dùng DATABASE_URL từ env – URL-encode ký tự đặc biệt trong password
const connectionString = process.env.DATABASE_URL || ''

let _sql: ReturnType<typeof postgres> | null = null

function getDb() {
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
    CREATE TABLE IF NOT EXISTS course_settings (
      id SERIAL PRIMARY KEY,
      course_name TEXT DEFAULT 'Khóa học Dưa Cà Muối',
      course_price INTEGER DEFAULT 1095000,
      discount_price INTEGER DEFAULT 299000,
      course_description TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
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
  name: string; email: string; phone: string; paymentRef: string
}) {
  const sql = getDb()
  const rows = await sql`
    INSERT INTO course_leads (name, email, phone, payment_ref)
    VALUES (${data.name}, ${data.email}, ${data.phone}, ${data.paymentRef})
    ON CONFLICT (payment_ref) DO UPDATE
      SET name = EXCLUDED.name, email = EXCLUDED.email, phone = EXCLUDED.phone
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
