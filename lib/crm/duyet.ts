// Hộp "Cần duyệt" (Buổi 2 · Easymart: quản lý duyệt việc trong 24 giờ, QC chỉ kiểm ngẫu nhiên; người giữ cửa duyệt).
// Gom mọi thứ đang chờ một người có quyền quyết định về một chỗ, thay vì rải ở 6 trang.
import { getDb } from '../db'
import type { CrmUser } from './session'

type Sql = ReturnType<typeof getDb>

export interface ApprovalCounts {
  tasks: number; leave: number; ai: number; claims: number; miniErrors: number; posts: number; flaggedPunch: number; khoViec: number; total: number
}

const has = (u: CrmUser, p: string) => (u.permissions as string[]).includes(p)

/** Phạm vi bộ phận: admin thấy tất cả, quản lý thấy bộ phận mình. */
const allDepts = (u: CrmUser) => u.role === 'admin' || u.department === 'ban_giam_doc'

export async function approvalCounts(u: CrmUser, sql: Sql = getDb()): Promise<ApprovalCounts> {
  const all = allDepts(u)
  const [r] = await sql`
    SELECT
      (SELECT COUNT(*)::int FROM crm_tasks t WHERE ${has(u, 'viec.giao')} AND t.status IN ('xong', 'bo_qua') AND t.reviewed_at IS NULL
         AND t.kind NOT IN ('duyet_don_tu', 'ghep_don') AND COALESCE(t.edit_reason, '') NOT LIKE 'Hết hạn tự động%'
         AND t.done_at > NOW() - INTERVAL '7 days' AND t.assigned_staff_id <> ${u.id}
         AND (${all} OR t.department = ${u.department ?? ''})) AS tasks,
      (SELECT COUNT(*)::int FROM leave_requests l JOIN staff s ON s.id = l.staff_id WHERE ${has(u, 'cham_cong.duyet')}
         AND l.status = 'cho_duyet' AND l.staff_id <> ${u.id} AND (${all} OR s.department = ${u.department ?? ''})) AS leave,
      (SELECT COUNT(*)::int FROM ai_actions WHERE ${has(u, 'ai.duyet')} AND status IN ('cho_duyet', 'de_xuat')) AS ai,
      (SELECT COUNT(*)::int FROM order_claims WHERE ${has(u, 'qr.quan_ly')} AND status = 'cho_duyet'
         AND (lookup_result <> 'chua_thay' OR retry_until < NOW())) AS claims,
      (SELECT COUNT(*)::int FROM mini_orders WHERE ${has(u, 'qr.quan_ly')} AND status = 'moi' AND pos_status = 'loi') AS mini_errors,
      (SELECT COUNT(*)::int FROM attendance_logs l JOIN staff s ON s.id = l.staff_id WHERE ${has(u, 'cham_cong.duyet')}
         AND l.validity <> 'hop_le' AND l.at > NOW() - INTERVAL '7 days' AND (${all} OR s.department = ${u.department ?? ''})) AS flagged,
      (SELECT COUNT(*)::int FROM task_templates WHERE ${has(u, 'viec.giao')} AND source = 'de_xuat' AND NOT active
         AND (${all} OR department = ${u.department ?? ''})) AS kho_viec`
  // Bảng bài đăng Góc bếp do phiên Mini App tạo khi cần — chưa có thì coi như 0
  let posts = 0
  if (has(u, 'su_kien.quan_ly')) {
    const ok = (await sql`SELECT to_regclass('public.cook_posts') IS NOT NULL AS ok`)[0].ok
    if (ok) posts = (await sql`SELECT COUNT(*)::int AS n FROM cook_posts WHERE status = 'cho_duyet'`)[0].n
  }
  const c = { tasks: r.tasks, leave: r.leave, ai: r.ai, claims: r.claims, miniErrors: r.mini_errors, posts, flaggedPunch: r.flagged, khoViec: r.kho_viec }
  // Lượt chấm bị gắn cờ và kho việc đề xuất là "cần xem", không tính vào số đỏ trên menu
  return { ...c, total: c.tasks + c.leave + c.ai + c.claims + c.miniErrors + c.posts }
}

/** Có quyền duyệt ít nhất một thứ thì menu mới hiện mục "Cần duyệt". */
export function canApproveAnything(u: CrmUser) {
  return ['viec.giao', 'cham_cong.duyet', 'ai.duyet', 'qr.quan_ly', 'su_kien.quan_ly'].some(p => has(u, p))
}
