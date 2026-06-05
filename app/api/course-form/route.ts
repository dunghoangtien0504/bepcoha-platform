import { NextRequest, NextResponse } from 'next/server'
import { initDb, insertCourseLead } from '@/lib/db'
import { generatePaymentRef, buildQRPayload } from '@/lib/sepay'
import { notifyCourseLead } from '@/lib/telegram'

export async function POST(req: NextRequest) {
  try {
    await initDb()
    const body = await req.json()
    const { name, email, phone, giftLeadId } = body

    if (!name?.trim() || !email?.trim() || !phone?.trim()) {
      return NextResponse.json({ error: 'Vui lòng điền đầy đủ thông tin' }, { status: 400 })
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Email không hợp lệ' }, { status: 400 })
    }

    const paymentRef = generatePaymentRef(phone.trim())
    const amount = 299000

    await insertCourseLead({ name: name.trim(), email: email.trim(), phone: phone.trim(), paymentRef, amount })

    const qr = buildQRPayload(paymentRef, amount)

    notifyCourseLead({ name: name.trim(), email: email.trim(), phone: phone.trim(), paymentRef, status: 'pending' })
      .catch(console.error)

    // If this came from a gift lead, pause their email sequence
    if (giftLeadId) {
      fetch(new URL('/api/email-sequences/webhook', req.nextUrl), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ giftLeadId }),
      }).catch(err => console.error('[course-form] Failed to pause email sequence:', err))
    }

    return NextResponse.json({ success: true, paymentRef, amount, qr })
  } catch (err) {
    console.error('[course-form]', err)
    return NextResponse.json({ error: 'Có lỗi xảy ra, vui lòng thử lại' }, { status: 500 })
  }
}
