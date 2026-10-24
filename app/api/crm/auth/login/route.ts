import { getDb } from '@/lib/db'
import { verifyPassword } from '@/lib/auth'
import { ensureCrmSchema } from '@/lib/crm/schema'
import { CRM_COOKIE, createCrmSessionToken, sessionCookieOptions, clientIp, handle } from '@/lib/crm/session'
import { logAction } from '@/lib/crm/audit'
import { rateLimit } from '@/lib/ratelimit'

const MAX_FAILS = 5
const LOCK_MINUTES = 15

export const POST = handle(async (req: Request) => {
  const ip = clientIp(req)
  if (!rateLimit('crm-login:' + ip, 20, 10 * 60 * 1000)) {
    return Response.json({ error: 'Thử đăng nhập quá nhiều lần, vui lòng đợi 10 phút' }, { status: 429 })
  }
  const body = await req.json().catch(() => ({}))
  const email = String(body.email || '').trim().toLowerCase()
  const password = String(body.password || '')
  if (!email || !password) return Response.json({ error: 'Nhập email và mật khẩu' }, { status: 400 })

  await ensureCrmSchema()
  const sql = getDb()
  const s = (await sql`SELECT id, password_hash, status, failed_logins, locked_until, session_version FROM staff WHERE lower(email) = ${email}`)[0]
  // Cùng một câu trả lời cho "sai email" và "sai mật khẩu" để không lộ email nào có tài khoản
  const wrong = Response.json({ error: 'Email hoặc mật khẩu không đúng' }, { status: 401 })
  if (!s || s.status !== 'active') return wrong
  if (s.locked_until && new Date(s.locked_until) > new Date()) {
    return Response.json({ error: 'Tài khoản tạm khoá do nhập sai nhiều lần. Thử lại sau 15 phút hoặc nhờ quản trị mở khoá.' }, { status: 423 })
  }
  if (!(await verifyPassword(password, s.password_hash))) {
    const fails = (s.failed_logins as number) + 1
    await sql`UPDATE staff SET failed_logins = ${fails},
      locked_until = CASE WHEN ${fails} >= ${MAX_FAILS} THEN NOW() + make_interval(mins => ${LOCK_MINUTES}) ELSE locked_until END WHERE id = ${s.id}`
    await logAction({ actorId: s.id, action: 'LOGIN_FAIL', table: 'staff', recordId: s.id, ip })
    return wrong
  }
  await sql`UPDATE staff SET failed_logins = 0, locked_until = NULL, last_login = NOW() WHERE id = ${s.id}`
  await logAction({ actorId: s.id, action: 'LOGIN', table: 'staff', recordId: s.id, ip })
  const token = await createCrmSessionToken(s.id, s.session_version)
  const res = Response.json({ ok: true })
  res.headers.append('Set-Cookie', serializeCookie(CRM_COOKIE, token, sessionCookieOptions))
  return res
})

function serializeCookie(name: string, value: string, o: typeof sessionCookieOptions) {
  return [`${name}=${value}`, `Path=${o.path}`, `Max-Age=${o.maxAge}`, 'HttpOnly', `SameSite=Lax`, o.secure ? 'Secure' : ''].filter(Boolean).join('; ')
}
