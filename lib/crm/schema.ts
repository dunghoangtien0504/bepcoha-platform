// Lược đồ CRM v2: nền móng (phân quyền, nhật ký), dữ liệu đơn Pancake, việc, chấm công & phân ca, Mini App.
// Chạy SAU initDb() của lib/db.ts (dựa trên các bảng customers, staff, crm_tasks, opportunities, audit_logs có sẵn).
// Mọi câu lệnh đều chạy lại được nhiều lần (IF NOT EXISTS) và chạy trong 1 giao dịch có khoá như initDb.
import { getDb, initDb } from '../db'

type Sql = ReturnType<typeof getDb>

const g = globalThis as unknown as { __crmSchema?: Promise<void>; __crmSchemaKey?: string }

export function ensureCrmSchema(): Promise<void> {
  const key = String(CRM_SCHEMA_VERSION)
  if (!g.__crmSchema || g.__crmSchemaKey !== key) {
    g.__crmSchemaKey = key
    const p = (async () => {
      await initDb()
      await runCrmSchema()
    })().catch(err => { if (g.__crmSchema === p) g.__crmSchema = undefined; throw err })
    g.__crmSchema = p
  }
  return g.__crmSchema
}

// Đổi số này khi sửa DDL bên dưới để mọi instance chạy lại.
export const CRM_SCHEMA_VERSION = 17

async function runCrmSchema() {
  const sql = getDb()
  const done = await sql`SELECT to_regclass('public.crm_schema_version') IS NOT NULL AS ok`
  if (done[0]?.ok) {
    const v = await sql`SELECT version FROM crm_schema_version WHERE id = 1`
    if (v[0]?.version === CRM_SCHEMA_VERSION) return
  }
  await sql.begin(async tx => {
    await tx`SELECT pg_advisory_xact_lock(4242001)`
    await crmSchemaBody(tx as unknown as Sql)
    await tx`CREATE TABLE IF NOT EXISTS crm_schema_version (id INT PRIMARY KEY, version INT NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`
    await tx`INSERT INTO crm_schema_version (id, version) VALUES (1, ${CRM_SCHEMA_VERSION})
             ON CONFLICT (id) DO UPDATE SET version = EXCLUDED.version, updated_at = NOW()`
  })
}

async function dropCheck(sql: Sql, table: string, column: string) {
  await sql.unsafe(`
    DO $$
    DECLARE c text;
    BEGIN
      FOR c IN SELECT conname FROM pg_constraint
        WHERE conrelid = '${table}'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%${column}%'
      LOOP EXECUTE format('ALTER TABLE ${table} DROP CONSTRAINT %I', c); END LOOP;
    END $$;`)
}

async function crmSchemaBody(sql: Sql) {
  // ── Nhân viên: vai trò 3 bậc + bộ phận + quyền cấp thêm + thiết bị chấm công ──────────────
  await dropCheck(sql, 'staff', 'role')
  await sql`ALTER TABLE staff ADD CONSTRAINT staff_role_check CHECK (role IN ('admin', 'quan_ly', 'staff'))`
  await sql`ALTER TABLE staff ADD COLUMN IF NOT EXISTS department TEXT`
  await dropCheck(sql, 'staff', 'department')
  await sql`ALTER TABLE staff ADD CONSTRAINT staff_department_check CHECK (department IS NULL OR department IN
    ('ban_giam_doc', 'sale_cskh', 'marketing', 'san_tmdt', 'bep', 'kho_van', 'dao_tao'))`
  await sql`ALTER TABLE staff ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT ''`
  await sql`ALTER TABLE staff ADD COLUMN IF NOT EXISTS phone TEXT NOT NULL DEFAULT ''`
  await sql`ALTER TABLE staff ADD COLUMN IF NOT EXISTS extra_permissions JSONB NOT NULL DEFAULT '[]'`
  await sql`ALTER TABLE staff ADD COLUMN IF NOT EXISTS employment TEXT NOT NULL DEFAULT 'toan_thoi_gian'`
  await sql`ALTER TABLE staff ADD COLUMN IF NOT EXISTS monthly_hours INT NOT NULL DEFAULT 208`
  await sql`ALTER TABLE staff ADD COLUMN IF NOT EXISTS registered_device TEXT`
  await sql`ALTER TABLE staff ADD COLUMN IF NOT EXISTS failed_logins INT NOT NULL DEFAULT 0`
  await sql`ALTER TABLE staff ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ`
  await sql`ALTER TABLE staff ADD COLUMN IF NOT EXISTS session_version INT NOT NULL DEFAULT 1`

  // ── Nhật ký thao tác: ai (nhân viên/khách/hệ thống/agent) làm gì, trên bảng nào, lý do ───────
  await dropCheck(sql, 'audit_logs', 'table_name')
  await dropCheck(sql, 'audit_logs', 'action')
  await sql`ALTER TABLE audit_logs ALTER COLUMN user_id DROP NOT NULL`
  await sql`ALTER TABLE audit_logs ALTER COLUMN record_id DROP NOT NULL`
  await sql`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS actor_type TEXT NOT NULL DEFAULT 'staff'`
  await dropCheck(sql, 'audit_logs', 'actor_type')
  await sql`ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_actor_type_check CHECK (actor_type IN ('staff', 'customer', 'system', 'agent'))`
  await sql`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS reason TEXT`
  await sql`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS record_key TEXT`
  await sql`CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON audit_logs (created_at DESC)`
  await sql`CREATE INDEX IF NOT EXISTS audit_logs_table_idx ON audit_logs (table_name, record_id)`

  // ── Khách hàng: nguồn 'mini', xác minh SĐT, chấm sao (B4 K39), sinh nhật (B4 K05) ─────────────
  await dropCheck(sql, 'customers', 'source')
  await sql`ALTER TABLE customers ADD CONSTRAINT customers_source_check CHECK (source IN ('pancake', 'local', 'mini'))`
  await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ`
  await sql`UPDATE customers SET phone_verified_at = COALESCE(created_at, NOW()) WHERE phone_verified_at IS NULL AND source <> 'mini'`
  await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS stars SMALLINT CHECK (stars IS NULL OR stars BETWEEN 1 AND 5)`
  await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS birthday DATE`
  await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS province TEXT NOT NULL DEFAULT ''`
  await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS first_order_at TIMESTAMPTZ`
  await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS main_channel TEXT`
  await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_contact_at TIMESTAMPTZ`
  await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_wholesale BOOLEAN NOT NULL DEFAULT FALSE`
  await sql`CREATE INDEX IF NOT EXISTS customers_last_order_idx ON customers (last_order_at DESC NULLS LAST)`
  await sql`CREATE INDEX IF NOT EXISTS customers_stage_idx ON customers (stage)`
  await sql`CREATE INDEX IF NOT EXISTS customers_assigned_idx ON customers (assigned_staff_id)`
  await sql`CREATE INDEX IF NOT EXISTS customers_segments_idx ON customers USING GIN (segments)`

  // ── Đơn Pancake (bản sao chỉ đọc, đồng bộ định kỳ): nguồn sự thật về mua hàng ────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS pancake_orders (
      pos_order_id TEXT PRIMARY KEY,
      customer_id INT REFERENCES customers(id),
      pancake_customer_id TEXT,
      phone_norm TEXT NOT NULL DEFAULT '',
      phone_masked BOOLEAN NOT NULL DEFAULT FALSE,
      name TEXT NOT NULL DEFAULT '',
      platform TEXT NOT NULL DEFAULT 'khac' CHECK (platform IN ('facebook', 'tiktok', 'shopee', 'web', 'bep', 'khac')),
      status INT NOT NULL,
      status_name TEXT NOT NULL DEFAULT '',
      is_real BOOLEAN NOT NULL DEFAULT FALSE,
      total BIGINT NOT NULL DEFAULT 0,
      cod BIGINT NOT NULL DEFAULT 0,
      prepaid BIGINT NOT NULL DEFAULT 0,
      shipping_fee BIGINT NOT NULL DEFAULT 0,
      discount BIGINT NOT NULL DEFAULT 0,
      items JSONB NOT NULL DEFAULT '[]',
      product_lines TEXT[] NOT NULL DEFAULT '{}',
      tags JSONB NOT NULL DEFAULT '[]',
      province TEXT NOT NULL DEFAULT '',
      platform_order_ref TEXT,
      platform_order_ref_norm TEXT,
      tracking_code TEXT,
      tracking_code_norm TEXT,
      inserted_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ,
      synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  // Mã đơn Pancake đã chuẩn hoá (bỏ dấu chấm/gạch, viết hoa) để khách gõ "C5400123.0001" hay "c54001230001" đều khớp
  await sql`ALTER TABLE pancake_orders ADD COLUMN IF NOT EXISTS pos_order_id_norm TEXT`
  await sql`UPDATE pancake_orders SET pos_order_id_norm = upper(regexp_replace(pos_order_id, '[\\s\\-#.]', '', 'g')) WHERE pos_order_id_norm IS NULL`
  await sql`CREATE INDEX IF NOT EXISTS pancake_orders_pos_norm_idx ON pancake_orders (pos_order_id_norm)`
  // v10: số liệu theo đúng màn Thống kê Pancake (skill hacofood-baocao) — đơn chốt, doanh thu sàn, người bán, quảng cáo
  await dropCheck(sql, 'pancake_orders', 'platform')
  await sql`ALTER TABLE pancake_orders ADD CONSTRAINT pancake_orders_platform_check
            CHECK (platform IN ('facebook', 'tiktok', 'shopee', 'lazada', 'web', 'zalo', 'bep', 'khac'))`
  await sql`ALTER TABLE pancake_orders ADD COLUMN IF NOT EXISTS is_closed BOOLEAN`
  await sql`ALTER TABLE pancake_orders ADD COLUMN IF NOT EXISTS counts_revenue BOOLEAN`
  await sql`ALTER TABLE pancake_orders ADD COLUMN IF NOT EXISTS items_value BIGINT`
  await sql`ALTER TABLE pancake_orders ADD COLUMN IF NOT EXISTS revenue BIGINT`
  await sql`ALTER TABLE pancake_orders ADD COLUMN IF NOT EXISTS has_wholesale BOOLEAN NOT NULL DEFAULT FALSE`
  for (const c of ['seller_name', 'care_name', 'marketer_name', 'ad_id', 'utm_campaign']) {
    await sql.unsafe(`ALTER TABLE pancake_orders ADD COLUMN IF NOT EXISTS ${c} TEXT`)
  }
  // Tính lại đơn cũ (chỉ những dòng chưa có số mới). Nhóm hàng sỉ chỉ tính lại được khi đồng bộ/nạp lại đơn.
  await sql`
    UPDATE pancake_orders o SET
      is_closed = o.status NOT IN (0, 6, 7),
      counts_revenue = o.status NOT IN (0, 5, 6, 7),
      items_value = v.iv,
      revenue = CASE WHEN o.platform IN ('shopee', 'tiktok', 'lazada') AND o.cod + o.prepaid > 0 THEN o.cod + o.prepaid
                     ELSE GREATEST(0, v.iv - o.discount) END
    FROM (SELECT pos_order_id, COALESCE((SELECT SUM((it->>'qty')::numeric * (it->>'price')::numeric) FROM jsonb_array_elements(items) it), 0)::bigint AS iv
          FROM pancake_orders WHERE revenue IS NULL) v
    WHERE o.pos_order_id = v.pos_order_id`
  await sql`UPDATE pancake_orders SET is_real = counts_revenue AND revenue > 0 WHERE is_real IS DISTINCT FROM (counts_revenue AND revenue > 0)`
  await sql`CREATE INDEX IF NOT EXISTS pancake_orders_revenue_idx ON pancake_orders (inserted_at) WHERE counts_revenue`

  await sql`CREATE INDEX IF NOT EXISTS pancake_orders_customer_idx ON pancake_orders (customer_id, inserted_at DESC)`
  await sql`CREATE INDEX IF NOT EXISTS pancake_orders_phone_idx ON pancake_orders (phone_norm)`
  await sql`CREATE INDEX IF NOT EXISTS pancake_orders_inserted_idx ON pancake_orders (inserted_at DESC)`
  await sql`CREATE INDEX IF NOT EXISTS pancake_orders_tracking_idx ON pancake_orders (tracking_code_norm) WHERE tracking_code_norm IS NOT NULL`
  await sql`CREATE INDEX IF NOT EXISTS pancake_orders_platform_ref_idx ON pancake_orders (platform_order_ref_norm) WHERE platform_order_ref_norm IS NOT NULL`
  await sql`
    CREATE TABLE IF NOT EXISTS sync_runs (
      id SERIAL PRIMARY KEY,
      kind TEXT NOT NULL,
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      finished_at TIMESTAMPTZ,
      ok BOOLEAN,
      rows INT NOT NULL DEFAULT 0,
      detail TEXT NOT NULL DEFAULT ''
    )
  `

  // ── Sản phẩm: dòng sản phẩm, giá, số ngày dùng hết (B4 Z05), hàng chỉ bán kênh riêng (B4 K15) ──
  await sql`
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      line TEXT NOT NULL,
      name TEXT NOT NULL,
      skus TEXT[] NOT NULL DEFAULT '{}',
      retail_price BIGINT NOT NULL DEFAULT 0,
      wholesale_note TEXT NOT NULL DEFAULT '',
      use_up_days INT,
      private_channel_only BOOLEAN NOT NULL DEFAULT FALSE,
      next_offer TEXT NOT NULL DEFAULT '',
      active BOOLEAN NOT NULL DEFAULT TRUE,
      revenue_rank INT,
      UNIQUE (line, name)
    )
  `

  // ── Việc (kho việc): nguồn, ưu tiên, kết quả, lý do sửa đề xuất (B2 Z04), duyệt trong 24h ─────
  await sql`ALTER TABLE crm_tasks ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'khac'`
  await sql`ALTER TABLE crm_tasks ADD COLUMN IF NOT EXISTS priority SMALLINT NOT NULL DEFAULT 2`
  await sql`ALTER TABLE crm_tasks ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'can_lam'`
  await dropCheck(sql, 'crm_tasks', 'status')
  await sql`ALTER TABLE crm_tasks ADD CONSTRAINT crm_tasks_status_check CHECK (status IN ('can_lam', 'dang_lam', 'xong', 'bo_qua'))`
  await sql`UPDATE crm_tasks SET status = 'xong' WHERE done_at IS NOT NULL AND status = 'can_lam'`
  await sql`ALTER TABLE crm_tasks ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'tay'`
  await sql`ALTER TABLE crm_tasks ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT ''`
  await sql`ALTER TABLE crm_tasks ADD COLUMN IF NOT EXISTS suggestion TEXT NOT NULL DEFAULT ''`
  await sql`ALTER TABLE crm_tasks ADD COLUMN IF NOT EXISTS result TEXT`
  await sql`ALTER TABLE crm_tasks ADD COLUMN IF NOT EXISTS result_note TEXT NOT NULL DEFAULT ''`
  await sql`ALTER TABLE crm_tasks ADD COLUMN IF NOT EXISTS edit_reason TEXT NOT NULL DEFAULT ''`
  await sql`ALTER TABLE crm_tasks ADD COLUMN IF NOT EXISTS department TEXT`
  await sql`ALTER TABLE crm_tasks ADD COLUMN IF NOT EXISTS checklist JSONB NOT NULL DEFAULT '[]'`
  await sql`ALTER TABLE crm_tasks ADD COLUMN IF NOT EXISTS reviewed_by INT`
  await sql`ALTER TABLE crm_tasks ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ`
  await sql`ALTER TABLE crm_tasks ADD COLUMN IF NOT EXISTS review_note TEXT NOT NULL DEFAULT ''`
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS crm_tasks_auto_key_uq ON crm_tasks (auto_key) WHERE auto_key IS NOT NULL`
  await sql`CREATE INDEX IF NOT EXISTS crm_tasks_assignee_idx ON crm_tasks (assigned_staff_id, status, due_at)`
  await sql`
    CREATE TABLE IF NOT EXISTS task_templates (
      id SERIAL PRIMARY KEY,
      department TEXT NOT NULL,
      title TEXT NOT NULL,
      checklist JSONB NOT NULL DEFAULT '[]',
      repeat TEXT NOT NULL DEFAULT 'moi_ca' CHECK (repeat IN ('moi_ca', 'hang_ngay', 'hang_tuan')),
      shift_code TEXT,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      UNIQUE (department, title)
    )
  `

  // ── Cơ hội bán: thêm loại phễu (khoá offline / sỉ / setup quán / khoá online) ─────────────
  await sql`ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS pipeline TEXT NOT NULL DEFAULT 'khoa_offline'`
  await dropCheck(sql, 'opportunities', 'pipeline')
  await sql`ALTER TABLE opportunities ADD CONSTRAINT opportunities_pipeline_check CHECK (pipeline IN ('khoa_offline', 'khoa_online', 'si', 'setup_quan'))`
  await sql`ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS lost_reason TEXT NOT NULL DEFAULT ''`
  await sql`ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS next_step_at TIMESTAMPTZ`

  // ── Chấm công & phân ca (B2 bài 11, Z09): điểm làm việc, kho ca, lịch ca, lượt chấm, đơn từ ────
  await sql`
    CREATE TABLE IF NOT EXISTS work_sites (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      address TEXT NOT NULL DEFAULT '',
      lat DOUBLE PRECISION,
      lng DOUBLE PRECISION,
      radius_m INT NOT NULL DEFAULT 150,
      allowed_ips TEXT[] NOT NULL DEFAULT '{}',
      active BOOLEAN NOT NULL DEFAULT TRUE
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS shift_templates (
      id SERIAL PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      department TEXT,
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      break_minutes INT NOT NULL DEFAULT 0,
      kind TEXT NOT NULL DEFAULT 'toan_ca' CHECK (kind IN ('toan_ca', 'ban_thoi_gian', 'ca_gay', 'ca_dem')),
      late_grace_minutes INT NOT NULL DEFAULT 5,
      color TEXT NOT NULL DEFAULT '#0f766e',
      active BOOLEAN NOT NULL DEFAULT TRUE
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS shift_assignments (
      id SERIAL PRIMARY KEY,
      staff_id INT NOT NULL REFERENCES staff(id),
      work_date DATE NOT NULL,
      template_id INT NOT NULL REFERENCES shift_templates(id),
      site_id INT REFERENCES work_sites(id),
      note TEXT NOT NULL DEFAULT '',
      created_by INT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (staff_id, work_date, template_id)
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS shift_assignments_date_idx ON shift_assignments (work_date)`
  await sql`
    CREATE TABLE IF NOT EXISTS attendance_logs (
      id SERIAL PRIMARY KEY,
      staff_id INT NOT NULL REFERENCES staff(id),
      assignment_id INT REFERENCES shift_assignments(id),
      kind TEXT NOT NULL CHECK (kind IN ('vao', 'ra')),
      at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      lat DOUBLE PRECISION,
      lng DOUBLE PRECISION,
      accuracy_m DOUBLE PRECISION,
      distance_m DOUBLE PRECISION,
      site_id INT REFERENCES work_sites(id),
      device_id TEXT,
      ip TEXT,
      method TEXT NOT NULL DEFAULT 'gps' CHECK (method IN ('gps', 'ip', 'sua_tay')),
      validity TEXT NOT NULL DEFAULT 'hop_le' CHECK (validity IN ('hop_le', 'ngoai_vung', 'thiet_bi_la', 'khong_vi_tri')),
      note TEXT NOT NULL DEFAULT '',
      created_by INT
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS attendance_logs_staff_idx ON attendance_logs (staff_id, at DESC)`
  await sql`CREATE INDEX IF NOT EXISTS attendance_logs_assignment_idx ON attendance_logs (assignment_id)`
  await sql`
    CREATE TABLE IF NOT EXISTS leave_requests (
      id SERIAL PRIMARY KEY,
      staff_id INT NOT NULL REFERENCES staff(id),
      kind TEXT NOT NULL CHECK (kind IN ('nghi_phep', 'nghi_om', 'nghi_khong_luong', 'doi_ca', 'quen_cham_cong', 'di_muon_ve_som', 'tang_ca')),
      from_date DATE NOT NULL,
      to_date DATE NOT NULL,
      assignment_id INT REFERENCES shift_assignments(id),
      minutes INT,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'cho_duyet' CHECK (status IN ('cho_duyet', 'da_duyet', 'tu_choi', 'huy')),
      reviewed_by INT,
      reviewed_at TIMESTAMPTZ,
      review_note TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CHECK (to_date >= from_date)
    )
  `
  // Định biên theo TỔNG GIỜ CÔNG từng bộ phận theo thứ trong tuần (B2 Z09), không định biên người.
  await sql`
    CREATE TABLE IF NOT EXISTS staffing_targets (
      department TEXT NOT NULL,
      weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 1 AND 7),
      hours NUMERIC(5,1) NOT NULL,
      PRIMARY KEY (department, weekday)
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS holidays (
      day DATE PRIMARY KEY,
      name TEXT NOT NULL,
      pay_multiplier NUMERIC(3,1) NOT NULL DEFAULT 3.0
    )
  `

  // ── Mini App ↔ CRM (hợp đồng dữ liệu đã chốt với phiên "Mini app Zalo OA") ─────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS qr_batches (
      code TEXT PRIMARY KEY,
      sku TEXT NOT NULL DEFAULT '',
      channel TEXT NOT NULL CHECK (channel IN ('shopee', 'tiktok', 'facebook', 'bep')),
      cta TEXT NOT NULL,
      landing_variant TEXT NOT NULL DEFAULT 'a',
      printed_qty INT NOT NULL DEFAULT 0,
      note TEXT NOT NULL DEFAULT '',
      created_by INT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS mini_sessions (
      id SERIAL PRIMARY KEY,
      anon_id TEXT NOT NULL,
      phone TEXT,
      verified BOOLEAN NOT NULL DEFAULT FALSE,
      verified_via TEXT CHECK (verified_via IS NULL OR verified_via IN ('zalo_phone_token', 'otp', 'staff', 'order_match')),
      verified_at TIMESTAMPTZ,
      customer_id INT REFERENCES customers(id),
      created_customer BOOLEAN NOT NULL DEFAULT FALSE,
      batch_code TEXT REFERENCES qr_batches(code),
      claim_locked_until TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS mini_sessions_anon_idx ON mini_sessions (anon_id)`
  await sql`CREATE INDEX IF NOT EXISTS mini_sessions_phone_idx ON mini_sessions (phone)`
  await sql`
    CREATE TABLE IF NOT EXISTS funnel_events (
      id BIGSERIAL PRIMARY KEY,
      mini_session_id INT REFERENCES mini_sessions(id),
      customer_id INT REFERENCES customers(id),
      anon_id TEXT NOT NULL,
      step SMALLINT NOT NULL DEFAULT 0,
      name TEXT NOT NULL,
      batch_code TEXT,
      props JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS funnel_events_batch_idx ON funnel_events (batch_code, step, created_at)`
  await sql`CREATE INDEX IF NOT EXISTS funnel_events_session_idx ON funnel_events (mini_session_id)`
  await sql`
    CREATE TABLE IF NOT EXISTS consents (
      id SERIAL PRIMARY KEY,
      mini_session_id INT REFERENCES mini_sessions(id),
      customer_id INT REFERENCES customers(id),
      channel TEXT NOT NULL CHECK (channel IN ('zalo_oa', 'zbs', 'sms', 'email', 'dien_thoai')),
      purpose TEXT NOT NULL,
      text_version TEXT NOT NULL,
      text_hash TEXT NOT NULL DEFAULT '',
      verified BOOLEAN NOT NULL DEFAULT FALSE,
      granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      revoked_at TIMESTAMPTZ,
      source TEXT NOT NULL,
      evidence JSONB NOT NULL DEFAULT '{}'
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS consents_customer_idx ON consents (customer_id)`
  await sql`
    CREATE TABLE IF NOT EXISTS order_claims (
      id SERIAL PRIMARY KEY,
      mini_session_id INT NOT NULL REFERENCES mini_sessions(id),
      customer_id INT REFERENCES customers(id),
      order_ref_raw TEXT NOT NULL,
      order_ref_norm TEXT NOT NULL,
      ref_kind TEXT CHECK (ref_kind IS NULL OR ref_kind IN ('tracking_code', 'platform_order_ref', 'pos_order_id')),
      platform TEXT CHECK (platform IS NULL OR platform IN ('facebook', 'tiktok', 'shopee', 'web', 'bep', 'khac')),
      matched_pancake_order_id TEXT REFERENCES pancake_orders(pos_order_id),
      lookup_result TEXT NOT NULL DEFAULT 'chua_thay' CHECK (lookup_result IN ('khop_sdt', 'don_san', 'nhieu_don', 'sai_sdt', 'chua_thay')),
      status TEXT NOT NULL DEFAULT 'cho_duyet' CHECK (status IN ('cho_duyet', 'da_khop', 'tu_choi')),
      retry_until TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
      reviewed_by INT,
      reviewed_at TIMESTAMPTZ,
      review_note TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS order_claims_matched_uq ON order_claims (matched_pancake_order_id) WHERE status = 'da_khop'`
  await sql`CREATE INDEX IF NOT EXISTS order_claims_status_idx ON order_claims (status, created_at)`
  await sql`
    CREATE TABLE IF NOT EXISTS lesson_progress (
      mini_session_id INT NOT NULL REFERENCES mini_sessions(id),
      lesson_no SMALLINT NOT NULL,
      customer_id INT REFERENCES customers(id),
      unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      watched_pct SMALLINT NOT NULL DEFAULT 0 CHECK (watched_pct BETWEEN 0 AND 100),
      completed_at TIMESTAMPTZ,
      PRIMARY KEY (mini_session_id, lesson_no)
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS reward_ledger (
      id SERIAL PRIMARY KEY,
      mini_session_id INT REFERENCES mini_sessions(id),
      customer_id INT REFERENCES customers(id),
      kind TEXT NOT NULL CHECK (kind IN ('voucher', 'hoan_tien', 'gioi_thieu')),
      program TEXT NOT NULL,
      amount BIGINT NOT NULL DEFAULT 0,
      code TEXT UNIQUE,
      locked_phone TEXT,
      expires_at TIMESTAMPTZ,
      order_id TEXT,
      referral_reward_id INT REFERENCES referral_rewards(id),
      status TEXT NOT NULL DEFAULT 'da_cap' CHECK (status IN ('da_cap', 'da_dung', 'het_han', 'huy')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS reward_ledger_once_uq ON reward_ledger (locked_phone, program) WHERE locked_phone IS NOT NULL AND status <> 'huy'`

  // ── Mini App v2-A: điểm danh, sổ cái "Hạt Cốm", sổ tay công thức ─────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS daily_checkins (
      id SERIAL PRIMARY KEY,
      mini_session_id INT NOT NULL REFERENCES mini_sessions(id),
      customer_id INT REFERENCES customers(id),
      day DATE NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (mini_session_id, day)
    )
  `
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS daily_checkins_customer_day_uq ON daily_checkins (customer_id, day) WHERE customer_id IS NOT NULL`
  // Sổ cái: số dư = SUM(delta). Dòng âm (đổi quà) chỉ ghi được khi đã gắn khách đã xác minh — chặn ngay trong DB.
  await sql`
    CREATE TABLE IF NOT EXISTS points_ledger (
      id SERIAL PRIMARY KEY,
      mini_session_id INT NOT NULL REFERENCES mini_sessions(id),
      customer_id INT REFERENCES customers(id),
      delta INT NOT NULL CHECK (delta <> 0),
      reason TEXT NOT NULL CHECK (reason IN ('diem_danh', 'moc_chuoi', 'dang_ky', 'dieu_chinh', 'doi_qua', 'dung_don', 'hoan_don')),
      ref TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      created_by INT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (mini_session_id, reason, ref),
      CHECK (delta > 0 OR customer_id IS NOT NULL),
      CHECK (reason <> 'dieu_chinh' OR created_by IS NOT NULL)
    )
  `
  // Thưởng đăng ký cũng chỉ 1 lần/khách (không thì nhiều phiên = nhiều lần thưởng)
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS points_ledger_customer_once_uq ON points_ledger (customer_id, reason, ref)
            WHERE customer_id IS NOT NULL AND reason IN ('diem_danh', 'moc_chuoi', 'dang_ky')`
  await sql`CREATE INDEX IF NOT EXISTS points_ledger_customer_idx ON points_ledger (customer_id) WHERE customer_id IS NOT NULL`
  // v11: tiêu điểm vào đơn Mini App ('dung_don') và trả lại khi huỷ đơn ('hoan_don'); ref = mã đơn HMA…
  await dropCheck(sql, 'points_ledger', 'reason')
  await sql`ALTER TABLE points_ledger ADD CONSTRAINT points_ledger_reason_check CHECK (reason IN
    ('diem_danh', 'moc_chuoi', 'dang_ky', 'dieu_chinh', 'doi_qua', 'dung_don', 'hoan_don'))`
  await sql`ALTER TABLE points_ledger ADD CONSTRAINT points_ledger_dieu_chinh_check CHECK (reason <> 'dieu_chinh' OR created_by IS NOT NULL)`
  await sql`
    CREATE TABLE IF NOT EXISTS saved_recipes (
      mini_session_id INT NOT NULL REFERENCES mini_sessions(id),
      customer_id INT REFERENCES customers(id),
      recipe_slug TEXT NOT NULL CHECK (recipe_slug ~ '^[a-z0-9-]{1,80}$'),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (mini_session_id, recipe_slug)
    )
  `

  // ── Cài đặt chung (key/value có kiểu) ─────────────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL,
      updated_by INT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  // ── v11: Đơn đặt trong Mini App (hợp đồng v2-B). Giá do máy chủ tính; total = số khách trả (chưa ship) = COD gửi POScake.
  // Giới hạn dòng hàng chặn cả trong DB: 1–10 dòng, mỗi dòng 1–20, tổng ≤ 50. Giới hạn số đơn/giờ/ngày nằm ở lib/mini/orders.ts (có khoá).
  await sql.unsafe(`
    CREATE OR REPLACE FUNCTION mini_items_ok(items jsonb) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
      SELECT jsonb_typeof(items) = 'array' AND jsonb_array_length(items) BETWEEN 1 AND 10
        AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(items) it
                        WHERE jsonb_typeof(it->'qty') <> 'number' OR (it->>'qty')::numeric NOT BETWEEN 1 AND 20
                           OR (it->>'qty')::numeric <> trunc((it->>'qty')::numeric)
                           OR jsonb_typeof(it->'unit_price') <> 'number' OR (it->>'unit_price')::numeric < 0
                           OR COALESCE(it->>'sku', '') = '')
        AND (SELECT SUM((it->>'qty')::numeric) FROM jsonb_array_elements(items) it) <= 50
    $$`)
  await sql`
    CREATE TABLE IF NOT EXISTS mini_orders (
      id SERIAL PRIMARY KEY,
      ref_code TEXT UNIQUE NOT NULL CHECK (ref_code ~ '^HMA[0-9A-F]{8,}$'),
      mini_session_id INT NOT NULL REFERENCES mini_sessions(id),
      customer_id INT REFERENCES customers(id),
      phone TEXT NOT NULL,
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      items JSONB NOT NULL CHECK (mini_items_ok(items)),
      subtotal BIGINT NOT NULL CHECK (subtotal > 0),
      voucher_id INT REFERENCES reward_ledger(id),
      voucher_amount BIGINT NOT NULL DEFAULT 0 CHECK (voucher_amount >= 0),
      points_used INT NOT NULL DEFAULT 0 CHECK (points_used >= 0),
      points_amount BIGINT NOT NULL DEFAULT 0 CHECK (points_amount >= 0),
      total BIGINT NOT NULL CHECK (total >= 0 AND total = subtotal - voucher_amount - points_amount),
      payment TEXT NOT NULL CHECK (payment IN ('cod', 'chuyen_khoan')),
      payment_status TEXT NOT NULL DEFAULT 'chua_tra' CHECK (payment_status IN ('chua_tra', 'da_tra')),
      pos_order_id TEXT,
      pos_status TEXT NOT NULL DEFAULT 'cho_tao' CHECK (pos_status IN ('cho_tao', 'da_tao', 'loi')),
      pos_error TEXT,
      channel TEXT NOT NULL DEFAULT 'web' CHECK (channel IN ('web', 'zalo')),
      status TEXT NOT NULL DEFAULT 'moi' CHECK (status IN ('moi', 'huy')),
      cancelled_by INT REFERENCES staff(id),
      cancel_reason TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CHECK (voucher_id IS NOT NULL OR voucher_amount = 0),
      CHECK ((points_used = 0) = (points_amount = 0)),
      CHECK (points_used = 0 OR customer_id IS NOT NULL)
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS mini_orders_session_idx ON mini_orders (mini_session_id)`
  await sql`CREATE INDEX IF NOT EXISTS mini_orders_customer_idx ON mini_orders (customer_id) WHERE customer_id IS NOT NULL`
  await sql`CREATE INDEX IF NOT EXISTS mini_orders_phone_idx ON mini_orders (phone, created_at DESC)`
  await sql`CREATE INDEX IF NOT EXISTS mini_orders_pos_idx ON mini_orders (pos_order_id) WHERE pos_order_id IS NOT NULL`
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS mini_orders_voucher_uq ON mini_orders (voucher_id) WHERE voucher_id IS NOT NULL`

  // ── v12: Sự kiện & hộp thư trong Mini App (hợp đồng v3-A; Zalo Mini App 4.6: không like/bình luận trong app) ──
  await sql`
    CREATE TABLE IF NOT EXISTS events (
      id SERIAL PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL CHECK (slug ~ '^[a-z0-9-]{3,80}$'),
      title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
      summary TEXT NOT NULL DEFAULT '',
      body TEXT NOT NULL DEFAULT '',
      kind TEXT NOT NULL CHECK (kind IN ('livestream', 'workshop', 'thu_thach', 'uu_dai', 'le_tet', 'khac')),
      starts_at TIMESTAMPTZ NOT NULL,
      ends_at TIMESTAMPTZ CHECK (ends_at IS NULL OR ends_at >= starts_at),
      location TEXT NOT NULL DEFAULT '',
      image TEXT NOT NULL DEFAULT '' CHECK (image = '' OR image ~ '^(/images/|https://)'),
      join_url TEXT NOT NULL DEFAULT '' CHECK (join_url = '' OR join_url ~ '^https://'),
      capacity INT CHECK (capacity IS NULL OR capacity > 0),
      status TEXT NOT NULL DEFAULT 'nhap' CHECK (status IN ('nhap', 'cong_bo', 'huy')),
      created_by INT REFERENCES staff(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS events_status_idx ON events (status, starts_at)`
  // Khách bấm "Nhắc tôi" / "Giữ chỗ". Số chỗ đã giữ = giu_cho chưa huỷ; phiên Mini App khoá theo sự kiện khi giữ chỗ.
  await sql`
    CREATE TABLE IF NOT EXISTS event_reminders (
      id SERIAL PRIMARY KEY,
      event_id INT NOT NULL REFERENCES events(id),
      mini_session_id INT NOT NULL REFERENCES mini_sessions(id),
      customer_id INT REFERENCES customers(id),
      kind TEXT NOT NULL CHECK (kind IN ('nhac', 'giu_cho')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      cancelled_at TIMESTAMPTZ,
      UNIQUE (event_id, mini_session_id, kind)
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS event_reminders_event_idx ON event_reminders (event_id, kind) WHERE cancelled_at IS NULL`
  await sql`CREATE INDEX IF NOT EXISTS event_reminders_customer_idx ON event_reminders (customer_id) WHERE customer_id IS NOT NULL`
  // Hộp thư trong app. Link chỉ là đường dẫn TRONG app (Zalo 4.1). Thông báo chung không được gắn người cụ thể.
  await sql`
    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
      body TEXT NOT NULL DEFAULT '',
      link TEXT NOT NULL DEFAULT '' CHECK (link = '' OR link ~ '^/[a-z0-9/_-]*$'),
      image TEXT NOT NULL DEFAULT '' CHECK (image = '' OR image ~ '^(/images/|https://)'),
      kind TEXT NOT NULL CHECK (kind IN ('su_kien', 'cong_thuc', 'uu_dai', 'don_hang', 'khoe_mon', 'he_thong')),
      audience TEXT NOT NULL CHECK (audience IN ('tat_ca', 'da_xac_minh', 'khach', 'phien')),
      customer_id INT REFERENCES customers(id),
      mini_session_id INT REFERENCES mini_sessions(id),
      event_id INT REFERENCES events(id),
      publish_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ CHECK (expires_at IS NULL OR expires_at > publish_at),
      created_by INT REFERENCES staff(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CHECK (audience <> 'khach' OR customer_id IS NOT NULL),
      CHECK (audience <> 'phien' OR mini_session_id IS NOT NULL),
      CHECK (audience NOT IN ('tat_ca', 'da_xac_minh') OR (customer_id IS NULL AND mini_session_id IS NULL))
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS notifications_publish_idx ON notifications (publish_at DESC)`
  await sql`CREATE INDEX IF NOT EXISTS notifications_customer_idx ON notifications (customer_id) WHERE customer_id IS NOT NULL`
  await sql`CREATE INDEX IF NOT EXISTS notifications_session_idx ON notifications (mini_session_id) WHERE mini_session_id IS NOT NULL`
  // Một thông báo sự kiện "gửi mọi người" cho mỗi sự kiện (bấm công bố 2 lần không tạo 2 tin)
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS notifications_event_once_uq ON notifications (event_id) WHERE event_id IS NOT NULL AND audience = 'tat_ca'`
  await sql`
    CREATE TABLE IF NOT EXISTS notification_reads (
      notification_id INT NOT NULL REFERENCES notifications(id),
      mini_session_id INT NOT NULL REFERENCES mini_sessions(id),
      customer_id INT REFERENCES customers(id),
      read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (notification_id, mini_session_id)
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS notification_reads_customer_idx ON notification_reads (customer_id, notification_id) WHERE customer_id IS NOT NULL`

  // ── v13: cầu nối sang Zalo CRM của HACO (HACO-ZL-CRM): đơn đã chốt được gửi sang webhook đơn hàng ký HMAC ──
  await sql`ALTER TABLE pancake_orders ADD COLUMN IF NOT EXISTS zl_pushed_at TIMESTAMPTZ`
  await sql`ALTER TABLE pancake_orders ADD COLUMN IF NOT EXISTS zl_push_error TEXT`
  await sql`CREATE INDEX IF NOT EXISTS pancake_orders_zl_pending_idx ON pancake_orders (inserted_at)
            WHERE zl_pushed_at IS NULL AND counts_revenue AND NOT phone_masked AND phone_norm <> ''`

  // ── v14: Trung tâm AI — agent có mức tự chủ L0/L1/L2, hàng chờ duyệt + nhật ký hành động (kế hoạch HACO-ZL-CRM/haco) ──
  // Điều khiển chung (dừng khẩn cấp, mô phỏng) nằm ở app_settings key 'ai_control'.
  await sql`
    CREATE TABLE IF NOT EXISTS ai_agents (
      code TEXT PRIMARY KEY CHECK (code ~ '^[a-z_]{2,40}$'),
      name TEXT NOT NULL,
      purpose TEXT NOT NULL DEFAULT '',
      kpi TEXT NOT NULL DEFAULT '',
      level TEXT NOT NULL DEFAULT 'L0' CHECK (level IN ('L0', 'L1', 'L2')),
      max_level TEXT NOT NULL DEFAULT 'L2' CHECK (max_level IN ('L0', 'L1', 'L2')),
      enabled BOOLEAN NOT NULL DEFAULT FALSE,
      home TEXT NOT NULL DEFAULT 'crm' CHECK (home IN ('crm', 'zalo')),
      model_tier TEXT NOT NULL DEFAULT 're' CHECK (model_tier IN ('re', 'vua', 'manh')),
      kinds TEXT[] NOT NULL DEFAULT '{}',
      max_auto_per_day INT NOT NULL DEFAULT 20 CHECK (max_auto_per_day BETWEEN 0 AND 1000),
      sort SMALLINT NOT NULL DEFAULT 0,
      updated_by INT REFERENCES staff(id),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CHECK (level <= max_level)
    )
  `
  await sql`
    INSERT INTO ai_agents (code, name, purpose, kpi, level, max_level, enabled, home, model_tier, kinds, sort) VALUES
      ('tro_ly_ceo', 'Trợ lý CEO kiêm Số liệu', 'Bản tin 8h cho Cô Hạ: doanh thu, đơn chốt, khách mới, việc quá hạn, hàng chờ duyệt. Chỉ đọc số, không ghi gì vào dữ liệu.',
        '14 ngày bản tin liên tục, 0 số sai so với màn Thống kê Pancake', 'L2', 'L2', TRUE, 'crm', 're', '{bao_cao}', 1),
      ('cskh', 'CSKH kiêm Follow-up', 'Soạn nháp trả lời khách 1-1 trong Zalo CRM theo kịch bản HACO; nhân viên đọc rồi mới gửi.',
        'Phản hồi trung vị −50%; ≥ 80% nháp dùng nguyên văn', 'L1', 'L1', FALSE, 'zalo', 'vua', '{gui_tin}', 2),
      ('giu_chan', 'Giữ chân & mua lại', 'Tìm khách đã mua 25–45 ngày (sốt, nguyên liệu sắp hết), soạn tin hỏi thăm mời mua lại để người duyệt.',
        'Tỉ lệ mua lại 60 ngày +5 điểm %', 'L1', 'L1', FALSE, 'crm', 'vua', '{gui_tin,tao_viec}', 3),
      ('noi_dung', 'Content đa kênh', 'Viết bài Fanpage / Zalo OA từ kho câu chuyện và phàn nàn của khách. Chỉ mở khi số liệu cho thấy content nghẽn.',
        '20 bài/tuần, 0 vi phạm luật quảng cáo', 'L0', 'L1', FALSE, 'crm', 'manh', '{dang_bai}', 4),
      ('kiem_duyet', 'Kiểm duyệt chất lượng', 'Soát tin và bài trước khi gửi: giá đúng kịch bản, không nói chữa bệnh, không chữ "nhất".',
        '0 tin sai giá/chính sách lọt ra ngoài', 'L0', 'L2', FALSE, 'crm', 're', '{}', 5),
      ('quang_cao', 'Quảng cáo', 'Đọc số quảng cáo và đề xuất. Không bao giờ tự tiêu tiền (khoá ở L0).',
        'ROAS không giảm so với tuần trước', 'L0', 'L0', FALSE, 'crm', 'manh', '{}', 6)
    ON CONFLICT (code) DO NOTHING`
  await sql`
    CREATE TABLE IF NOT EXISTS ai_actions (
      id SERIAL PRIMARY KEY,
      agent_code TEXT NOT NULL REFERENCES ai_agents(code),
      kind TEXT NOT NULL CHECK (kind IN ('gui_tin', 'tao_viec', 'cap_nhat_khach', 'dang_bai', 'bao_cao')),
      customer_id INT REFERENCES customers(id),
      title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 300),
      body TEXT NOT NULL DEFAULT '',
      original_body TEXT NOT NULL DEFAULT '',
      payload JSONB NOT NULL DEFAULT '{}',
      rationale TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL CHECK (status IN ('de_xuat', 'cho_duyet', 'mo_phong', 'da_thuc_hien', 'tu_choi', 'loi', 'da_hoan_tac', 'het_han')),
      level_at_create TEXT NOT NULL CHECK (level_at_create IN ('L0', 'L1', 'L2')),
      auto_executed BOOLEAN NOT NULL DEFAULT FALSE,
      edited BOOLEAN NOT NULL DEFAULT FALSE,
      sim_verdict TEXT CHECK (sim_verdict IN ('dong_y', 'khac')),
      decided_by INT REFERENCES staff(id),
      decided_at TIMESTAMPTZ,
      decision_note TEXT NOT NULL DEFAULT '',
      executed_at TIMESTAMPTZ,
      result JSONB,
      error TEXT,
      dedupe_key TEXT UNIQUE,
      expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CHECK (status NOT IN ('tu_choi') OR decision_note <> ''),
      CHECK (status <> 'mo_phong' OR executed_at IS NULL)
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS ai_actions_status_idx ON ai_actions (status, created_at DESC)`
  await sql`CREATE INDEX IF NOT EXISTS ai_actions_agent_idx ON ai_actions (agent_code, created_at DESC)`
  await sql`CREATE INDEX IF NOT EXISTS ai_actions_customer_idx ON ai_actions (customer_id) WHERE customer_id IS NOT NULL`

  // ── v15: Kho việc (Buổi 2 · Easymart): việc cha → việc con, gắn bộ phận / ca; vào ca là sinh việc của ca ──
  await sql`ALTER TABLE task_templates ADD COLUMN IF NOT EXISTS group_name TEXT NOT NULL DEFAULT ''`
  await sql`ALTER TABLE task_templates ADD COLUMN IF NOT EXISTS due_offset_min INT CHECK (due_offset_min IS NULL OR due_offset_min BETWEEN 0 AND 1440)`
  await sql`ALTER TABLE task_templates ADD COLUMN IF NOT EXISTS sort INT NOT NULL DEFAULT 0`
  await sql`ALTER TABLE task_templates ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'tay'`
  await sql`ALTER TABLE task_templates ADD COLUMN IF NOT EXISTS updated_by INT REFERENCES staff(id)`
  await sql`ALTER TABLE task_templates ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
  await dropCheck(sql, 'task_templates', 'source')
  await sql`ALTER TABLE task_templates ADD CONSTRAINT task_templates_source_check CHECK (source IN ('tay', 'de_xuat'))`
  // Kho việc đề xuất sẵn (TẮT): quản lý đọc, sửa, bật — "AI đề xuất kho việc, người duyệt một lượt" (B2 phần 12)
  await sql`
    INSERT INTO task_templates (department, group_name, title, checklist, repeat, due_offset_min, sort, active, source) VALUES
      ('bep', 'Mở ca bếp', 'Kiểm nhiệt độ tủ mát, tủ đông và ghi sổ', '[{"text":"Tủ mát 0–5°C","done":false},{"text":"Tủ đông ≤ −18°C","done":false},{"text":"Ghi vào sổ nhiệt độ","done":false}]', 'moi_ca', 30, 1, FALSE, 'de_xuat'),
      ('bep', 'Mở ca bếp', 'Vệ sinh khu sơ chế trước khi làm', '[{"text":"Lau bàn, dao thớt","done":false},{"text":"Đủ găng tay, mũ, tạp dề","done":false}]', 'moi_ca', 30, 2, FALSE, 'de_xuat'),
      ('bep', 'Sản xuất', 'Làm theo phiếu sản xuất trong ngày', '[{"text":"Đối chiếu số lượng với đơn chờ giao","done":false},{"text":"Ghi số lô và hạn dùng lên nhãn","done":false}]', 'hang_ngay', NULL, 3, FALSE, 'de_xuat'),
      ('bep', 'Đóng ca bếp', 'Vệ sinh cuối ca, khoá gas', '[{"text":"Rửa dụng cụ, lau sàn","done":false},{"text":"Đổ rác","done":false},{"text":"Khoá gas, tắt điện","done":false}]', 'moi_ca', NULL, 4, FALSE, 'de_xuat'),
      ('kho_van', 'Đóng gói đơn', 'In phiếu và soạn đơn Pancake trong ngày', '[{"text":"In phiếu đơn đã xác nhận","done":false},{"text":"Đóng gói đủ món, kèm thẻ QR Mini App","done":false},{"text":"Chụp ảnh gói hàng đơn từ 500.000đ","done":false}]', 'hang_ngay', 180, 1, FALSE, 'de_xuat'),
      ('kho_van', 'Kiểm kho', 'Kiểm tồn sốt và nguyên liệu cuối ngày', '[{"text":"Đếm hũ sốt theo loại","done":false},{"text":"Báo quản lý món sắp hết","done":false}]', 'hang_ngay', NULL, 2, FALSE, 'de_xuat'),
      ('sale_cskh', 'Đầu ca', 'Trả lời hết tin nhắn tồn từ tối qua', '[{"text":"Fanpage / Pancake","done":false},{"text":"Zalo CRM","done":false}]', 'moi_ca', 60, 1, FALSE, 'de_xuat'),
      ('sale_cskh', 'Chăm khách', 'Làm hết việc chăm khách máy giao hôm nay', '[]', 'hang_ngay', NULL, 2, FALSE, 'de_xuat'),
      ('sale_cskh', 'Cuối ca', 'Ghi phàn nàn của khách vào hồ sơ khách', '[{"text":"Ghi rõ món, vấn đề, cách đã xử lý","done":false}]', 'moi_ca', NULL, 3, FALSE, 'de_xuat')
    ON CONFLICT (department, title) DO NOTHING`
  await sql`CREATE INDEX IF NOT EXISTS crm_tasks_staff_due_idx ON crm_tasks (assigned_staff_id, due_at) WHERE status IN ('can_lam', 'dang_lam')`

  // ── v16: Cô Hạ đồng ý (27/10/2026) bật tự đóng việc máy sinh quá hạn 3 ngày; việc gọi khách lớn được giữ lại và rải dần.
  //    Chỉ đặt khi chưa có, để quản trị chỉnh sau này không bị ghi đè.
  await sql`INSERT INTO app_settings (key, value) VALUES ('task_auto_expire_days', '3') ON CONFLICT (key) DO NOTHING`

  // ── v17: hội thoại Pancake (inbox) gắn với khách CRM theo SĐT — kết nối học theo Chat Quality Agent ──
  await sql`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS customer_id INT REFERENCES customers(id)`
  await sql`CREATE INDEX IF NOT EXISTS conversations_customer_idx ON conversations (customer_id, last_message_at DESC) WHERE customer_id IS NOT NULL`
  await sql`CREATE INDEX IF NOT EXISTS conversations_waiting_idx ON conversations (last_message_at) WHERE is_unread`
}
