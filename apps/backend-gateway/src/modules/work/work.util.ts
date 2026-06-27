import { randomBytes } from 'crypto';

/**
 * Chuyển tiêu đề thành slug an toàn cho URL: bỏ dấu tiếng Việt, hạ chữ thường,
 * thay khoảng trắng/ký tự lạ bằng dấu gạch ngang. Có hậu tố ngẫu nhiên để tránh trùng.
 */
export function slugify(title: string): string {
  const base = title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 160);
  const suffix = randomBytes(3).toString('hex');
  return base ? `${base}-${suffix}` : suffix;
}

/** Sinh mã dự án ngẫu nhiên dạng PRJ-XXXXXX khi người dùng để trống. */
export function generateProjectCode(): string {
  return `PRJ-${randomBytes(3).toString('hex').toUpperCase()}`;
}

/** Tách phần mở rộng file (không gồm dấu chấm), trả về null nếu không có. */
export function extractExtension(fileName: string): string | null {
  const idx = fileName.lastIndexOf('.');
  if (idx <= 0 || idx === fileName.length - 1) return null;
  return fileName.slice(idx + 1).toLowerCase();
}

/** Bóc nội dung base64 từ data URL hoặc chuỗi base64 thuần. */
export function decodeBase64Payload(content: string): Buffer {
  const commaIdx = content.indexOf(',');
  const raw = content.startsWith('data:') && commaIdx >= 0 ? content.slice(commaIdx + 1) : content;
  return Buffer.from(raw, 'base64');
}
