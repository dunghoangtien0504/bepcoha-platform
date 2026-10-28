import { NextRequest, NextResponse } from 'next/server'
import { initDb } from '@/lib/db'
import { SepayWebhookPayload } from '@/lib/sepay'
import { safeEqual } from '@/lib/internal-auth'
import { matchProductRef, matchCourseRef, handleProductPayment } from '@/lib/payment-handlers'
import { PRODUCT_HANDLERS } from '@/lib/product-handlers'
import { handleCoursePayment } from '@/lib/course-payment'

/**
 * Webhook SePay. Bước 0 (HACO-LOOP/05):
 *  - chỉ xử lý TIỀN VÀO; khoá API so sánh thời gian hằng, thiếu cấu hình thì từ chối
 *  - mọi sản phẩm + khoá học đều "xác nhận đúng 1 lần" (SePay có thể gọi trùng)
 *  - mã đúng định dạng mà không tìm thấy đơn → báo Telegram (tiền về mà không có đơn)
 *  - Telegram/email/POScake lỗi sau khi đã nhận tiền → xếp hàng thử lại (payment_followups)
 */
export async function POST(req: NextRequest) {
  try {
    const expectedKey = process.env.SEPAY_API_KEY
    if (!expectedKey) {
      console.error('[payment-webhook] SEPAY_API_KEY chưa được cấu hình')
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
    }
    // SePay gửi header: "Authorization: Apikey YOUR_KEY"
    const apiKey = (req.headers.get('Authorization') || '').replace(/^Apikey\s+/i, '').trim()
    if (!safeEqual(apiKey, expectedKey)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const payload: SepayWebhookPayload = await req.json()
    if (payload.transferType && payload.transferType !== 'in') {
      return NextResponse.json({ success: true, message: 'Ignored outgoing transfer' })
    }
    const content = String(payload.content || '')
    const received = Number(payload.transferAmount) || 0
    await initDb()

    const product = matchProductRef(content)
    if (product) {
      const h = PRODUCT_HANDLERS[product.label]
      return handleProductPayment(h, product.ref, received, content, product.strict)
    }
    const course = matchCourseRef(content)
    if (course) return handleCoursePayment(course.ref, received, content, course.strict)

    return NextResponse.json({ success: true, message: 'Not our transaction' })
  } catch (err) {
    console.error('[payment-webhook]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
