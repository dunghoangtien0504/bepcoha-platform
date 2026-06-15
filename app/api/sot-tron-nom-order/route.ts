import { NextRequest, NextResponse } from 'next/server'
import { notifyOrder } from '@/lib/telegram'
import { createPancakeOrder } from '@/lib/pancake'

const PRICES: Record<string, number> = {
  '500g': 65000,
  '1kg': 105000,
}

export async function POST(req: NextRequest) {
  try {
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
    const productLabel = product === '500g'
      ? `Sốt Trộn Nộm 500g (${unitPrice.toLocaleString('vi-VN')}đ/chai)`
      : `Sốt Trộn Nộm 1kg (${unitPrice.toLocaleString('vi-VN')}đ/chai)`

    const orderData = {
      name: name.trim(),
      phone: phone.trim(),
      email: (email || '').trim(),
      address: address.trim(),
      product: product as '500g' | '1kg',
      quantity: qty,
      totalPrice,
      note: note?.trim() || '',
    }

    // Gửi song song: Telegram + POScake (không chặn nhau)
    await Promise.allSettled([
      notifyOrder({ ...orderData, product: `${productLabel} x${qty}` }),
      createPancakeOrder(orderData),
    ])

    return NextResponse.json({ success: true, totalPrice, productLabel })
  } catch (err) {
    console.error('[sot-tron-nom-order]', err)
    return NextResponse.json({ error: 'Có lỗi xảy ra, vui lòng thử lại' }, { status: 500 })
  }
}
