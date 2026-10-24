import { safeEqual } from '@/lib/internal-auth'
import { ensureCrmSchema } from '@/lib/crm/schema'
import { generateDailyTasks } from '@/lib/crm/tasks'
import { syncRecentOrders } from '@/lib/crm/sync'
import { logAction } from '@/lib/crm/audit'

/**
 * Tác vụ định kỳ (Vercel Cron / GitHub Actions gọi kèm header Authorization: Bearer <CRON_SECRET>):
 *  ?task=sync  — mỗi giờ: đồng bộ đơn Pancake 14 ngày gần nhất, tra lại yêu cầu ghép đơn
 *  ?task=daily — 8h sáng: sinh việc theo vòng đời khách
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
    if (task === 'sync') return Response.json({ ok: true, ...(await syncRecentOrders()) })
    if (task === 'daily') return Response.json({ ok: true, created: await generateDailyTasks() })
    return Response.json({ error: 'task phải là sync hoặc daily' }, { status: 400 })
  } catch (e) {
    console.error('[crm/cron]', task, e)
    await logAction({ actorType: 'system', actorId: null, action: 'CRON_FAIL', table: 'sync_runs', reason: `${task}: ${e instanceof Error ? e.message : e}` }).catch(() => {})
    return Response.json({ error: 'Tác vụ lỗi, đã ghi nhật ký' }, { status: 500 })
  }
}
