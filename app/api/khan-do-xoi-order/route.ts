import { NextRequest, NextResponse } from 'next/server'
import { initDb, insertKdxOrder } from '@/lib/db'
import { notifyKdxPending } from '@/lib/telegram'
import { createKdxPancakeOrder } from '@/lib/pancake'
import { generateKdxRef, buildQRPayload } from '@/lib/sepay'

const PRICE = 49000
const PRODUCT_KEY = '1mx1m'
const PRODUCT_LABEL = 'Khăn Đồ Xôi 1m×1m'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, phone, address, quantity, note } = body

    if (!name?.trim() || !phone?.trim() || !address?.trim()) {
      return NextResponse.json({ error: 'Vui lòng điền đủ: Họ tên, Số điện thoại, Địa chỉ' }, { status: 400 })
    }
    if (!/^0\d{9}$/.test(phone.trim())) {
      return NextResponse.json({ error: 'Số điện thoại không hợp lệ (10 số, bắt đầu bằng 0)' }, { status: 400 })
    }
    const qty = parseInt(quantity) || 1
    if (qty < 1 || qty > 50) {
      return NextResponse.json({ error: 'Số lượng không hợp lệ' }, { status: 400 })
    }

    const totalPrice = PRICE * qty
    const refCode = generateKdxRef(phone.trim())

    await initDb()

    const pancakeResult = await createKdxPancakeOrder({
      name: name.trim(), phone: phone.trim(),
      email: '', address: address.trim(),
      product: 'lon',
      quantity: qty, totalPrice,
      note: note?.trim() || '',
    })
    const pancakeOrderId: string | undefined = pancakeResult?.data?.id
      ? String(pancakeResult.data.id)
      : pancakeResult?.id ? String(pancakeResult.id) : undefined

    await insertKdxOrder({
      refCode, pancakeOrderId,
      name: name.trim(), phone: phone.trim(),
      email: '', address: address.trim(),
      product: PRODUCT_KEY, quantity: qty, totalPrice,
      note: note?.trim() || '',
    })

    await notifyKdxPending({
      name: name.trim(), phone: phone.trim(), address: address.trim(),
      product: PRODUCT_LABEL, quantity: qty, totalPrice,
      refCode, pancakeOrderId,
      note: note?.trim() || '',
    }).catch(console.error)

    const qr = buildQRPayload(refCode, totalPrice)

    return NextResponse.json({ success: true, refCode, totalPrice, productLabel: PRODUCT_LABEL, qr })
  } catch (err) {
    console.error('[khan-do-xoi-order]', err)
    return NextResponse.json({ error: 'Có lỗi xảy ra, vui lòng thử lại' }, { status: 500 })
  }
}
