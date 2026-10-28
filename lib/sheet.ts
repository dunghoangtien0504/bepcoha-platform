export interface SheetLeadRow {
  createdAt: string
  name: string
  phone: string
  email: string
  segment: string
  source: string
  consent: boolean
  ref: string
}

const ALLOWED = /^https:\/\/(script\.google\.com|script\.googleusercontent\.com)\//

/**
 * Đẩy 1 lead sang Google Sheet qua Apps Script Web App (SHEET_WEBHOOK_URL).
 * Trả false nếu chưa cấu hình (không coi là lỗi); ném lỗi nếu gửi thất bại (để được xếp hàng thử lại).
 */
export async function pushLeadToSheet(row: SheetLeadRow): Promise<boolean> {
  const url = process.env.SHEET_WEBHOOK_URL
  if (!url) return false
  if (!ALLOWED.test(url)) throw new Error('SHEET_WEBHOOK_URL phải là địa chỉ https của Google Apps Script')
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...row, secret: process.env.SHEET_WEBHOOK_SECRET || undefined }),
    redirect: 'follow',
    signal: AbortSignal.timeout(6_000),
  })
  if (!res.ok) throw new Error(`Google Sheet trả lỗi ${res.status}`)
  return true
}
