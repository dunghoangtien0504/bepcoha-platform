import { NextRequest, NextResponse } from 'next/server'
import { initDb, insertSxxOrder } from '@/lib/db'
import { notifySxxPending } from '@/lib/telegram'
import { createSxxPancakeOrder } from '@/lib/pancake'
import { generateSxxRef, buildQRPayload } from '@/lib/sepay'
import { rateLimit, getClientIp } from '@/lib/ratelimit'

const PRICES: Record<string, number> = {
  '500g': 100000,
  '1kg': 190000,
}

const PRODUCT_LABELS: Record<string, string> = {
  '500g': 'Sốt Xá Xíu 500g',
  '1kg': 'Sốt Xá Xíu 1kg',
}

export async function POST(req: NextRequest) {
  try {
    // Chống spam: tối đa 5 đơn / IP / 10 phút
    const ip = getClientIp(req)
    if (!rateLimit(`sxx-order:${ip}`, 5, 10 * 60 * 1000)) {
      return NextResponse.json(
        { error: 'Bạn đặt hàng quá nhanh, vui lòng thử lại sau ít phút.' },
        { status: 429 },
      )
    }

    const body = await req.json()
    const { name, phone, email, address, product, quantity, note } = body

    if (!name?.trim() || !phone?.trim() || !address?.trim() || !product || !quantity) {
      return NextResponse.json({ error: 'Vui lòng điền đầy đủ thông tin' }, { status: 400 })
    }
    if (!/^0\d{9}$/.test(phone.trim())) {
      return NextResponse.json({ error: 'Số điện thoại không hợp lệ (10 số, bắt đầu bằng 0)' }, { status: 400 })
    }
    if (!['500g', '1kg'].includes(product)) {
      return NextResponse.json({ error: 'Sản phẩm không hợp lệ' }, { status: 400 })
    }
    const qty = parseInt(quantity)
    if (isNaN(qty) || qty < 1 || qty > 50) {
      return NextResponse.json({ error: 'Số lượng không hợp lệ' }, { status: 400 })
    }

    const unitPrice = PRICES[product]
    const totalPrice = unitPrice * qty
    const productLabel = PRODUCT_LABELS[product]
    const refCode = generateSxxRef(phone.trim())

    await initDb()

    // Tạo đơn POScake status 0 (Mới)
    const pancakeResult = await createSxxPancakeOrder({
      name: name.trim(), phone: phone.trim(),
      email: (email || '').trim(), address: address.trim(),
      product: product as '500g' | '1kg',
      quantity: qty, totalPrice,
      note: note?.trim() || '',
    })
    const pancakeOrderId: string | undefined = pancakeResult?.data?.id
      ? String(pancakeResult.data.id)
      : pancakeResult?.id ? String(pancakeResult.id) : undefined

    // Lưu Supabase
    await insertSxxOrder({
      refCode,
      pancakeOrderId,
      name: name.trim(), phone: phone.trim(),
      email: (email || '').trim(), address: address.trim(),
      product, quantity: qty, totalPrice,
      note: note?.trim() || '',
    })

    // Telegram: chưa thanh toán
    await notifySxxPending({
      name: name.trim(), phone: phone.trim(), address: address.trim(),
      product: productLabel, quantity: qty, totalPrice,
      refCode, pancakeOrderId,
      note: note?.trim() || '',
    }).catch(console.error)

    // QR chuyển khoản
    const qr = buildQRPayload(refCode, totalPrice)

    return NextResponse.json({
      success: true,
      refCode,
      totalPrice,
      productLabel,
      qr,
    })
  } catch (err) {
    console.error('[sot-xa-xiu-order]', err)
    return NextResponse.json({ error: 'Có lỗi xảy ra, vui lòng thử lại' }, { status: 500 })
  }
}
