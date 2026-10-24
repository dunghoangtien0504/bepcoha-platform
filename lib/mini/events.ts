// Sự kiện của Mini App (đợt v3-A): livestream, workshop tại bếp, thử thách tuần, mùa cốm, lễ Tết…
// Thiết kế: Mini-App/THIET-KE-v3-CONG-DONG.md mục 3.4. Bảng events, event_reminders do phiên CRM tạo (schema v12);
// nhân viên tạo/sửa sự kiện trên CRM. Quy tắc:
//  - Khách chỉ thấy sự kiện status 'cong_bo'. Sự kiện 'huy' vẫn hiện ở "Đã qua"/trang chi tiết với nhãn huỷ nếu khách đã đăng ký.
//  - "Nhắc tôi" và "Giữ chỗ" cần đã đăng ký SĐT (phiên). customer_id chỉ ghi khi phiên đã xác minh (như các bảng con khác).
//  - Giữ chỗ có giới hạn số chỗ: khoá advisory theo sự kiện để 2 người bấm cùng lúc không vượt capacity.
import { getDb } from '../db'
import { MiniError, badRequest, noSession } from './errors'
import { loadSession, type SessionRow } from './service'

type Sql = ReturnType<typeof getDb>

export type ReminderKind = 'nhac' | 'giu_cho'

export interface PublicEvent {
  slug: string
  title: string
  summary: string
  body: string
  kind: string
  starts_at: string
  ends_at: string | null
  location: string
  image: string
  join_url: string
  status: 'cong_bo' | 'huy'
  capacity: number | null
  seats_left: number | null
  reminded: boolean
  booked: boolean
}

const childCustomer = (s: SessionRow) => (s.verified ? s.customer_id : null)

/** Cột chung + số chỗ đã giữ + trạng thái của phiên/khách đang xem. */
async function selectEvents(where: 'sap_toi' | 'da_qua' | { slug: string }, s: SessionRow | null, sql: Sql) {
  const sid = s?.id ?? null
  const cid = s ? childCustomer(s) : null
  const mine = (kind: ReminderKind) => sql`
    EXISTS (SELECT 1 FROM event_reminders r WHERE r.event_id = e.id AND r.kind = ${kind} AND r.cancelled_at IS NULL
            AND (r.mini_session_id = ${sid} OR (${cid}::int IS NOT NULL AND r.customer_id = ${cid})))`
  const filter =
    typeof where === 'object'
      ? sql`e.slug = ${where.slug} AND e.status <> 'nhap'`
      : where === 'sap_toi'
        ? sql`e.status = 'cong_bo' AND COALESCE(e.ends_at, e.starts_at + INTERVAL '2 hours') >= NOW()`
        : sql`e.status IN ('cong_bo', 'huy') AND COALESCE(e.ends_at, e.starts_at + INTERVAL '2 hours') < NOW()`
  const order = where === 'da_qua' ? sql`e.starts_at DESC` : sql`e.starts_at ASC`
  return sql`
    SELECT e.*,
      (SELECT COUNT(*)::int FROM event_reminders r WHERE r.event_id = e.id AND r.kind = 'giu_cho' AND r.cancelled_at IS NULL) AS booked_count,
      ${mine('nhac')} AS reminded, ${mine('giu_cho')} AS booked
    FROM events e WHERE ${filter} ORDER BY ${order} LIMIT 50`
}

function publicEvent(e: Record<string, unknown>): PublicEvent {
  const capacity = e.capacity === null || e.capacity === undefined ? null : Number(e.capacity)
  return {
    slug: e.slug as string,
    title: e.title as string,
    summary: e.summary as string,
    body: e.body as string,
    kind: e.kind as string,
    starts_at: new Date(e.starts_at as string).toISOString(),
    ends_at: e.ends_at ? new Date(e.ends_at as string).toISOString() : null,
    location: e.location as string,
    image: e.image as string,
    join_url: e.join_url as string,
    status: e.status as 'cong_bo' | 'huy',
    capacity,
    seats_left: capacity === null ? null : Math.max(0, capacity - Number(e.booked_count)),
    reminded: !!e.reminded,
    booked: !!e.booked,
  }
}

export async function listEvents(sessionId: number | null, tabRaw: unknown, sql: Sql = getDb()) {
  const tab = tabRaw === 'da_qua' ? 'da_qua' : 'sap_toi'
  const s = await loadSession(sessionId, sql)
  try {
    return { events: (await selectEvents(tab, s, sql)).map(publicEvent) }
  } catch (e) {
    // Bảng v3-A chưa có (phiên CRM giữ migration): trang Sự kiện vẫn mở, chỉ rỗng.
    if ((e as { code?: string }).code === '42P01') return { events: [] as PublicEvent[] }
    throw e
  }
}

const validSlug = (v: unknown) => (typeof v === 'string' && /^[a-z0-9-]{3,80}$/.test(v) ? v : null)

export async function getEvent(sessionId: number | null, slugRaw: unknown, sql: Sql = getDb()) {
  const slug = validSlug(slugRaw)
  if (!slug) throw badRequest()
  const s = await loadSession(sessionId, sql)
  const rows = await selectEvents({ slug }, s, sql)
  if (!rows[0]) throw new MiniError(404, 'not_found', 'Không tìm thấy sự kiện này.')
  return { event: publicEvent(rows[0]) }
}

/** Bật/tắt "Nhắc tôi" hoặc "Giữ chỗ". Gọi lặp không tạo dòng trùng (UNIQUE event, phiên, kind). */
export async function setReminder(sessionId: number | null, slugRaw: unknown, kindRaw: unknown, onRaw: unknown, sql: Sql = getDb()) {
  const slug = validSlug(slugRaw)
  const kind = kindRaw === 'nhac' || kindRaw === 'giu_cho' ? (kindRaw as ReminderKind) : null
  if (!slug || !kind || typeof onRaw !== 'boolean') throw badRequest()
  const s = await loadSession(sessionId, sql)
  if (!s) throw noSession()

  await sql.begin(async tx => {
    const ev = (await tx`SELECT id, status, capacity, starts_at FROM events WHERE slug = ${slug} AND status <> 'nhap'`)[0]
    if (!ev) throw new MiniError(404, 'not_found', 'Không tìm thấy sự kiện này.')
    if (onRaw && (ev.status !== 'cong_bo' || new Date(ev.starts_at) < new Date())) {
      throw new MiniError(409, 'event_closed', 'Sự kiện này đã diễn ra hoặc đã huỷ.')
    }
    if (!onRaw) {
      await tx`UPDATE event_reminders SET cancelled_at = NOW()
               WHERE event_id = ${ev.id} AND mini_session_id = ${s.id} AND kind = ${kind} AND cancelled_at IS NULL`
      return
    }
    if (kind === 'giu_cho') {
      if (ev.capacity === null) throw badRequest('Sự kiện này không cần giữ chỗ, chị bấm "Nhắc tôi" nhé.')
      await tx`SELECT pg_advisory_xact_lock(hashtext(${'mini-event:' + ev.id}))`
      const taken = (await tx`SELECT COUNT(*)::int AS n FROM event_reminders
                              WHERE event_id = ${ev.id} AND kind = 'giu_cho' AND cancelled_at IS NULL AND mini_session_id <> ${s.id}`)[0].n
      if (taken >= Number(ev.capacity)) throw new MiniError(409, 'event_full', 'Sự kiện đã đủ chỗ. Chị bấm "Nhắc tôi" để Cô báo khi có buổi sau nhé.')
    }
    await tx`
      INSERT INTO event_reminders (event_id, mini_session_id, customer_id, kind)
      VALUES (${ev.id}, ${s.id}, ${childCustomer(s)}, ${kind})
      ON CONFLICT (event_id, mini_session_id, kind) DO UPDATE SET cancelled_at = NULL, customer_id = EXCLUDED.customer_id`
    // Giữ chỗ thì cũng nhắc giờ luôn.
    if (kind === 'giu_cho') {
      await tx`
        INSERT INTO event_reminders (event_id, mini_session_id, customer_id, kind)
        VALUES (${ev.id}, ${s.id}, ${childCustomer(s)}, 'nhac')
        ON CONFLICT (event_id, mini_session_id, kind) DO UPDATE SET cancelled_at = NULL`
    }
  })
  return getEvent(s.id, slug, sql)
}
