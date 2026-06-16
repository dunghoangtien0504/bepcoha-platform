import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { initDb, saveConversationEvaluation, saveConversationAnalysis, getConversationEvaluation } from '@/lib/db'
import { getPancakePageById, PANCAKE_PAGE_API, cleanPancakeText, parseTags } from '@/lib/pancake'

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

// Lấy messages của 1 hội thoại từ Pancake (đã làm sạch HTML, bỏ tin rỗng)
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
  const parsed: ParsedMessage[] = rawMsgs.map((m: Record<string, unknown>, i: number) => {
    const from = (m.from as Record<string, unknown>) || {}
    // Tin từ Page/NV có admin_id; tin từ khách thì không.
    const isFromPage = !!from.admin_id
    const senderName = isFromPage
      ? String(from.admin_name || from.name || '')   // admin_name = tên NV thật (Botcake / Bùi Thu Thảo...)
      : String(from.name || '')
    return {
      id: `msg_${i}`,
      from_customer: !isFromPage,
      content: cleanPancakeText(String(m.message || m.content || m.text || '')),
      timestamp: String(m.inserted_at || m.created_at || m.timestamp || ''),
      sender_name: senderName,
    }
  })
  // Bỏ tin rỗng (vd <div></div> sau khi làm sạch)
  return parsed.filter(m => m.content.length > 0)
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

  const evalFields = {
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
  }

  if ('error' in result) {
    return NextResponse.json({ messages: [], warning: result.error, ...evalFields })
  }
  return NextResponse.json({ messages: result, ...evalFields })
}

// PATCH: lưu đánh giá thủ công (người dùng chỉnh tay)
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

interface AiAnalysis {
  customer_needs: string
  sales_name: string
  score: number | null
  outcome: string
  evaluation: string
  needs_attention: boolean
  issue: string
  tags: string[]
}

function parseAiJson(raw: string): AiAnalysis | null {
  try {
    const cleaned = raw.replace(/```json|```/gi, '').trim()
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start === -1 || end === -1) return null
    const obj = JSON.parse(cleaned.slice(start, end + 1))
    const tags = Array.isArray(obj.tags)
      ? obj.tags.map((t: unknown) => String(t).trim()).filter(Boolean).slice(0, 4)
      : []
    return {
      customer_needs: String(obj.customer_needs || ''),
      sales_name: String(obj.sales_name || ''),
      score: typeof obj.score === 'number' ? obj.score : (parseInt(obj.score) || null),
      outcome: String(obj.outcome || ''),
      evaluation: String(obj.evaluation || ''),
      needs_attention: obj.needs_attention === true || obj.needs_attention === 'true',
      issue: String(obj.issue || ''),
      tags,
    }
  } catch {
    return null
  }
}

// POST: AI tự phân tích nhu cầu khách + đánh giá & chấm điểm phiên trả lời của sales
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
    return NextResponse.json({ error: 'Không có tin nhắn để phân tích' }, { status: 400 })
  }

  const text = result
    .map(m => m.from_customer
      ? `Khách: ${m.content}`
      : `NV${m.sender_name ? ` (${m.sender_name})` : ''}: ${m.content}`)
    .join('\n')

  const prompt = `Bạn là chuyên gia QA chăm sóc khách hàng. Phân tích đoạn hội thoại bán hàng qua tin nhắn dưới đây và trả về JSON THUẦN (không markdown, không giải thích thêm) đúng cấu trúc:
{
  "customer_needs": "Phân tích nhu cầu của khách trong 1-2 câu: khách muốn gì, đang ở giai đoạn nào (hỏi thông tin / cân nhắc / quyết định mua / không mua)",
  "sales_name": "Tên nhân viên THẬT đã trả lời khách — lấy CHÍNH XÁC từ tên trong nhãn 'NV (Tên)' của các dòng NV. Nếu có nhiều người, chọn người trả lời chính/nhiều nhất. Nếu CHỈ có 'Botcake' (tin tự động) thì ghi 'Tự động (Botcake)'. TUYỆT ĐỐI không ghi tên Page 'Cô Hạ Dạy Nấu Ăn'",
  "score": <số nguyên 1-5: chấm chất lượng phiên trả lời của sales — 5 là xuất sắc>,
  "outcome": "<một trong: order (đã/đang chốt đơn), inquiry (mới hỏi thông tin), no_buy (không mua), need_staff (cần nhân viên hỗ trợ thêm), ai_wrong (bot trả lời sai/lạc đề)>",
  "evaluation": "Nhận xét phiên trả lời của sales trong 1-2 câu: làm tốt gì, thiếu sót gì (vd: chưa hỏi SĐT, chưa chốt đơn, trả lời chậm, đúng/sai nhu cầu)",
  "needs_attention": <true nếu có vấn đề HỆ TRỌNG cần xử lý ngay: khách bức xúc/phàn nàn/dọa bỏ, NV trả lời sai gây hiểu lầm, khách hỏi nhưng bị bỏ lơ chưa ai trả lời, mất khách tiềm năng rõ ràng, sự cố đơn hàng/giao hàng. Ngược lại false>,
  "issue": "Nếu needs_attention=true: mô tả ngắn gọn vấn đề hệ trọng cần xử lý. Nếu false: để chuỗi rỗng",
  "tags": ["1-4 tag NGẮN (2-4 từ) tiếng Việt phân loại vấn đề/chủ đề hội thoại, vd: 'Hỏi giá', 'Sốt trộn nộm', 'Chốt đơn', 'Phí ship', 'Phàn nàn giao hàng', 'Hỏi công thức', 'Khách quay lại'"]
}

Hội thoại:
${text}`

  const model = genai.getGenerativeModel({ model: 'gemini-2.5-flash' })
  const aiRes = await model.generateContent(prompt)
  const analysis = parseAiJson(aiRes.response.text())

  if (!analysis) {
    return NextResponse.json({ error: 'AI trả về sai định dạng, thử lại' }, { status: 502 })
  }

  const score = analysis.score && analysis.score >= 1 && analysis.score <= 5 ? analysis.score : null
  const summary = analysis.customer_needs.slice(0, 200)

  await saveConversationAnalysis(convId, {
    customerNeeds: analysis.customer_needs,
    salesName: analysis.sales_name,
    salesEvaluation: analysis.evaluation,
    aiScore: score,
    label: analysis.outcome || null,
    summary,
    needsAttention: analysis.needs_attention,
    issue: analysis.needs_attention ? (analysis.issue || null) : null,
    tags: analysis.tags,
    customerName,
    pageName,
  })

  return NextResponse.json({
    customer_needs: analysis.customer_needs,
    sales_name: analysis.sales_name,
    sales_evaluation: analysis.evaluation,
    ai_score: score,
    outcome: analysis.outcome,
    ai_summary: summary,
    needs_attention: analysis.needs_attention,
    issue: analysis.needs_attention ? analysis.issue : '',
    tags: analysis.tags,
  })
}
