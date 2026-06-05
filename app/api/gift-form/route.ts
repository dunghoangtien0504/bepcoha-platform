import { NextRequest, NextResponse } from 'next/server'
import { initDb, insertGiftLead, markEmailSent, updateGiftLeadSequence } from '@/lib/db'
import { sendGiftEmail } from '@/lib/email'
import { notifyGiftLead } from '@/lib/telegram'

export async function POST(req: NextRequest) {
  try {
    await initDb()
    const body = await req.json()
    const { name, email, phone } = body

    if (!name?.trim() || !email?.trim() || !phone?.trim()) {
      return NextResponse.json({ error: 'Vui lòng điền đầy đủ thông tin' }, { status: 400 })
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Email không hợp lệ' }, { status: 400 })
    }

    const id = await insertGiftLead({ name: name.trim(), email: email.trim(), phone: phone.trim() })

    // Chờ email gửi xong + update flag trước khi return
    await Promise.all([
      sendGiftEmail({ name: name.trim(), email: email.trim() })
        .then(() => markEmailSent('gift_leads', id))
        .catch(err => {
          console.error('[gift-form] Email send error:', err)
          throw err
        }),
      notifyGiftLead({ name: name.trim(), email: email.trim(), phone: phone.trim() })
        .catch(err => console.error('[gift-form] Telegram notify error:', err)),
    ])

    // Khởi tạo chuỗi email nurture - Email 1 gửi sau 1 ngày
    const nextEmail1At = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000) // +1 ngày
    await updateGiftLeadSequence(id, 'pending_email1', nextEmail1At)

    return NextResponse.json({ success: true, giftLeadId: id })
  } catch (err) {
    console.error('[gift-form]', err)
    return NextResponse.json({ error: 'Có lỗi xảy ra, vui lòng thử lại' }, { status: 500 })
  }
}
