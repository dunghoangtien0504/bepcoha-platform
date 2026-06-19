import { ImageResponse } from 'next/og'
import { readFile } from 'fs/promises'
import path from 'path'

export const runtime = 'nodejs'
export const alt = 'Khăn Đồ Xôi 1m×1m – Bếp Cô Hạ · 49.000đ'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  const imgDir = path.join(process.cwd(), 'public', 'images', 'khan-do-xoi')
  const [luoiData, xoiData] = await Promise.all([
    readFile(path.join(imgDir, 'san-pham', '724597989_1683075906108439_2952143396022032152_n.jpg')),
    readFile(path.join(imgDir, 'thanh-pham', '724485203_2296217747574178_5800612475932619747_n.jpg')),
  ])
  const luoiSrc = `data:image/jpeg;base64,${luoiData.toString('base64')}`
  const xoiSrc  = `data:image/jpeg;base64,${xoiData.toString('base64')}`

  return new ImageResponse(
    (
      <div style={{
        display: 'flex', width: 1200, height: 630,
        background: 'linear-gradient(135deg, #0D3B22 0%, #155C34 55%, #1E7A43 100%)',
        fontFamily: 'sans-serif', position: 'relative', overflow: 'hidden',
      }}>
        {/* Dot texture */}
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.05,
          backgroundImage: 'radial-gradient(circle, #fff 1.5px, transparent 1.5px)',
          backgroundSize: '28px 28px', display: 'flex',
        }} />

        {/* Left copy */}
        <div style={{
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
          padding: '55px 0 55px 65px', width: 620, position: 'relative', zIndex: 1,
        }}>
          {/* Brand */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)',
            borderRadius: 12, padding: '7px 16px', marginBottom: 24, alignSelf: 'flex-start',
          }}>
            <span style={{ color: '#86EFAC', fontSize: 14, fontWeight: 700 }}>Bếp Cô Hạ · Hacofood.vn</span>
          </div>

          {/* Badge */}
          <div style={{
            display: 'flex', background: '#DC2626', borderRadius: 50,
            padding: '5px 16px', marginBottom: 18, alignSelf: 'flex-start',
          }}>
            <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>Bí mật xôi ngon của người bán hàng rong</span>
          </div>

          {/* Headline */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 22 }}>
            <span style={{ color: '#fff', fontSize: 54, fontWeight: 900, lineHeight: 1.1 }}>Xôi Chín Đều, Ráo Hạt,</span>
            <span style={{ color: '#F0B429', fontSize: 54, fontWeight: 900, lineHeight: 1.1 }}>Không Dính!</span>
          </div>

          {/* Benefits */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 30 }}>
            {[
              'Vải lưới 1m×1m — hơi nước thoát đều khắp bề mặt',
              'May viền 4 cạnh chắc chắn — dùng 1000+ lần',
              'Giao toàn quốc · Đổi trả nếu lỗi sản xuất',
            ].map(b => (
              <div key={b} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ADE80', flexShrink: 0, display: 'flex' }} />
                <span style={{ color: '#BBF7D0', fontSize: 17 }}>{b}</span>
              </div>
            ))}
          </div>

          {/* Price + CTA */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 16,
            background: 'rgba(0,0,0,0.2)', border: '1.5px solid #F0B429',
            borderRadius: 18, padding: '14px 22px', alignSelf: 'flex-start',
          }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ color: '#86EFAC', fontSize: 12, fontWeight: 600 }}>CHỈ</span>
              <span style={{ color: '#fff', fontSize: 46, fontWeight: 900, lineHeight: 1 }}>49.000đ</span>
              <span style={{ color: '#6EE7B7', fontSize: 11, marginTop: 2 }}>chưa bao gồm phí vận chuyển</span>
            </div>
            <div style={{
              display: 'flex', background: '#F0B429', borderRadius: 14,
              padding: '12px 18px', flexDirection: 'column', alignItems: 'center',
            }}>
              <span style={{ color: '#0D3B22', fontSize: 17, fontWeight: 900, textAlign: 'center', lineHeight: 1.3 }}>
                ĐẶT HÀNG{'\n'}NGAY →
              </span>
            </div>
          </div>
        </div>

        {/* Right images */}
        <div style={{
          position: 'absolute', right: 0, top: 0, bottom: 0, width: 555,
          display: 'flex', flexDirection: 'column',
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={luoiSrc} style={{ width: '100%', height: 315, objectFit: 'cover', objectPosition: 'center top' }} alt="" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={xoiSrc}  style={{ width: '100%', height: 315, objectFit: 'cover', objectPosition: 'center' }} alt="" />
          {/* Left fade */}
          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0, width: 100,
            background: 'linear-gradient(to right, #0D3B22, transparent)', display: 'flex',
          }} />
          {/* Middle divider */}
          <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 2, background: '#155C34', opacity: 0.6, display: 'flex' }} />
        </div>

        {/* URL */}
        <div style={{ position: 'absolute', bottom: 20, left: 65, color: 'rgba(255,255,255,0.35)', fontSize: 13, display: 'flex' }}>
          hacofood.vn/khan-do-xoi
        </div>
      </div>
    ),
    { ...size }
  )
}
