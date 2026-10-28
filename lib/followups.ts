import type { PaymentFollowup } from './db'
import type { ProductHandler, ProductOrder } from './payment-handlers'

export const MAX_FOLLOWUP_ATTEMPTS = 8

/** Các thao tác bên ngoài được tiêm vào để test được mà không cần DB/mạng. */
export interface FollowupDeps {
  productHandlers: Record<string, ProductHandler>
  updatePosStatus: (orderId: string) => Promise<boolean>
  getCourseLead: (ref: string) => Promise<{ id: number; name: string; email: string; amount: number | null; email_sent: boolean } | undefined>
  sendCourseEmail: (lead: { name: string; email: string; amount: number }) => Promise<{ error?: { message: string } | null } | null | undefined>
  markCourseEmailSent: (id: number) => Promise<void>
  /** Đẩy lead quà sang Google Sheet (ném lỗi nếu thất bại). Không có = bỏ qua. */
  pushGiftLeadToSheet?: (id: number) => Promise<void>
}

/**
 * Xử lý 1 việc. Trả về true nếu xong (hoặc không còn gì để làm), NÉM LỖI nếu phải thử lại.
 * Việc chỉ đọc lại đơn theo mã, không lưu thông tin cá nhân trong hàng đợi.
 */
export async function processFollowup(f: Pick<PaymentFollowup, 'kind' | 'ref_code'>, d: FollowupDeps): Promise<boolean> {
  const [type, label] = f.kind.split(':')

  if (type === 'course_email') {
    const lead = await d.getCourseLead(f.ref_code)
    if (!lead || lead.email_sent) return true
    const res = await d.sendCourseEmail({ name: lead.name, email: lead.email, amount: Number(lead.amount) || 299000 })
    if (res?.error) throw new Error(`Resend: ${res.error.message}`)
    await d.markCourseEmailSent(lead.id)
    return true
  }

  if (type === 'sheet') {
    if (!d.pushGiftLeadToSheet) return true
    await d.pushGiftLeadToSheet(Number(f.ref_code))
    return true
  }

  const h = d.productHandlers[label]
  // Nhãn lạ = quên khai báo handler ở route: phải lỗi rõ ràng để còn bị báo động, không được im lặng coi là xong
  if (!h) throw new Error(`Không có handler cho ${f.kind}`)
  const order: ProductOrder | undefined = await h.getOrder(f.ref_code)
  if (!order) return true

  if (type === 'pancake') {
    if (!order.pancake_order_id) return true
    const ok = await d.updatePosStatus(order.pancake_order_id)
    if (!ok) throw new Error('POScake vẫn chưa cập nhật được')
    return true
  }

  if (type === 'notify') {
    let updated = false
    if (order.pancake_order_id) updated = await d.updatePosStatus(order.pancake_order_id).catch(() => false)
    await h.notifyPaid({
      name: order.name, phone: order.phone, product: order.product, quantity: order.quantity,
      totalPrice: order.total_price, refCode: f.ref_code,
      pancakeOrderId: order.pancake_order_id || undefined, pancakeUpdated: updated,
    })
    return true
  }
  return true
}

export interface RunDeps extends FollowupDeps {
  claim: (limit: number) => Promise<PaymentFollowup[]>
  done: (id: number) => Promise<void>
  failed: (id: number, error: string, attempts: number, giveUp: boolean) => Promise<void>
  escalate: (f: { kind: string; ref: string; attempts: number; error: string }) => Promise<void>
  markEscalated: (id: number) => Promise<void>
}

/**
 * Chạy các việc đến hạn. `f.attempts` đã được tính lần thử này (tăng ngay lúc lấy việc).
 * Quá số lần thì báo động 1 lần để người thật xử lý; báo không được thì lần sau báo lại.
 */
export async function runFollowups(d: RunDeps, limit = 10): Promise<{ done: number; retry: number; gaveUp: number }> {
  const due = await d.claim(limit)
  const out = { done: 0, retry: 0, gaveUp: 0 }

  const escalate = async (f: PaymentFollowup, error: string) => {
    if (f.escalated) return
    // chỉ đánh dấu đã báo khi báo thật sự đi được
    await d.escalate({ kind: f.kind, ref: f.ref_code, attempts: f.attempts, error })
      .then(() => d.markEscalated(f.id))
      .catch(e => console.error('[followups] Không báo động được:', e))
  }

  for (const f of due) {
    // đã bỏ cuộc từ trước nhưng chưa báo được, hoặc bị cắt giữa chừng quá nhiều lần
    if (f.status === 'failed' || f.attempts > MAX_FOLLOWUP_ATTEMPTS) {
      if (f.status !== 'failed') await d.failed(f.id, f.last_error || 'vượt số lần thử', f.attempts, true)
      out.gaveUp++
      await escalate(f, f.last_error || 'vượt số lần thử')
      continue
    }
    try {
      await processFollowup(f, d)
      await d.done(f.id)
      out.done++
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      const giveUp = f.attempts >= MAX_FOLLOWUP_ATTEMPTS
      await d.failed(f.id, msg, f.attempts, giveUp)
      if (giveUp) { out.gaveUp++; await escalate(f, msg) } else out.retry++
    }
  }
  return out
}
