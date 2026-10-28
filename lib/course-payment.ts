// Thanh toán khoá học (mã DH…): cùng nguyên tắc với đơn sản phẩm — xác nhận đúng 1 lần (nguyên tử),
// chuyển thiếu thì không kích hoạt, email/Telegram lỗi thì xếp hàng thử lại thay vì mất.
import { NextResponse } from 'next/server'
import { getLeadByRef, confirmPayment, markCourseEmailSent, markTelegramSent, enqueueFollowup } from './db'
import { sendCourseConfirmEmail } from './email'
import { notifyCourseLead, notifyPaymentMismatch, notifyPaymentUnmatched } from './telegram'

export interface CourseLeadLite { id: number; name: string; email: string; phone: string; amount: number | null; payment_status: string | null }

export interface CoursePaymentDeps {
  getLead: (ref: string) => Promise<CourseLeadLite | undefined>
  confirm: (ref: string) => Promise<boolean>
  sendEmail: (d: { name: string; email: string; amount: number }) => Promise<{ error?: { message: string } | null } | null | undefined>
  markEmailSent: (id: number) => Promise<void>
  notifyPaid: (d: { name: string; email: string; phone: string; paymentRef: string; amount: number }) => Promise<void>
  markTelegramSent: (id: number) => Promise<void>
  mismatch: (d: { paymentRef: string; received: number; expected: number; content: string }) => Promise<void>
  unmatched: (d: { paymentRef: string; received: number; content: string }) => Promise<void>
  enqueue: (kind: string, ref: string) => Promise<void>
}

export const defaultCourseDeps: CoursePaymentDeps = {
  getLead: async r => (await getLeadByRef(r)) as CourseLeadLite | undefined,
  confirm: confirmPayment,
  sendEmail: sendCourseConfirmEmail as CoursePaymentDeps['sendEmail'],
  markEmailSent: markCourseEmailSent,
  notifyPaid: d => notifyCourseLead({ ...d, status: 'paid' }),
  markTelegramSent,
  mismatch: notifyPaymentMismatch,
  unmatched: notifyPaymentUnmatched,
  enqueue: (k, r) => enqueueFollowup(k, r),
}

export async function handleCoursePayment(ref: string, received: number, content: string, strict: boolean, d: CoursePaymentDeps = defaultCourseDeps) {
  const lead = await d.getLead(ref)
  if (!lead) {
    if (strict) await d.unmatched({ paymentRef: ref, received, content }).catch(console.error)
    return NextResponse.json({ success: true, message: 'Lead not found' })
  }
  if (lead.payment_status === 'paid') return NextResponse.json({ success: true, message: 'Already processed' })
  const expected = Number(lead.amount) || 299000
  if (received < expected) {
    // Chuyển thiếu (vd thử 10k) → KHÔNG kích hoạt, báo người thật xử lý
    await d.mismatch({ paymentRef: ref, received, expected, content }).catch(console.error)
    return NextResponse.json({ success: true, message: 'Underpaid - not activated' })
  }
  // Nguyên tử: SePay gọi trùng thì chỉ 1 request đi tiếp
  if (!(await d.confirm(ref))) return NextResponse.json({ success: true, message: 'Already processed' })

  const email = d.sendEmail({ name: lead.name, email: lead.email, amount: expected })
    .then(async res => {
      if (res?.error) throw new Error(`Resend: ${res.error.message}`)
      await d.markEmailSent(lead.id)
    })
    .catch(async err => { console.error('[course-payment] email', err); await d.enqueue('course_email', ref).catch(console.error) })
  const tele = d.notifyPaid({ name: lead.name, email: lead.email, phone: lead.phone, paymentRef: ref, amount: expected })
    .then(() => d.markTelegramSent(lead.id))
    .catch(err => console.error('[course-payment] telegram', err))
  await Promise.all([email, tele])
  return NextResponse.json({ success: true })
}
