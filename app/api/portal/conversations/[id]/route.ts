import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { initDb, getConversationById, updateConversationEvaluation } from '@/lib/db'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function checkAuth(req: NextRequest) {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim()
  return token === (process.env.ADMIN_PASSWORD || 'hacofood2024')
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await initDb()
  const { id } = await params
  const conv = await getConversationById(Number(id))
  if (!conv) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ conversation: conv })
}

// Lưu đánh giá (sao + nhãn + ghi chú)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await initDb()
  const { id } = await params
  const body = await req.json()
  await updateConversationEvaluation(Number(id), {
    score: body.score,
    label: body.label,
    note: body.note,
  })
  return NextResponse.json({ ok: true })
}

// Gọi Claude tóm tắt hội thoại
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await initDb()
  const { id } = await params
  const conv = await getConversationById(Number(id))
  if (!conv) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const text = conv.messages
    .map(m => `${m.from_customer ? 'Khách' : 'AI/NV'}: ${m.content}`)
    .join('\n')

  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    messages: [{
      role: 'user',
      content: `Tóm tắt hội thoại bán hàng này trong 2-3 câu ngắn gọn bằng tiếng Việt. Nêu rõ: khách hỏi gì, AI/NV xử lý ra sao, kết quả (đặt hàng / không mua / còn đang hỏi). Không dùng markdown.\n\n${text}`
    }]
  })

  const summary = (msg.content[0] as { text: string }).text.trim()

  const sql = (await import('@/lib/db')).getDb()
  await sql`UPDATE conversations SET ai_summary = ${summary}, updated_at = NOW() WHERE id = ${Number(id)}`

  return NextResponse.json({ summary })
}
