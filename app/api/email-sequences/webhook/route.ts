import { NextRequest, NextResponse } from 'next/server'
import { initDb, pauseEmailSequence } from '@/lib/db'

/**
 * Webhook endpoint to pause email sequence when a gift lead makes a purchase
 * Called from course-form when a customer completes their transaction
 */
export async function POST(req: NextRequest) {
  try {
    await initDb()

    const { giftLeadId } = await req.json()

    if (!giftLeadId) {
      return NextResponse.json({ error: 'Missing giftLeadId' }, { status: 400 })
    }

    // Pause the email sequence for this gift lead
    await pauseEmailSequence(giftLeadId)

    return NextResponse.json({
      success: true,
      message: `Email sequence paused for lead ${giftLeadId}`,
    })
  } catch (err) {
    console.error('[email-sequences/webhook]', err)
    return NextResponse.json({ error: 'Failed to process webhook' }, { status: 500 })
  }
}
