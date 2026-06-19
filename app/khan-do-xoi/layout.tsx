import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Khăn Đồ Xôi 1m×1m – Bếp Cô Hạ | Hacofood.vn',
  description: 'Khăn vải lưới hấp xôi chuyên dụng 1m×1m. Xôi chín đều, ráo hạt, không dính chảo. Dùng 1000+ lần. Chỉ 49.000đ – giao toàn quốc.',
  keywords: ['khăn đồ xôi', 'vải hấp xôi', 'đồ xôi', 'khăn lưới hấp', 'bếp cô hạ', 'hacofood'],
  openGraph: {
    title: 'Khăn Đồ Xôi 1m×1m – Chỉ 49.000đ | Bếp Cô Hạ',
    description: 'Xôi chín đều, ráo hạt, không dính chảo. Vải lưới chuyên dụng, dùng 1000+ lần. Giao toàn quốc.',
    url: 'https://hacofood.vn/khan-do-xoi',
    siteName: 'Bếp Cô Hạ – Hacofood.vn',
    locale: 'vi_VN',
    type: 'website',
    // opengraph-image.tsx tự động được dùng làm og:image
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
