// Nội dung câu đồng ý của Mini App — bản gốc nằm ở đây (server), client chỉ gửi text_version.
// Mỗi lượt đồng ý lưu text_version + text_hash (sha256 của đúng câu khách đã thấy) làm bằng chứng (Luật 91/2025/QH15).
// KHÔNG sửa câu của một phiên bản đã dùng: muốn đổi chữ thì thêm phiên bản mới, giữ phiên bản cũ để đối chiếu.
// Câu hiển thị ở Mini-App/app/src/content.ts phải trùng từng chữ với phiên bản tương ứng ở đây.
import { createHash } from 'node:crypto'

export const CONSENT_TEXTS: Record<string, string> = {
  'mini-2026-10-v1':
    'Tôi đồng ý để HACO Food (Bếp Cô Hạ) lưu số điện thoại này và liên hệ qua Zalo/điện thoại để hướng dẫn nấu, chăm sóc sau mua và gửi ưu đãi. Tôi có thể huỷ bất cứ lúc nào.',
}

export const CONSENT_CHANNELS = ['zalo_oa', 'dien_thoai', 'sms'] as const
export type ConsentChannel = (typeof CONSENT_CHANNELS)[number]
export const CONSENT_PURPOSES = ['cham_soc_sau_mua'] as const

export function consentText(version: string): string | null {
  return Object.prototype.hasOwnProperty.call(CONSENT_TEXTS, version) ? CONSENT_TEXTS[version] : null
}

export function consentHash(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}
