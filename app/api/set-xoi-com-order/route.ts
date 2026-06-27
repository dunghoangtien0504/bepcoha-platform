import { NextRequest, NextResponse } from 'next/server'
import { initDb, insertSxcOrder } from '@/lib/db'
import { notifySxcPending } from '@/lib/telegram'
import { createSxcPancakeOrder } from '@/lib/pancake'
import { generateSxcRef, buildQRPayload } from '@/lib/sepay'

const PRICE = 139000
const PRODUCT_KEY = 'set-xoi-com'
const PRODUCT_LABEL = 'Sét Nguyên Liệu Xôi Cốm Sen Dừa Bếp Cô Hạ'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, phone, address, quantity, note } = body

    if (!name?.trim() || !phone?.trim() || !address?.trim()) {
      return NextResponse.json({ error: 'Vui lòng điền đủ họ tên, số điện thoại và địa chỉ' }, { status: 400 })
    }
    if (!/^0\d{9}$/.test(phone.trim())) {
      return NextResponse.json({ error: 'Số điện thoại không hợp lệ (10 số, bắt đầu bằng 0)' }, { status: 400 })
    }
    const qty = parseInt(quantity) || 1
    if (qty < 1 || qty > 50) {
      return NextResponse.json({ error: 'Số lượng không hợp lệ' }, { status: 400 })
    }

    const totalPrice = PRICE * qty
    const refCode = generateSxcRef(phone.trim())

    await initDb()

    const pancakeResult = await createSxcPancakeOrder({
      name: name.trim(), phone: phone.trim(),
      email: '', address: address.trim(),
      quantity: qty, totalPrice,
      note: note?.trim() || '',
    }).catch(() => null)

    const pancakeOrderId: string | undefined = pancakeResult?.data?.id
      ? String(pancakeResult.data.id)
      : pancakeResult?.id ? String(pancakeResult.id) : undefined

    await insertSxcOrder({
      refCode, pancakeOrderId,
      name: name.trim(), phone: phone.trim(),
      email: '', address: address.trim(),
      product: PRODUCT_KEY, quantity: qty, totalPrice,
      note: note?.trim() || '',
    })

    await notifySxcPending({
      name: name.trim(), phone: phone.trim(), address: address.trim(),
      product: PRODUCT_LABEL, quantity: qty, totalPrice,
      refCode, pancakeOrderId,
      note: note?.trim() || '',
    }).catch(console.error)

    const qr = buildQRPayload(refCode, totalPrice)

    return NextResponse.json({ success: true, refCode, totalPrice, productLabel: PRODUCT_LABEL, qr })
  } catch (err) {
    console.error('[set-xoi-com-order]', err)
    return NextResponse.json({ error: 'Có lỗi xảy ra, vui lòng thử lại' }, { status: 500 })
  }
}
