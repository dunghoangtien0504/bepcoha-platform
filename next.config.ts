import type { NextConfig } from "next";

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
]

const nextConfig: NextConfig = {
  // Mini App (bản build tĩnh của phiên "Mini app Zalo OA") phục vụ ở /m: mọi đường dẫn con trả về index.html
  async rewrites() {
    return [
      { source: '/m', destination: '/m/index.html' },   // link in trên thẻ QR: /m?b=<MÃ_LÔ>
      { source: '/m/:path((?!assets/).*)', destination: '/m/index.html' },
    ]
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'qr.sepay.vn' },
      { protocol: 'https', hostname: 'api.qrserver.com' },
    ],
  },
};

export default nextConfig;
