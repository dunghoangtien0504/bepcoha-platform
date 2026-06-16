import { NextRequest, NextResponse } from 'next/server'
import { initDb, insertConversation, getDb } from '@/lib/db'

const PANCAKE_API = 'https://pages.fm/api/public_api/v1'

// Lấy tất cả page tokens từ env (PANCAKE_PAGE_TOKEN, PANCAKE_PAGE_TOKEN_1, _2, _3...)
function getPageTokens(): string[] {
  const tokens: string[] = []
  const single = process.env.PANCAKE_PAGE_TOKEN
  if (single) tokens.push(single)
  for (let i = 1; i <= 10; i++) {
    const t = process.env[`PANCAKE_PAGE_TOKEN_${i}`]
    if (t) tokens.push(t)
  }
  return [...new Set(tokens)]
}

async function fetchConversations(pageToken: string, page = 1) {
  const url = `${PANCAKE_API}/conversations?page_access_token=${pageToken}&page=${page}&page_size=20`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Pancake API error: ${res.status}`)
  return res.json()
}

async function fetchMessages(pageToken: string, conversationId: string) {
  const url = `${PANCAKE_API}/conversations/${conversationId}/messages?page_access_token=${pageToken}&page_size=50`
  const res = await fetch(url)
  if (!res.ok) return null
  return res.json()
}

export async function GET(req: NextRequest) {
  // Bảo mật: chỉ Vercel Cron hoặc request có đúng secret mới được gọi
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get('authorization') || req.nextUrl.searchParams.get('secret') || ''
    if (!auth.includes(secret)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  await initDb()
  const sql = getDb()

  // Đảm bảo có unique constraint để tránh trùng lặp
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS conversations_pancake_id_unique
    ON conversations (pancake_conversation_id)
    WHERE pancake_conversation_id IS NOT NULL
  `

  const tokens = getPageTokens()
  if (!tokens.length) {
    return NextResponse.json({ error: 'Không có PANCAKE_PAGE_TOKEN nào được cấu hình' }, { status: 400 })
  }

  let totalNew = 0
  let totalSkipped = 0
  const errors: string[] = []

  for (const token of tokens) {
    try {
      const data = await fetchConversations(token)
      const conversations = data?.data || data?.conversations || []

      for (const conv of conversations) {
        const pancakeId = String(conv.id || conv.conversation_id || '')
        if (!pancakeId) continue

        // Kiểm tra đã có trong DB chưa
        const existing = await sql`
          SELECT id FROM conversations WHERE pancake_conversation_id = ${pancakeId}
        `
        if (existing.length > 0) {
          totalSkipped++
          continue
        }

        // Lấy tin nhắn của hội thoại này
        const msgData = await fetchMessages(token, pancakeId)
        const rawMessages = msgData?.data || msgData?.messages || []

        const messages = rawMessages.map((m: Record<string, unknown>, i: number) => ({
          id: `msg_${i}`,
          from_customer: !!(m.from_customer ?? m.is_from_customer ?? (m.sender_type === 'customer')),
          content: String(m.message || m.content || m.text || ''),
          timestamp: String(m.created_at || m.timestamp || ''),
          sender_name: String(m.from?.name || m.sender_name || ''),
        }))

        const customer = conv.customer || conv.from || {}
        const page = conv.page || {}

        await insertConversation({
          pancakeConversationId: pancakeId,
          customerName: String(customer.name || conv.customer_name || 'Khách'),
          customerPhone: String(customer.phone || conv.phone || ''),
          platform: String(conv.channel || conv.platform || 'facebook'),
          pageName: String(page.name || conv.page_name || 'Bếp Cô Hạ'),
          messages,
        })
        totalNew++
      }
    } catch (e) {
      errors.push(String(e))
    }
  }

  return NextResponse.json({
    ok: true,
    new: totalNew,
    skipped: totalSkipped,
    errors,
    synced_at: new Date().toISOString(),
  })
}
