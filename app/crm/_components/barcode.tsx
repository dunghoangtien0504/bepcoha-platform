// Mã vạch Code 128 (bộ B) cho voucher mua hàng nội bộ (khung hình B2 bài 12 · 4:06). Tự vẽ SVG, không cần thư viện.
// Bảng mẫu chuẩn: mỗi ký tự 6 vạch/khoảng, tổng 11 mô-đun; ký tự dừng 7 phần, 13 mô-đun.
export const CODE128 = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
]
const START_B = 104, STOP = 106

/** Chuỗi độ rộng (vạch, khoảng, vạch…) của cả mã: Start B + dữ liệu + checksum + Stop. Ký tự ngoài ASCII 32–126 bị bỏ. */
export function code128B(text: string): number[] {
  const vals = [...text].map(ch => ch.charCodeAt(0) - 32).filter(v => v >= 0 && v <= 94)
  const check = (START_B + vals.reduce((s, v, i) => s + v * (i + 1), 0)) % 103
  return [START_B, ...vals, check, STOP].flatMap(v => [...CODE128[v]].map(Number))
}

export function Barcode({ value, height = 64, className = '' }: { value: string; height?: number; className?: string }) {
  const widths = code128B(value)
  const quiet = 10
  const total = widths.reduce((a, b) => a + b, 0) + quiet * 2
  let x = quiet
  const bars: { x: number; w: number }[] = []
  widths.forEach((w, i) => { if (i % 2 === 0) bars.push({ x, w }); x += w })
  return (
    <svg viewBox={`0 0 ${total} ${height}`} preserveAspectRatio="none" className={className} role="img" aria-label={`Mã vạch ${value}`} style={{ shapeRendering: 'crispEdges' }}>
      <rect width={total} height={height} fill="#fff" />
      {bars.map((b, i) => <rect key={i} x={b.x} y={0} width={b.w} height={height} fill="#111" />)}
    </svg>
  )
}
