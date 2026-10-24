import { randomBytes } from 'node:crypto'
import { getDb } from '@/lib/db'
import { hashPassword } from '@/lib/auth'
import { requireCrm, handle, HttpError, clientIp } from '@/lib/crm/session'
import { logAction } from '@/lib/crm/audit'
import { isRole, isDepartment, PERMISSIONS } from '@/lib/crm/permissions'

const tempPassword = () => randomBytes(9).toString('base64url')

/** Tạo tài khoản: mật khẩu tạm hiện ĐÚNG 1 lần cho quản trị chuyển cho nhân viên. */
export const POST = handle(async (req: Request) => {
  const user = await requireCrm('nhan_vien.quan_ly')
  const b = await req.json().catch(() => ({}))
  const email = String(b.email || '').trim().toLowerCase()
  const name = String(b.name || '').trim().slice(0, 100)
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !name) throw new HttpError(400, 'Nhập tên và email hợp lệ')
  if (!isRole(b.role) || !isDepartment(b.department)) throw new HttpError(400, 'Chọn vai trò và bộ phận')
  if (b.role === 'admin' && user.role !== 'admin') throw new HttpError(403, 'Chỉ quản trị tạo được tài khoản quản trị')
  const pw = tempPassword()
  const sql = getDb()
  const row = (await sql`
    INSERT INTO staff (name, email, password_hash, role, department, title, phone, employment)
    VALUES (${name}, ${email}, ${await hashPassword(pw)}, ${b.role}, ${b.department}, ${String(b.title || '').slice(0, 100)}, ${String(b.phone || '').slice(0, 20)},
            ${b.employment === 'ban_thoi_gian' ? 'ban_thoi_gian' : 'toan_thoi_gian'})
    RETURNING id`.catch(e => { if (String(e?.code) === '23505') throw new HttpError(409, 'Email đã có tài khoản'); throw e }))[0]
  await logAction({ actorId: user.id, action: 'INSERT', table: 'staff', recordId: row.id, after: { email, name, role: b.role, department: b.department }, ip: clientIp(req) })
  return Response.json({ ok: true, id: row.id, temp_password: pw })
})

/** Đổi vai trò/bộ phận/quyền thêm, khoá/mở tài khoản, đặt lại mật khẩu. Mọi thay đổi quyền đều đăng xuất người đó khỏi mọi máy. */
export const PATCH = handle(async (req: Request) => {
  const user = await requireCrm('nhan_vien.quan_ly')
  const b = await req.json().catch(() => ({}))
  const id = Number(b.id)
  const sql = getDb()
  const before = (await sql`SELECT id, role, department, extra_permissions, status, title FROM staff WHERE id = ${id}`)[0]
  if (!before) throw new HttpError(404, 'Không tìm thấy nhân viên')
  if (id === user.id && (b.role !== undefined || b.status === 'inactive')) throw new HttpError(400, 'Không tự đổi vai trò hoặc tự khoá chính mình')
  if ((before.role === 'admin' || b.role === 'admin') && user.role !== 'admin') throw new HttpError(403, 'Chỉ quản trị sửa được tài khoản quản trị')
  const set: Record<string, unknown> = {}
  let bump = false
  let tempPw: string | null = null
  if (b.role !== undefined) { if (!isRole(b.role)) throw new HttpError(400, 'Vai trò không hợp lệ'); set.role = b.role; bump = true }
  if (b.department !== undefined) { if (!isDepartment(b.department)) throw new HttpError(400, 'Bộ phận không hợp lệ'); set.department = b.department; bump = true }
  if (b.extra_permissions !== undefined) {
    const list = Array.isArray(b.extra_permissions) ? b.extra_permissions.filter((p: unknown) => (PERMISSIONS as readonly unknown[]).includes(p)) : []
    set.extra_permissions = sql.json(list); bump = true
  }
  if (b.status !== undefined) { set.status = b.status === 'inactive' ? 'inactive' : 'active'; bump = true }
  if (b.title !== undefined) set.title = String(b.title).slice(0, 100)
  if (b.action === 'unlock') { set.failed_logins = 0; set.locked_until = null }
  if (b.action === 'reset_password') { tempPw = tempPassword(); set.password_hash = await hashPassword(tempPw); bump = true }
  if (!Object.keys(set).length) throw new HttpError(400, 'Không có gì để cập nhật')
  await sql`UPDATE staff SET ${sql(set as never)}${bump ? sql`, session_version = session_version + 1` : sql``} WHERE id = ${id}`
  const after = (await sql`SELECT id, role, department, extra_permissions, status, title FROM staff WHERE id = ${id}`)[0]
  await logAction({ actorId: user.id, action: b.action === 'reset_password' ? 'RESET_PASSWORD' : 'UPDATE', table: 'staff', recordId: id, before, after, ip: clientIp(req) })
  return Response.json({ ok: true, temp_password: tempPw })
})
