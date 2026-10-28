// Luồng đặt hàng dùng chung cho các trang sản phẩm (Bước 0, HACO-LOOP/05):
//  - giá do MÁY CHỦ quyết (theo bảng giá BG0926-001), không tin số tiền trình duyệt gửi lên
//  - chống spam: tối đa 5 đơn / IP / 10 phút
//  - POScake lỗi hoặc treo quá 10 giây → vẫn LƯU đơn, tin Telegram báo "CHƯA CÓ ĐƠN TRÊN POSCAKE"
//  - Telegram lỗi → không làm hỏng đơn của khách
import { NextRequest, NextResponse } from 'next/server'
import { initDb } from './db'
import { buildQRPayload } from './sepay'
import { rateLimit, getClientIp } from './ratelimit'
import { normalizePhone } from './phone'

export interface LandingProductConfig<V extends string> {
  tag: string                                   // dùng cho log và khoá chống spam
  variants: Record<V, { price: number; label: string }>
  defaultVariant: V
  requireVariant: boolean                       // trang có cho chọn loại (500g/1kg) hay không
  acceptsEmail: boolean
  makeRef: (phone: string) => string
  createPos: (d: { name: string; phone: string; email: string; address: string; variant: V; quantity: number; totalPrice: number; note: string }) => Promise<unknown>
  insert: (d: { refCode: string; pancakeOrderId?: string; name: string; phone: string; email: string; address: string; product: string; quantity: number; totalPrice: number; note: string }) => Promise<unknown>
  storedProduct: (variant: V) => string        // giá trị cột product trong bảng đơn (giữ như dữ liệu cũ)
  notifyPending: (d: { name: string; phone: string; address: string; product: string; quantity: number; totalPrice: number; refCode: string; pancakeOrderId?: string; note: string }) => Promise<void>
}

const clean = (v: unknown, max = 300) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

function posId(r: unknown): string | undefined {
  const o = r as { data?: { id?: unknown }; id?: unknown } | null
  const id = o?.data?.id ?? o?.id
  return id === undefined || id === null ? undefined : String(id)
}

export async function placeLandingOrder<V extends string>(req: NextRequest, cfg: LandingProductConfig<V>) {
  try {
    if (!rateLimit(`${cfg.tag}-order:${getClientIp(req)}`, 5, 10 * 60 * 1000)) {
      return NextResponse.json({ error: 'Bạn đặt hàng quá nhanh, vui lòng thử lại sau ít phút.' }, { status: 429 })
    }
    const body = await req.json().catch(() => ({}))
    const name = clean(body.name, 100), phone = normalizePhone(clean(body.phone, 30)), address = clean(body.address, 500)
    const email = cfg.acceptsEmail ? clean(body.email, 200) : ''
    const note = clean(body.note, 500)
    if (!name || !phone || !address) return NextResponse.json({ error: 'Vui lòng điền đủ họ tên, số điện thoại và địa chỉ' }, { status: 400 })
    if (!/^0\d{9}$/.test(phone)) return NextResponse.json({ error: 'Số điện thoại không hợp lệ (10 số, bắt đầu bằng 0)' }, { status: 400 })
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: 'Email không hợp lệ' }, { status: 400 })

    const variantRaw = body.product
    if (cfg.requireVariant && !(typeof variantRaw === 'string' && variantRaw in cfg.variants)) {
      return NextResponse.json({ error: 'Sản phẩm không hợp lệ' }, { status: 400 })
    }
    const variant = (cfg.requireVariant ? variantRaw : cfg.defaultVariant) as V
    const qty = body.quantity === undefined || body.quantity === '' ? 1 : Number.parseInt(String(body.quantity), 10)
    if (!Number.isInteger(qty) || qty < 1 || qty > 50) return NextResponse.json({ error: 'Số lượng không hợp lệ' }, { status: 400 })

    const { price, label } = cfg.variants[variant]
    const totalPrice = price * qty
    const refCode = cfg.makeRef(phone)
    await initDb()

    // POScake: lỗi/treo thì bỏ qua (đã có timeout 10 giây trong lib/pancake.ts), đơn vẫn được lưu
    const pos = await cfg.createPos({ name, phone, email, address, variant, quantity: qty, totalPrice, note })
      .catch(err => { console.error(`[${cfg.tag}-order] POScake`, err); return null })
    const pancakeOrderId = posId(pos)

    await cfg.insert({ refCode, pancakeOrderId, name, phone, email, address, product: cfg.storedProduct(variant), quantity: qty, totalPrice, note })
    await cfg.notifyPending({ name, phone, address, product: label, quantity: qty, totalPrice, refCode, pancakeOrderId, note })
      .catch(err => console.error(`[${cfg.tag}-order] Telegram`, err))

    return NextResponse.json({ success: true, refCode, totalPrice, productLabel: label, qr: buildQRPayload(refCode, totalPrice) })
  } catch (err) {
    console.error(`[${cfg.tag}-order]`, err)
    return NextResponse.json({ error: 'Có lỗi xảy ra, vui lòng thử lại' }, { status: 500 })
  }
}
