// Hàng bán trong Mini App (đợt v2-B). Giá do MÁY CHỦ quyết, không tin số tiền app gửi lên.
// Giá trùng bảng giá các trang sản phẩm (app/api/*-order/route.ts, BG0926-001); test mini-orders kiểm hai bên không lệch nhau.
// Mã variation POScake dùng đúng biến môi trường của trang sản phẩm.
// Giá chưa gồm phí ship (giống trang sản phẩm): nhân viên báo phí khi gọi xác nhận.

export interface CatalogItem {
  sku: string
  product: string // nhóm sản phẩm, trùng đường dẫn trang sản phẩm
  name: string
  variant: string
  price: number
  image: string
  variationEnv: string
}

export const CATALOG: CatalogItem[] = [
  { sku: 'sxc-set', product: '/set-xoi-com', name: 'Sét Nguyên Liệu Xôi Cốm Sen Dừa', variant: '1 sét', price: 148000,
    image: '/images/set-xoi-com/san-pham/z7728489506719_b50b067d25c4d1ac0ef7f35b9a862580.jpg', variationEnv: 'PANCAKE_VAR_SXC' },
  { sku: 'sxx-500g', product: '/sot-xa-xiu', name: 'Sốt Xá Xíu Bếp Cô Hạ', variant: '500g', price: 100000,
    image: '/images/sot-xa-xiu/san-pham/hero-sot-xa-xiu.jpg', variationEnv: 'PANCAKE_VAR_SXX_500G' },
  { sku: 'sxx-1kg', product: '/sot-xa-xiu', name: 'Sốt Xá Xíu Bếp Cô Hạ', variant: '1kg', price: 190000,
    image: '/images/sot-xa-xiu/san-pham/hero-sot-xa-xiu.jpg', variationEnv: 'PANCAKE_VAR_SXX_1KG' },
  { sku: 'stn-500g', product: '/sot-tron-nom', name: 'Sốt Trộn Nộm Bếp Cô Hạ', variant: '500g', price: 65000,
    image: '/images/sot-tron-nom/san-pham/710331986_1632696845246594_3341255585345294524_n.jpg', variationEnv: 'PANCAKE_VAR_500G' },
  { sku: 'stn-1kg', product: '/sot-tron-nom', name: 'Sốt Trộn Nộm Bếp Cô Hạ', variant: '1kg', price: 105000,
    image: '/images/sot-tron-nom/san-pham/710331986_1632696845246594_3341255585345294524_n.jpg', variationEnv: 'PANCAKE_VAR_1KG' },
  { sku: 'kdx', product: '/khan-do-xoi', name: 'Khăn Đồ Xôi Bếp Cô Hạ', variant: '1m×1m', price: 49000,
    image: '/images/khan-do-xoi/san-pham/724597989_1683075906108439_2952143396022032152_n.jpg', variationEnv: 'PANCAKE_KDX_VAR' },
]

const BY_SKU = new Map(CATALOG.map(i => [i.sku, i]))

export const findSku = (sku: string) => BY_SKU.get(sku)

export const variationId = (i: CatalogItem) => process.env[i.variationEnv] || ''

/** Phần app được thấy: không lộ tên biến môi trường. */
export function publicCatalog() {
  return CATALOG.map(({ sku, product, name, variant, price, image }) => ({ sku, product, name, variant, price, image }))
}
