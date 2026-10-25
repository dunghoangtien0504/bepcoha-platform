// Cộng đồng "Góc bếp chị em" (Mini App v8): khách đăng ảnh món mình nấu + caption; Bếp duyệt trên CRM rồi mới hiện.
// Theo chính sách Zalo Mini App mục 4.6: KHÔNG có thả tim, bình luận, trang cá nhân; khách không thấy bài chưa duyệt của người khác.
// Bài gửi là gửi cho Bếp; Bếp là bên chọn đăng (giống mục "ảnh khách hàng" của trang bán hàng).
//
// Bảng cook_posts do phiên Mini App tạo (Cô Hạ đồng ý 25/10/2026 vì phiên CRM không chạy). Phiên CRM: nếu chuyển vào
// lib/crm/schema.ts thì giữ nguyên tên cột. Ảnh lưu thẳng trong DB (đã nén ở máy khách ≤ 1280px), giới hạn 800KB/ảnh.
import { getDb } from '../db'
import { logAction } from '../crm/audit'
import { MiniError, badRequest, noSession } from './errors'
import { loadSession, type SessionRow } from './service'

type Sql = ReturnType<typeof getDb>

export const POST_LIMITS = { perSessionDay: 3, pendingPerSession: 5, maxImageBytes: 800 * 1024, captionMax: 300, nameMax: 40 }
export const POST_STATUSES = ['cho_duyet', 'da_duyet', 'tu_choi', 'an'] as const
export type PostStatus = (typeof POST_STATUSES)[number]

let ready: Promise<void> | null = null
/** Tạo bảng nếu chưa có (chạy 1 lần mỗi tiến trình). */
export function ensureCommunitySchema(sql: Sql = getDb()): Promise<void> {
  ready ??= (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS cook_posts (
        id SERIAL PRIMARY KEY,
        mini_session_id INT NOT NULL REFERENCES mini_sessions(id),
        customer_id INT REFERENCES customers(id),
        recipe_slug TEXT CHECK (recipe_slug IS NULL OR recipe_slug ~ '^[a-z0-9-]{1,80}$'),
        caption TEXT NOT NULL CHECK (char_length(caption) BETWEEN 1 AND 300),
        display_name TEXT NOT NULL DEFAULT '' CHECK (char_length(display_name) <= 40),
        area TEXT NOT NULL DEFAULT '' CHECK (char_length(area) <= 40),
        image BYTEA NOT NULL,
        image_mime TEXT NOT NULL CHECK (image_mime IN ('image/jpeg', 'image/png', 'image/webp')),
        image_bytes INT NOT NULL,
        consent_publish BOOLEAN NOT NULL CHECK (consent_publish),
        status TEXT NOT NULL DEFAULT 'cho_duyet' CHECK (status IN ('cho_duyet', 'da_duyet', 'tu_choi', 'an')),
        praised BOOLEAN NOT NULL DEFAULT false,
        pinned BOOLEAN NOT NULL DEFAULT false,
        reject_reason TEXT NOT NULL DEFAULT '',
        reviewed_by INT REFERENCES staff(id),
        reviewed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`
    await sql`CREATE INDEX IF NOT EXISTS cook_posts_status_idx ON cook_posts (status, pinned DESC, created_at DESC)`
    await sql`CREATE INDEX IF NOT EXISTS cook_posts_session_idx ON cook_posts (mini_session_id)`
  })().catch(e => {
    ready = null
    throw e
  })
  return ready
}

const clean = (v: unknown, max: number) =>
  typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : ''

/** Đọc ảnh data URL, kiểm đúng loại theo byte đầu file (không tin phần khai báo). */
export function decodeImage(dataUrl: unknown): { buf: Buffer; mime: 'image/jpeg' | 'image/png' | 'image/webp' } {
  if (typeof dataUrl !== 'string') throw badRequest('Chị chọn ảnh món ăn giúp Cô nhé.')
  const m = dataUrl.match(/^data:image\/(?:jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=]+)$/)
  if (!m) throw badRequest('Ảnh chưa đúng định dạng (JPG, PNG hoặc WebP).')
  const buf = Buffer.from(m[1], 'base64')
  if (buf.length > POST_LIMITS.maxImageBytes) throw new MiniError(413, 'too_large', 'Ảnh hơi lớn, chị chọn ảnh khác giúp Cô nhé.')
  if (buf.length < 100) throw badRequest('Ảnh chưa đúng định dạng (JPG, PNG hoặc WebP).')
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { buf, mime: 'image/jpeg' }
  if (buf.subarray(0, 4).toString('hex') === '89504e47') return { buf, mime: 'image/png' }
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return { buf, mime: 'image/webp' }
  throw badRequest('Ảnh chưa đúng định dạng (JPG, PNG hoặc WebP).')
}

async function requirePoster(sessionId: number | null, sql: Sql): Promise<SessionRow> {
  const s = await loadSession(sessionId, sql)
  if (!s || !s.phone) throw noSession()
  return s
}

export async function createPost(sessionId: number | null, body: Record<string, unknown>, sql: Sql = getDb()) {
  await ensureCommunitySchema(sql)
  const s = await requirePoster(sessionId, sql)
  const caption = clean(body.caption, POST_LIMITS.captionMax)
  if (caption.length < 2) throw badRequest('Chị viết vài chữ giới thiệu món giúp Cô nhé.')
  if (body.consent !== true) throw badRequest('Chị tick đồng ý để Bếp được đăng ảnh giúp Cô nhé.')
  const slug = typeof body.recipe_slug === 'string' && body.recipe_slug ? body.recipe_slug : null
  if (slug !== null && !/^[a-z0-9-]{1,80}$/.test(slug)) throw badRequest()
  const { buf, mime } = decodeImage(body.image)

  const counts = (await sql`
    SELECT COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours')::int AS day,
           COUNT(*) FILTER (WHERE status = 'cho_duyet')::int AS pending
    FROM cook_posts WHERE mini_session_id = ${s.id}`)[0]
  if (counts.day >= POST_LIMITS.perSessionDay || counts.pending >= POST_LIMITS.pendingPerSession) {
    throw new MiniError(429, 'post_limit', 'Hôm nay chị đã gửi đủ ảnh rồi, Cô duyệt xong chị gửi tiếp nhé.')
  }
  const row = (await sql`
    INSERT INTO cook_posts (mini_session_id, customer_id, recipe_slug, caption, display_name, area, image, image_mime, image_bytes, consent_publish)
    VALUES (${s.id}, ${s.verified ? s.customer_id : null}, ${slug}, ${caption}, ${clean(body.display_name, POST_LIMITS.nameMax)},
            ${clean(body.area, POST_LIMITS.nameMax)}, ${buf}, ${mime}, ${buf.length}, true)
    RETURNING id, status, created_at`)[0]
  return { post: { id: row.id as number, status: row.status as PostStatus, created_at: new Date(row.created_at).toISOString() } }
}

const publicPost = (r: Record<string, unknown>) => ({
  id: r.id as number,
  caption: r.caption as string,
  display_name: (r.display_name as string) || 'Chị em Bếp Cô Hạ',
  area: r.area as string,
  recipe_slug: (r.recipe_slug as string | null) ?? null,
  praised: !!r.praised,
  pinned: !!r.pinned,
  created_at: new Date(r.created_at as string).toISOString(),
  image_url: `/api/mini/community/posts/${r.id}/image`,
})

/** Bài đã duyệt (ai cũng xem được, không cần đăng ký). Bài ghim lên đầu. */
export async function listApproved(limit = 30, sql: Sql = getDb()) {
  await ensureCommunitySchema(sql)
  const n = Math.min(60, Math.max(1, Math.floor(limit)))
  const rows = await sql`
    SELECT id, caption, display_name, area, recipe_slug, praised, pinned, created_at FROM cook_posts
    WHERE status = 'da_duyet' ORDER BY pinned DESC, created_at DESC LIMIT ${n}`
  return { posts: rows.map(publicPost) }
}

/** Bài của chính phiên này (mọi trạng thái), để khách biết bài đang chờ duyệt hay bị từ chối vì sao. */
export async function myPosts(sessionId: number | null, sql: Sql = getDb()) {
  await ensureCommunitySchema(sql)
  const s = await requirePoster(sessionId, sql)
  const rows = await sql`
    SELECT id, caption, display_name, area, recipe_slug, praised, pinned, created_at, status, reject_reason FROM cook_posts
    WHERE mini_session_id = ${s.id} ORDER BY created_at DESC LIMIT 30`
  return { posts: rows.map(r => ({ ...publicPost(r), status: r.status as PostStatus, reject_reason: r.reject_reason as string })) }
}

/** Ảnh: bài đã duyệt thì công khai; bài chưa duyệt chỉ chủ bài xem được. */
export async function postImage(id: number, sessionId: number | null, sql: Sql = getDb()) {
  await ensureCommunitySchema(sql)
  if (!Number.isInteger(id) || id < 1) throw new MiniError(404, 'not_found', 'Không tìm thấy ảnh.')
  const r = (await sql`SELECT image, image_mime, status, mini_session_id FROM cook_posts WHERE id = ${id}`)[0]
  if (!r) throw new MiniError(404, 'not_found', 'Không tìm thấy ảnh.')
  const isPublic = r.status === 'da_duyet'
  if (!isPublic && r.mini_session_id !== sessionId) throw new MiniError(404, 'not_found', 'Không tìm thấy ảnh.')
  return { bytes: r.image as Buffer, mime: r.image_mime as string, isPublic }
}

// ── Phía CRM: nhân viên duyệt ──

export type ModerateAction = 'duyet' | 'khen' | 'tu_choi' | 'an' | 'ghim' | 'bo_ghim'

export async function listForReview(status: PostStatus | 'tat_ca' = 'cho_duyet', sql: Sql = getDb()) {
  await ensureCommunitySchema(sql)
  const rows =
    status === 'tat_ca'
      ? await sql`SELECT p.id, p.caption, p.display_name, p.area, p.recipe_slug, p.status, p.praised, p.pinned, p.reject_reason, p.created_at,
                         p.image_bytes, p.customer_id, s.name AS reviewer FROM cook_posts p LEFT JOIN staff s ON s.id = p.reviewed_by
                  ORDER BY p.created_at DESC LIMIT 200`
      : await sql`SELECT p.id, p.caption, p.display_name, p.area, p.recipe_slug, p.status, p.praised, p.pinned, p.reject_reason, p.created_at,
                         p.image_bytes, p.customer_id, s.name AS reviewer FROM cook_posts p LEFT JOIN staff s ON s.id = p.reviewed_by
                  WHERE p.status = ${status} ORDER BY p.created_at DESC LIMIT 200`
  return rows
}

export async function moderatePost(id: number, action: ModerateAction, staffId: number, reason: string, ip: string, sql: Sql = getDb()) {
  await ensureCommunitySchema(sql)
  const before = (await sql`SELECT id, status, praised, pinned FROM cook_posts WHERE id = ${id}`)[0]
  if (!before) return null
  const r = reason.trim().slice(0, 300)
  if (action === 'tu_choi' && !r) throw badRequest('Ghi lý do từ chối để khách biết (VD: ảnh mờ, không phải món ăn).')
  const set =
    action === 'duyet' ? sql`status = 'da_duyet', reject_reason = ''`
    : action === 'khen' ? sql`status = 'da_duyet', praised = true, reject_reason = ''`
    : action === 'tu_choi' ? sql`status = 'tu_choi', reject_reason = ${r}, pinned = false`
    : action === 'an' ? sql`status = 'an', pinned = false`
    : action === 'ghim' ? sql`pinned = true`
    : sql`pinned = false`
  const after = (await sql`UPDATE cook_posts SET ${set}, reviewed_by = ${staffId}, reviewed_at = NOW() WHERE id = ${id}
                           RETURNING id, status, praised, pinned`)[0]
  await logAction({ actorId: staffId, action: 'MODERATE', table: 'cook_posts', recordId: id, before, after: { ...after, action }, reason: r || undefined, ip }, sql)
  return after
}

/** Ảnh cho nhân viên duyệt (mọi trạng thái). */
export async function postImageForStaff(id: number, sql: Sql = getDb()) {
  await ensureCommunitySchema(sql)
  const r = (await sql`SELECT image, image_mime FROM cook_posts WHERE id = ${id}`)[0]
  return r ? { bytes: r.image as Buffer, mime: r.image_mime as string } : null
}
