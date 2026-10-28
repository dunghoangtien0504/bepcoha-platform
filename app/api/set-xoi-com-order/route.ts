import { NextRequest } from 'next/server'
import { insertSxcOrder } from '@/lib/db'
import { notifySxcPending } from '@/lib/telegram'
import { createSxcPancakeOrder } from '@/lib/pancake'
import { generateSxcRef } from '@/lib/sepay'
import { placeLandingOrder } from '@/lib/landing-order'

// Giá theo bảng giá BG0926-001 (07/9/26)
export function POST(req: NextRequest) {
  return placeLandingOrder(req, {
    tag: 'sxc',
    variants: { set: { price: 148000, label: 'Sét Nguyên Liệu Xôi Cốm Sen Dừa Bếp Cô Hạ' } },
    defaultVariant: 'set', requireVariant: false, acceptsEmail: false,
    makeRef: generateSxcRef,
    createPos: d => createSxcPancakeOrder(d),
    insert: insertSxcOrder,
    storedProduct: () => 'set-xoi-com',
    notifyPending: notifySxcPending,
  })
}
