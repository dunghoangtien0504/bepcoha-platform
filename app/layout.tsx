import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });

export const metadata: Metadata = {
  title: "Bếp Cô Hạ | Hacofood.vn",
  description:
    "Bếp Cô Hạ – Nguyên liệu & khóa học nấu ăn online. Sốt Trộn Nộm, Sét Xôi Cốm, Khăn Đồ Xôi, Khóa Dưa Cà Muối.",
  keywords: ["bếp cô hạ", "hacofood", "nấu ăn", "sốt trộn nộm", "xôi cốm"],
  openGraph: {
    title: "Bếp Cô Hạ | Hacofood.vn",
    description: "Nguyên liệu & khóa học nấu ăn online từ Bếp Cô Hạ",
    url: "https://hacofood.vn",
    siteName: "Hacofood.vn",
    locale: "vi_VN",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={geist.variable}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
