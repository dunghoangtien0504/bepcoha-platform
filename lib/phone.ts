/**
 * Chuẩn hoá số điện thoại Việt Nam về dạng "0xxxxxxxxx" (10 số, bắt đầu bằng 0).
 * Dùng làm khoá gộp dữ liệu khách hàng giữa Pancake, các bảng đơn hàng cũ và hội thoại,
 * vốn lưu SĐT không đồng nhất (+84, 84, có/không số 0 đầu, khoảng trắng, dấu gạch...).
 */
export function normalizePhone(raw: string | null | undefined): string {
  if (!raw) return ''
  let digits = raw.replace(/\D/g, '')
  if (digits.startsWith('84') && digits.length === 11) {
    digits = '0' + digits.slice(2)
  } else if (digits.length === 9) {
    digits = '0' + digits
  }
  return digits
}
