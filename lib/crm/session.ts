// Phiên đăng nhập CRM: cookie httpOnly, JWT ký bằng CRM_SESSION_SECRET (khác JWT_SECRET cũ và MINI_SESSION_SECRET),
// aud = 'crm'. Mỗi request tra lại DB: tài khoản còn hoạt động, đúng session_version (đổi mật khẩu/khoá là đăng xuất mọi nơi),
// và quyền lấy theo DB hiện tại chứ không tin quyền ghi trong token.
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { jwtVerify, SignJWT } from 'jose'
import { getDb } from '../db'
import { ensureCrmSchema } from './schema'
import { permissionsFor, isDepartment, isRole, type Permission, type Role, type Department } from './permissions'

export const CRM_COOKIE = 'haco_crm'
const AUDIENCE = 'crm'
const TTL_SECONDS = 12 * 60 * 60

export interface CrmUser {
  id: number
  name: string
  email: string
  role: Role
  department: Department | null
  title: string
  permissions: Permission[]
}

function secret(): Uint8Array {
  const s = process.env.CRM_SESSION_SECRET
  if (!s || s.length < 32) throw new Error('CRM_SESSION_SECRET chưa cấu hình (cần ≥32 ký tự ngẫu nhiên)')
  return new TextEncoder().encode(s)
}

export async function createCrmSessionToken(staffId: number, sessionVersion: number): Promise<string> {
  return new SignJWT({ sv: sessionVersion })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(staffId))
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${TTL_SECONDS}s`)
    .sign(secret())
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: TTL_SECONDS,
}

async function userFromToken(token: string | undefined): Promise<CrmUser | null> {
  if (!token) return null
  let staffId: number, sv: number
  try {
    const { payload } = await jwtVerify(token, secret(), { audience: AUDIENCE })
    staffId = Number(payload.sub)
    sv = Number(payload.sv)
    if (!Number.isInteger(staffId) || !Number.isInteger(sv)) return null
  } catch {
    return null
  }
  await ensureCrmSchema()
  const sql = getDb()
  const rows = await sql`
    SELECT id, name, email, role, department, title, extra_permissions, status, session_version
    FROM staff WHERE id = ${staffId}
  `
  const s = rows[0]
  if (!s || s.status !== 'active' || s.session_version !== sv || !isRole(s.role)) return null
  const dept = isDepartment(s.department) ? s.department : null
  return {
    id: s.id,
    name: s.name,
    email: s.email,
    role: s.role,
    department: dept,
    title: s.title,
    permissions: permissionsFor(s.role, dept, Array.isArray(s.extra_permissions) ? s.extra_permissions : []),
  }
}

/** Dùng trong Server Component / Route Handler. */
export async function getCrmUser(): Promise<CrmUser | null> {
  const store = await cookies()
  return userFromToken(store.get(CRM_COOKIE)?.value)
}

/** Dùng trong trang (Server Component): layout và trang chạy song song nên trang cũng phải tự chuyển về đăng nhập. */
export async function pageUser(): Promise<CrmUser> {
  const user = await getCrmUser()
  if (!user) redirect('/crm/dang-nhap')
  return user
}

export function can(user: CrmUser | null, perm: Permission): boolean {
  return !!user && user.permissions.includes(perm)
}

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

/** Route Handler: chưa đăng nhập → 401; thiếu quyền → 403. */
export async function requireCrm(perm?: Permission): Promise<CrmUser> {
  const user = await getCrmUser()
  if (!user) throw new HttpError(401, 'Chưa đăng nhập')
  if (perm && !can(user, perm)) throw new HttpError(403, 'Không có quyền thực hiện thao tác này')
  return user
}

/** Bọc Route Handler: đổi HttpError thành JSON lỗi; lỗi khác → 500 kèm log. */
export function handle<T extends unknown[]>(fn: (...args: T) => Promise<Response>) {
  return async (...args: T): Promise<Response> => {
    try {
      return await fn(...args)
    } catch (e) {
      if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status })
      console.error('[crm]', e)
      return Response.json({ error: 'Lỗi hệ thống, đã ghi lại để kiểm tra' }, { status: 500 })
    }
  }
}

export function clientIp(req: Request): string {
  return (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || req.headers.get('x-real-ip') || ''
}
