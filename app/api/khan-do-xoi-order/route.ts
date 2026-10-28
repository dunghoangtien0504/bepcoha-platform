import { NextRequest } from 'next/server'
import { insertKdxOrder } from '@/lib/db'
import { notifyKdxPending } from '@/lib/telegram'
import { createKdxPancakeOrder } from '@/lib/pancake'
import { generateKdxRef } from '@/lib/sepay'
import { placeLandingOrder } from '@/lib/landing-order'

// Giá theo bảng giá BG0926-001 (07/9/26)
export function POST(req: NextRequest) {
  return placeLandingOrder(req, {
    tag: 'kdx',
    variants: { lon: { price: 49000, label: 'Khăn Đồ Xôi 1m×1m' } },
    defaultVariant: 'lon', requireVariant: false, acceptsEmail: false,
    makeRef: generateKdxRef,
    createPos: d => createKdxPancakeOrder({ ...d, product: 'lon' }),
    insert: insertKdxOrder,
    storedProduct: () => '1mx1m',
    notifyPending: notifyKdxPending,
  })
}
