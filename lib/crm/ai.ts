// Trung tâm AI (kế hoạch HACO-ZL-CRM/haco/KE-HOACH-HACO.md, bài học B2 K01, B6 K10, B5 K21):
// - Mỗi agent có mức tự chủ: L0 chỉ đề xuất · L1 làm khi người duyệt · L2 tự làm trong giới hạn (trần số việc/ngày).
// - Mọi hành động của agent đi qua bảng ai_actions: hàng chờ duyệt + nhật ký + hoàn tác.
// - DỪNG KHẨN CẤP: chặn mọi lượt thực hiện ở đây (đọc thẳng DB mỗi lần, không cache) và gọi công tắc dừng của Zalo CRM.
// - MÔ PHỎNG: agent vẫn chạy trên dữ liệu thật nhưng chỉ ghi 'mo_phong', không làm gì; người chấm "đồng ý / khác" để đo độ khớp.
import { getDb } from '../db'
import { logAction } from './audit'

type Sql = ReturnType<typeof getDb>

export const LEVELS = {
  L0: 'L0 · Chỉ đề xuất',
  L1: 'L1 · Chờ duyệt',
  L2: 'L2 · Tự làm trong giới hạn',
} as const
export type Level = keyof typeof LEVELS

export const ACTION_KINDS = {
  gui_tin: 'Gửi tin cho khách',
  tao_viec: 'Tạo việc cho nhân viên',
  cap_nhat_khach: 'Cập nhật hồ sơ khách',
  dang_bai: 'Đăng bài',
  bao_cao: 'Bản tin / báo cáo',
} as const
export type ActionKind = keyof typeof ACTION_KINDS

export const ACTION_STATUS = {
  de_xuat: 'Đề xuất (L0)',
  cho_duyet: 'Chờ duyệt',
  mo_phong: 'Mô phỏng',
  da_thuc_hien: 'Đã thực hiện',
  tu_choi: 'Từ chối',
  loi: 'Lỗi',
  da_hoan_tac: 'Đã hoàn tác',
  het_han: 'Hết hạn',
} as const
export type ActionStatus = keyof typeof ACTION_STATUS

export const MODEL_TIERS = { re: 'Model rẻ (đọc, ghi, nhắc)', vua: 'Model vừa (soạn tin)', manh: 'Model mạnh (phân tích, viết)' } as const

/** Trường hồ sơ khách agent được phép đề xuất sửa (có hoàn tác). */
const CUSTOMER_FIELDS = { stars: 'Số sao', stage: 'Giai đoạn' } as const

export class AiError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

// ── Điều khiển chung ────────────────────────────────────────────────────────────────────

export interface AiControl {
  stopped: boolean
  stopped_at: string | null
  stopped_by: number | null
  reason: string
  simulation: boolean
  zalo: { ok: boolean; detail: string; at: string } | null
}

const DEFAULT_CONTROL: AiControl = { stopped: false, stopped_at: null, stopped_by: null, reason: '', simulation: false, zalo: null }

export async function getControl(sql: Sql = getDb()): Promise<AiControl> {
  const r = await sql`SELECT value FROM app_settings WHERE key = 'ai_control'`
  return { ...DEFAULT_CONTROL, ...((r[0]?.value as Partial<AiControl>) ?? {}) }
}

async function saveControl(c: AiControl, staffId: number | null, sql: Sql) {
  await sql`INSERT INTO app_settings (key, value, updated_by) VALUES ('ai_control', ${sql.json(c as never)}, ${staffId})
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = NOW()`
}

/** Gọi công tắc dừng của Zalo CRM (HACO-ZL-CRM /api/public/ai/kill-switch). Không cấu hình thì báo rõ để người tắt tay. */
export async function callZaloKillSwitch(action: 'stop' | 'resume', reason: string, fetchImpl: typeof fetch = fetch) {
  const base = (process.env.ZL_CRM_URL || '').replace(/\/$/, '')
  const key = process.env.ZL_CRM_API_KEY || ''
  const at = new Date().toISOString()
  if (!base || !key) return { ok: false, detail: 'Chưa cấu hình ZL_CRM_URL / ZL_CRM_API_KEY: vào Zalo CRM tắt tay AI và chuỗi tin', at }
  try {
    const res = await fetchImpl(`${base}/api/public/ai/kill-switch`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': key },
      body: JSON.stringify({ action, reason }), signal: AbortSignal.timeout(8_000),
    })
    return res.ok ? { ok: true, detail: action === 'stop' ? 'Zalo CRM đã dừng AI và chuỗi tin' : 'Zalo CRM đã chạy lại', at }
      : { ok: false, detail: `Zalo CRM trả lỗi ${res.status}: vào Zalo CRM kiểm tra tay`, at }
  } catch (e) {
    return { ok: false, detail: `Không gọi được Zalo CRM (${e instanceof Error ? e.message : e}): vào Zalo CRM tắt tay`, at }
  }
}

/** Dừng: ai có quyền xem cũng bấm được. Chạy lại: chỉ người quản lý AI (route kiểm quyền). */
export async function setEmergencyStop(stop: boolean, staffId: number, reason: string, ip: string, sql: Sql = getDb(), fetchImpl: typeof fetch = fetch) {
  const before = await getControl(sql)
  const next: AiControl = stop
    ? { ...before, stopped: true, stopped_at: new Date().toISOString(), stopped_by: staffId, reason }
    : { ...before, stopped: false, reason }
  // Ghi trạng thái trước rồi mới gọi Zalo CRM: phía CRM HACO dừng ngay cả khi mạng lỗi
  await saveControl(next, staffId, sql)
  next.zalo = await callZaloKillSwitch(stop ? 'stop' : 'resume', reason || (stop ? 'Dừng khẩn cấp từ CRM HACO' : 'Chạy lại từ CRM HACO'), fetchImpl)
  await saveControl(next, staffId, sql)
  await logAction({ actorId: staffId, action: stop ? 'AI_STOP' : 'AI_RESUME', table: 'app_settings', recordKey: 'ai_control',
    before: { stopped: before.stopped }, after: { stopped: next.stopped, zalo: next.zalo }, reason, ip }, sql)
  return next
}

export async function setSimulation(on: boolean, staffId: number, ip: string, sql: Sql = getDb()) {
  const c = await getControl(sql)
  await saveControl({ ...c, simulation: on }, staffId, sql)
  await logAction({ actorId: staffId, action: on ? 'AI_SIM_ON' : 'AI_SIM_OFF', table: 'app_settings', recordKey: 'ai_control', ip }, sql)
}

// ── Agent ───────────────────────────────────────────────────────────────────────────────

export interface AgentRow {
  code: string; name: string; purpose: string; kpi: string; level: Level; max_level: Level; enabled: boolean
  home: 'crm' | 'zalo'; model_tier: keyof typeof MODEL_TIERS; kinds: string[]; max_auto_per_day: number
}

export async function getAgent(code: string, sql: Sql = getDb()): Promise<AgentRow | null> {
  return ((await sql`SELECT * FROM ai_agents WHERE code = ${code}`)[0] as AgentRow | undefined) ?? null
}

export async function updateAgent(code: string, patch: { level?: string; enabled?: boolean; max_auto_per_day?: number }, staffId: number, ip: string, sql: Sql = getDb()) {
  const a = await getAgent(code, sql)
  if (!a) throw new AiError(404, 'Không có agent này')
  const level = patch.level ?? a.level
  if (!(level in LEVELS)) throw new AiError(400, 'Mức không hợp lệ')
  if (level > a.max_level) throw new AiError(400, `${a.name} chỉ được tới ${a.max_level}`)
  const max = patch.max_auto_per_day ?? a.max_auto_per_day
  if (!Number.isInteger(max) || max < 0 || max > 1000) throw new AiError(400, 'Trần việc tự làm mỗi ngày: 0–1000')
  const enabled = patch.enabled ?? a.enabled
  await sql`UPDATE ai_agents SET level = ${level}, enabled = ${enabled}, max_auto_per_day = ${max}, updated_by = ${staffId}, updated_at = NOW() WHERE code = ${code}`
  await logAction({ actorId: staffId, action: 'AI_AGENT_UPDATE', table: 'ai_agents', recordKey: code,
    before: { level: a.level, enabled: a.enabled, max_auto_per_day: a.max_auto_per_day }, after: { level, enabled, max_auto_per_day: max }, ip }, sql)
}

// ── Đề xuất ─────────────────────────────────────────────────────────────────────────────

export interface ProposeInput {
  agent: string; kind: ActionKind; title: string; body?: string; payload?: Record<string, unknown>
  customerId?: number | null; rationale?: string; dedupeKey?: string | null; expiresAt?: Date | null
}

/**
 * Agent gửi một việc muốn làm. Trạng thái do mức tự chủ quyết định (agent không tự chọn được):
 * tắt → bỏ · mô phỏng → 'mo_phong' · L0 → 'de_xuat' · L1 → 'cho_duyet' · L2 → tự làm nếu chưa dừng và chưa chạm trần, không thì chờ duyệt.
 * Trùng dedupeKey → bỏ qua (trả null).
 */
export async function propose(input: ProposeInput, sql: Sql = getDb()) {
  const agent = await getAgent(input.agent, sql)
  if (!agent) throw new AiError(400, `Không có agent ${input.agent}`)
  if (!agent.enabled) return null
  if (!agent.kinds.includes(input.kind)) throw new AiError(400, `${agent.name} không được làm việc loại ${input.kind}`)
  const control = await getControl(sql)
  if (input.kind === 'gui_tin') {
    if (!input.customerId) throw new AiError(400, 'Gửi tin cần khách')
    const ok = await sql`SELECT 1 FROM customers WHERE id = ${input.customerId} AND opted_out_at IS NULL AND phone_verified_at IS NOT NULL`
    if (!ok.length) return null // khách từ chối nhận tin hoặc chưa xác minh SĐT: không bao giờ đề xuất nhắn
  }
  const status: ActionStatus = control.simulation ? 'mo_phong' : agent.level === 'L0' ? 'de_xuat' : 'cho_duyet'
  const body = input.body ?? ''
  const row = (await sql`
    INSERT INTO ai_actions (agent_code, kind, customer_id, title, body, original_body, payload, rationale, status, level_at_create, dedupe_key, expires_at)
    VALUES (${agent.code}, ${input.kind}, ${input.customerId ?? null}, ${input.title.slice(0, 300)}, ${body}, ${body},
            ${sql.json((input.payload ?? {}) as never)}, ${input.rationale ?? ''}, ${status}, ${agent.level}, ${input.dedupeKey ?? null}, ${input.expiresAt ?? null})
    ON CONFLICT (dedupe_key) DO NOTHING RETURNING *`)[0]
  if (!row) return null
  if (status === 'cho_duyet' && agent.level === 'L2' && !control.stopped) {
    const used = (await sql`SELECT COUNT(*)::int AS n FROM ai_actions WHERE agent_code = ${agent.code} AND auto_executed
                            AND executed_at > date_trunc('day', NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh') AT TIME ZONE 'Asia/Ho_Chi_Minh'`)[0].n
    if (used < agent.max_auto_per_day) {
      try { return await runAction(row.id, null, { auto: true }, sql) } catch (e) { console.warn('[ai] tự làm lỗi, để chờ duyệt:', e instanceof Error ? e.message : e) }
    }
  }
  return row
}

// ── Thực hiện / duyệt / từ chối / hoàn tác ──────────────────────────────────────────────

type ActionRow = Record<string, unknown> & { id: number; kind: ActionKind; status: ActionStatus; agent_code: string; customer_id: number | null; title: string; body: string; payload: Record<string, unknown> }

/** Làm thật một việc. Mọi đường (tự làm L2, người duyệt) đều qua đây, và đây là chỗ chặn khi dừng khẩn cấp. */
async function runAction(id: number, staffId: number | null, opts: { auto?: boolean; body?: string; note?: string }, sql: Sql) {
  return sql.begin(async tx => {
    const t = tx as unknown as Sql
    const control = await getControl(t)
    if (control.stopped) throw new AiError(423, 'Trung tâm AI đang DỪNG KHẨN CẤP: không thực hiện việc nào cho tới khi người quản lý cho chạy lại')
    if (control.simulation) throw new AiError(409, 'Đang ở chế độ mô phỏng: không thực hiện việc nào')
    const a = (await t`SELECT * FROM ai_actions WHERE id = ${id} FOR UPDATE`)[0] as ActionRow | undefined
    if (!a) throw new AiError(404, 'Không tìm thấy việc')
    if (a.status !== 'cho_duyet' && a.status !== 'de_xuat') throw new AiError(409, `Việc đang ở trạng thái "${ACTION_STATUS[a.status]}"`)
    const body = opts.body !== undefined ? opts.body.trim() : a.body
    if (a.kind === 'gui_tin' && !body) throw new AiError(400, 'Tin nhắn trống')
    let result: Record<string, unknown>
    try {
      // savepoint: lệnh lỗi trong execute không làm hỏng giao dịch, vẫn ghi được trạng thái 'loi'
      result = await (tx as unknown as { savepoint: <T>(fn: (sp: Sql) => Promise<T>) => Promise<T> }).savepoint(sp => execute({ ...a, body }, staffId, sp))
    } catch (e) {
      if (e instanceof AiError) throw e
      // không ném lỗi ở đây: ném sẽ rollback cả dòng 'loi' vừa ghi
      return (await t`UPDATE ai_actions SET status = 'loi', error = ${String(e instanceof Error ? e.message : e).slice(0, 500)}, decided_by = ${staffId}, decided_at = NOW()
                      WHERE id = ${id} RETURNING *`)[0]
    }
    const after = (await t`
      UPDATE ai_actions SET status = 'da_thuc_hien', body = ${body}, edited = ${body !== a.body || a.edited === true}, auto_executed = ${!!opts.auto},
        decided_by = ${staffId}, decided_at = NOW(), decision_note = ${opts.note ?? ''}, executed_at = NOW(), result = ${t.json(result as never)}
      WHERE id = ${id} RETURNING *`)[0]
    await logAction({ actorType: opts.auto ? 'agent' : 'staff', actorId: staffId, action: opts.auto ? 'AI_AUTO_EXECUTE' : 'AI_APPROVE',
      table: 'ai_actions', recordId: id, recordKey: a.agent_code, after: { kind: a.kind, result, edited: after.edited }, reason: opts.note ?? null }, t)
    return after
  })
}

async function execute(a: ActionRow, staffId: number | null, t: Sql): Promise<Record<string, unknown>> {
  switch (a.kind) {
    case 'bao_cao':
      return {} // nội dung nằm ngay trong việc; màn Tổng quan đọc bản mới nhất
    case 'gui_tin':
    case 'tao_viec': {
      // CRM HACO chưa tự gửi Zalo: tin đã duyệt thành việc cho người phụ trách khách gửi tay (giữ đúng L1).
      // Khách chưa có người phụ trách → giao Sale đang ít việc nhất hôm nay (không đổ về người duyệt).
      const kind = a.kind === 'gui_tin' ? 'ai_gui_tin' : String(a.payload.task_kind || 'khac')
      const due = a.kind === 'gui_tin' ? null : (a.payload.due_hours ? Number(a.payload.due_hours) : 24)
      const task = (await t`
        INSERT INTO crm_tasks (customer_id, title, kind, priority, due_at, assigned_staff_id, created_by, source, suggestion, department, auto_key)
        SELECT ${a.customer_id}, ${a.title}, ${kind}, 2, NOW() + make_interval(hours => ${due ?? 4}),
               COALESCE((SELECT assigned_staff_id FROM customers WHERE id = ${a.customer_id}),
                        (SELECT s.id FROM staff s WHERE s.status = 'active' AND s.department = 'sale_cskh'
                         ORDER BY (SELECT COUNT(*) FROM crm_tasks x WHERE x.assigned_staff_id = s.id AND x.status IN ('can_lam', 'dang_lam')
                                   AND x.created_at > NOW() - INTERVAL '1 day'), s.id LIMIT 1),
                        ${staffId}), ${staffId ?? 0}, 'ai',
               ${a.body}, 'sale_cskh', ${'ai:' + a.id}
        RETURNING id`)[0]
      return { task_id: task.id }
    }
    case 'cap_nhat_khach': {
      const field = String(a.payload.field || '')
      if (!(field in CUSTOMER_FIELDS) || !a.customer_id) throw new AiError(400, 'Trường hồ sơ không được phép sửa')
      const before = (await t`SELECT stars, stage FROM customers WHERE id = ${a.customer_id} FOR UPDATE`)[0]
      if (!before) throw new AiError(404, 'Không có khách')
      if (field === 'stars') await t`UPDATE customers SET stars = ${Number(a.payload.value)}, updated_at = NOW() WHERE id = ${a.customer_id}`
      else await t`UPDATE customers SET stage = ${String(a.payload.value)}, updated_at = NOW() WHERE id = ${a.customer_id}`
      return { field, before: before[field] ?? null, after: a.payload.value }
    }
    case 'dang_bai':
      throw new AiError(501, 'Đăng bài chưa nối kênh: agent Content đang ở L0, chỉ đề xuất')
  }
}

export async function approveAction(id: number, staffId: number, opts: { body?: string; note?: string }, sql: Sql = getDb()) {
  return runAction(id, staffId, opts, sql)
}

export async function rejectAction(id: number, staffId: number, note: string, ip: string, sql: Sql = getDb()) {
  if (!note.trim()) throw new AiError(400, 'Ghi lý do từ chối để agent học (B2 K02)')
  const r = await sql`UPDATE ai_actions SET status = 'tu_choi', decided_by = ${staffId}, decided_at = NOW(), decision_note = ${note.trim().slice(0, 1000)}
                      WHERE id = ${id} AND status IN ('cho_duyet', 'de_xuat') RETURNING agent_code`
  if (!r.length) throw new AiError(409, 'Việc không còn chờ duyệt')
  await logAction({ actorId: staffId, action: 'AI_REJECT', table: 'ai_actions', recordId: id, recordKey: r[0].agent_code, reason: note, ip }, sql)
}

/** Hoàn tác trong 24 giờ: việc chưa ai làm thì bỏ việc; sửa hồ sơ thì trả giá trị cũ. */
export async function undoAction(id: number, staffId: number, reason: string, ip: string, sql: Sql = getDb()) {
  return sql.begin(async tx => {
    const t = tx as unknown as Sql
    const a = (await t`SELECT * FROM ai_actions WHERE id = ${id} FOR UPDATE`)[0] as (ActionRow & { executed_at: Date; result: Record<string, unknown> }) | undefined
    if (!a || a.status !== 'da_thuc_hien') throw new AiError(409, 'Chỉ hoàn tác được việc đã thực hiện')
    if (Date.now() - new Date(a.executed_at).getTime() > 24 * 3600_000) throw new AiError(409, 'Quá 24 giờ, không hoàn tác tự động được')
    const res = a.result ?? {}
    if (res.task_id) {
      const done = await t`UPDATE crm_tasks SET status = 'bo_qua', result_note = 'Hoàn tác từ Trung tâm AI' WHERE id = ${Number(res.task_id)} AND status IN ('can_lam', 'dang_lam') RETURNING id`
      if (!done.length) throw new AiError(409, 'Nhân viên đã làm xong việc này, không hoàn tác được')
    } else if (a.kind === 'cap_nhat_khach' && a.customer_id) {
      if (res.field === 'stars') await t`UPDATE customers SET stars = ${res.before as number | null}, updated_at = NOW() WHERE id = ${a.customer_id}`
      else if (res.field === 'stage') await t`UPDATE customers SET stage = ${res.before as string | null}, updated_at = NOW() WHERE id = ${a.customer_id}`
    } else if (a.kind !== 'bao_cao') throw new AiError(409, 'Việc này không hoàn tác được')
    await t`UPDATE ai_actions SET status = 'da_hoan_tac', decision_note = ${reason.slice(0, 1000)} WHERE id = ${id}`
    await logAction({ actorId: staffId, action: 'AI_UNDO', table: 'ai_actions', recordId: id, recordKey: a.agent_code, reason, ip }, t)
  })
}

export async function setSimVerdict(id: number, staffId: number, verdict: 'dong_y' | 'khac', sql: Sql = getDb()) {
  const r = await sql`UPDATE ai_actions SET sim_verdict = ${verdict}, decided_by = ${staffId}, decided_at = NOW() WHERE id = ${id} AND status = 'mo_phong' RETURNING id`
  if (!r.length) throw new AiError(409, 'Chỉ chấm được việc mô phỏng')
}

// ── Số liệu & tự hạ cấp ─────────────────────────────────────────────────────────────────

export async function agentStats(days = 7, sql: Sql = getDb()) {
  return sql`
    SELECT g.code,
      COUNT(x.*)::int AS total,
      COUNT(x.*) FILTER (WHERE x.status IN ('cho_duyet', 'de_xuat'))::int AS waiting,
      COUNT(x.*) FILTER (WHERE x.status = 'da_thuc_hien' AND NOT x.edited)::int AS as_is,
      COUNT(x.*) FILTER (WHERE x.status = 'da_thuc_hien' AND x.edited)::int AS edited,
      COUNT(x.*) FILTER (WHERE x.status = 'tu_choi')::int AS rejected,
      COUNT(x.*) FILTER (WHERE x.status = 'da_hoan_tac')::int AS undone,
      COUNT(x.*) FILTER (WHERE x.sim_verdict = 'dong_y')::int AS sim_agree,
      COUNT(x.*) FILTER (WHERE x.sim_verdict IS NOT NULL)::int AS sim_rated
    FROM ai_agents g LEFT JOIN ai_actions x ON x.agent_code = g.code AND x.created_at > NOW() - make_interval(days => ${days})
    GROUP BY g.code`
}

/** Người sửa/từ chối/hoàn tác > 20% trên ≥ 20 việc trong 7 ngày → agent L2 tự về L1 (tiêu chí 3 của kế hoạch). */
export async function autoDowngrade(sql: Sql = getDb()) {
  const rows = await sql`
    SELECT g.code, COUNT(x.*)::int AS decided,
      COUNT(x.*) FILTER (WHERE x.edited OR x.status IN ('tu_choi', 'da_hoan_tac'))::int AS bad
    FROM ai_agents g JOIN ai_actions x ON x.agent_code = g.code
    WHERE g.level = 'L2' AND x.created_at > NOW() - INTERVAL '7 days' AND x.status IN ('da_thuc_hien', 'tu_choi', 'da_hoan_tac') AND x.kind <> 'bao_cao'
    GROUP BY g.code`
  const down: string[] = []
  for (const r of rows) {
    if (r.decided >= 20 && r.bad / r.decided > 0.2) {
      await sql`UPDATE ai_agents SET level = 'L1', updated_at = NOW() WHERE code = ${r.code} AND level = 'L2'`
      await logAction({ actorType: 'system', actorId: null, action: 'AI_AUTO_DOWNGRADE', table: 'ai_agents', recordKey: r.code,
        after: { level: 'L1', decided: r.decided, bad: r.bad }, reason: `Người sửa/từ chối ${Math.round(r.bad / r.decided * 100)}% trong 7 ngày` }, sql)
      down.push(r.code)
    }
  }
  await sql`UPDATE ai_actions SET status = 'het_han' WHERE status IN ('cho_duyet', 'de_xuat') AND expires_at < NOW()`
  return down
}
