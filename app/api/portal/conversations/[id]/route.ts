import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { initDb, saveConversationEvaluation, saveConversationSummary, getConversationEvaluation } from '@/lib/db'
import { getPancakePageById, PANCAKE_PAGE_API } from '@/lib/pancake'

const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

function checkAuth(req: NextRequest) {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim()
  return token === (process.env.ADMIN_PASSWORD || 'hacofood2024')
}

interface ParsedMessage {
  id: string
  from_customer: boolean
  content: string
  timestamp: string
  sender_name: string
}

// Lấy messages của 1 hội thoại từ Pancake
async function fetchMessages(pageId: string, convId: string, customerId: string): Promise<ParsedMessage[] | { error: string; status: number }> {
  const page = await getPancakePageById(pageId)
  if (!page) return { error: 'Không tìm thấy page (kiểm tra PANCAKE_USER_TOKEN)', status: 500 }

  const url = `${PANCAKE_PAGE_API}/pages/${pageId}/conversations/${convId}/messages` +
    `?page_access_token=${page.token}` +
    (customerId ? `&customer_id=${customerId}` : '')

  let res: Response
  try {
    res = await fetch(url, { next: { revalidate: 0 } })
  } catch {
    return { error: 'Không gọi được Pancake API', status: 502 }
  }
  if (!res.ok) return { error: `Pancake API lỗi ${res.status}`, status: 502 }

  const data = await res.json()
  const rawMsgs = data?.messages || data?.data || []
  return rawMsgs.map((m: Record<string, unknown>, i: number) => {
    const from = (m.from as Record<string, unknown>) || {}
    // Khách: from.id === customer_id, hoặc không phải admin/page
    const fromId = String(from.id || '')
    const isFromCustomer = customerId
      ? fromId === customerId
      : !!(m.from_customer ?? m.is_from_customer ?? !(m.is_from_page ?? from.admin_id))
    return {
      id: `msg_${i}`,
      from_customer: isFromCustomer,
      content: String(m.message || m.content || m.text || ''),
      timestamp: String(m.inserted_at || m.created_at || m.timestamp || ''),
      sender_name: String(from.name || m.sender_name || ''),
    }
  })
}

// GET: messages + evaluation
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await initDb()
  const { id: convId } = await params
  const pageId = req.nextUrl.searchParams.get('page_id') || ''
  const customerId = req.nextUrl.searchParams.get('customer_id') || ''

  const result = await fetchMessages(pageId, convId, customerId)
  const eval_ = await getConversationEvaluation(convId)

  if ('error' in result) {
    // Vẫn trả evaluation kể cả khi không lấy được messages
    return NextResponse.json({
      messages: [],
      warning: result.error,
      ai_summary: eval_?.ai_summary ?? null,
      evaluation_score: eval_?.evaluation_score ?? null,
      evaluation_label: eval_?.evaluation_label ?? null,
      evaluation_note: eval_?.evaluation_note ?? null,
    })
  }

  return NextResponse.json({
    messages: result,
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
  const { id: convId } = await params
  const body = await req.json()

  await saveConversationEvaluation(convId, {
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
  const { id: convId } = await params

  const body = await req.json().catch(() => ({}))
  const customerName: string = body.customer_name || ''
  const pageName: string = body.page_name || ''
  const pageId: string = body.page_id || ''
  const customerId: string = body.customer_id || ''

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: 'Chưa cấu hình GEMINI_API_KEY' }, { status: 500 })
  }

  const result = await fetchMessages(pageId, convId, customerId)
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }
  if (!result.length) {
    return NextResponse.json({ error: 'Không có tin nhắn để tóm tắt' }, { status: 400 })
  }

  const text = result
    .map(m => `${m.from_customer ? 'Khách' : 'AI/NV'}: ${m.content}`)
    .filter(l => l.length > 6)
    .join('\n')

  const model = genai.getGenerativeModel({ model: 'gemini-2.5-flash' })
  const aiRes = await model.generateContent(
    `Tóm tắt nhu cầu của khách trong hội thoại này trong 2-3 câu ngắn gọn bằng tiếng Việt. Nêu rõ: khách cần gì, đang ở giai đoạn nào (hỏi thông tin / đang cân nhắc / đã quyết định mua / không mua), và điểm cần chú ý. Không dùng markdown.\n\n${text}`
  )
  const summary = aiRes.response.text().trim()
  await saveConversationSummary(convId, summary, customerName, pageName)

  return NextResponse.json({ summary })
}
