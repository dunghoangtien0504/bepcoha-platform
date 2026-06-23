import { NextRequest, NextResponse } from 'next/server'
import { initDb, getAllConversationEvaluations } from '@/lib/db'
import { getPancakePages, PANCAKE_PAGE_API, PANCAKE_USER_API, cleanPancakeText, parseTags } from '@/lib/pancake'
import { checkAdminAuth } from '@/lib/admin-auth'

export async function GET(req: NextRequest) {
  if (!checkAdminAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const debug = req.nextUrl.searchParams.get('debug') === '1'

  await initDb()
  const evaluations = await getAllConversationEvaluations()

  const pages = await getPancakePages()
  if (!pages.length) {
    // Khi debug: gọi thẳng /pages để xem Pancake trả về gì
    let pagesRaw: unknown = 'PANCAKE_USER_TOKEN chưa được set'
    const userToken = process.env.PANCAKE_USER_TOKEN || process.env.PANCAKE_ACCESS_TOKEN
    if (debug && userToken) {
      try {
        const r = await fetch(`${PANCAKE_USER_API}/pages?access_token=${userToken}`)
        pagesRaw = { status: r.status, body: await r.json().catch(() => r.text()) }
      } catch (e) {
        pagesRaw = { error: String(e) }
      }
    }
    return NextResponse.json({
      conversations: [],
      warning: 'Không lấy được page nào. Kiểm tra PANCAKE_USER_TOKEN.',
      has_user_token: !!userToken,
      ...(debug ? { pages_raw: pagesRaw } : {}),
    })
  }

  const conversations: unknown[] = []
  const debugRaw: unknown[] = []

  // Pancake bắt buộc `since` & `until` (Unix timestamp giây), khoảng phải < 1 tháng.
  const until = Math.floor(Date.now() / 1000)
  const since = until - 29 * 24 * 60 * 60

  for (const page of pages) {
    try {
      const url = `${PANCAKE_PAGE_API}/pages/${page.pageId}/conversations` +
        `?page_access_token=${page.token}&page_number=1&since=${since}&until=${until}`
      const res = await fetch(url, { next: { revalidate: 0 } })
      if (!res.ok) {
        if (debug) debugRaw.push({ page: page.name, status: res.status, body: await res.text() })
        continue
      }
      const data = await res.json()
      const convList = data?.conversations || data?.data || []

      // Debug: dump 1 hội thoại INBOX thật (field assignee) + tất cả từ-người-gửi của tin nhắn
      if (debug && debugRaw.length === 0) {
        const inbox = convList.find((c: Record<string, unknown>) =>
          String(c.type || '').toUpperCase() === 'INBOX') || convList[0]
        let msgFroms: unknown = 'n/a'
        if (inbox) {
          const fid = String(inbox.id || inbox.conversation_id || '')
          const cid = String(inbox.customer_id || inbox.customers?.[0]?.id || '')
          try {
            const mRes = await fetch(`${PANCAKE_PAGE_API}/pages/${page.pageId}/conversations/${fid}/messages?page_access_token=${page.token}&customer_id=${cid}`)
            const mData = await mRes.json()
            msgFroms = (mData?.messages || mData?.data || []).map((m: Record<string, unknown>) => ({
              from: m.from, original_message: String(m.original_message || m.message || '').slice(0, 50),
            }))
          } catch (e) { msgFroms = { error: String(e) } }
        }
        debugRaw.push({
          page: page.name,
          conversation_assignee_fields: inbox ? {
            current_assign_users: inbox.current_assign_users,
            assignee_ids: inbox.assignee_ids,
            assignee_histories: inbox.assignee_histories,
            last_sent_by: inbox.last_sent_by,
          } : null,
          message_froms: msgFroms,
        })
      }

      for (const conv of convList) {
        const convId = String(conv.id || conv.conversation_id || '')
        if (!convId) continue

        // Chỉ lấy tin nhắn (INBOX), bỏ qua bình luận (COMMENT)
        const convType = String(conv.type || '').toUpperCase()
        if (convType === 'COMMENT' || convType === 'RATING') continue

        // Bỏ hội thoại chỉ có tin tự động [Botcake] (khách chưa phản hồi)
        const rawSnippet = String(conv.snippet || conv.last_message?.message || conv.last_message || '')
        if (/\[botcake\]/i.test(rawSnippet)) continue

        // customer_id cần cho việc lấy messages
        const customerId = String(
          conv.customer_id ||
          conv.from?.id ||
          conv.customers?.[0]?.id ||
          conv.customers?.[0]?.fb_id ||
          ''
        )

        const cust = conv.customers?.[0] || conv.customer || conv.from || {}
        const phoneRaw = cust.phone ?? cust.phone_number ?? conv.recent_phone_numbers?.[0]
        const phone = typeof phoneRaw === 'string'
          ? phoneRaw
          : (phoneRaw && typeof phoneRaw === 'object'
              ? String((phoneRaw as Record<string, unknown>).phone_number || (phoneRaw as Record<string, unknown>).phone || '')
              : '')

        const eval_ = evaluations[convId]

        conversations.push({
          id: convId,
          page_id: page.pageId,
          customer_id: customerId,
          customer_name: String(cust.name || conv.customer_name || 'Khách ẩn danh'),
          customer_phone: String(phone || ''),
          platform: String(conv.type || conv.platform || 'facebook'),
          page_name: page.name,
          last_message_preview: cleanPancakeText(String(conv.snippet || conv.last_message?.message || conv.last_message || '')).slice(0, 120),
          last_message_at: String(conv.updated_at || conv.last_sent_at || conv.inserted_at || ''),
          messages: [],
          messages_loaded: false,
          ai_summary: eval_?.ai_summary ?? null,
          customer_needs: eval_?.customer_needs ?? null,
          sales_name: eval_?.sales_name ?? null,
          sales_evaluation: eval_?.sales_evaluation ?? null,
          ai_score: eval_?.ai_score ?? null,
          needs_attention: eval_?.needs_attention ?? false,
          issue: eval_?.issue ?? null,
          tags: parseTags(eval_?.tags),
          analyzed_at: eval_?.analyzed_at ?? null,
          evaluation_score: eval_?.evaluation_score ?? null,
          evaluation_label: eval_?.evaluation_label ?? null,
          evaluation_note: eval_?.evaluation_note ?? null,
          evaluated_at: eval_?.evaluated_at ?? null,
        })
      }
    } catch (e) {
      if (debug) debugRaw.push({ page: page.name, error: String(e) })
    }
  }

  if (debug) return NextResponse.json({ conversations, debug: debugRaw, pages: pages.map(p => ({ id: p.pageId, name: p.name })) })
  return NextResponse.json({ conversations })
}
