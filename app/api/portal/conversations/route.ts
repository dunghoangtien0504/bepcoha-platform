import { NextRequest, NextResponse } from 'next/server'
import { initDb, getAllConversationEvaluations } from '@/lib/db'
import { getPancakePages, PANCAKE_PAGE_API, PANCAKE_USER_API, cleanPancakeText, parseTags } from '@/lib/pancake'

function checkAuth(req: NextRequest) {
  const adminPw = process.env.ADMIN_PASSWORD || 'hacofood2024'
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (token === adminPw) return true
  // Cho phép xác thực qua query param ?secret= để mở debug bằng trình duyệt
  const secret = req.nextUrl.searchParams.get('secret') || ''
  return secret === adminPw
}

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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

      // Debug: liệt kê danh sách nhân viên (users) của page
      if (debug) {
        let users: unknown = 'n/a'
        try {
          const uRes = await fetch(`${PANCAKE_PAGE_API}/pages/${page.pageId}/users?page_access_token=${page.token}`)
          const uData = await uRes.json()
          const list = uData?.users || uData?.data || uData
          users = Array.isArray(list)
            ? list.map((u: Record<string, unknown>) => ({ id: u.id, name: u.name || u.fb_name || u.admin_name }))
            : { status: uRes.status, body: uData }
        } catch (e) {
          users = { error: String(e) }
        }
        debugRaw.push({ page: page.name, users })
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
