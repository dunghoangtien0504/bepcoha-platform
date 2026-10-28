import { NextRequest, NextResponse } from 'next/server'
import { initDb, pauseEmailSequenceForEmail } from '@/lib/db'
import { checkApiKey } from '@/lib/internal-auth'

/**
 * Dừng chuỗi email của 1 lead quà (vd lead đã mua khoá qua kênh khác).
 * K4: bắt buộc khoá API và email phải khớp đúng lead — không cho người ngoài dừng chuỗi của người khác.
 * (Form khoá học trên web gọi thẳng database, không qua route này.)
 */
export async function POST(req: NextRequest) {
  const auth = checkApiKey(req, 'EMAIL_SEQUENCE_API_KEY')
  if (auth === 'misconfigured') return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  if (auth !== 'ok') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { giftLeadId, email } = await req.json().catch(() => ({}))
    const id = Number(giftLeadId)
    if (!Number.isInteger(id) || id <= 0 || typeof email !== 'string' || !email.trim()) {
      return NextResponse.json({ error: 'Cần giftLeadId và email' }, { status: 400 })
    }
    await initDb()
    const paused = await pauseEmailSequenceForEmail(id, email)
    return NextResponse.json({ success: true, paused })
  } catch (err) {
    console.error('[email-sequences/webhook]', err)
    return NextResponse.json({ error: 'Failed to process webhook' }, { status: 500 })
  }
}
