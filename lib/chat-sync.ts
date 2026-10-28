import { getDb } from './db'
import { normalizePhone } from './phone'
import { getPancakePages, getPancakePageById, PANCAKE_PAGE_API, cleanPancakeText } from './pancake'
import { getEnabledJobs, runQcJob, logSystem } from './qc'

export interface ParsedMessage {
  id: string
  from_customer: boolean
  content: string
  timestamp: string
  sender_name: string
  seen: boolean
}

// Lấy tin nhắn của 1 hội thoại từ Pancake (đã làm sạch HTML, bỏ tin rỗng)
export async function fetchPancakeMessages(pageId: string, convId: string, customerId: string): Promise<ParsedMessage[] | { error: string; status: number }> {
  const page = await getPancakePageById(pageId)
  if (!page) return { error: 'Không tìm thấy page (kiểm tra PANCAKE_USER_TOKEN)', status: 500 }

  const url = `${PANCAKE_PAGE_API}/pages/${pageId}/conversations/${convId}/messages` +
    `?page_access_token=${page.token}` + (customerId ? `&customer_id=${customerId}` : '')

  let res: Response
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(20_000) })
  } catch {
    return { error: 'Không gọi được Pancake API', status: 502 }
  }
  if (!res.ok) return { error: `Pancake API lỗi ${res.status}`, status: 502 }

  const data = await res.json()
  const rawMsgs = data?.messages || data?.data || []
  const parsed: ParsedMessage[] = rawMsgs.map((m: Record<string, unknown>, i: number) => {
    const from = (m.from as Record<string, unknown>) || {}
    // Tin do Page gửi (nhân viên, Botcake, tin hệ thống tự động) có from.id trùng page_id; khách có from.id là PSID của khách.
    // admin_id chỉ có khi nhân viên/bot gửi thủ công nên KHÔNG đủ để nhận diện (tin tự động của Page không có admin_id).
    const isFromPage = !!from.admin_id || String(from.id || '') === String(m.page_id || pageId)
    const senderName = isFromPage
      ? String(from.admin_name || 'Tự động (Page)')
      : String(from.name || '')
    const hasAttachment = Array.isArray(m.attachments) && (m.attachments as unknown[]).length > 0
    const text = cleanPancakeText(String(m.message || m.original_message || m.content || m.text || ''))
    return {
      id: `msg_${i}`,
      from_customer: !isFromPage,
      content: text || (hasAttachment ? '[Hình ảnh/tệp đính kèm]' : ''),
      timestamp: String(m.inserted_at || m.created_at || m.timestamp || ''),
      sender_name: senderName,
      // Pancake đánh dấu seen=false cho từng tin nhắn khách CHƯA đọc - đây là số hiển thị trên badge đỏ của Pancake (khác với cờ "seen" ở cấp hội thoại, vốn chỉ nói đã có ai mở hội thoại hay chưa).
      seen: m.seen !== false,
    }
  })
  return parsed.filter(m => m.content.length > 0)
}

// ── Đồng bộ hội thoại Pancake → DB ────────────────────────────────────────────
export interface SyncResult {
  pages: number
  conversationsSeen: number
  conversationsUpserted: number
  messagesFetched: number
  analyzed: number
  pass: number
  fail: number
  alerts: number
  errors: string[]
  pendingMessages: number
}

const MAX_MESSAGE_FETCH = 150
const MAX_LIST_PAGES = 25
const FIRST_SYNC_DAYS = 14
const MAX_ANALYZE = 40

export async function syncPancakeConversations(opts: { analyze?: boolean; days?: number } = {}): Promise<SyncResult> {
  const sql = getDb()
  const result: SyncResult = { pages: 0, conversationsSeen: 0, conversationsUpserted: 0, messagesFetched: 0, analyzed: 0, pass: 0, fail: 0, alerts: 0, errors: [], pendingMessages: 0 }
  const pages = await getPancakePages()
  result.pages = pages.length

  const until = Math.floor(Date.now() / 1000)

  for (const page of pages) {
    try {
      // Lần đầu: lấy 7 ngày gần nhất. Các lần sau: chỉ lấy từ hội thoại mới nhất đã có (trừ 2 giờ) để đồng bộ nhanh.
      const latest = await sql`SELECT MAX(last_message_at) AS at FROM conversations WHERE page_id = ${page.pageId}`
      const since = opts.days ? until - opts.days * 24 * 3600 : latest[0]?.at
        ? Math.floor(new Date(latest[0].at as string).getTime() / 1000) - 2 * 3600
        : until - FIRST_SYNC_DAYS * 24 * 3600

      // Pancake trả tối đa 200 mục/trang (gồm cả bình luận), mới nhất trước — phải lật trang đến khi hết.
      for (let pageNo = 1; pageNo <= MAX_LIST_PAGES; pageNo++) {
      const url = `${PANCAKE_PAGE_API}/pages/${page.pageId}/conversations?page_access_token=${page.token}&page_number=${pageNo}&since=${since}&until=${until}`
      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) })
      if (!res.ok) { result.errors.push(`${page.name}: Pancake ${res.status}`); break }
      const data = await res.json()
      const list: Record<string, any>[] = data?.conversations || data?.data || [] // eslint-disable-line @typescript-eslint/no-explicit-any
      if (!list.length) break

      // Gom cả trang (200 mục) thành MỘT câu upsert thay vì từng dòng: DB ở xa nên mỗi câu lệnh tốn ~0,15 giây.
      const rows = new Map<string, Record<string, unknown>>()
      for (const conv of list) {
        const convId = String(conv.id || conv.conversation_id || '')
        if (!convId) continue
        const type = String(conv.type || '').toUpperCase()
        if (type === 'COMMENT' || type === 'RATING') continue
        result.conversationsSeen++

        const snippet = String(conv.snippet || conv.last_message?.message || conv.last_message || '')
        const cust = conv.customers?.[0] || conv.customer || conv.from || {}
        const customerId = String(conv.customer_id || conv.from?.id || conv.customers?.[0]?.id || conv.customers?.[0]?.fb_id || '')
        const phoneRaw = cust.phone ?? cust.phone_number ?? conv.recent_phone_numbers?.[0]
        const phone = normalizePhone(typeof phoneRaw === 'string' ? phoneRaw
          : (phoneRaw && typeof phoneRaw === 'object' ? String(phoneRaw.phone_number || phoneRaw.phone || '') : ''))
        const lastAt = String(conv.updated_at || conv.last_sent_at || conv.inserted_at || '')
        const lastAtDate = lastAt ? new Date(lastAt) : null
        // Người đang được giao hội thoại trên Pancake
        const assignees: string[] = Array.isArray(conv.current_assign_users)
          ? conv.current_assign_users.map((u: { name?: string }) => String(u?.name || '').trim()).filter(Boolean)
          : []
        // "Chưa đọc" theo cờ seen của Facebook không đáng tin (vẫn false dù nhân viên đã trả lời từ lâu, vì
        // Pancake không luôn gọi mark_seen). Định nghĩa đáng tin hơn: tin CUỐI CÙNG trong hội thoại là của khách
        // (chưa ai trả lời) — lấy từ last_sent_by, không cần tải tin nhắn.
        const lastSender = (conv.last_sent_by as Record<string, unknown>) || {}
        const lastFromPage = !!lastSender.admin_id || String(lastSender.id ?? lastSender.uid ?? '') === String(page.pageId)
        const isUnread = !lastFromPage && Object.keys(lastSender).length > 0

        rows.set(convId, {
          pancake_conversation_id: convId,
          page_id: page.pageId,
          pancake_customer_id: customerId,
          customer_name: String(cust.name || conv.customer_name || 'Khách ẩn danh'),
          customer_phone: phone,
          platform: String(conv.type || conv.platform || 'facebook').toLowerCase(),
          page_name: page.name,
          last_message_preview: cleanPancakeText(snippet).slice(0, 200),
          last_message_at: lastAtDate && !isNaN(lastAtDate.getTime()) ? lastAtDate : null,
          assignees: sql.json(assignees as never),
          is_unread: isUnread,
          unread_count: isUnread ? 1 : 0,
        })
      }

      const batch = Array.from(rows.values())
      if (batch.length) {
        await sql`
          INSERT INTO conversations ${sql(batch as never, 'pancake_conversation_id', 'page_id', 'pancake_customer_id', 'customer_name', 'customer_phone', 'platform', 'page_name', 'last_message_preview', 'last_message_at', 'assignees', 'is_unread', 'unread_count')}
          ON CONFLICT (pancake_conversation_id) WHERE pancake_conversation_id IS NOT NULL DO UPDATE SET
            page_id = EXCLUDED.page_id,
            pancake_customer_id = EXCLUDED.pancake_customer_id,
            customer_name = EXCLUDED.customer_name,
            customer_phone = CASE WHEN EXCLUDED.customer_phone <> '' THEN EXCLUDED.customer_phone ELSE conversations.customer_phone END,
            last_message_preview = EXCLUDED.last_message_preview,
            last_message_at = EXCLUDED.last_message_at,
            assignees = EXCLUDED.assignees,
            is_unread = EXCLUDED.is_unread,
            unread_count = EXCLUDED.unread_count,
            updated_at = NOW()
        `
        result.conversationsUpserted += batch.length
      }
      }
    } catch (e) {
      result.errors.push(`${page.name}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  // Tải tin nhắn cho hội thoại mới/có tin mới (giới hạn mỗi lượt để không quá tải)
  const stale = await sql`
    SELECT pancake_conversation_id AS id, page_id, pancake_customer_id, customer_name, page_name, last_message_at
    FROM conversations
    WHERE page_id IS NOT NULL AND pancake_conversation_id IS NOT NULL
      AND (messages_synced_at IS NULL OR last_message_at > messages_synced_at)
    ORDER BY last_message_at DESC NULLS LAST
    LIMIT ${MAX_MESSAGE_FETCH}
  `
  const fetched: Array<{ id: string; msgs: ParsedMessage[]; customer_name: string; page_name: string; last_message_at: string | null }> = []
  for (const row of stale) {
    const msgs = await fetchPancakeMessages(String(row.page_id), String(row.id), String(row.pancake_customer_id || ''))
    if ('error' in msgs) { result.errors.push(`msg ${row.id}: ${msgs.error}`); continue }
    await sql`
      UPDATE conversations SET messages = ${sql.json(msgs as never)}, messages_synced_at = NOW()
      WHERE pancake_conversation_id = ${String(row.id)}
    `
    result.messagesFetched++
    fetched.push({ id: String(row.id), msgs, customer_name: String(row.customer_name), page_name: String(row.page_name), last_message_at: row.last_message_at ? String(row.last_message_at) : null })
  }

  const pending = await sql`SELECT COUNT(*)::int AS n FROM conversations WHERE page_id IS NOT NULL AND pancake_conversation_id IS NOT NULL AND (messages_synced_at IS NULL OR last_message_at > messages_synced_at)`
  result.pendingMessages = pending[0].n

  // Chấm chất lượng bằng AI theo lô cho hội thoại vừa có tin mới
  if (opts.analyze && process.env.GEMINI_API_KEY) {
    const todo = fetched.filter(f => f.msgs.some(m => m.from_customer)).slice(0, MAX_ANALYZE)
    if (todo.length) {
      for (const job of await getEnabledJobs()) {
        const r = await runQcJob(job, todo.map(f => ({ id: f.id, customer_name: f.customer_name, page_name: f.page_name, messages: f.msgs, last_message_at: f.last_message_at })))
        result.analyzed += r.analyzed; result.pass += r.pass; result.fail += r.fail; result.alerts += r.alerts
        if (r.errors) result.errors.push(`Tác vụ "${job.name}": ${r.errors} lô lỗi`)
      }
    }
  }
  await logSystem(result.errors.length ? 'warn' : 'info', 'sync',
    `Đồng bộ ${result.conversationsUpserted} hội thoại, ${result.messagesFetched} tin, AI chấm ${result.analyzed}`, result)
  return result
}
