// Chấm công & phân ca (B2 bài 10–12, Z09): GPS + thiết bị đã đăng ký, kho ca, xếp ca tuần, định biên theo giờ công,
// bảng công tháng, đơn từ, "chuỗi đúng giờ". Giờ tính theo Asia/Ho_Chi_Minh.
import { getDb } from '../db'
import { logAction } from './audit'
export { LEAVE_KINDS, DAY_STATUS_LABEL, type LeaveKind, type DayStatus } from './labels'

type Sql = ReturnType<typeof getDb>
export const TZ = 'Asia/Ho_Chi_Minh'

/** Khoảng cách 2 toạ độ (mét). */
export function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000, rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(lat2 - lat1), dLng = rad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

export interface PunchInput { kind: 'vao' | 'ra'; lat?: number | null; lng?: number | null; accuracy?: number | null; deviceId?: string | null; ip?: string }

export interface PunchResult {
  id: number
  validity: 'hop_le' | 'ngoai_vung' | 'thiet_bi_la' | 'khong_vi_tri'
  distance: number | null
  siteName: string | null
  assignmentId: number | null
  message: string
}

/** Tự chấm công. Mọi lượt đều được LƯU (kể cả ngoài vùng/thiết bị lạ) để quản lý xem, chỉ gắn cờ hợp lệ hay không. */
export async function punch(staffId: number, p: PunchInput, sql: Sql = getDb()): Promise<PunchResult> {
  return sql.begin(async tx => {
    const t = tx as unknown as Sql
    const staff = (await t`SELECT id, registered_device FROM staff WHERE id = ${staffId} FOR UPDATE`)[0]
    if (!staff) throw new Error('Không tìm thấy nhân viên')
    // Ca gần nhất hôm nay (hoặc ca đêm hôm qua chưa kết thúc)
    const asg = (await t`
      SELECT a.id, a.site_id, ws.name AS site_name, ws.lat, ws.lng, ws.radius_m, ws.allowed_ips,
             ((a.work_date + st.start_time) AT TIME ZONE ${TZ}) AS start_at
      FROM shift_assignments a JOIN shift_templates st ON st.id = a.template_id
      LEFT JOIN work_sites ws ON ws.id = a.site_id
      WHERE a.staff_id = ${staffId} AND a.work_date BETWEEN (NOW() AT TIME ZONE ${TZ})::date - 1 AND (NOW() AT TIME ZONE ${TZ})::date
      ORDER BY abs(extract(epoch FROM ((a.work_date + st.start_time) AT TIME ZONE ${TZ}) - NOW())) LIMIT 1
    `)[0]
    const site = asg?.site_id ? asg : (await t`SELECT id AS site_id, name AS site_name, lat, lng, radius_m, allowed_ips FROM work_sites WHERE active ORDER BY id LIMIT 1`)[0]

    let validity: PunchResult['validity'] = 'hop_le'
    let distance: number | null = null
    let method: 'gps' | 'ip' = 'gps'
    const hasGps = Number.isFinite(p.lat) && Number.isFinite(p.lng)
    if (hasGps && site?.lat != null && site?.lng != null) {
      distance = Math.round(distanceMeters(p.lat!, p.lng!, site.lat, site.lng))
      const slack = Math.min(Number(p.accuracy) || 0, 100)
      if (distance > site.radius_m + slack) validity = 'ngoai_vung'
    } else if (site?.allowed_ips?.length && p.ip && site.allowed_ips.includes(p.ip)) {
      method = 'ip'
    } else {
      validity = 'khong_vi_tri'
    }
    // Thiết bị: lần đầu chấm công thì đăng ký máy này; về sau máy khác bị gắn cờ (quản lý có thể đặt lại thiết bị).
    // Chỉ đăng ký máy khi lượt chấm đầu tiên HỢP LỆ (đúng vị trí): bấm thử ở nhà không biến máy đó thành máy chấm công.
    const device = (p.deviceId || '').slice(0, 100) || null
    if (device && !staff.registered_device) {
      if (validity === 'hop_le') await t`UPDATE staff SET registered_device = ${device} WHERE id = ${staffId}`
    } else if (validity === 'hop_le' && (!device || device !== staff.registered_device)) {
      validity = 'thiet_bi_la'
    }
    const row = (await t`
      INSERT INTO attendance_logs (staff_id, assignment_id, kind, lat, lng, accuracy_m, distance_m, site_id, device_id, ip, method, validity, created_by)
      VALUES (${staffId}, ${asg?.id ?? null}, ${p.kind}, ${hasGps ? p.lat! : null}, ${hasGps ? p.lng! : null}, ${p.accuracy ?? null},
              ${distance}, ${site?.site_id ?? null}, ${device}, ${p.ip ?? ''}, ${method}, ${validity}, ${staffId})
      RETURNING id
    `)[0]
    const msg = {
      hop_le: p.kind === 'vao' ? 'Đã chấm công vào ca' : 'Đã chấm công ra ca',
      ngoai_vung: `Đã ghi nhận nhưng bạn đang cách điểm làm việc ${distance}m (ngoài vùng). Quản lý sẽ xem lại.`,
      thiet_bi_la: 'Đã ghi nhận nhưng đây không phải máy đã đăng ký chấm công. Quản lý sẽ xem lại.',
      khong_vi_tri: 'Đã ghi nhận nhưng không lấy được vị trí. Hãy bật định vị rồi chấm lại, hoặc gửi đơn "Quên chấm công".',
    }[validity]
    return { id: row.id, validity, distance, siteName: site?.site_name ?? null, assignmentId: asg?.id ?? null, message: msg }
  })
}

/**
 * Bảng công theo từng ca đã xếp trong khoảng ngày. Mỗi dòng = 1 ca của 1 người, kèm giờ vào/ra hợp lệ đầu–cuối,
 * phút đi muộn/về sớm, phút làm thực tế (trong khung ca, trừ nghỉ giữa ca) và trạng thái.
 */
export async function timesheet(from: string, to: string, staffId: number | null = null, sql: Sql = getDb()) {
  return sql`
    WITH a AS (
      SELECT a.id, a.staff_id, a.work_date, st.code, st.name AS shift_name, st.color, st.break_minutes, st.late_grace_minutes,
             ((a.work_date + st.start_time) AT TIME ZONE ${TZ}) AS start_at,
             ((a.work_date + st.end_time + CASE WHEN st.end_time <= st.start_time THEN INTERVAL '1 day' ELSE INTERVAL '0' END) AT TIME ZONE ${TZ}) AS end_at
      FROM shift_assignments a JOIN shift_templates st ON st.id = a.template_id
      WHERE a.work_date BETWEEN ${from}::date AND ${to}::date AND (${staffId}::int IS NULL OR a.staff_id = ${staffId})
    ), p AS (
      SELECT a.id,
        (SELECT MIN(l.at) FROM attendance_logs l WHERE l.staff_id = a.staff_id AND l.kind = 'vao' AND l.validity = 'hop_le'
           AND l.at BETWEEN a.start_at - INTERVAL '2 hours' AND a.end_at) AS in_at,
        (SELECT MAX(l.at) FROM attendance_logs l WHERE l.staff_id = a.staff_id AND l.kind = 'ra' AND l.validity = 'hop_le'
           AND l.at BETWEEN a.start_at AND a.end_at + INTERVAL '4 hours') AS out_at,
        (SELECT COUNT(*) FROM attendance_logs l WHERE l.staff_id = a.staff_id AND l.validity <> 'hop_le'
           AND l.at BETWEEN a.start_at - INTERVAL '2 hours' AND a.end_at + INTERVAL '4 hours')::int AS flagged,
        (SELECT r.kind FROM leave_requests r WHERE r.staff_id = a.staff_id AND r.status = 'da_duyet'
           AND a.work_date BETWEEN r.from_date AND r.to_date ORDER BY r.id DESC LIMIT 1) AS leave_kind
      FROM a
    )
    SELECT a.id AS assignment_id, a.staff_id, s.name AS staff_name, s.department, a.work_date::text AS work_date, a.code, a.shift_name, a.color,
           a.start_at, a.end_at, p.in_at, p.out_at, p.flagged, p.leave_kind,
           GREATEST(0, extract(epoch FROM a.end_at - a.start_at) / 60 - a.break_minutes)::int AS planned_min,
           CASE WHEN p.in_at > a.start_at + make_interval(mins => a.late_grace_minutes) THEN (extract(epoch FROM p.in_at - a.start_at) / 60)::int ELSE 0 END AS late_min,
           CASE WHEN p.out_at < a.end_at THEN (extract(epoch FROM a.end_at - p.out_at) / 60)::int ELSE 0 END AS early_min,
           CASE WHEN p.in_at IS NOT NULL AND p.out_at IS NOT NULL
             THEN GREATEST(0, extract(epoch FROM LEAST(p.out_at, a.end_at) - GREATEST(p.in_at, a.start_at)) / 60 - a.break_minutes)::int
             WHEN p.leave_kind IN ('quen_cham_cong', 'di_muon_ve_som') THEN GREATEST(0, extract(epoch FROM a.end_at - a.start_at) / 60 - a.break_minutes)::int
             ELSE 0 END AS worked_min,
           CASE
             WHEN p.leave_kind IN ('nghi_phep', 'nghi_om', 'nghi_khong_luong', 'doi_ca') THEN 'nghi_co_phep'
             WHEN p.leave_kind IN ('quen_cham_cong', 'di_muon_ve_som') THEN 'du_cong'
             WHEN NOW() < a.start_at THEN 'chua_den'
             WHEN p.in_at IS NULL AND p.out_at IS NULL AND NOW() < a.end_at THEN 'chua_den'
             WHEN p.in_at IS NOT NULL AND p.out_at IS NULL AND NOW() < a.end_at + INTERVAL '4 hours' THEN 'dang_lam'
             WHEN p.in_at IS NULL AND p.out_at IS NULL THEN 'vang'
             WHEN p.in_at IS NULL OR p.out_at IS NULL THEN 'thieu_cham'
             WHEN p.in_at > a.start_at + make_interval(mins => a.late_grace_minutes) AND p.out_at < a.end_at THEN 'muon_som'
             WHEN p.in_at > a.start_at + make_interval(mins => a.late_grace_minutes) THEN 'di_muon'
             WHEN p.out_at < a.end_at THEN 've_som'
             ELSE 'du_cong' END AS day_status
    FROM a JOIN p ON p.id = a.id JOIN staff s ON s.id = a.staff_id
    ORDER BY a.work_date, a.start_at, s.name
  `
}

/** "Chuỗi đúng giờ" (B2 bài 12): số ca liên tiếp gần nhất đi đúng giờ, đủ công. */
export async function onTimeStreak(staffId: number, sql: Sql = getDb()): Promise<number> {
  const rows = await timesheet(
    new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10), new Date().toISOString().slice(0, 10), staffId, sql)
  let n = 0
  for (const r of [...rows].reverse()) {
    if (r.day_status === 'chua_den' || r.day_status === 'dang_lam' || r.day_status === 'nghi_co_phep') continue
    if (r.day_status === 'du_cong') n++
    else break
  }
  return n
}

/** Độ phủ ca so với định biên giờ công theo bộ phận × ngày (B2 Z09). */
export async function coverage(from: string, to: string, sql: Sql = getDb()) {
  return sql`
    WITH d AS (SELECT gs::date AS day FROM generate_series(${from}::date, ${to}::date, INTERVAL '1 day') gs),
    planned AS (
      SELECT a.work_date AS day, s.department,
             SUM(GREATEST(0, extract(epoch FROM (st.end_time - st.start_time + CASE WHEN st.end_time <= st.start_time THEN INTERVAL '1 day' ELSE INTERVAL '0' END)) / 3600 - st.break_minutes / 60.0)) AS hours
      FROM shift_assignments a JOIN shift_templates st ON st.id = a.template_id JOIN staff s ON s.id = a.staff_id
      WHERE a.work_date BETWEEN ${from}::date AND ${to}::date
      GROUP BY 1, 2
    )
    SELECT d.day::text AS day, t.department, t.hours::float AS target_hours, COALESCE(p.hours, 0)::float AS planned_hours
    FROM d JOIN staffing_targets t ON t.weekday = extract(isodow FROM d.day)
    LEFT JOIN planned p ON p.day = d.day AND p.department = t.department
    ORDER BY d.day, t.department
  `
}

export async function reviewLeave(id: number, reviewerId: number, approve: boolean, note: string, ip: string, sql: Sql = getDb()) {
  return sql.begin(async tx => {
    const t = tx as unknown as Sql
    const before = (await t`SELECT * FROM leave_requests WHERE id = ${id} FOR UPDATE`)[0]
    if (!before) return null
    if (before.status !== 'cho_duyet') return before
    const after = (await t`
      UPDATE leave_requests SET status = ${approve ? 'da_duyet' : 'tu_choi'}, reviewed_by = ${reviewerId}, reviewed_at = NOW(), review_note = ${note}
      WHERE id = ${id} RETURNING *`)[0]
    await logAction({ actorId: reviewerId, action: approve ? 'APPROVE' : 'REJECT', table: 'leave_requests', recordId: id, before, after, reason: note, ip }, t)
    return after
  })
}
