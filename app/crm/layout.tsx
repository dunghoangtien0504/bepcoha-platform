import type { Metadata, Viewport } from 'next'
import { Be_Vietnam_Pro } from 'next/font/google'

const font = Be_Vietnam_Pro({ subsets: ['vietnamese', 'latin'], weight: ['400', '500', '600', '700'], display: 'swap' })

export const metadata: Metadata = {
  title: { default: 'HACO CRM', template: '%s · HACO CRM' },
  robots: { index: false, follow: false },
}
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#065f46' }

export default function CrmRootLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${font.className} min-h-screen bg-stone-100 text-stone-900`}>{children}</div>
}
