// Bảng xử lý thanh toán cho từng sản phẩm bán trên web (dùng chung cho webhook SePay và hàng đợi thử lại).
// Thêm sản phẩm mới: thêm 1 dòng ở đây + mẫu mã ở PRODUCT_REFS (lib/payment-handlers.ts).
import type { ProductHandler, ProductOrder } from './payment-handlers'
import {
  getStnOrderByRef, confirmStnPayment, getKdxOrderByRef, confirmKdxPayment,
  getSxcOrderByRef, confirmSxcPayment, getSxxOrderByRef, confirmSxxPayment,
} from './db'
import { notifyStnPaid, notifyKdxPaid, notifySxcPaid, notifySxxPaid } from './telegram'
import { getMiniOrderByRef, confirmMiniPayment, notifyMiniPaid } from './mini/orders'

const asOrder = (o: unknown) => (o ?? undefined) as ProductOrder | undefined

export const PRODUCT_HANDLERS: Record<string, ProductHandler> = {
  STN: { label: 'STN', getOrder: async r => asOrder(await getStnOrderByRef(r)), confirm: confirmStnPayment, notifyPaid: notifyStnPaid },
  KDX: { label: 'KDX', getOrder: async r => asOrder(await getKdxOrderByRef(r)), confirm: confirmKdxPayment, notifyPaid: notifyKdxPaid },
  SXC: { label: 'SXC', getOrder: async r => asOrder(await getSxcOrderByRef(r)), confirm: confirmSxcPayment, notifyPaid: notifySxcPaid },
  SXX: { label: 'SXX', getOrder: async r => asOrder(await getSxxOrderByRef(r)), confirm: confirmSxxPayment, notifyPaid: notifySxxPaid },
  HMA: { label: 'HMA', getOrder: async r => asOrder(await getMiniOrderByRef(r)), confirm: confirmMiniPayment, notifyPaid: notifyMiniPaid },
}
