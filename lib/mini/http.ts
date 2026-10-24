// Bọc Route Handler của /api/mini/*: đảm bảo schema, kiểm cùng origin, đọc JSON có giới hạn, đổi MiniError thành JSON lỗi.
import { ensureCrmSchema } from '../crm/schema'
import { miniTokenFromRequest, verifyMiniToken } from '../mini-auth'
import { MiniError, badRequest } from './errors'

const MAX_BODY = 16 * 1024

export function miniRoute<T extends unknown[]>(fn: (req: Request, ...rest: T) => Promise<Response>) {
  return async (req: Request, ...rest: T): Promise<Response> => {
    try {
      assertSameOrigin(req)
      await ensureCrmSchema()
      return await fn(req, ...rest)
    } catch (e) {
      if (e instanceof MiniError) return Response.json({ error: e.code, message: e.message, ...e.extra }, { status: e.status })
      console.error('[mini]', e)
      return Response.json({ error: 'server_error', message: 'Có lỗi hệ thống, chị thử lại sau giúp Cô nhé.' }, { status: 500 })
    }
  }
}

/**
 * Chống gửi chéo trang (CSRF) cho phiên dùng cookie: request ghi (POST) có header Origin thì Origin phải trùng host.
 * Bản Zalo dùng header Authorization (không tự gửi theo trình duyệt) nên không cần kiểm.
 */
function assertSameOrigin(req: Request) {
  if (req.method === 'GET' || req.headers.get('authorization')) return
  const origin = req.headers.get('origin')
  if (!origin) return
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host')
  let originHost = ''
  try {
    originHost = new URL(origin).host
  } catch {
    // Origin hỏng → coi như khác host
  }
  if (!host || originHost !== host) throw new MiniError(403, 'forbidden_origin', 'Yêu cầu không hợp lệ.')
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  const len = Number(req.headers.get('content-length') || 0)
  if (len > MAX_BODY) throw new MiniError(413, 'too_large', 'Dữ liệu gửi lên quá lớn.')
  const text = await req.text()
  if (text.length > MAX_BODY) throw new MiniError(413, 'too_large', 'Dữ liệu gửi lên quá lớn.')
  if (!text) return {}
  try {
    const v = JSON.parse(text)
    if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>
  } catch {
    // rơi xuống badRequest
  }
  throw badRequest()
}

export async function sessionIdFrom(req: Request): Promise<number | null> {
  return verifyMiniToken(miniTokenFromRequest(req))
}

export function clientInfo(req: Request) {
  return {
    ip: (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || req.headers.get('x-real-ip') || '',
    ua: (req.headers.get('user-agent') || '').slice(0, 200),
    zalo: !!req.headers.get('authorization') || req.headers.get('x-mini-platform') === 'zalo',
  }
}
