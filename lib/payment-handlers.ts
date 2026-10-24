import { NextResponse } from 'next/server'
import { notifyPaymentMismatch, notifyPaymentUnmatched } from './telegram'
import { updatePancakeOrderStatus } from './pancake'
import { enqueueFollowup } from './db'

export interface ProductOrder {
  name: string; phone: string; product: string; quantity: number; total_price: number
  payment_status: string; pancake_order_id?: string | null
}

export interface ProductHandler {
  label: string
  getOrder: (ref: string) => Promise<ProductOrder | undefined>
  confirm: (ref: string) => Promise<boolean>
  notifyPaid: (d: {
    name: string; phone: string; product: string; quantity: number; totalPrice: number
    refCode: string; pancakeOrderId?: string; pancakeUpdated: boolean
  }) => Promise<void>
}

// ── Nhận diện mã đơn trong nội dung chuyển khoản ─────────────────────────────
// strict = đúng định dạng do generate*Ref tạo ra (không nuốt chữ thừa dính sau mã).
// loose  = dự phòng cho mã đơn cũ có định dạng khác; CHỈ dùng để tra đơn, không dùng để báo động.
const PRODUCT_REFS = [
  { label: 'STN', strict: /STN\d{10}/i, loose: /STN[A-Z0-9]+/i },
  { label: 'KDX', strict: /KDX\d{10}/i, loose: /KDX[A-Z0-9]+/i },
  { label: 'SXC', strict: /SXC\d{10}/i, loose: /SXC[A-Z0-9]+/i },
  { label: 'SXX', strict: /SXX\d{10}[0-9A-F]{4}/i, loose: /SXX[A-Z0-9]+/i },
  { label: 'HMA', strict: /HMA\d{10}[0-9A-F]{4}/i, loose: /HMA[A-Z0-9]+/i },
]
const COURSE_REF = { strict: /DH\d{10}/i, loose: /DH[A-Z0-9]+/i }

export interface RefMatch { label: string; ref: string; strict: boolean }

export function matchProductRef(content: string): RefMatch | null {
  // Quét mã chuẩn của MỌI loại trước, để chữ lạ giống "STN…" không che mất mã KDX/SXC/SXX chuẩn phía sau
  for (const p of PRODUCT_REFS) {
    const s = content.match(p.strict)
    if (s) return { label: p.label, ref: s[0].toUpperCase(), strict: true }
  }
  for (const p of PRODUCT_REFS) {
    const l = content.match(p.loose)
    if (l) return { label: p.label, ref: l[0].toUpperCase(), strict: false }
  }
  return null
}

export function matchCourseRef(content: string): RefMatch | null {
  const s = content.match(COURSE_REF.strict)
  if (s) return { label: 'DH', ref: s[0].toUpperCase(), strict: true }
  const l = content.match(COURSE_REF.loose)
  if (l) return { label: 'DH', ref: l[0].toUpperCase(), strict: false }
  return null
}

/**
 * Xử lý tiền chuyển khoản cho 1 đơn sản phẩm.
 * alertIfMissing: chỉ báo động "có tiền nhưng không thấy đơn" khi mã khớp định dạng chuẩn
 * (tránh báo nhầm với chuyển khoản không liên quan có chứa chữ như "dhung").
 */
export async function handleProductPayment(
  h: ProductHandler, refCode: string, received: number, content: string, alertIfMissing = true,
  enqueue: (kind: string, ref: string) => Promise<void> = enqueueFollowup,
) {
  const order = await h.getOrder(refCode)
  if (!order) {
    if (alertIfMissing) {
      await notifyPaymentUnmatched({ paymentRef: refCode, received, content }).catch(console.error)
    }
    return NextResponse.json({ success: true, message: `${h.label} order not found` })
  }
  if (order.payment_status === 'paid') return NextResponse.json({ success: true, message: 'Already paid' })

  if (received < order.total_price) {
    await notifyPaymentMismatch({ paymentRef: refCode, received, expected: order.total_price, content }).catch(console.error)
    return NextResponse.json({ success: true, message: 'Underpaid' })
  }

  // Nguyên tử: chỉ tiếp tục nếu CHÍNH request này chuyển đơn sang 'paid'
  // (SePay có thể gọi webhook trùng lặp cho cùng giao dịch)
  const justConfirmed = await h.confirm(refCode)
  if (!justConfirmed) return NextResponse.json({ success: true, message: 'Already paid' })

  // Cập nhật POScake sang "Chờ chuyển hàng" (status 9)
  let pancakeUpdated = false
  if (order.pancake_order_id) {
    const updated = await updatePancakeOrderStatus(order.pancake_order_id, 9).catch(() => null)
    pancakeUpdated = !!updated
    // Đã nhận tiền nhưng POScake chưa cập nhật: hẹn thử lại thay vì để nhân viên tự nhớ
    if (!pancakeUpdated) await enqueue(`pancake:${h.label}`, refCode).catch(console.error)
  }

  await h.notifyPaid({
    name: order.name, phone: order.phone,
    product: order.product, quantity: order.quantity, totalPrice: order.total_price,
    refCode, pancakeOrderId: order.pancake_order_id || undefined,
    pancakeUpdated,
  }).catch(async err => {
    console.error(err)
    // Tin báo đơn đã trả tiền không tới được kho: hẹn gửi lại thay vì mất hẳn
    await enqueue(`notify:${h.label}`, refCode).catch(console.error)
  })

  return NextResponse.json({ success: true })
}
