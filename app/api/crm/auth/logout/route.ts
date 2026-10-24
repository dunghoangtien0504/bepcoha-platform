import { CRM_COOKIE } from '@/lib/crm/session'

export async function POST() {
  const res = Response.json({ ok: true })
  res.headers.append('Set-Cookie', `${CRM_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`)
  return res
}
