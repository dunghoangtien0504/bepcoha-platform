import { NextRequest } from 'next/server'
import { insertStnOrder } from '@/lib/db'
import { notifyStnPending } from '@/lib/telegram'
import { createPancakeOrder } from '@/lib/pancake'
import { generateStnRef } from '@/lib/sepay'
import { placeLandingOrder } from '@/lib/landing-order'

// Giá theo bảng giá BG0926-001 (07/9/26)
export function POST(req: NextRequest) {
  return placeLandingOrder<'500g' | '1kg'>(req, {
    tag: 'stn',
    variants: { '500g': { price: 65000, label: 'Sốt Trộn Nộm 500g' }, '1kg': { price: 105000, label: 'Sốt Trộn Nộm 1kg' } },
    defaultVariant: '500g', requireVariant: true, acceptsEmail: true,
    makeRef: generateStnRef,
    createPos: d => createPancakeOrder({ ...d, product: d.variant }),
    insert: insertStnOrder,
    storedProduct: v => v,
    notifyPending: notifyStnPending,
  })
}
