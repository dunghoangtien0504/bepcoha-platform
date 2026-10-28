import { NextRequest, NextResponse } from 'next/server'
import { initDb, insertCourseLead, pauseEmailSequenceForEmail } from '@/lib/db'
import { generatePaymentRef, buildQRPayload } from '@/lib/sepay'
import { notifyCourseLead } from '@/lib/telegram'
import { coursePriceFor } from '@/lib/promo'
import { rateLimit, getClientIp } from '@/lib/ratelimit'
import { parseReferralCode } from '@/lib/loop'
import { normalizePhone } from '@/lib/phone'

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

export async function POST(req: NextRequest) {
  try {
    if (!rateLimit(`course-form:${getClientIp(req)}`, 5, 10 * 60 * 1000)) {
      return NextResponse.json({ error: 'Bạn gửi quá nhanh, vui lòng thử lại sau ít phút.' }, { status: 429 })
    }
    const body = await req.json().catch(() => ({}))
    const name = clean(body.name, 100), email = clean(body.email, 200), phone = normalizePhone(clean(body.phone, 30))
    if (!name || !email || !phone) return NextResponse.json({ error: 'Vui lòng điền đầy đủ thông tin' }, { status: 400 })
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: 'Email không hợp lệ' }, { status: 400 })
    if (!/^0\d{9}$/.test(phone)) return NextResponse.json({ error: 'Số điện thoại không hợp lệ (10 số, bắt đầu bằng 0)' }, { status: 400 })

    await initDb()
    const paymentRef = generatePaymentRef(phone)
    // Giá do máy chủ quyết: khuyến mãi 239k chỉ khi link Email 5 có chữ ký đúng email này và còn hạn
    const amount = coursePriceFor(email, { promo: body.promo, x: body.x, t: body.t })
    await insertCourseLead({ name, email, phone, paymentRef, amount, referredByCode: parseReferralCode(body.ref) })

    notifyCourseLead({ name, email, phone, paymentRef, status: 'pending', amount }).catch(console.error)

    // Lead quà đăng ký khoá: dừng chuỗi email — chỉ khi email khớp đúng lead đó (không cho người ngoài dừng chuỗi của người khác)
    const giftLeadId = Number(body.giftLeadId)
    if (Number.isInteger(giftLeadId) && giftLeadId > 0) {
      await pauseEmailSequenceForEmail(giftLeadId, email).catch(err => console.error('[course-form] pause sequence', err))
    }
    return NextResponse.json({ success: true, paymentRef, amount, qr: buildQRPayload(paymentRef, amount) })
  } catch (err) {
    console.error('[course-form]', err)
    return NextResponse.json({ error: 'Có lỗi xảy ra, vui lòng thử lại' }, { status: 500 })
  }
}
