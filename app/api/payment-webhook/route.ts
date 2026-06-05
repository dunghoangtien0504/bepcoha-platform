import { NextRequest, NextResponse } from 'next/server'
import { initDb, confirmPayment, getLeadByRef, markEmailSent, markTelegramSent } from '@/lib/db'
import { sendCourseConfirmEmail } from '@/lib/email'
import { notifyCourseLead } from '@/lib/telegram'
import { SepayWebhookPayload } from '@/lib/sepay'

export async function POST(req: NextRequest) {
  try {
    // SePay gửi header: "Authorization: Apikey YOUR_KEY"
    const authHeader = req.headers.get('Authorization') || ''
    const apiKey = authHeader.replace(/^Apikey\s+/i, '').trim()
    const expectedKey = process.env.SEPAY_API_KEY || ''
    if (expectedKey && apiKey !== expectedKey) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await initDb()
    const payload: SepayWebhookPayload = await req.json()

    const content = payload.content || ''
    const match = content.match(/DH[A-Z0-9]+/i)
    if (!match) {
      return NextResponse.json({ success: true, message: 'Not our transaction' })
    }

    const paymentRef = match[0].toUpperCase()
    const lead = await getLeadByRef(paymentRef)

    if (!lead) return NextResponse.json({ success: true, message: 'Lead not found' })
    if (lead.payment_status === 'paid') return NextResponse.json({ success: true, message: 'Already processed' })

    await confirmPayment(paymentRef)

    await Promise.all([
      sendCourseConfirmEmail({ name: lead.name, email: lead.email })
        .then(() => markEmailSent('course_leads', lead.id))
        .catch(console.error),
      notifyCourseLead({ name: lead.name, email: lead.email, phone: lead.phone, paymentRef, status: 'paid' })
        .then(() => markTelegramSent(lead.id))
        .catch(console.error),
    ])

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[payment-webhook]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
