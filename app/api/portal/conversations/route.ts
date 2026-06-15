import { NextRequest, NextResponse } from 'next/server'
import { initDb, getAllConversations, insertConversation } from '@/lib/db'

function checkAuth(req: NextRequest) {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim()
  return token === (process.env.ADMIN_PASSWORD || 'hacofood2024')
}

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await initDb()
  const conversations = await getAllConversations(200)
  return NextResponse.json({ conversations })
}

// Cho phép paste hội thoại thủ công từ portal
export async function POST(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await initDb()
  const body = await req.json()
  const id = await insertConversation({
    customerName: body.customer_name || 'Khách hàng',
    customerPhone: body.customer_phone || '',
    platform: body.platform || 'manual',
    pageName: body.page_name || 'Nhập tay',
    messages: body.messages || [],
    aiSummary: body.ai_summary,
  })
  return NextResponse.json({ id })
}
