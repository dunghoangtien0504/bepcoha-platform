import { requireCrm, handle, HttpError, clientIp, can } from '@/lib/crm/session'
import { setEmergencyStop, setSimulation, updateAgent, approveAction, rejectAction, undoAction, setSimVerdict, AiError } from '@/lib/crm/ai'
import { runTroLyCeo, runGiuChan } from '@/lib/crm/ai-agents'

const asHttp = (e: unknown): never => { if (e instanceof AiError) throw new HttpError(e.status, e.message); throw e }

/**
 * Trung tâm AI — một route, nhiều thao tác:
 *  stop (ai.xem: ai cũng dừng được) · resume, simulation, agent, run (ai.quan_ly)
 *  approve, reject, undo, sim_verdict (ai.duyet)
 */
export const POST = handle(async (req: Request) => {
  const user = await requireCrm('ai.xem')
  const b = await req.json().catch(() => ({}))
  const ip = clientIp(req)
  const need = (perm: 'ai.duyet' | 'ai.quan_ly') => { if (!can(user, perm)) throw new HttpError(403, 'Bạn không có quyền này') }
  const id = Number(b.id)
  switch (b.action) {
    case 'stop': {
      const c = await setEmergencyStop(true, user.id, String(b.reason || 'Dừng khẩn cấp').slice(0, 300), ip)
      return Response.json({ ok: true, zalo: c.zalo })
    }
    case 'resume': {
      need('ai.quan_ly')
      const reason = String(b.reason || '').trim()
      if (!reason) throw new HttpError(400, 'Ghi lý do cho chạy lại (đã kiểm tra nguyên nhân dừng chưa?)')
      const c = await setEmergencyStop(false, user.id, reason.slice(0, 300), ip)
      return Response.json({ ok: true, zalo: c.zalo })
    }
    case 'simulation':
      need('ai.quan_ly')
      await setSimulation(!!b.on, user.id, ip)
      return Response.json({ ok: true })
    case 'agent':
      need('ai.quan_ly')
      await updateAgent(String(b.code), { level: b.level, enabled: b.enabled, max_auto_per_day: b.max_auto_per_day === undefined ? undefined : Number(b.max_auto_per_day) }, user.id, ip).catch(asHttp)
      return Response.json({ ok: true })
    case 'run': {
      need('ai.quan_ly')
      if (b.agent === 'tro_ly_ceo') return Response.json({ ok: true, result: await runTroLyCeo().catch(asHttp) })
      if (b.agent === 'giu_chan') return Response.json({ ok: true, result: await runGiuChan().catch(asHttp) })
      throw new HttpError(400, 'Agent này chưa chạy được từ CRM')
    }
    case 'approve': {
      need('ai.duyet')
      const r = await approveAction(id, user.id, { body: typeof b.body === 'string' ? b.body : undefined, note: String(b.note || '').slice(0, 500) }).catch(asHttp)
      return Response.json({ ok: r.status === 'da_thuc_hien', status: r.status, error: r.error ?? null })
    }
    case 'reject':
      need('ai.duyet')
      await rejectAction(id, user.id, String(b.note || ''), ip).catch(asHttp)
      return Response.json({ ok: true })
    case 'undo':
      need('ai.duyet')
      await undoAction(id, user.id, String(b.reason || 'Hoàn tác'), ip).catch(asHttp)
      return Response.json({ ok: true })
    case 'sim_verdict':
      need('ai.duyet')
      if (b.verdict !== 'dong_y' && b.verdict !== 'khac') throw new HttpError(400, 'Chọn đồng ý hoặc khác')
      await setSimVerdict(id, user.id, b.verdict).catch(asHttp)
      return Response.json({ ok: true })
  }
  throw new HttpError(400, 'Thao tác không hợp lệ')
})
