// Logic thuần (không DB) của vòng lặp chăm sóc: phân nhóm, đọc bảng tính, mã giới thiệu.

export const SEGMENTS = ['A', 'B', 'C', 'D'] as const
export type Segment = typeof SEGMENTS[number]

/** Chuẩn hoá danh sách nhóm: chỉ nhận A/B/C/D, bỏ trùng, sắp xếp; rỗng thì mặc định A (khách bình thường). */
export function normalizeSegments(input: unknown): Segment[] {
  const arr = Array.isArray(input) ? input : typeof input === 'string' ? input.split(/[\s,;|]+/) : []
  const set = new Set<Segment>()
  for (const v of arr) {
    const s = String(v).trim().toUpperCase()
    if ((SEGMENTS as readonly string[]).includes(s)) set.add(s as Segment)
  }
  return set.size ? [...set].sort() : ['A']
}

/** Câu trả lời của khách ở câu hỏi "chị đang muốn gì?": chỉ nhận đúng 1 chữ A–D, còn lại coi như không trả lời. */
export function parseSegmentAnswer(v: unknown): Segment | null {
  const s = typeof v === 'string' ? v.trim().toUpperCase() : ''
  return (SEGMENTS as readonly string[]).includes(s) ? (s as Segment) : null
}

/** Mã giới thiệu: 6 ký tự dễ đọc (bỏ 0/O/1/I/L), do người dùng gõ nên chuẩn hoá về chữ hoa. */
// 31 ký tự (bỏ 0/O/1/I/L dễ nhầm khi đọc bằng miệng/viết tay).
export const REFERRAL_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
// 31 không chia hết 256: dùng rejection sampling (bỏ byte lệch) để mỗi ký tự có xác suất đều nhau, không lệch modulo.
const REFERRAL_REJECT_ABOVE = Math.floor(256 / REFERRAL_ALPHABET.length) * REFERRAL_ALPHABET.length // 248

/** Cần dư ra vài byte ngẫu nhiên vì một số byte bị loại (rejection sampling). 16 byte gần như luôn đủ cho 6 ký tự. */
export function generateReferralCode(randomBytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < randomBytes.length && out.length < 6; i++) {
    const b = randomBytes[i]
    if (b < REFERRAL_REJECT_ABOVE) out += REFERRAL_ALPHABET[b % REFERRAL_ALPHABET.length]
  }
  if (out.length < 6) throw new Error('generateReferralCode: không đủ byte ngẫu nhiên, thử lại với buffer lớn hơn')
  return out
}
export function parseReferralCode(v: unknown): string | null {
  const s = typeof v === 'string' ? v.trim().toUpperCase() : ''
  return /^[2-9A-HJKMNP-Z]{6}$/.test(s) ? s : null
}

// ── Đọc bảng tính (Google Sheet xuất CSV) ────────────────────────────────────
/** Đọc CSV theo RFC 4180 (ô có dấu phẩy/xuống dòng/nháy kép). Trả về mảng các dòng. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQ = false
  const src = text.replace(/^﻿/, '')
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (inQ) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++ } else inQ = false
      } else cell += ch
    } else if (ch === '"' && cell === '') inQ = true   // nháy kép chỉ mở chuỗi ở đầu ô; giữa ô coi là ký tự thường
    else if (ch === ',') { row.push(cell); cell = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      row.push(cell); cell = ''
      if (row.some(c => c.trim() !== '')) rows.push(row)
      row = []
    } else cell += ch
  }
  row.push(cell)
  if (row.some(c => c.trim() !== '')) rows.push(row)
  return rows
}

export interface SheetLead {
  phone: string
  name: string
  email: string
  segments: Segment[]
  source: string
}

const HEADER_ALIASES: Record<string, string[]> = {
  phone: ['phone', 'sdt', 'sđt', 'so dien thoai', 'số điện thoại', 'dien thoai', 'điện thoại'],
  name: ['name', 'ten', 'tên', 'ho ten', 'họ tên', 'họ và tên', 'ho va ten'],
  email: ['email', 'mail'],
  segment: ['segment', 'nhom', 'nhóm', 'segment_answer'],
  source: ['source', 'nguon', 'nguồn'],
}

function norm(h: string): string {
  return h.trim().toLowerCase().normalize('NFC')
}

/** Đổi bảng CSV thành danh sách lead hợp lệ. Bỏ dòng không có số điện thoại di động Việt Nam hợp lệ. */
export function parseSheetLeads(csv: string, normalizePhone: (p: string) => string, maxRows = 2000): { leads: SheetLead[]; skipped: number } {
  const rows = parseCsv(csv)
  if (rows.length < 2) return { leads: [], skipped: 0 }
  const header = rows[0].map(norm)
  const col = (key: string) => header.findIndex(h => HEADER_ALIASES[key].includes(h))
  const ci = { phone: col('phone'), name: col('name'), email: col('email'), segment: col('segment'), source: col('source') }
  if (ci.phone < 0) return { leads: [], skipped: rows.length - 1 }
  const leads = new Map<string, SheetLead>()
  let skipped = 0
  for (const r of rows.slice(1, maxRows + 1)) {
    const phone = normalizePhone(r[ci.phone] ?? '')
    if (!/^0[35789]\d{8}$/.test(phone)) { skipped++; continue }
    const email = (ci.email >= 0 ? (r[ci.email] ?? '') : '').trim().toLowerCase()
    leads.set(phone, {
      phone,
      name: (ci.name >= 0 ? (r[ci.name] ?? '') : '').trim().slice(0, 120),
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email.slice(0, 160) : '',
      segments: normalizeSegments(ci.segment >= 0 ? r[ci.segment] : ''),
      source: (ci.source >= 0 ? (r[ci.source] ?? '') : '').trim().slice(0, 40) || 'sheet',
    })
  }
  return { leads: [...leads.values()], skipped }
}

// ── Nội dung việc tự sinh cho nhân viên ─────────────────────────────────────
export type LoopTaskKind = 'd7' | 'next' | 'course_welcome' | 'vip' | 'referral_reward'

export function displayName(name: string | null | undefined, id: number): string {
  const n = (name ?? '').trim()
  return n ? n.slice(0, 60) : `khách #${id}`
}

export function taskTitle(kind: LoopTaskKind, name: string, extra = ''): string {
  switch (kind) {
    case 'd7': return `Ngày 7 · Hỏi thăm ${name}: dùng hàng ổn chưa? Xin ảnh nấu thử. ${extra}`.trim()
    case 'next': return `Ngày 12–20 · Gợi ý cho ${name} sản phẩm/khóa học kế tiếp (theo nhóm khách).`.trim()
    case 'course_welcome': return `Học viên mới · Hỏi ${name} đã vào học được chưa, cần hỗ trợ gì không.`
    case 'vip': return `VIP · Gọi cảm ơn ${name} và hỏi nhu cầu sắp tới.`
    case 'referral_reward': return `Thưởng giới thiệu · ${name} đã giới thiệu được khách mua hàng: gửi quà tri ân. ${extra}`.trim()
  }
}
