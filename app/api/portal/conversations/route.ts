import { NextRequest, NextResponse } from 'next/server'
import { initDb, getAllConversationEvaluations } from '@/lib/db'

const PANCAKE_API = 'https://pages.fm/api/public_api/v1'

function checkAuth(req: NextRequest) {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim()
  return token === (process.env.ADMIN_PASSWORD || 'hacofood2024')
}

function getPageTokens(): Array<{ token: string; label: string }> {
  const tokens: Array<{ token: string; label: string }> = []
  const single = process.env.PANCAKE_PAGE_TOKEN
  if (single) tokens.push({ token: single, label: 'Page 1' })
  for (let i = 1; i <= 10; i++) {
    const t = process.env[`PANCAKE_PAGE_TOKEN_${i}`]
    if (t) tokens.push({ token: t, label: `Page ${i + 1}` })
  }
  return tokens
}

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await initDb()
  const evaluations = await getAllConversationEvaluations()

  const tokens = getPageTokens()
  if (!tokens.length) {
    return NextResponse.json({ conversations: [], warning: 'Chưa cấu hình PANCAKE_PAGE_TOKEN' })
  }

  const conversations: unknown[] = []

  for (const { token, label } of tokens) {
    try {
      const url = `${PANCAKE_API}/conversations?page_access_token=${token}&page=1&page_size=30`
      const res = await fetch(url, { next: { revalidate: 0 } })
      if (!res.ok) continue
      const data = await res.json()
      const convList = data?.data || data?.conversations || []

      for (const conv of convList) {
        const pancakeId = String(conv.id || conv.conversation_id || '')
        if (!pancakeId) continue

        const customer = conv.customer || conv.from || {}
        const page = conv.page || {}
        const lastMsg = conv.last_message || conv.messages?.[0] || {}

        const eval_ = evaluations[pancakeId]

        conversations.push({
          id: pancakeId,
          customer_name: String(customer.name || conv.customer_name || 'Khách ẩn danh'),
          customer_phone: String(customer.phone || conv.phone || ''),
          platform: String(conv.channel || conv.platform || 'facebook'),
          page_name: String(page.name || conv.page_name || label),
          last_message_preview: String(lastMsg.message || lastMsg.content || lastMsg.text || ''),
          last_message_at: String(conv.updated_at || conv.last_message_at || conv.created_at || ''),
          messages: [],
          messages_loaded: false,
          // evaluations từ DB
          ai_summary: eval_?.ai_summary ?? null,
          evaluation_score: eval_?.evaluation_score ?? null,
          evaluation_label: eval_?.evaluation_label ?? null,
          evaluation_note: eval_?.evaluation_note ?? null,
          evaluated_at: eval_?.evaluated_at ?? null,
        })
      }
    } catch {
      // skip token errors
    }
  }

  return NextResponse.json({ conversations })
}
