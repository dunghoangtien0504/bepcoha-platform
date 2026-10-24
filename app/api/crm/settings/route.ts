import { getDb } from '@/lib/db'
import { requireCrm, handle, HttpError, clientIp } from '@/lib/crm/session'
import { logAction } from '@/lib/crm/audit'
import { isDepartment } from '@/lib/crm/permissions'

/** Cài đặt: điểm làm việc (toạ độ, bán kính, IP Wi-Fi), kho ca, định biên giờ công, sản phẩm (ngày dùng hết, chỉ bán kênh riêng). */
export const PUT = handle(async (req: Request) => {
  const user = await requireCrm('cai_dat.sua')
  const b = await req.json().catch(() => ({}))
  const sql = getDb()
  const ip = clientIp(req)
  switch (b.kind) {
    case 'site': {
      const lat = Number(b.lat), lng = Number(b.lng), radius = Number(b.radius_m)
      if (!(lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180)) throw new HttpError(400, 'Toạ độ không hợp lệ')
      if (!(radius >= 30 && radius <= 2000)) throw new HttpError(400, 'Bán kính 30–2000 mét')
      const ips = String(b.allowed_ips || '').split(/[\s,]+/).filter(x => /^[0-9a-f.:]+$/i.test(x)).slice(0, 10)
      const before = (await sql`SELECT * FROM work_sites WHERE id = ${Number(b.id)}`)[0]
      await sql`UPDATE work_sites SET name = ${String(b.name || before?.name).slice(0, 100)}, address = ${String(b.address || '').slice(0, 300)},
        lat = ${lat}, lng = ${lng}, radius_m = ${radius}, allowed_ips = ${ips} WHERE id = ${Number(b.id)}`
      await logAction({ actorId: user.id, action: 'UPDATE', table: 'work_sites', recordId: Number(b.id), before, after: { lat, lng, radius, ips }, ip })
      break
    }
    case 'shift': {
      const code = String(b.code || '').trim().toUpperCase()
      if (!/^[A-Z0-9-]{2,12}$/.test(code) || !/^\d{2}:\d{2}$/.test(b.start_time) || !/^\d{2}:\d{2}$/.test(b.end_time)) throw new HttpError(400, 'Mã ca và giờ (HH:MM) không hợp lệ')
      const dept = b.department && isDepartment(b.department) ? b.department : null
      await sql`INSERT INTO shift_templates (code, name, department, start_time, end_time, break_minutes, kind, late_grace_minutes, color)
        VALUES (${code}, ${String(b.name || code).slice(0, 60)}, ${dept}, ${b.start_time}, ${b.end_time}, ${Math.max(0, Number(b.break_minutes) || 0)},
                ${['toan_ca', 'ban_thoi_gian', 'ca_gay', 'ca_dem'].includes(b.shift_kind) ? b.shift_kind : 'toan_ca'}, ${Math.max(0, Number(b.late_grace_minutes) || 5)}, ${/^#[0-9a-f]{6}$/i.test(b.color) ? b.color : '#0f766e'})
        ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, department = EXCLUDED.department, start_time = EXCLUDED.start_time, end_time = EXCLUDED.end_time,
          break_minutes = EXCLUDED.break_minutes, kind = EXCLUDED.kind, late_grace_minutes = EXCLUDED.late_grace_minutes, color = EXCLUDED.color, active = TRUE`
      await logAction({ actorId: user.id, action: 'UPSERT', table: 'shift_templates', recordKey: code, after: b, ip })
      break
    }
    case 'target': {
      if (!isDepartment(b.department)) throw new HttpError(400, 'Bộ phận không hợp lệ')
      const hours: number[] = Array.isArray(b.hours) ? b.hours.map(Number) : []
      if (hours.length !== 7 || hours.some(h => !(h >= 0 && h <= 200))) throw new HttpError(400, 'Nhập đủ 7 ngày, mỗi ngày 0–200 giờ')
      for (let i = 0; i < 7; i++) await sql`INSERT INTO staffing_targets (department, weekday, hours) VALUES (${b.department}, ${i + 1}, ${hours[i]})
        ON CONFLICT (department, weekday) DO UPDATE SET hours = EXCLUDED.hours`
      await logAction({ actorId: user.id, action: 'UPDATE', table: 'staffing_targets', recordKey: b.department, after: hours, ip })
      break
    }
    case 'product': {
      const days = b.use_up_days === '' || b.use_up_days === null ? null : Number(b.use_up_days)
      if (days !== null && !(days >= 1 && days <= 365)) throw new HttpError(400, 'Số ngày dùng hết 1–365')
      await sql`UPDATE products SET use_up_days = ${days}, private_channel_only = ${!!b.private_channel_only}, next_offer = ${String(b.next_offer ?? '').slice(0, 300)} WHERE id = ${Number(b.id)}`
      await logAction({ actorId: user.id, action: 'UPDATE', table: 'products', recordId: Number(b.id), after: b, ip })
      break
    }
    case 'mini_voucher': {
      // Voucher Mini App (mỗi SĐT 1 lần, khoá theo SĐT). Xoá cài đặt = ngừng cấp.
      if (b.clear) {
        await sql`DELETE FROM app_settings WHERE key = 'mini_voucher'`
        await logAction({ actorId: user.id, action: 'DELETE', table: 'app_settings', recordKey: 'mini_voucher', ip })
        break
      }
      const program = String(b.program || '').trim()
      const amount = Number(b.amount), days = Number(b.valid_days)
      if (!/^[a-z0-9-]{3,40}$/.test(program)) throw new HttpError(400, 'Mã chương trình 3–40 ký tự: chữ thường, số, gạch ngang')
      if (!Number.isInteger(amount) || amount <= 0 || amount > 1_000_000) throw new HttpError(400, 'Số tiền là số nguyên 1–1.000.000đ')
      if (!Number.isInteger(days) || days <= 0 || days > 365) throw new HttpError(400, 'Hạn dùng 1–365 ngày')
      const value = { program, amount, valid_days: days }
      const before = (await sql`SELECT value FROM app_settings WHERE key = 'mini_voucher'`)[0]?.value ?? null
      await sql`INSERT INTO app_settings (key, value, updated_by) VALUES ('mini_voucher', ${sql.json(value)}, ${user.id})
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = NOW()`
      await logAction({ actorId: user.id, action: 'UPDATE', table: 'app_settings', recordKey: 'mini_voucher', before, after: value, ip })
      break
    }
    case 'mini_points': {
      // Mức "Hạt Cốm" cho Mini App v2-A: { checkin, milestones: { "<số ngày chuỗi>": điểm } }. Xoá = dùng mặc định trong code.
      if (b.clear) {
        await sql`DELETE FROM app_settings WHERE key = 'mini_points'`
        await logAction({ actorId: user.id, action: 'DELETE', table: 'app_settings', recordKey: 'mini_points', ip })
        break
      }
      const checkin = Number(b.checkin)
      if (!Number.isInteger(checkin) || checkin < 1 || checkin > 100) throw new HttpError(400, 'Điểm mỗi lần điểm danh: số nguyên 1–100')
      const raw = (b.milestones && typeof b.milestones === 'object') ? b.milestones as Record<string, unknown> : {}
      const milestones: Record<string, number> = {}
      for (const [k, v] of Object.entries(raw)) {
        const day = Number(k), pts = Number(v)
        if (!Number.isInteger(day) || day < 2 || day > 365 || !Number.isInteger(pts) || pts < 1 || pts > 1000) {
          throw new HttpError(400, 'Mốc chuỗi: số ngày 2–365, điểm 1–1000')
        }
        milestones[String(day)] = pts
      }
      if (Object.keys(milestones).length > 10) throw new HttpError(400, 'Tối đa 10 mốc chuỗi')
      const value = { checkin, milestones }
      const before = (await sql`SELECT value FROM app_settings WHERE key = 'mini_points'`)[0]?.value ?? null
      await sql`INSERT INTO app_settings (key, value, updated_by) VALUES ('mini_points', ${sql.json(value)}, ${user.id})
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = NOW()`
      await logAction({ actorId: user.id, action: 'UPDATE', table: 'app_settings', recordKey: 'mini_points', before, after: value, ip })
      break
    }
    default: throw new HttpError(400, 'Loại cài đặt không hợp lệ')
  }
  return Response.json({ ok: true })
})
