import { NextRequest, NextResponse } from 'next/server'
import { initDb, insertGiftLead, markEmailSent, markGiftPendingConfirm, markGiftNoConsent } from '@/lib/db'
import { sendGiftEmail } from '@/lib/email'
import { notifyGiftLead } from '@/lib/telegram'
import { rateLimit, getClientIp } from '@/lib/ratelimit'
import { parseReferralCode, parseSegmentAnswer } from '@/lib/loop'
import { normalizePhone } from '@/lib/phone'
import { GIFT_CONSENT_TEXT } from '@/lib/consent-text'

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

/**
 * Nhận quà. Quà đã hứa luôn được gửi. Chuỗi email chăm sóc CHỈ chạy khi khách tự tick đồng ý VÀ bấm xác nhận trong thư
 * (đồng ý 2 bước, HACO-LOOP/15). Không tick → vẫn nhận quà, không vào chuỗi.
 */
export async function POST(req: NextRequest) {
  try {
    if (!rateLimit(`gift-form:${getClientIp(req)}`, 5, 10 * 60 * 1000)) {
      return NextResponse.json({ error: 'Bạn gửi quá nhanh, vui lòng thử lại sau ít phút.' }, { status: 429 })
    }
    const body = await req.json().catch(() => ({}))
    const name = clean(body.name, 100), email = clean(body.email, 200), phone = normalizePhone(clean(body.phone, 30))
    if (!name || !email || !phone) return NextResponse.json({ error: 'Vui lòng điền đầy đủ thông tin' }, { status: 400 })
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: 'Email không hợp lệ' }, { status: 400 })
    if (!/^0\d{9}$/.test(phone)) return NextResponse.json({ error: 'Số điện thoại không hợp lệ (10 số, bắt đầu bằng 0)' }, { status: 400 })
    const consent = body.consent === true

    await initDb()
    const id = await insertGiftLead({
      name, email, phone,
      consentText: consent ? GIFT_CONSENT_TEXT : undefined,
      segmentAnswer: parseSegmentAnswer(body.segment),
      referredByCode: parseReferralCode(body.ref),
    })

    // Quà là thư giao dịch: vẫn gửi; Resend trả {error} cũng coi là lỗi (không đánh dấu đã gửi)
    const res = await sendGiftEmail({ name, email, askConfirm: consent })
    if (res && 'error' in res && res.error) throw new Error(`Resend: ${res.error.message}`)
    await markEmailSent('gift_leads', id)
    if (consent) await markGiftPendingConfirm(id)
    else await markGiftNoConsent(id)

    await notifyGiftLead({ name, email, phone }).catch(err => console.error('[gift-form] Telegram', err))
    return NextResponse.json({ success: true, giftLeadId: id, confirmNeeded: consent })
  } catch (err) {
    console.error('[gift-form]', err)
    return NextResponse.json({ error: 'Có lỗi xảy ra, vui lòng thử lại' }, { status: 500 })
  }
}
