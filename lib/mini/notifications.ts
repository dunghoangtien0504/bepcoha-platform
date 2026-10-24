// Hộp thư thông báo trong Mini App (đợt v3-A). Bảng notifications, notification_reads do phiên CRM tạo (schema v12);
// nhân viên soạn thông báo trên CRM (gửi tất cả / khách đã xác minh / một khách / một phiên).
// Quy tắc:
//  - Link chỉ là đường dẫn TRONG app (CHECK ở DB) — chính sách Zalo Mini App mục 4.1 cấm đưa khách ra link ngoài.
//  - Đã đọc: khách đã xác minh tính theo khách (đọc trên máy nào cũng tính), chưa xác minh tính theo phiên.
//  - Khách mới không bị "ngập" tin cũ: chỉ tin đăng từ 7 ngày trước khi khách đăng ký trở đi mới tính là chưa đọc.
//  - Nhắc sự kiện (khách bấm "Nhắc tôi") không cần cron: tự hiện khi sự kiện sắp diễn ra trong 24 giờ.
import { getDb } from '../db'
import { badRequest } from './errors'
import { loadSession, type SessionRow } from './service'

type Sql = ReturnType<typeof getDb>

const LIST_LIMIT = 30
const KEEP_DAYS = 60
const NEW_MEMBER_GRACE_DAYS = 7

export interface PublicNotification {
  id: number
  title: string
  body: string
  link: string
  image: string
  kind: string
  published_at: string
  read: boolean
}

export interface UpcomingReminder {
  slug: string
  title: string
  starts_at: string
  within_hour: boolean
}

const verifiedCustomer = (s: SessionRow | null) => (s && s.verified ? s.customer_id : null)

function visible(s: SessionRow | null, sql: Sql) {
  const sid = s?.id ?? null
  const cid = verifiedCustomer(s)
  return sql`
    n.publish_at <= NOW() AND (n.expires_at IS NULL OR n.expires_at > NOW())
    AND n.publish_at > NOW() - make_interval(days => ${KEEP_DAYS})
    AND (n.audience = 'tat_ca'
      OR (n.audience = 'da_xac_minh' AND ${cid}::int IS NOT NULL)
      OR (n.audience = 'khach' AND ${cid}::int IS NOT NULL AND n.customer_id = ${cid})
      OR (n.audience = 'phien' AND ${sid}::int IS NOT NULL AND n.mini_session_id = ${sid}))`
}

function isRead(s: SessionRow | null, sql: Sql) {
  if (!s) return sql`TRUE`
  const cid = verifiedCustomer(s)
  const since = new Date(new Date(s.created_at).getTime() - NEW_MEMBER_GRACE_DAYS * 86400000)
  return sql`(
    n.publish_at < ${since}
    OR EXISTS (SELECT 1 FROM notification_reads r WHERE r.notification_id = n.id
               AND (r.mini_session_id = ${s.id} OR (${cid}::int IS NOT NULL AND r.customer_id = ${cid}))))`
}

async function upcomingReminders(s: SessionRow | null, sql: Sql): Promise<UpcomingReminder[]> {
  if (!s) return []
  const cid = verifiedCustomer(s)
  const rows = await sql`
    SELECT DISTINCT e.slug, e.title, e.starts_at FROM events e JOIN event_reminders r ON r.event_id = e.id
    WHERE r.kind = 'nhac' AND r.cancelled_at IS NULL AND e.status = 'cong_bo'
      AND e.starts_at > NOW() AND e.starts_at <= NOW() + INTERVAL '24 hours'
      AND (r.mini_session_id = ${s.id} OR (${cid}::int IS NOT NULL AND r.customer_id = ${cid}))
    ORDER BY e.starts_at`
  return rows.map(r => {
    const t = new Date(r.starts_at as string)
    return { slug: r.slug as string, title: r.title as string, starts_at: t.toISOString(), within_hour: t.getTime() - Date.now() <= 3600_000 }
  })
}

const missingTable = (e: unknown) => (e as { code?: string }).code === '42P01'

export async function listNotifications(sessionId: number | null, sql: Sql = getDb()) {
  const s = await loadSession(sessionId, sql)
  try {
    const rows = await sql`
      SELECT n.*, ${isRead(s, sql)} AS is_read FROM notifications n
      WHERE ${visible(s, sql)} ORDER BY n.publish_at DESC LIMIT ${LIST_LIMIT}`
    const notifications: PublicNotification[] = rows.map(n => ({
      id: n.id,
      title: n.title,
      body: n.body,
      link: n.link,
      image: n.image,
      kind: n.kind,
      published_at: new Date(n.publish_at).toISOString(),
      read: !!n.is_read,
    }))
    const reminders = await upcomingReminders(s, sql)
    return { notifications, reminders, unread: notifications.filter(n => !n.read).length + reminders.length }
  } catch (e) {
    if (missingTable(e)) return { notifications: [] as PublicNotification[], reminders: [] as UpcomingReminder[], unread: 0 }
    throw e
  }
}

/** Số đếm cho chuông trên trang chủ (gắn vào /me). */
export async function unreadCount(s: SessionRow, sql: Sql = getDb()): Promise<number> {
  try {
    const r = await sql`SELECT COUNT(*)::int AS n FROM notifications n WHERE ${visible(s, sql)} AND NOT ${isRead(s, sql)}`
    return r[0].n + (await upcomingReminders(s, sql)).length
  } catch (e) {
    if (missingTable(e)) return 0
    throw e
  }
}

/** Đánh dấu đã đọc: danh sách id (tối đa 50) hoặc tất cả. Chỉ đánh dấu được tin mà phiên này thấy. */
export async function markRead(sessionId: number | null, body: Record<string, unknown>, sql: Sql = getDb()) {
  const s = await loadSession(sessionId, sql)
  if (!s) return { unread: 0 }
  const all = body.all === true
  const ids = Array.isArray(body.ids) ? body.ids : []
  if (!all && (!ids.length || ids.length > 50 || !ids.every(i => Number.isInteger(i) && i > 0))) throw badRequest()
  const cid = verifiedCustomer(s)
  await sql`
    INSERT INTO notification_reads (notification_id, mini_session_id, customer_id)
    SELECT n.id, ${s.id}, ${cid} FROM notifications n
    WHERE ${visible(s, sql)} ${all ? sql`` : sql`AND n.id = ANY(${ids as number[]})`}
    ON CONFLICT (notification_id, mini_session_id) DO NOTHING`
  return { unread: await unreadCount(s, sql) }
}
