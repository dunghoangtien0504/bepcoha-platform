import { NextRequest } from 'next/server'
import { insertSxxOrder } from '@/lib/db'
import { notifySxxPending } from '@/lib/telegram'
import { createSxxPancakeOrder } from '@/lib/pancake'
import { generateSxxRef } from '@/lib/sepay'
import { placeLandingOrder } from '@/lib/landing-order'

// Giá theo bảng giá BG0926-001 (07/9/26)
export function POST(req: NextRequest) {
  return placeLandingOrder<'500g' | '1kg'>(req, {
    tag: 'sxx',
    variants: { '500g': { price: 100000, label: 'Sốt Xá Xíu 500g' }, '1kg': { price: 190000, label: 'Sốt Xá Xíu 1kg' } },
    defaultVariant: '500g', requireVariant: true, acceptsEmail: true,
    makeRef: generateSxxRef,
    createPos: d => createSxxPancakeOrder({ ...d, product: d.variant }),
    insert: insertSxxOrder,
    storedProduct: v => v,
    notifyPending: notifySxxPending,
  })
}
