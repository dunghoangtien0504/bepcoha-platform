import { safeEqual } from '@/lib/internal-auth'
import { ensureCrmSchema } from '@/lib/crm/schema'
import { generateDailyTasks, expireStaleAutoTasks, scheduleVipBacklog } from '@/lib/crm/tasks'
import { syncRecentOrders } from '@/lib/crm/sync'
import { pushOrdersToZl } from '@/lib/crm/zl-bridge'
import { syncPancakeChats } from '@/lib/crm/pancake-chat'
import { autoDowngrade } from '@/lib/crm/ai'
import { runTroLyCeo, runGiuChan } from '@/lib/crm/ai-agents'
import { logAction } from '@/lib/crm/audit'

/**
 * Tác vụ định kỳ (Vercel Cron / GitHub Actions gọi kèm header Authorization: Bearer <CRON_SECRET>):
 *  ?task=sync  — mỗi giờ: đồng bộ đơn Pancake 14 ngày gần nhất, tra lại yêu cầu ghép đơn, gửi đơn đã chốt sang Zalo CRM, đồng bộ hội thoại inbox Pancake
 *  ?task=daily — 8h sáng: sinh việc theo vòng đời khách; Trung tâm AI: tự hạ cấp agent, bản tin Trợ lý CEO, đề xuất Giữ chân
 */
export async function GET(req: Request) {
  // Vercel Cron gửi "Authorization: Bearer <CRON_SECRET>"; công cụ khác có thể gửi x-api-key
  const expected = process.env.CRON_SECRET
  if (!expected) return Response.json({ error: 'CRON_SECRET chưa cấu hình' }, { status: 500 })
  const given = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '') || req.headers.get('x-api-key') || ''
  if (!safeEqual(given, expected)) return Response.json({ error: 'Không có quyền' }, { status: 401 })
  await ensureCrmSchema()
  const task = new URL(req.url).searchParams.get('task')
  try {
    if (task === 'sync') {
      const synced = await syncRecentOrders()
      // Zalo CRM tắt hay lỗi không được làm hỏng lượt đồng bộ đơn
      const zl = await pushOrdersToZl().catch(e => ({ error: e instanceof Error ? e.message : String(e) }))
      // Hội thoại inbox Pancake (chỉ đọc): lỗi không làm hỏng lượt đồng bộ đơn
      const chats = await syncPancakeChats().catch(e => ({ error: e instanceof Error ? e.message : String(e) }))
      return Response.json({ ok: true, ...synced, zl, chats })
    }
    if (task === 'daily') {
      const err = (e: unknown) => `lỗi: ${e instanceof Error ? e.message : e}`
      const expired = await expireStaleAutoTasks().catch(err)
      const created = await generateDailyTasks()
      // Khách lớn: rải dần 5 khách/sale/ngày (Cô Hạ chốt 27/10)
      const vip = await scheduleVipBacklog().catch(err)
      // Agent lỗi không được làm hỏng việc sinh việc hằng ngày; agent tắt thì propose() tự bỏ qua.
      // Giữ chân chạy TRƯỚC bản tin để bản tin đếm đúng số việc AI chờ duyệt.
      const ai = {
        downgraded: await autoDowngrade().catch(err),
        giu_chan: await runGiuChan().catch(err),
        brief: await runTroLyCeo().then(r => (r ? r.status : 'bỏ qua')).catch(err),
      }
      return Response.json({ ok: true, expired, created, vip, ai })
    }
    return Response.json({ error: 'task phải là sync hoặc daily' }, { status: 400 })
  } catch (e) {
    console.error('[crm/cron]', task, e)
    await logAction({ actorType: 'system', actorId: null, action: 'CRON_FAIL', table: 'sync_runs', reason: `${task}: ${e instanceof Error ? e.message : e}` }).catch(() => {})
    return Response.json({ error: 'Tác vụ lỗi, đã ghi nhật ký' }, { status: 500 })
  }
}
