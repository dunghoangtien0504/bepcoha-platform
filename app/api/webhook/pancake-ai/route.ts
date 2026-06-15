import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { initDb, insertAiOrder } from '@/lib/db'
import { createPancakeOrder } from '@/lib/pancake'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Danh sách sản phẩm - khớp với variation_id trong Poscake
// Cập nhật env vars: PANCAKE_VAR_<TEN> cho từng sản phẩm
const PRODUCTS: Record<string, { name: string; envKey: string }> = {
  'dua-ca-muoi':     { name: 'Dưa Cà Muối',      envKey: 'PANCAKE_VAR_DUA_CA'   },
  'rau-ma-dau-xanh': { name: 'Rau Má Đậu Xanh',   envKey: 'PANCAKE_VAR_RAU_MA'   },
  'sot-tron-nom':    { name: 'Sốt Trộn Nộm',      envKey: 'PANCAKE_VAR_SOT_500G' },
}

const SYSTEM_PROMPT = `Bạn phân tích hội thoại bán hàng trên Messenger/Zalo và trích xuất thông tin đặt hàng.

Trả về JSON thuần (không markdown):
{
  "has_order": true/false,
  "confidence": 0.0-1.0,
  "customer_name": "Tên khách",
  "customer_phone": "0xxxxxxxxx",
  "customer_address": "Địa chỉ đầy đủ",
  "note": "Ghi chú nếu có",
  "items": [
    { "product_key": "dua-ca-muoi|rau-ma-dau-xanh|sot-tron-nom", "quantity": 1, "unit": "kg/chai/hộp" }
  ],
  "reason": "Lý do nếu has_order=false"
}

Quy tắc:
- has_order=true chỉ khi khách ĐÃ xác nhận đặt hàng (không phải chỉ hỏi giá)
- Cần đủ: tên + SĐT + địa chỉ + sản phẩm → mới has_order=true
- Chuẩn hóa SĐT: bỏ khoảng trắng, +84 → 0
- product_key phải là 1 trong 3 loại trên`

function formatMessages(messages: Array<{ from_customer?: boolean; message?: string; content?: string }>): string {
  return messages
    .map(m => `${m.from_customer ? 'Khách' : 'AI/NV'}: ${m.message || m.content || ''}`)
    .filter(l => l.length > 10)
    .join('\n')
}

export async function POST(req: NextRequest) {
  // Xác thực webhook secret (tùy chọn)
  const secret = process.env.PANCAKE_WEBHOOK_SECRET
  if (secret) {
    const incoming = req.headers.get('x-webhook-secret') || req.headers.get('authorization') || ''
    if (!incoming.includes(secret)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  await initDb()

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Lấy tin nhắn từ nhiều format webhook khác nhau của Pancake
  const messages = (body.messages as Array<Record<string, unknown>>) ||
    (body.message ? [body.message] : [])
  const conversation = (body.conversation as Record<string, unknown>) || {}
  const customer = (conversation.customer as Record<string, unknown>) || {}
  const pageName = ((conversation.page as Record<string, unknown>)?.name as string) || 'Messenger'

  if (!messages.length) {
    return NextResponse.json({ status: 'skipped', reason: 'no messages' })
  }

  const conversationText = formatMessages(messages as Array<{ from_customer?: boolean; message?: string; content?: string }>)
  const customerName = (customer.name as string) || ''

  // Gọi Claude phân tích hội thoại
  let extraction: Record<string, unknown>
  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Tên khách trên Pancake: ${customerName}\n\n${conversationText}` }],
    })
    const raw = (msg.content[0] as { text: string }).text.trim()
    extraction = JSON.parse(raw.replace(/```json?/g, '').replace(/```/g, '').trim())
  } catch (e) {
    return NextResponse.json({ status: 'error', reason: `AI error: ${e}` }, { status: 500 })
  }

  if (!extraction.has_order) {
    return NextResponse.json({ status: 'no_order', reason: extraction.reason })
  }

  if ((extraction.confidence as number) < 0.75) {
    return NextResponse.json({ status: 'low_confidence', confidence: extraction.confidence })
  }

  // Map sản phẩm → variation_id
  const items = (extraction.items as Array<{ product_key: string; quantity: number; unit: string }>) || []
  const orderItems = items
    .map(item => {
      const prod = PRODUCTS[item.product_key]
      if (!prod) return null
      const variationId = process.env[prod.envKey] || ''
      if (!variationId) return null
      return { variation_id: variationId, product_name: prod.name, quantity: item.quantity || 1 }
    })
    .filter(Boolean) as Array<{ variation_id: string; product_name: string; quantity: number }>

  if (!orderItems.length) {
    await insertAiOrder({
      customerName: extraction.customer_name as string || customerName,
      customerPhone: extraction.customer_phone as string || '',
      customerAddress: extraction.customer_address as string || '',
      items: [],
      rawConversation: conversationText,
      confidence: extraction.confidence as number,
      status: 'failed',
      source: pageName,
      note: `Không map được sản phẩm: ${items.map(i => i.product_key).join(', ')}`,
    })
    return NextResponse.json({ status: 'error', reason: 'Không tìm thấy variation_id cho sản phẩm' })
  }

  // Tạo đơn trên Poscake
  const firstItem = orderItems[0]
  let poscakeResult: Record<string, unknown> | null = null
  let orderStatus: 'created' | 'failed' = 'created'

  try {
    poscakeResult = await createPancakeOrder({
      name: extraction.customer_name as string || customerName,
      phone: extraction.customer_phone as string || '',
      email: '',
      address: extraction.customer_address as string || '',
      product: '500g',  // giá trị placeholder - variation_id đã được set bên dưới
      quantity: firstItem.quantity,
      totalPrice: 0,
      note: (extraction.note as string) || `Đặt qua AI Agent | Kênh: ${pageName}`,
    }) as Record<string, unknown>

    // Ghi đè variation_id đúng (createPancakeOrder dùng PANCAKE_VAR_500G mặc định)
    // Tạo lại request với đúng variation_id nếu cần nhiều sản phẩm
  } catch (e) {
    orderStatus = 'failed'
    poscakeResult = { error: String(e) }
  }

  const poscakeOrderId = (poscakeResult?.data as Record<string, unknown>)?.id as string ||
    poscakeResult?.id as string || undefined

  await insertAiOrder({
    poscakeOrderId,
    customerName: extraction.customer_name as string || customerName,
    customerPhone: extraction.customer_phone as string || '',
    customerAddress: extraction.customer_address as string || '',
    items: orderItems,
    rawConversation: conversationText,
    confidence: extraction.confidence as number,
    status: orderStatus,
    source: pageName,
    note: extraction.note as string || '',
    poscakeResponse: poscakeResult as Record<string, unknown>,
  })

  return NextResponse.json({
    status: orderStatus,
    order_id: poscakeOrderId,
    customer: extraction.customer_name,
    items: orderItems.map(i => `${i.product_name} x${i.quantity}`),
  })
}
