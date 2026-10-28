// Kết nối HỘI THOẠI Pancake (inbox Facebook / Zalo OA / Instagram / TikTok… đã nối vào Pancake) vào CRM.
// Học theo Chat Quality Agent (tanviet12/chat-quality-agent, MIT, backend/channels/pancake.go):
//  - API công khai của Pancake: https://pages.fm/api/public_api — chỉ cần Page ID + Page Access Token
//    (Pancake → Cài đặt → Công cụ → "Public API access token"), không OAuth, không webhook (đọc định kỳ).
//  - Danh sách hội thoại: v2 /pages/{id}/conversations?type=INBOX&order_by=updated_at&since&until, lật trang bằng last_conversation_id (60/lần).
//  - Tin nhắn: v1 /pages/{id}/conversations/{cid}/messages, lô 30 tin, lô sau cũ hơn (current_count).
//  - Giới hạn 5 lượt/giây/page → giữ 250ms giữa 2 lượt; 429 thì chờ rồi thử lại; Pancake báo lỗi bằng HTTP 200 + success:false.
//  - Lỗi không bao giờ chứa URL (URL có token).
// Khác CQA: CRM cần biết hội thoại là của KHÁCH NÀO, nên giữ SĐT đã chuẩn hoá chỉ để ghép với khách có sẵn
// (không tạo khách mới từ chat, không lưu email/đơn kèm theo). Chỉ GET — không gửi tin, không sửa gì trên Pancake.
import { getDb } from '../db'
import { getPancakePages, cleanPancakeText, type PancakePage } from '../pancake'
import { normalizePhone } from '../phone'

type Sql = ReturnType<typeof getDb>
type Json = Record<string, unknown>

export const PANCAKE_PUBLIC_V1 = 'https://pages.fm/api/public_api/v1'
export const PANCAKE_PUBLIC_V2 = 'https://pages.fm/api/public_api/v2'
const CONV_PAGE_SIZE = 60
const MAX_PAGES = 200
const MIN_INTERVAL_MS = 250
const MAX_RETRIES = 3
const FIRST_SYNC_DAYS = 14
const KEEP_MESSAGES = 100

export class PancakeChatError extends Error {}

export class PancakeChatClient {
  private last = 0
  constructor(private page: PancakePage, private fetchImpl: typeof fetch = fetch, private minInterval = MIN_INTERVAL_MS, private backoffMs = 1000) {}

  private async turn() {
    const wait = this.last + this.minInterval - Date.now()
    this.last = Date.now() + Math.max(0, wait)
    if (wait > 0) await new Promise(r => setTimeout(r, wait))
  }

  async get(base: string, path: string, params: Record<string, string> = {}): Promise<Json> {
    const qs = new URLSearchParams({ ...params, page_access_token: this.page.token })
    for (let attempt = 0; ; attempt++) {
      await this.turn()
      let res: Response
      try {
        res = await this.fetchImpl(`${base}${path}?${qs}`, { signal: AbortSignal.timeout(30_000) })
      } catch (e) {
        // không đưa URL (có token) vào lỗi
        throw new PancakeChatError(`Không gọi được Pancake (${e instanceof Error ? e.name : 'lỗi mạng'})`)
      }
      if (res.status === 429 && attempt < MAX_RETRIES) { await new Promise(r => setTimeout(r, this.backoffMs * (attempt + 1))); continue }
      if (!res.ok) throw new PancakeChatError(`Pancake trả lỗi HTTP ${res.status}`)
      const body = await res.json().catch(() => null) as Json | null
      if (!body) throw new PancakeChatError('Pancake trả dữ liệu không đọc được')
      if (body.success === false) throw new PancakeChatError(`Pancake báo lỗi: ${String(body.message || body.error_code || 'không rõ')}`)
      return body
    }
  }

  /** Kiểm tra token còn dùng được (giống CQA: gọi danh sách thẻ của page). */
  async healthCheck() { await this.get(PANCAKE_PUBLIC_V1, `/pages/${encodeURIComponent(this.page.pageId)}/tags`) }

  /** Hội thoại inbox cập nhật từ `since` (giây unix), mới nhất trước. */
  async conversationsSince(since: number): Promise<Json[]> {
    const out: Json[] = []
    let lastId = ''
    for (let i = 0; i < MAX_PAGES; i++) {
      const params: Record<string, string> = { type: 'INBOX', order_by: 'updated_at', since: String(since), until: String(Math.floor(Date.now() / 1000)) }
      if (lastId) params.last_conversation_id = lastId
      const body = await this.get(PANCAKE_PUBLIC_V2, `/pages/${encodeURIComponent(this.page.pageId)}/conversations`, params)
      const list = (body.conversations as Json[] | undefined) ?? []
      if (!list.length) break
      out.push(...list)
      const next = String(list[list.length - 1].id ?? '')
      if (list.length < CONV_PAGE_SIZE || !next || next === lastId) break
      lastId = next
    }
    return out
  }

  /** Tin nhắn của 1 hội thoại, từ cũ đến mới, tối đa `max` tin gần nhất. */
  async messages(conversationId: string, max = KEEP_MESSAGES): Promise<Json[]> {
    const batches: Json[][] = []
    const seen = new Set<string>()
    let fetched = 0
    for (let i = 0; i < MAX_PAGES && fetched < max; i++) {
      const body = await this.get(PANCAKE_PUBLIC_V1, `/pages/${encodeURIComponent(this.page.pageId)}/conversations/${encodeURIComponent(conversationId)}/messages`,
        fetched ? { current_count: String(fetched) } : {})
      const list = (body.messages as Json[] | undefined) ?? []
      const fresh = list.filter(m => { const id = String(m.id ?? ''); if (!id || seen.has(id)) return false; seen.add(id); return true })
      if (!fresh.length) break
      batches.push(fresh)
      fetched += list.length
    }
    // lô sau cũ hơn lô trước; trong mỗi lô tin xếp cũ → mới (CQA ghi chú: ngược tài liệu Pancake)
    return batches.reverse().flat().slice(-max)
  }
}

export interface ChatRow {
  conversationId: string; pageId: string; pancakeCustomerId: string; customerName: string; phone: string
  platform: string; preview: string; lastAt: Date | null; assignees: string[]; isUnread: boolean
}

/** Hội thoại Pancake → dòng CRM. Bỏ bình luận/đánh giá. "Chờ trả lời" = tin cuối là của khách (cờ seen của Facebook không đáng tin). */
export function parseConversation(c: Json, pageId: string): ChatRow | null {
  const id = String(c.id ?? '')
  const type = String(c.type ?? 'INBOX').toUpperCase()
  if (!id || (type && type !== 'INBOX')) return null
  const customers = (c.customers as Json[] | undefined) ?? []
  const cust = customers[0] ?? (c.from as Json | undefined) ?? {}
  const phones = (c.recent_phone_numbers as unknown[] | undefined) ?? []
  const firstPhone = phones.map(p => typeof p === 'string' ? p : String((p as Json)?.phone_number ?? (p as Json)?.phone ?? '')).find(Boolean)
  const phone = normalizePhone(String(cust.phone_number ?? cust.phone ?? firstPhone ?? ''))
  const lastSender = (c.last_sent_by as Json | undefined) ?? {}
  const fromPage = !!lastSender.admin_id || String(lastSender.id ?? lastSender.uid ?? '') === String(pageId)
  const at = new Date(String(c.updated_at ?? c.inserted_at ?? ''))
  const snippet = String(c.snippet ?? ((c.last_message as Json | undefined)?.message ?? ''))
  return {
    conversationId: id, pageId,
    pancakeCustomerId: String(cust.id ?? cust.fb_id ?? (c.from as Json | undefined)?.id ?? ''),
    customerName: String(cust.name ?? (c.from as Json | undefined)?.name ?? '').trim() || 'Khách ẩn danh',
    phone: /^0\d{9}$/.test(phone) ? phone : '',
    platform: String(c.platform ?? (c.page as Json | undefined)?.platform ?? 'facebook').toLowerCase(),
    preview: cleanPancakeText(snippet).slice(0, 200),
    lastAt: isNaN(at.getTime()) ? null : at,
    assignees: ((c.current_assign_users as Json[] | undefined) ?? []).map(u => String(u?.name ?? '').trim()).filter(Boolean),
    isUnread: !fromPage && Object.keys(lastSender).length > 0,
  }
}

export interface ChatMessage { id: string; fromCustomer: boolean; sender: string; text: string; at: string; attachments: number }

/** Tin nhắn Pancake → bản gọn để hiện trong CRM. Tin của page ghi tên nhân viên trả lời (admin_name), không ghi tên page. */
export function parseMessage(m: Json, pageId: string): ChatMessage {
  const from = (m.from as Json | undefined) ?? {}
  const fromPage = !!from.admin_id || String(from.id ?? '') === String(m.page_id ?? pageId)
  const atts = (m.attachments as unknown[] | undefined) ?? []
  return {
    id: String(m.id ?? ''),
    fromCustomer: !fromPage,
    sender: fromPage ? String(from.admin_name || 'Tự động (Page)') : String(from.name ?? 'Khách'),
    text: cleanPancakeText(String(m.original_message ?? m.message ?? '')).slice(0, 2000) || (atts.length ? `[${atts.length} tệp/ảnh]` : ''),
    at: String(m.inserted_at ?? ''),
    attachments: atts.length,
  }
}

export interface ChatSyncResult { pages: number; conversations: number; linked: number; messagesFetched: number; errors: string[] }

/** Đồng bộ hội thoại inbox (gọi mỗi giờ cùng đơn Pancake). Ghép khách theo SĐT với khách đã có trong CRM. */
export async function syncPancakeChats(opts: { maxMessageFetch?: number; pages?: PancakePage[]; fetchImpl?: typeof fetch } = {}, sql: Sql = getDb()): Promise<ChatSyncResult> {
  const pages = opts.pages ?? await getPancakePages()
  const r: ChatSyncResult = { pages: pages.length, conversations: 0, linked: 0, messagesFetched: 0, errors: [] }
  for (const page of pages) {
    const client = new PancakeChatClient(page, opts.fetchImpl)
    try {
      const latest = (await sql`SELECT MAX(last_message_at) AS at FROM conversations WHERE page_id = ${page.pageId}`)[0]?.at
      const since = latest ? Math.floor(new Date(latest).getTime() / 1000) - 2 * 3600 : Math.floor(Date.now() / 1000) - FIRST_SYNC_DAYS * 86400
      const rows = (await client.conversationsSince(since)).map(c => parseConversation(c, page.pageId)).filter((x): x is ChatRow => !!x)
      for (const c of rows) {
        await sql`
          INSERT INTO conversations (pancake_conversation_id, page_id, page_name, pancake_customer_id, customer_name, customer_phone, platform,
                                     last_message_preview, last_message_at, assignees, is_unread, unread_count, customer_id)
          VALUES (${c.conversationId}, ${c.pageId}, ${page.name}, ${c.pancakeCustomerId}, ${c.customerName}, ${c.phone}, ${c.platform},
                  ${c.preview}, ${c.lastAt}, ${sql.json(c.assignees as never)}, ${c.isUnread}, ${c.isUnread ? 1 : 0},
                  ${c.phone ? sql`(SELECT id FROM customers WHERE phone = ${c.phone} LIMIT 1)` : null})
          ON CONFLICT (pancake_conversation_id) WHERE pancake_conversation_id IS NOT NULL DO UPDATE SET
            page_id = EXCLUDED.page_id, page_name = EXCLUDED.page_name, pancake_customer_id = EXCLUDED.pancake_customer_id,
            customer_name = EXCLUDED.customer_name,
            customer_phone = CASE WHEN EXCLUDED.customer_phone <> '' THEN EXCLUDED.customer_phone ELSE conversations.customer_phone END,
            customer_id = COALESCE(conversations.customer_id, EXCLUDED.customer_id),
            last_message_preview = EXCLUDED.last_message_preview, last_message_at = EXCLUDED.last_message_at,
            assignees = EXCLUDED.assignees, is_unread = EXCLUDED.is_unread, unread_count = EXCLUDED.unread_count, updated_at = NOW()`
      }
      r.conversations += rows.length
    } catch (e) {
      r.errors.push(`${page.name}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  // Ghép lại các hội thoại cũ chưa có khách (khách mới được tạo từ đơn Pancake sau khi chat)
  r.linked = (await sql`
    UPDATE conversations v SET customer_id = c.id FROM customers c
    WHERE v.customer_id IS NULL AND v.customer_phone <> '' AND c.phone = v.customer_phone RETURNING v.id`).length

  // Tin nhắn: chỉ cho hội thoại ĐÃ ghép khách và có tin mới (hồ sơ khách cần), giới hạn mỗi lượt
  const byId = new Map(pages.map(p => [p.pageId, p]))
  const stale = await sql`
    SELECT pancake_conversation_id AS id, page_id FROM conversations
    WHERE customer_id IS NOT NULL AND page_id IS NOT NULL AND (messages_synced_at IS NULL OR last_message_at > messages_synced_at)
    ORDER BY last_message_at DESC NULLS LAST LIMIT ${opts.maxMessageFetch ?? 60}`
  for (const s of stale) {
    const page = byId.get(String(s.page_id))
    if (!page) continue
    try {
      const msgs = (await new PancakeChatClient(page, opts.fetchImpl).messages(String(s.id))).map(m => parseMessage(m, page.pageId))
      await sql`UPDATE conversations SET messages = ${sql.json(msgs as never)}, messages_synced_at = NOW() WHERE pancake_conversation_id = ${String(s.id)}`
      r.messagesFetched++
    } catch (e) {
      r.errors.push(`tin ${s.id}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  return r
}

/** Khách đang chờ trả lời (tin cuối là của khách) trong 2 ngày qua, chờ lâu nhất trước — cho màn Hôm nay. */
export async function waitingChats(limit = 8, sql: Sql = getDb()) {
  const rows = await sql`
    SELECT v.pancake_conversation_id, v.page_name, v.customer_name, v.customer_id, v.last_message_preview, v.last_message_at, v.assignees,
           EXTRACT(EPOCH FROM NOW() - v.last_message_at)::int / 60 AS wait_min
    FROM conversations v
    WHERE v.is_unread AND v.page_id IS NOT NULL AND v.last_message_at > NOW() - INTERVAL '2 days'
    ORDER BY v.last_message_at ASC LIMIT ${limit}`
  const [c] = await sql`SELECT COUNT(*)::int AS n, COUNT(*) FILTER (WHERE last_message_at < NOW() - INTERVAL '30 minutes')::int AS late
                        FROM conversations WHERE is_unread AND page_id IS NOT NULL AND last_message_at > NOW() - INTERVAL '2 days'`
  return { rows, total: c.n as number, late: c.late as number }
}
