import { NextRequest, NextResponse } from 'next/server'
import { initDb, getGiftLeadsPendingEmails, updateGiftLeadSequence } from '@/lib/db'
import {
  sendGiftSequenceEmail1,
  sendGiftSequenceEmail2,
  sendGiftSequenceEmail3,
  sendGiftSequenceEmail4,
  sendGiftSequenceEmail5,
} from '@/lib/email'

export async function POST(req: NextRequest) {
  try {
    await initDb()

    // Basic API key protection
    const apiKey = req.headers.get('x-api-key')
    const expectedKey = process.env.EMAIL_SEQUENCE_API_KEY
    if (!expectedKey || apiKey !== expectedKey) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const pendingLeads = await getGiftLeadsPendingEmails()
    const results = []

    for (const lead of pendingLeads) {
      try {
        let emailFunction
        let nextStatus: string
        let nextEmailAt: Date | undefined

        // Determine which email to send based on current status
        if (lead.email_sequence_status === 'pending_email1') {
          emailFunction = sendGiftSequenceEmail1
          nextStatus = 'email1_sent'
          nextEmailAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) // +2 days
        } else if (lead.email_sequence_status === 'pending_email2') {
          emailFunction = sendGiftSequenceEmail2
          nextStatus = 'email2_sent'
          nextEmailAt = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000) // +1 day
        } else if (lead.email_sequence_status === 'pending_email3') {
          emailFunction = sendGiftSequenceEmail3
          nextStatus = 'email3_sent'
          nextEmailAt = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000) // +1 day
        } else if (lead.email_sequence_status === 'pending_email4') {
          emailFunction = sendGiftSequenceEmail4
          nextStatus = 'email4_sent'
          nextEmailAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) // +2 days
        } else if (lead.email_sequence_status === 'email4_sent' && !lead.email_sequence_paused) {
          // Send email 5 after email 4 is sent
          emailFunction = sendGiftSequenceEmail5
          nextStatus = 'email5_sent'
          nextEmailAt = undefined // This is the last email
        } else {
          continue // Skip if not in expected state
        }

        if (!emailFunction) continue

        // Send email
        await emailFunction({ name: lead.name, email: lead.email })

        // Update sequence status
        if (nextEmailAt) {
          await updateGiftLeadSequence(lead.id, `pending_email${getNextEmailNumber(nextStatus)}`, nextEmailAt)
        } else {
          // Mark as completed after last email
          await updateGiftLeadSequence(lead.id, 'completed')
        }

        results.push({
          id: lead.id,
          email: lead.email,
          status: nextStatus,
          success: true,
        })

        console.log(`[email-sequence] Sent ${nextStatus} to ${lead.email}`)
      } catch (err) {
        console.error(`[email-sequence] Failed for lead ${lead.id}:`, err)
        results.push({
          id: lead.id,
          email: lead.email,
          success: false,
          error: String(err),
        })
      }
    }

    return NextResponse.json({
      success: true,
      totalProcessed: pendingLeads.length,
      results,
    })
  } catch (err) {
    console.error('[email-sequences/send]', err)
    return NextResponse.json({ error: 'Failed to process email sequence' }, { status: 500 })
  }
}

// Helper to get next email number from status
function getNextEmailNumber(status: string): number {
  if (status === 'email1_sent') return 2
  if (status === 'email2_sent') return 3
  if (status === 'email3_sent') return 4
  if (status === 'email4_sent') return 5
  return 1
}
