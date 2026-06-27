import { NextRequest, NextResponse } from 'next/server'
import { initDb, confirmPayment, getLeadByRef, markEmailSent, markTelegramSent, getStnOrderByRef, confirmStnPayment, getKdxOrderByRef, confirmKdxPayment, getSxcOrderByRef, confirmSxcPayment } from '@/lib/db'
import { sendCourseConfirmEmail } from '@/lib/email'
import { notifyCourseLead, notifyPaymentMismatch, notifyStnPaid, notifyKdxPaid, notifySxcPaid } from '@/lib/telegram'
import { SepayWebhookPayload } from '@/lib/sepay'
import { updatePancakeOrderStatus } from '@/lib/pancake'

export async function POST(req: NextRequest) {
  try {
    // SePay gửi header: "Authorization: Apikey YOUR_KEY"
    const authHeader = req.headers.get('Authorization') || ''
    const apiKey = authHeader.replace(/^Apikey\s+/i, '').trim()
    const expectedKey = process.env.SEPAY_API_KEY
    if (!expectedKey) {
      console.error('[payment-webhook] SEPAY_API_KEY chưa được cấu hình')
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
    }
    if (apiKey !== expectedKey) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await initDb()
    const payload: SepayWebhookPayload = await req.json()

    const content = payload.content || ''

    // ── Sốt Trộn Nộm (STN prefix) ────────────────────────────────────────────
    const stnMatch = content.match(/STN[A-Z0-9]+/i)
    if (stnMatch) {
      const refCode = stnMatch[0].toUpperCase()
      const order = await getStnOrderByRef(refCode)
      if (!order) return NextResponse.json({ success: true, message: 'STN order not found' })
      if (order.payment_status === 'paid') return NextResponse.json({ success: true, message: 'Already paid' })

      const received = Number(payload.transferAmount) || 0
      if (received < order.total_price) {
        await notifyPaymentMismatch({ paymentRef: refCode, received, expected: order.total_price, content }).catch(console.error)
        return NextResponse.json({ success: true, message: 'Underpaid' })
      }

      await confirmStnPayment(refCode)

      // Cập nhật POScake sang "Chờ chuyển hàng" (status 9)
      let pancakeUpdated = false
      if (order.pancake_order_id) {
        const updated = await updatePancakeOrderStatus(order.pancake_order_id, 9).catch(() => null)
        pancakeUpdated = !!updated
      }

      await notifyStnPaid({
        name: order.name, phone: order.phone,
        product: order.product, quantity: order.quantity, totalPrice: order.total_price,
        refCode, pancakeOrderId: order.pancake_order_id || undefined,
        pancakeUpdated,
      }).catch(console.error)

      return NextResponse.json({ success: true })
    }

    // ── Khăn Đồ Xôi (KDX prefix) ─────────────────────────────────────────────
    const kdxMatch = content.match(/KDX[A-Z0-9]+/i)
    if (kdxMatch) {
      const refCode = kdxMatch[0].toUpperCase()
      const order = await getKdxOrderByRef(refCode)
      if (!order) return NextResponse.json({ success: true, message: 'KDX order not found' })
      if (order.payment_status === 'paid') return NextResponse.json({ success: true, message: 'Already paid' })

      const received = Number(payload.transferAmount) || 0
      if (received < order.total_price) {
        await notifyPaymentMismatch({ paymentRef: refCode, received, expected: order.total_price, content }).catch(console.error)
        return NextResponse.json({ success: true, message: 'Underpaid' })
      }

      await confirmKdxPayment(refCode)

      let pancakeUpdated = false
      if (order.pancake_order_id) {
        const updated = await updatePancakeOrderStatus(order.pancake_order_id, 9).catch(() => null)
        pancakeUpdated = !!updated
      }

      await notifyKdxPaid({
        name: order.name, phone: order.phone,
        product: order.product, quantity: order.quantity, totalPrice: order.total_price,
        refCode, pancakeOrderId: order.pancake_order_id || undefined,
        pancakeUpdated,
      }).catch(console.error)

      return NextResponse.json({ success: true })
    }

    // ── Sét Xôi Cốm (SXC prefix) ─────────────────────────────────────────────
    const sxcMatch = content.match(/SXC[A-Z0-9]+/i)
    if (sxcMatch) {
      const refCode = sxcMatch[0].toUpperCase()
      const order = await getSxcOrderByRef(refCode)
      if (!order) return NextResponse.json({ success: true, message: 'SXC order not found' })
      if (order.payment_status === 'paid') return NextResponse.json({ success: true, message: 'Already paid' })

      const received = Number(payload.transferAmount) || 0
      if (received < order.total_price) {
        await notifyPaymentMismatch({ paymentRef: refCode, received, expected: order.total_price, content }).catch(console.error)
        return NextResponse.json({ success: true, message: 'Underpaid' })
      }

      await confirmSxcPayment(refCode)

      let pancakeUpdated = false
      if (order.pancake_order_id) {
        const updated = await updatePancakeOrderStatus(order.pancake_order_id, 9).catch(() => null)
        pancakeUpdated = !!updated
      }

      await notifySxcPaid({
        name: order.name, phone: order.phone,
        product: order.product, quantity: order.quantity, totalPrice: order.total_price,
        refCode, pancakeOrderId: order.pancake_order_id || undefined,
        pancakeUpdated,
      }).catch(console.error)

      return NextResponse.json({ success: true })
    }

    // ── Khóa học Dưa Cà Muối (DH prefix) ────────────────────────────────────
    const match = content.match(/DH[A-Z0-9]+/i)
    if (!match) {
      return NextResponse.json({ success: true, message: 'Not our transaction' })
    }

    const paymentRef = match[0].toUpperCase()
    const lead = await getLeadByRef(paymentRef)

    if (!lead) return NextResponse.json({ success: true, message: 'Lead not found' })
    if (lead.payment_status === 'paid') return NextResponse.json({ success: true, message: 'Already processed' })

    // KIỂM TRA SỐ TIỀN: phải chuyển đủ (cho phép dư) mới kích hoạt khóa học
    const received = Number(payload.transferAmount) || 0
    const expected = Number(lead.amount) || 299000
    if (received < expected) {
      // Chuyển thiếu (vd test 10k) → KHÔNG kích hoạt, cảnh báo admin xử lý tay
      await notifyPaymentMismatch({
        paymentRef,
        received,
        expected,
        content,
      }).catch(console.error)
      return NextResponse.json({ success: true, message: 'Underpaid - not activated' })
    }

    await confirmPayment(paymentRef)

    await Promise.all([
      sendCourseConfirmEmail({ name: lead.name, email: lead.email, amount: expected })
        .then(() => markEmailSent('course_leads', lead.id))
        .catch(console.error),
      notifyCourseLead({ name: lead.name, email: lead.email, phone: lead.phone, paymentRef, status: 'paid', amount: expected })
        .then(() => markTelegramSent(lead.id))
        .catch(console.error),
    ])

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[payment-webhook]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
