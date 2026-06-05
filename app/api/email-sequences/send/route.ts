import { NextRequest, NextResponse } from 'next/server'
import { initDb, getGiftLeadsPendingEmails, updateGiftLeadSequence } from '@/lib/db'
import {
  sendGiftSequenceEmail1,
  sendGiftSequenceEmail2,
  sendGiftSequenceEmail3,
  sendGiftSequenceEmail4,
  sendGiftSequenceEmail5,
} from '@/lib/email'

// Hỗ trợ cả GET (cron-job.org) và POST
export async function GET(req: NextRequest) {
  return handleSequence(req)
}
export async function POST(req: NextRequest) {
  return handleSequence(req)
}

async function handleSequence(req: NextRequest) {
  try {
    // API key protection
    const apiKey = req.headers.get('x-api-key')
    const expectedKey = process.env.EMAIL_SEQUENCE_API_KEY || 'hacofood_email_2026'
    if (apiKey !== expectedKey) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await initDb()
    const pendingLeads = await getGiftLeadsPendingEmails()
    const results = []

    for (const lead of pendingLeads) {
      try {
        let emailFn: ((data: { name: string; email: string }) => Promise<any>) | null = null
        let nextStatus = ''
        let nextEmailAt: Date | undefined

        const DAY = 24 * 60 * 60 * 1000

        // Sequence:
        // Email 1: gửi 1 ngày sau đăng ký (next_email_at set khi insert lead)
        // Email 2: gửi 2 ngày sau Email 1
        // Email 3: gửi 1 ngày sau Email 2
        // Email 4: gửi 1 ngày sau Email 3
        // Email 5: gửi 2 ngày sau Email 4

        if (lead.email_sequence_status === 'pending_email1') {
          emailFn = sendGiftSequenceEmail1
          nextStatus = 'pending_email2'
          nextEmailAt = new Date(Date.now() + 2 * DAY)
        } else if (lead.email_sequence_status === 'pending_email2') {
          emailFn = sendGiftSequenceEmail2
          nextStatus = 'pending_email3'
          nextEmailAt = new Date(Date.now() + 1 * DAY)
        } else if (lead.email_sequence_status === 'pending_email3') {
          emailFn = sendGiftSequenceEmail3
          nextStatus = 'pending_email4'
          nextEmailAt = new Date(Date.now() + 1 * DAY)
        } else if (lead.email_sequence_status === 'pending_email4') {
          emailFn = sendGiftSequenceEmail4
          nextStatus = 'pending_email5'
          nextEmailAt = new Date(Date.now() + 2 * DAY)
        } else if (lead.email_sequence_status === 'pending_email5') {
          emailFn = sendGiftSequenceEmail5
          nextStatus = 'completed'
          nextEmailAt = undefined
        } else {
          continue
        }

        if (!emailFn) continue

        await emailFn({ name: lead.name, email: lead.email })
        await updateGiftLeadSequence(lead.id, nextStatus, nextEmailAt)

        results.push({ id: lead.id, email: lead.email, status: nextStatus, success: true })
        console.log(`[email-sequence] Sent → ${nextStatus} for ${lead.email}`)
      } catch (err) {
        console.error(`[email-sequence] Failed for lead ${lead.id}:`, err)
        results.push({ id: lead.id, email: lead.email, success: false, error: String(err) })
      }
    }

    return NextResponse.json({ success: true, totalProcessed: pendingLeads.length, results })
  } catch (err) {
    console.error('[email-sequences/send]', err)
    return NextResponse.json({ error: 'Failed to process email sequence' }, { status: 500 })
  }
}
