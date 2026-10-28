import { getDb } from '@/lib/db'
import { requireCrm, handle } from '@/lib/crm/session'
import { syncEarnings, mascotLine, MASCOT_MOOD, type MascotKey } from '@/lib/crm/san-choi'
import { TZ } from '@/lib/crm/attendance'

/**
 * Linh vật Cốm nói gì sau khi chấm công (B2 K17: chưa xong việc thì "mắng", xong thì khen lên trời).
 * Gọi ngay sau POST /api/crm/attendance. Chỉ đọc + tính lại thưởng; không đổi lượt chấm.
 */
export const POST = handle(async (req: Request) => {
  const user = await requireCrm('cham_cong.cua_toi')
  const b = await req.json().catch(() => ({}))
  const kind = b.kind === 'ra' ? 'ra' : 'vao'
  const sql = getDb()
  const before = Number(b.streak_before) || 0
  const earn = await syncEarnings(user.id, sql)
  const last = (await sql`SELECT validity FROM attendance_logs WHERE staff_id = ${user.id} ORDER BY id DESC LIMIT 1`)[0]
  const open = (await sql`
    SELECT COUNT(*)::int AS n FROM crm_tasks WHERE assigned_staff_id = ${user.id} AND status IN ('can_lam', 'dang_lam') AND customer_id IS NULL
      AND (due_at IS NULL OR due_at < (date_trunc('day', NOW() AT TIME ZONE ${TZ}) + INTERVAL '1 day') AT TIME ZONE ${TZ})`)[0].n
  // Ca hôm nay: vào sau giờ bắt đầu = muộn (luật Sân chơi: không ân hạn)
  const shift = (await sql`
    SELECT ((a.work_date + st.start_time) AT TIME ZONE ${TZ}) AS start_at,
           (SELECT u.assignment_id FROM sc_shield_uses u WHERE u.assignment_id = a.id) AS shielded
    FROM shift_assignments a JOIN shift_templates st ON st.id = a.template_id
    WHERE a.staff_id = ${user.id} AND a.work_date = (NOW() AT TIME ZONE ${TZ})::date ORDER BY st.start_time LIMIT 1`)[0]
  let key: MascotKey
  if (!earn.playing) key = 'chua_choi'
  else if (last && last.validity !== 'hop_le') key = 'co'
  else if (kind === 'vao') key = shift && Date.now() > +new Date(shift.start_at) ? (shift.shielded ? 'vao_khien' : 'vao_muon') : 'vao_dung'
  else if (open > 0) key = 'ra_con_viec'
  else key = earn.newTokens > 0 ? 'ra_xong' : earn.waitingReview > 0 ? 'ra_cho_duyet' : 'ra_binh'
  return Response.json({
    key, mood: MASCOT_MOOD[key], line: mascotLine(key, { streak: earn.streak, open, old: before }),
    streak: earn.streak, level: earn.level.name, levelIcon: earn.level.icon, newTokens: earn.newTokens, open, playing: earn.playing,
  })
})
