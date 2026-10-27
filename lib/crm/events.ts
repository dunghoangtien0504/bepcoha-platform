// Sự kiện & hộp thư Mini App phía CRM (hợp đồng v3-A với phiên "Mini app Zalo OA").
// Phiên Mini App đọc events/notifications và ghi event_reminders/notification_reads; CRM tạo, sửa, công bố.
import { getDb } from '../db'
import { logAction } from './audit'

type Sql = ReturnType<typeof getDb>

export const EVENT_KINDS = {
  livestream: 'Livestream', workshop: 'Workshop', thu_thach: 'Thử thách', uu_dai: 'Ưu đãi', le_tet: 'Lễ Tết', khac: 'Khác',
} as const
export type EventKind = keyof typeof EVENT_KINDS
export const EVENT_STATUS = { nhap: 'Nháp', cong_bo: 'Đã công bố', huy: 'Đã huỷ' } as const
export type EventStatus = keyof typeof EVENT_STATUS

export const NOTIFICATION_KINDS = {
  su_kien: 'Sự kiện', cong_thuc: 'Công thức', uu_dai: 'Ưu đãi', don_hang: 'Đơn hàng', khoe_mon: 'Khoe món', he_thong: 'Hệ thống',
} as const
export type NotificationKind = keyof typeof NOTIFICATION_KINDS
/** Nhóm nhận nhân viên được chọn. 'phien' chỉ do phiên Mini App tự sinh (nhắc giờ diễn ra, đơn hàng). */
export const STAFF_AUDIENCES = { tat_ca: 'Mọi người dùng Mini App', da_xac_minh: 'Khách đã xác minh SĐT', khach: 'Một khách cụ thể' } as const
export type StaffAudience = keyof typeof STAFF_AUDIENCES

export class EventInputError extends Error {}

/** 'YYYY-MM-DDTHH:mm' (ô datetime-local, giờ Việt Nam) → Date. */
export function vnLocalToDate(v: unknown): Date | null {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return null
  const d = new Date(`${v}:00+07:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Date → 'YYYY-MM-DDTHH:mm' giờ Việt Nam để đổ vào ô datetime-local. */
export function dateToVnLocal(v: Date | string | null | undefined): string {
  if (!v) return ''
  const d = new Date(new Date(v).getTime() + 7 * 3600_000)
  return d.toISOString().slice(0, 16)
}

export function slugify(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'd')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)
}

const str = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max)
const IMG = /^(\/images\/|https:\/\/)/
const IN_APP_LINK = /^\/[a-z0-9/_-]*$/

export interface EventInput {
  slug: string; title: string; summary: string; body: string; kind: EventKind; starts_at: Date; ends_at: Date | null
  location: string; image: string; join_url: string; capacity: number | null
}

export function parseEventInput(b: Record<string, unknown>): EventInput {
  const title = str(b.title, 200)
  if (!title) throw new EventInputError('Nhập tên sự kiện')
  const slug = str(b.slug, 80) || slugify(title)
  if (!/^[a-z0-9-]{3,80}$/.test(slug)) throw new EventInputError('Đường dẫn chỉ gồm chữ thường không dấu, số và dấu gạch (3–80 ký tự)')
  if (!Object.hasOwn(EVENT_KINDS, String(b.kind))) throw new EventInputError('Chọn loại sự kiện')
  const starts = vnLocalToDate(b.starts_at)
  if (!starts) throw new EventInputError('Chọn giờ bắt đầu')
  const ends = b.ends_at ? vnLocalToDate(b.ends_at) : null
  if (b.ends_at && !ends) throw new EventInputError('Giờ kết thúc không hợp lệ')
  if (ends && ends < starts) throw new EventInputError('Giờ kết thúc phải sau giờ bắt đầu')
  const image = str(b.image, 500)
  if (image && !IMG.test(image)) throw new EventInputError('Ảnh phải là đường dẫn /images/... hoặc link https')
  const join = str(b.join_url, 500)
  if (join && !join.startsWith('https://')) throw new EventInputError('Link tham gia phải bắt đầu bằng https://')
  const cap = b.capacity === '' || b.capacity == null ? null : Number(b.capacity)
  if (cap !== null && (!Number.isInteger(cap) || cap <= 0)) throw new EventInputError('Số chỗ phải là số nguyên dương, hoặc để trống nếu không cần giữ chỗ')
  return {
    slug, title, summary: str(b.summary, 500), body: str(b.body, 10000), kind: b.kind as EventKind,
    starts_at: starts, ends_at: ends, location: str(b.location, 300), image, join_url: join, capacity: cap,
  }
}

export async function listEvents(sql: Sql = getDb()) {
  return sql`
    SELECT e.*, s.name AS creator_name, COALESCE(e.ends_at, e.starts_at) < NOW() AS is_past,
      COUNT(r.*) FILTER (WHERE r.kind = 'giu_cho' AND r.cancelled_at IS NULL)::int AS reserved,
      COUNT(r.*) FILTER (WHERE r.kind = 'nhac' AND r.cancelled_at IS NULL)::int AS reminders
    FROM events e LEFT JOIN staff s ON s.id = e.created_by LEFT JOIN event_reminders r ON r.event_id = e.id
    GROUP BY e.id, s.name
    ORDER BY (e.status = 'huy'), (COALESCE(e.ends_at, e.starts_at) < NOW()), e.starts_at DESC
    LIMIT 200`
}

export async function getEvent(id: number, sql: Sql = getDb()) {
  const e = (await sql`SELECT * FROM events WHERE id = ${id}`)[0]
  if (!e) return null
  const [reminders, notification] = await Promise.all([
    sql`SELECT r.kind, r.created_at, r.cancelled_at, r.customer_id, m.phone, m.verified, c.name AS customer_name
        FROM event_reminders r JOIN mini_sessions m ON m.id = r.mini_session_id LEFT JOIN customers c ON c.id = r.customer_id
        WHERE r.event_id = ${id} ORDER BY r.cancelled_at IS NOT NULL, r.kind, r.created_at`,
    sql`SELECT id, publish_at FROM notifications WHERE event_id = ${id} AND audience = 'tat_ca' LIMIT 1`,
  ])
  return { event: e, reminders, notification: notification[0] ?? null }
}

export async function createEvent(input: EventInput, staffId: number, ip: string, sql: Sql = getDb()) {
  const row = (await sql`
    INSERT INTO events (slug, title, summary, body, kind, starts_at, ends_at, location, image, join_url, capacity, created_by)
    VALUES (${input.slug}, ${input.title}, ${input.summary}, ${input.body}, ${input.kind}, ${input.starts_at}, ${input.ends_at},
            ${input.location}, ${input.image}, ${input.join_url}, ${input.capacity}, ${staffId})
    RETURNING id`
    .catch(e => { if (String(e?.code) === '23505') throw new EventInputError('Đường dẫn này đã có sự kiện khác dùng'); throw e }))[0]
  await logAction({ actorId: staffId, action: 'INSERT', table: 'events', recordId: row.id, recordKey: input.slug, after: input, ip }, sql)
  return row.id as number
}

/** Sửa nội dung. Giảm số chỗ xuống dưới số đã giữ thì từ chối (không tự huỷ chỗ của khách). */
export async function updateEvent(id: number, input: EventInput, staffId: number, ip: string, sql: Sql = getDb()) {
  return sql.begin(async tx => {
    const t = tx as unknown as Sql
    await t`SELECT pg_advisory_xact_lock(hashtext(${'event:' + id}))`
    const before = (await t`SELECT * FROM events WHERE id = ${id} FOR UPDATE`)[0]
    if (!before) return null
    if (before.status === 'cong_bo' && before.slug !== input.slug) throw new EventInputError('Sự kiện đã công bố, không đổi được đường dẫn (link trong thông báo sẽ hỏng)')
    if (input.capacity !== null) {
      const n = (await t`SELECT COUNT(*)::int AS n FROM event_reminders WHERE event_id = ${id} AND kind = 'giu_cho' AND cancelled_at IS NULL`)[0].n
      if (input.capacity < n) throw new EventInputError(`Đã có ${n} người giữ chỗ, số chỗ không được nhỏ hơn`)
    }
    const after = (await t`
      UPDATE events SET slug = ${input.slug}, title = ${input.title}, summary = ${input.summary}, body = ${input.body}, kind = ${input.kind},
        starts_at = ${input.starts_at}, ends_at = ${input.ends_at}, location = ${input.location}, image = ${input.image},
        join_url = ${input.join_url}, capacity = ${input.capacity}, updated_at = NOW()
      WHERE id = ${id} RETURNING *`
      .catch(e => { if (String(e?.code) === '23505') throw new EventInputError('Đường dẫn này đã có sự kiện khác dùng'); throw e }))[0]
    await logAction({ actorId: staffId, action: 'UPDATE', table: 'events', recordId: id, recordKey: input.slug, before, after, ip }, t)
    return after
  })
}

/**
 * Công bố / huỷ / trả về nháp. Công bố kèm notify=true tạo 1 thông báo 'su_kien' gửi mọi người, link /su-kien/<slug>
 * (mỗi sự kiện tối đa 1 tin như vậy — bấm lại không gửi trùng).
 */
export async function setEventStatus(id: number, status: EventStatus, opts: { notify?: boolean; reason?: string }, staffId: number, ip: string, sql: Sql = getDb()) {
  return sql.begin(async tx => {
    const t = tx as unknown as Sql
    const before = (await t`SELECT * FROM events WHERE id = ${id} FOR UPDATE`)[0]
    if (!before) return null
    const after = (await t`UPDATE events SET status = ${status}, updated_at = NOW() WHERE id = ${id} RETURNING *`)[0]
    let notificationId: number | null = null
    if (status === 'cong_bo' && opts.notify) {
      const n = await t`
        INSERT INTO notifications (title, body, link, image, kind, audience, event_id, expires_at, created_by)
        VALUES (${after.title}, ${after.summary}, ${'/su-kien/' + after.slug}, ${after.image}, 'su_kien', 'tat_ca', ${id},
                ${after.ends_at ?? new Date(new Date(after.starts_at).getTime() + 6 * 3600_000)}, ${staffId})
        ON CONFLICT (event_id) WHERE event_id IS NOT NULL AND audience = 'tat_ca' DO NOTHING RETURNING id`
      notificationId = n[0]?.id ?? null
    }
    await logAction({ actorId: staffId, action: status === 'cong_bo' ? 'PUBLISH' : status === 'huy' ? 'CANCEL' : 'UNPUBLISH', table: 'events',
      recordId: id, recordKey: before.slug, before: { status: before.status }, after: { status, notificationId }, reason: opts.reason ?? null, ip }, t)
    return { event: after, notificationId }
  })
}

export interface NotificationInput {
  title: string; body: string; link: string; image: string; kind: NotificationKind; audience: StaffAudience
  customer_id: number | null; publish_at: Date; expires_at: Date | null
}

export function parseNotificationInput(b: Record<string, unknown>): NotificationInput {
  const title = str(b.title, 200)
  if (!title) throw new EventInputError('Nhập tiêu đề')
  const link = str(b.link, 300)
  if (link && !IN_APP_LINK.test(link)) throw new EventInputError('Link chỉ được là đường dẫn trong Mini App, VD /su-kien/xoi-com-tet (Zalo cấm dẫn ra ngoài)')
  const image = str(b.image, 500)
  if (image && !IMG.test(image)) throw new EventInputError('Ảnh phải là đường dẫn /images/... hoặc link https')
  if (!Object.hasOwn(NOTIFICATION_KINDS, String(b.kind)) || b.kind === 'don_hang') throw new EventInputError('Chọn loại thông báo')
  if (!Object.hasOwn(STAFF_AUDIENCES, String(b.audience))) throw new EventInputError('Chọn nhóm nhận')
  const cid = b.audience === 'khach' ? Number(b.customer_id) : null
  if (b.audience === 'khach' && (!Number.isInteger(cid) || (cid as number) <= 0)) throw new EventInputError('Nhập mã khách (số trong đường dẫn hồ sơ khách)')
  const publish = b.publish_at ? vnLocalToDate(b.publish_at) : new Date()
  if (!publish) throw new EventInputError('Giờ gửi không hợp lệ')
  const expires = b.expires_at ? vnLocalToDate(b.expires_at) : null
  if (b.expires_at && !expires) throw new EventInputError('Giờ hết hạn không hợp lệ')
  if (expires && expires <= publish) throw new EventInputError('Giờ hết hạn phải sau giờ gửi')
  return { title, body: str(b.body, 2000), link, image, kind: b.kind as NotificationKind, audience: b.audience as StaffAudience,
    customer_id: cid, publish_at: publish, expires_at: expires }
}

export async function createNotification(input: NotificationInput, staffId: number, ip: string, sql: Sql = getDb()) {
  if (input.customer_id !== null && !(await sql`SELECT 1 FROM customers WHERE id = ${input.customer_id}`).length) {
    throw new EventInputError('Không có khách với mã này')
  }
  const row = (await sql`
    INSERT INTO notifications (title, body, link, image, kind, audience, customer_id, publish_at, expires_at, created_by)
    VALUES (${input.title}, ${input.body}, ${input.link}, ${input.image}, ${input.kind}, ${input.audience}, ${input.customer_id},
            ${input.publish_at}, ${input.expires_at}, ${staffId})
    RETURNING id`)[0]
  await logAction({ actorId: staffId, action: 'INSERT', table: 'notifications', recordId: row.id, after: input, ip }, sql)
  return row.id as number
}

/** Thu hồi: cho hết hạn ngay (giữ bản ghi để đối chiếu, không xoá). Tin hẹn giờ chưa tới giờ cũng không bao giờ hiện. */
export async function expireNotification(id: number, staffId: number, ip: string, sql: Sql = getDb()) {
  const r = await sql`UPDATE notifications SET publish_at = LEAST(publish_at, NOW() - INTERVAL '1 second'), expires_at = NOW()
                      WHERE id = ${id} AND audience <> 'phien' AND (expires_at IS NULL OR expires_at > NOW()) RETURNING id`
  if (r.length) await logAction({ actorId: staffId, action: 'EXPIRE', table: 'notifications', recordId: id, ip }, sql)
  return r.length > 0
}

export async function listNotifications(sql: Sql = getDb()) {
  return sql`
    SELECT n.id, n.title, n.body, n.link, n.kind, n.audience, n.customer_id, n.event_id, n.publish_at, n.expires_at, n.created_at,
           s.name AS creator_name, c.name AS customer_name, n.publish_at > NOW() AS is_scheduled,
           COALESCE(n.expires_at <= NOW(), FALSE) AS is_expired,
           (SELECT COUNT(DISTINCT COALESCE('c' || r.customer_id, 's' || r.mini_session_id))::int FROM notification_reads r WHERE r.notification_id = n.id) AS reads
    FROM notifications n LEFT JOIN staff s ON s.id = n.created_by LEFT JOIN customers c ON c.id = n.customer_id
    WHERE n.audience <> 'phien'
    ORDER BY n.publish_at DESC LIMIT 200`
}
