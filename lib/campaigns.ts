import { createHmac } from 'crypto'

export type Arm = 'treatment' | 'holdout'
/** repeat = mời mua thêm sản phẩm; course = mời khách đã mua sản phẩm sang khoá học (cầu nối sản phẩm → khoá học) */
export type CampaignGoal = 'repeat' | 'course'

export interface CampaignCriteria {
  goal: CampaignGoal
  minDaysSinceLastOrder: number   // đã im lặng ít nhất bấy nhiêu ngày
  maxDaysSinceLastOrder: number   // nhưng chưa quá bấy nhiêu ngày
  minOrders: number
  maxOrders: number               // 1 = chỉ khách mới mua 1 lần
  contactCooldownDays: number     // không chọn người vừa được chăm sóc gần đây
  excludeRecentCampaignDays: number // không chọn người đã nằm trong chiến dịch gần đây (tránh nhiễu phép đo)
  holdoutPct: number              // % giữ làm nhóm đối chứng (không liên hệ)
  cap: number                     // tối đa số khách mỗi chiến dịch
}

export const DEFAULT_CRITERIA: CampaignCriteria = {
  goal: 'repeat',
  minDaysSinceLastOrder: 45,
  maxDaysSinceLastOrder: 365,
  minOrders: 1,
  maxOrders: 1,
  contactCooldownDays: 30,
  excludeRecentCampaignDays: 120,
  holdoutPct: 20,
  cap: 500,
}

type NumericKey = Exclude<keyof CampaignCriteria, 'goal'>
const RANGES: Record<NumericKey, [number, number]> = {
  minDaysSinceLastOrder: [0, 730],
  maxDaysSinceLastOrder: [1, 1095],
  minOrders: [1, 100],
  maxOrders: [1, 100],
  contactCooldownDays: [0, 365],
  excludeRecentCampaignDays: [120, 365],  // không được ngắn hơn cửa sổ bảo vệ nhóm đối chứng (120 ngày)
  holdoutPct: [10, 50],   // dưới 10% thì nhóm đối chứng quá nhỏ để đo
  cap: [20, 5000],
}

/** Chuẩn hoá + kiểm tra tiêu chí. Trả về { error } nếu sai (không bao giờ nhận số ngoài khoảng cho phép). */
export function validateCriteria(input: unknown): { criteria: CampaignCriteria } | { error: string } {
  const src = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  const out = { ...DEFAULT_CRITERIA }
  if (src.goal !== undefined) {
    if (src.goal !== 'repeat' && src.goal !== 'course') return { error: 'goal chỉ được là repeat hoặc course' }
    out.goal = src.goal
  }
  // Chiến dịch mời sang khoá học: khách có thể đã mua nhiều lần, mặc định nới số lần mua và đưa mốc im lặng về ngắn hơn
  if (out.goal === 'course') { out.maxOrders = 100; out.minDaysSinceLastOrder = 14; out.maxDaysSinceLastOrder = 365 }
  for (const k of Object.keys(RANGES) as NumericKey[]) {
    if (src[k] === undefined) continue
    if (src[k] === null || src[k] === '') return { error: `${k} không được để trống` }
    const v = Number(src[k])
    const [lo, hi] = RANGES[k]
    if (!Number.isInteger(v) || v < lo || v > hi) return { error: `${k} phải là số nguyên trong khoảng ${lo}–${hi}` }
    out[k] = v
  }
  if (out.minDaysSinceLastOrder >= out.maxDaysSinceLastOrder) return { error: 'minDaysSinceLastOrder phải nhỏ hơn maxDaysSinceLastOrder' }
  if (out.minOrders > out.maxOrders) return { error: 'minOrders không được lớn hơn maxOrders' }
  return { criteria: out }
}

/**
 * Chia nhóm cố định theo băm (không ngẫu nhiên mỗi lần chạy): cùng chiến dịch + cùng khách luôn ra cùng nhóm,
 * nên kiểm tra lại được và nhân viên không thể "chọn" khách vào nhóm nào.
 */
export function assignArm(campaignKey: string, customerId: number, holdoutPct: number, secret: string): Arm {
  // HMAC với khoá bí mật của máy chủ: người có danh sách + id khách cũng không tự tính ra ai thuộc nhóm đối chứng
  const h = createHmac('sha256', secret).update(`${campaignKey}:${customerId}`).digest()
  const u = h.readUInt32BE(0) / 0x100000000   // [0,1)
  return u * 100 < holdoutPct ? 'holdout' : 'treatment'
}

export interface ArmStat { n: number; hits: number }
export interface Comparison {
  rateTreatment: number | null
  rateHoldout: number | null
  lift: number | null              // chênh lệch (treatment − holdout), đơn vị 0..1
  ci95: [number, number] | null
  enough: boolean                  // đủ mẫu để tin?
  verdict: 'chua-du-mau' | 'co-tac-dung' | 'khong-khac-biet' | 'tac-dung-am'
}

export const MIN_PER_ARM = 100
export const MIN_EVENTS = 20

/** So sánh tỷ lệ mua lại 2 nhóm (khoảng tin cậy 95% xấp xỉ chuẩn). Ít mẫu thì không kết luận. */
export function compareArms(t: ArmStat, h: ArmStat): Comparison {
  const rt = t.n ? t.hits / t.n : null
  const rh = h.n ? h.hits / h.n : null
  if (rt === null || rh === null) return { rateTreatment: rt, rateHoldout: rh, lift: null, ci95: null, enough: false, verdict: 'chua-du-mau' }
  const lift = rt - rh
  const se = Math.sqrt((rt * (1 - rt)) / t.n + (rh * (1 - rh)) / h.n)
  const ci: [number, number] = [lift - 1.96 * se, lift + 1.96 * se]
  // đủ người VÀ đủ số ca mua lại (tỷ lệ thấp thì 100 người chỉ có vài ca, khoảng tin cậy không đáng tin)
  const enough = t.n >= MIN_PER_ARM && h.n >= MIN_PER_ARM && t.hits + h.hits >= MIN_EVENTS
  let verdict: Comparison['verdict'] = 'chua-du-mau'
  if (enough) verdict = ci[0] > 0 ? 'co-tac-dung' : ci[1] < 0 ? 'tac-dung-am' : 'khong-khac-biet'
  return { rateTreatment: rt, rateHoldout: rh, lift, ci95: ci, enough, verdict }
}

// ── Xuất CSV an toàn ─────────────────────────────────────────────────────────
/** Ô bắt đầu bằng = + - @ hoặc tab/CR bị Excel hiểu là công thức: thêm dấu nháy đơn để vô hiệu. */
export function csvCell(v: unknown): string {
  let s = String(v ?? '')
  if (/^[\s\u00a0\u200b\ufeff]*[=+\-@\t\r\n]/.test(s)) s = `'${s}`
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(header: string[], rows: unknown[][]): string {
  // BOM để Excel đọc đúng tiếng Việt
  return '﻿' + [header, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n') + '\r\n'
}
