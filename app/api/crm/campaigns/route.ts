import { randomBytes } from 'node:crypto'
import { requireCrm, handle, HttpError, clientIp } from '@/lib/crm/session'
import { logAction } from '@/lib/crm/audit'
import { validateCriteria, assignArm } from '@/lib/campaigns'
import { findCampaignCandidates, createCampaignAtomic } from '@/lib/db'

/** Xem trước số khách (action = 'preview') hoặc tạo chiến dịch có nhóm đối chứng (action = 'create'). */
export const POST = handle(async (req: Request) => {
  const b = await req.json().catch(() => ({}))
  const v = validateCriteria(b.criteria)
  if ('error' in v) throw new HttpError(400, v.error)
  if (b.action === 'preview') {
    await requireCrm('chien_dich.xem')
    const rows = await findCampaignCandidates(v.criteria)
    return Response.json({ count: rows.length, expectedHoldout: Math.round(rows.length * v.criteria.holdoutPct / 100) })
  }
  const user = await requireCrm('chien_dich.tao')
  const name = String(b.name || '').trim().slice(0, 200)
  if (!name) throw new HttpError(400, 'Đặt tên chiến dịch')
  const secret = process.env.CAMPAIGN_SECRET
  if (!secret || secret.length < 32) throw new HttpError(500, 'Máy chủ chưa cấu hình CAMPAIGN_SECRET')
  const key = 'cd-' + new Date().toISOString().slice(0, 10) + '-' + randomBytes(3).toString('hex')
  const out = await createCampaignAtomic(key, name, v.criteria, user.id, cid => assignArm(key, cid, v.criteria.holdoutPct, secret))
  if (!out) throw new HttpError(400, 'Không có khách nào khớp điều kiện')
  await logAction({ actorId: user.id, action: 'INSERT', table: 'care_campaigns', recordId: out.id, after: { name, criteria: v.criteria, ...out }, ip: clientIp(req) })
  return Response.json({ ok: true, ...out })
})
