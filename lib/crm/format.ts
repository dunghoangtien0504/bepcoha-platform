// Định dạng chuẩn tiếng Việt (viên gạch "Dùng được": ngày dd/mm/yyyy, tiền có dấu chấm ngăn nghìn, %).
const TZ = 'Asia/Ho_Chi_Minh'

export function money(v: number | string | bigint | null | undefined): string {
  const n = Number(v ?? 0)
  return n.toLocaleString('vi-VN') + 'đ'
}

/** Tiền rút gọn: 1,2 tỷ · 345tr · 12k */
export function moneyShort(v: number | string | bigint | null | undefined): string {
  const n = Number(v ?? 0)
  if (Math.abs(n) >= 1e9) return (n / 1e9).toLocaleString('vi-VN', { maximumFractionDigits: 2 }) + ' tỷ'
  if (Math.abs(n) >= 1e6) return (n / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + 'tr'
  if (Math.abs(n) >= 1e3) return Math.round(n / 1e3).toLocaleString('vi-VN') + 'k'
  return n.toLocaleString('vi-VN')
}

export function num(v: number | string | null | undefined): string {
  return Number(v ?? 0).toLocaleString('vi-VN')
}

export function pct(part: number, whole: number, digits = 1): string {
  if (!whole) return '—'
  return (part / whole * 100).toLocaleString('vi-VN', { maximumFractionDigits: digits }) + '%'
}

function toDate(v: string | Date | null | undefined): Date | null {
  if (!v) return null
  const d = v instanceof Date ? v : new Date(v)
  return isNaN(d.getTime()) ? null : d
}

export function date(v: string | Date | null | undefined): string {
  const d = toDate(v)
  return d ? d.toLocaleDateString('vi-VN', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'
}

export function dateTime(v: string | Date | null | undefined): string {
  const d = toDate(v)
  return d ? d.toLocaleString('vi-VN', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
}

export function time(v: string | Date | null | undefined): string {
  const d = toDate(v)
  return d ? d.toLocaleTimeString('vi-VN', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }) : '—'
}

/** Thứ trong tuần cho ngày dạng yyyy-mm-dd: T2…T7, CN */
export function weekdayShort(ymd: string): string {
  const dow = new Date(ymd.slice(0, 10) + 'T12:00:00Z').getUTCDay()
  return dow === 0 ? 'CN' : `T${dow + 1}`
}

/** "3 ngày trước", "trong 2 giờ" */
export function relative(v: string | Date | null | undefined, now = Date.now()): string {
  const d = toDate(v)
  if (!d) return '—'
  const diff = d.getTime() - now, abs = Math.abs(diff)
  const unit = abs < 3600e3 ? [Math.round(abs / 60e3), 'phút'] : abs < 86400e3 ? [Math.round(abs / 3600e3), 'giờ'] : [Math.round(abs / 86400e3), 'ngày']
  return diff < 0 ? `${unit[0]} ${unit[1]} trước` : `trong ${unit[0]} ${unit[1]}`
}

/** Ngày hôm nay theo giờ VN, dạng yyyy-mm-dd */
export function todayVN(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86400000)
  return d.toLocaleDateString('en-CA', { timeZone: TZ })
}

export function mondayOf(ymd: string): string {
  const d = new Date(ymd + 'T12:00:00Z')
  const dow = (d.getUTCDay() + 6) % 7
  return new Date(d.getTime() - dow * 86400000).toISOString().slice(0, 10)
}

export function addDays(ymd: string, n: number): string {
  return new Date(new Date(ymd + 'T12:00:00Z').getTime() + n * 86400000).toISOString().slice(0, 10)
}

export function minutesToHours(min: number): string {
  const h = Math.floor(min / 60), m = min % 60
  return m ? `${h}g${String(m).padStart(2, '0')}` : `${h}g`
}
