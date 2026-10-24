import { getDb } from '@/lib/db'
import { hashPassword, verifyPassword } from '@/lib/auth'
import { requireCrm, handle, HttpError, clientIp, CRM_COOKIE, createCrmSessionToken, sessionCookieOptions } from '@/lib/crm/session'
import { logAction } from '@/lib/crm/audit'

/** Tự đổi mật khẩu: đăng xuất mọi máy khác (tăng session_version), giữ phiên hiện tại bằng cookie mới. */
export const POST = handle(async (req: Request) => {
  const user = await requireCrm()
  const b = await req.json().catch(() => ({}))
  const next = String(b.new_password || '')
  if (next.length < 10) throw new HttpError(400, 'Mật khẩu mới cần ít nhất 10 ký tự')
  const sql = getDb()
  const s = (await sql`SELECT password_hash FROM staff WHERE id = ${user.id}`)[0]
  if (!s || !(await verifyPassword(String(b.old_password || ''), s.password_hash))) throw new HttpError(400, 'Mật khẩu hiện tại không đúng')
  const row = (await sql`UPDATE staff SET password_hash = ${await hashPassword(next)}, session_version = session_version + 1 WHERE id = ${user.id} RETURNING session_version`)[0]
  await logAction({ actorId: user.id, action: 'CHANGE_PASSWORD', table: 'staff', recordId: user.id, ip: clientIp(req) })
  const token = await createCrmSessionToken(user.id, row.session_version)
  const res = Response.json({ ok: true })
  res.headers.append('Set-Cookie', `${CRM_COOKIE}=${token}; Path=/; Max-Age=${sessionCookieOptions.maxAge}; HttpOnly; SameSite=Lax${sessionCookieOptions.secure ? '; Secure' : ''}`)
  return res
})
