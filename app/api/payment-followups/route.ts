import { NextRequest, NextResponse } from 'next/server'
import { initDb, claimDueFollowups, markFollowupDone, markFollowupFailed, markFollowupEscalated, getLeadByRef, markCourseEmailSent } from '@/lib/db'
import { checkApiKey } from '@/lib/internal-auth'
import { runFollowups } from '@/lib/followups'
import { PRODUCT_HANDLERS } from '@/lib/product-handlers'
import { updatePancakeOrderStatus } from '@/lib/pancake'
import { sendCourseConfirmEmail } from '@/lib/email'
import { notifyFollowupFailed } from '@/lib/telegram'

/**
 * Hàng đợi việc sau thanh toán (chạy mỗi 10–15 phút, gọi kèm header x-api-key = FOLLOWUP_API_KEY):
 * gửi lại tin Telegram báo kho, cập nhật lại POScake, gửi lại email xác nhận khoá học.
 * Thử tối đa 8 lần, quá thì báo động Telegram 1 lần cho người thật xử lý.
 */
async function handle(req: NextRequest) {
  const auth = checkApiKey(req, 'FOLLOWUP_API_KEY')
  if (auth === 'misconfigured') return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  if (auth !== 'ok') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    await initDb()
    const out = await runFollowups({
      productHandlers: PRODUCT_HANDLERS,
      updatePosStatus: async id => !!(await updatePancakeOrderStatus(id, 9).catch(() => null)),
      getCourseLead: async ref => {
        const l = await getLeadByRef(ref)
        return l ? { id: l.id, name: l.name, email: l.email, amount: l.amount ?? null, email_sent: !!l.email_sent } : undefined
      },
      sendCourseEmail: lead => sendCourseConfirmEmail(lead) as ReturnType<Parameters<typeof runFollowups>[0]['sendCourseEmail']>,
      markCourseEmailSent,
      claim: claimDueFollowups,
      done: markFollowupDone,
      failed: markFollowupFailed,
      escalate: notifyFollowupFailed,
      markEscalated: markFollowupEscalated,
    }, 20)
    return NextResponse.json({ success: true, ...out })
  } catch (err) {
    console.error('[payment-followups]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export const GET = handle
export const POST = handle
