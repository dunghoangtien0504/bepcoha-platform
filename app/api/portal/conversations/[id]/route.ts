import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { initDb, saveConversationEvaluation, saveConversationSummary, getConversationEvaluation } from '@/lib/db'

const PANCAKE_API = 'https://pages.fm/api/public_api/v1'
const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

function checkAuth(req: NextRequest) {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim()
  return token === (process.env.ADMIN_PASSWORD || 'hacofood2024')
}

function getFirstToken(): string | null {
  return process.env.PANCAKE_PAGE_TOKEN ||
    process.env.PANCAKE_PAGE_TOKEN_1 ||
    null
}

function getPageToken(req: NextRequest): string | null {
  // Client có thể truyền page_token qua query param nếu cần
  const qt = req.nextUrl.searchParams.get('page_token')
  if (qt) return qt
  // Thử từng token có trong env
  for (let i = 0; i <= 10; i++) {
    const key = i === 0 ? 'PANCAKE_PAGE_TOKEN' : `PANCAKE_PAGE_TOKEN_${i}`
    const t = process.env[key]
    if (t) return t
  }
  return null
}

// GET: lấy messages của 1 hội thoại từ Pancake + evaluation từ DB
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await initDb()
  const { id: pancakeId } = await params

  const token = getPageToken(req)
  if (!token) return NextResponse.json({ error: 'Chưa cấu hình PANCAKE_PAGE_TOKEN' }, { status: 500 })

  // Fetch messages từ Pancake
  let messages: unknown[] = []
  try {
    const url = `${PANCAKE_API}/conversations/${pancakeId}/messages?page_access_token=${token}&page_size=50`
    const res = await fetch(url, { next: { revalidate: 0 } })
    if (res.ok) {
      const data = await res.json()
      const rawMsgs = data?.data || data?.messages || []
      messages = rawMsgs.map((m: Record<string, unknown>, i: number) => ({
        id: `msg_${i}`,
        from_customer: !!(m.from_customer ?? m.is_from_customer ?? (m.sender_type === 'customer')),
        content: String(m.message || m.content || m.text || ''),
        timestamp: String(m.created_at || m.timestamp || ''),
        sender_name: String((m.from as Record<string, unknown>)?.name || m.sender_name || ''),
      }))
    }
  } catch {
    // Trả về rỗng nếu lỗi
  }

  const eval_ = await getConversationEvaluation(pancakeId)

  return NextResponse.json({
    messages,
    ai_summary: eval_?.ai_summary ?? null,
    evaluation_score: eval_?.evaluation_score ?? null,
    evaluation_label: eval_?.evaluation_label ?? null,
    evaluation_note: eval_?.evaluation_note ?? null,
  })
}

// PATCH: lưu đánh giá
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await initDb()
  const { id: pancakeId } = await params
  const body = await req.json()

  await saveConversationEvaluation(pancakeId, {
    score: body.score ?? null,
    label: body.label ?? null,
    note: body.note ?? null,
    customerName: body.customer_name,
    pageName: body.page_name,
  })

  return NextResponse.json({ ok: true })
}

// POST: tóm tắt nhu cầu khách bằng AI
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await initDb()
  const { id: pancakeId } = await params

  const body = await req.json().catch(() => ({}))
  const customerName: string = body.customer_name || ''
  const pageName: string = body.page_name || ''

  const token = getFirstToken()
  if (!token) return NextResponse.json({ error: 'Chưa cấu hình PANCAKE_PAGE_TOKEN' }, { status: 500 })

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: 'Chưa cấu hình GEMINI_API_KEY' }, { status: 500 })
  }

  // Fetch messages
  let messages: Array<{ from_customer: boolean; content: string }> = []
  try {
    const url = `${PANCAKE_API}/conversations/${pancakeId}/messages?page_access_token=${token}&page_size=50`
    const res = await fetch(url)
    if (res.ok) {
      const data = await res.json()
      const rawMsgs = data?.data || data?.messages || []
      messages = rawMsgs.map((m: Record<string, unknown>) => ({
        from_customer: !!(m.from_customer ?? m.is_from_customer ?? (m.sender_type === 'customer')),
        content: String(m.message || m.content || m.text || ''),
      }))
    }
  } catch {
    return NextResponse.json({ error: 'Không lấy được tin nhắn từ Pancake' }, { status: 502 })
  }

  if (!messages.length) {
    return NextResponse.json({ error: 'Không có tin nhắn để tóm tắt' }, { status: 400 })
  }

  const text = messages
    .map(m => `${m.from_customer ? 'Khách' : 'AI/NV'}: ${m.content}`)
    .join('\n')

  const model = genai.getGenerativeModel({ model: 'gemini-2.5-flash' })
  const result = await model.generateContent(
    `Tóm tắt nhu cầu của khách trong hội thoại này trong 2-3 câu ngắn gọn bằng tiếng Việt. Nêu rõ: khách cần gì, đang ở giai đoạn nào (hỏi thông tin / đang cân nhắc / đã quyết định mua / không mua), và điểm cần chú ý. Không dùng markdown.\n\n${text}`
  )
  const summary = result.response.text().trim()
  await saveConversationSummary(pancakeId, summary, customerName, pageName)

  return NextResponse.json({ summary })
}
