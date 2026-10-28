import Link from 'next/link'
import { getDb } from '@/lib/db'
import { pageUser, can } from '@/lib/crm/session'
import { timesheet, onTimeStreak } from '@/lib/crm/attendance'
import { todayBoard } from '@/lib/crm/kho-viec'
import { approvalCounts, canApproveAnything } from '@/lib/crm/duyet'
import { maskPhone } from '@/lib/crm/customers'
import { waitingChats } from '@/lib/crm/pancake-chat'
import { getPancakeConversationUrl } from '@/lib/pancake'
import { time, todayVN, dateTime, relative } from '@/lib/crm/format'
import { Card, Note, Badge } from '../_components/ui'
import { PunchPanel } from './cham-cong/punch-client'
import { TaskCard } from './viec/task-client'
import { playerState } from '@/lib/crm/san-choi'
import { myProjectTasks } from '@/lib/crm/du-an'
import { Com } from './san-choi/mascot'

export const metadata = { title: 'Hôm nay' }

type Row = Record<string, unknown>

/**
 * "Hôm nay" (Buổi 2 · Easymart): mở app là thấy ca, nút chấm công, và đúng những việc phải xong trong ngày.
 * Chấm công vào ca → kho việc của bộ phận tự sinh việc cho ca; ra ca còn việc dở thì bị nhắc.
 */
export default async function TodayPage() {
  const user = await pageUser()
  const sql = getDb()
  const today = todayVN()
  const approver = canApproveAnything(user)
  const [shifts, streak, board, site, counts, brief, lastSync] = await Promise.all([
    timesheet(today, today, user.id),
    onTimeStreak(user.id),
    todayBoard(user.id),
    sql`SELECT name FROM work_sites WHERE active ORDER BY id LIMIT 1`,
    approver ? approvalCounts(user) : Promise.resolve(null),
    can(user, 'bao_cao.xem') ? sql`SELECT title, body, executed_at FROM ai_actions WHERE agent_code = 'tro_ly_ceo' AND status = 'da_thuc_hien' ORDER BY executed_at DESC LIMIT 1` : Promise.resolve([]),
    sql`SELECT MAX(finished_at) AS at, NOW() - MAX(finished_at) > INTERVAL '3 hours' AS stale FROM sync_runs WHERE ok`,
  ])
  // Sân chơi + việc dự án: lỗi ở phần này không được làm hỏng trang Hôm nay
  const [game, projectTasks] = await Promise.all([
    playerState(user.id).catch(e => { console.error('[san-choi]', e); return null }),
    myProjectTasks(user.id).catch(e => { console.error('[du-an]', e); return [] }),
  ])
  const showPhone = can(user, 'khach.xem_sdt')
  const manager = can(user, 'viec.giao')
  // Khách nhắn inbox Pancake mà chưa ai trả lời (người làm với khách mới thấy)
  const waiting = can(user, 'khach.xem') ? await waitingChats(8).catch(() => null) : null
  const staff = manager ? await sql`SELECT id, name FROM staff WHERE status = 'active' ORDER BY name` : []
  const toCard = (r: Row): Row => ({
    ...r, customer_phone: r.customer_phone ? (showPhone ? String(r.customer_phone) : maskPhone(String(r.customer_phone))) : null,
    due_at: r.due_at ? new Date(r.due_at as string).toISOString() : null, done_at: r.done_at ? new Date(r.done_at as string).toISOString() : null,
  })
  const groups = [
    { key: 'ca', title: 'Việc trong ca', items: (board.inShift as unknown as Row[]).map(toCard) },
    { key: 'khach', title: 'Chăm khách', items: (board.care as unknown as Row[]).map(toCard) },
  ].filter(g => g.items.length)
  const doneToday = (board.doneToday as unknown as Row[]).map(toCard)
  const shownOpen = board.inShift.length + board.care.length
  const pctDone = board.total ? Math.round(board.done / board.total * 100) : 0
  const shift = shifts[0]
  const notCheckedIn = shift && !shift.in_at
  // Lượt chấm có ghi nhận nhưng bị gắn cờ (ngoài vùng, máy lạ…): việc ca đã sinh, chỉ chờ quản lý xem lại công
  const flaggedOnly = notCheckedIn && Number(shift.flagged) > 0
  const syncStale = can(user, 'bao_cao.xem') && (!lastSync[0]?.at || lastSync[0].stale)

  return (
    <>
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-stone-900 sm:text-2xl">Chào {user.name}</h1>
        <p className="text-sm text-stone-500">{new Date().toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', weekday: 'long', day: '2-digit', month: '2-digit' })}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="min-w-0">
          <PunchPanel openTasks={shownOpen} siteName={site[0]?.name ?? null} streak={game?.streak ?? streak}
            shifts={shifts.map(s => ({ id: s.assignment_id as number, name: s.shift_name as string, start: time(s.start_at), end: time(s.end_at), inAt: s.in_at ? time(s.in_at) : null, outAt: s.out_at ? time(s.out_at) : null }))} />
        </div>
        <Card title="Tiến độ hôm nay">
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-semibold tabular-nums text-emerald-700">{board.done}</span>
            <span className="text-stone-500">/ {board.total} việc xong</span>
          </div>
          <div className="mt-2 h-2.5 rounded-full bg-stone-100"><div className="h-2.5 rounded-full bg-emerald-600 transition-all" style={{ width: `${pctDone}%` }} /></div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-stone-600">
            <span>Chuỗi đúng giờ: <b className="text-emerald-700">{streak} ca</b></span>
            {board.overdue > 0 && <span className="font-medium text-rose-600">{board.overdue} việc quá hạn</span>}
          </div>
          {board.total > 0 && board.open === 0 && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Xong hết việc hôm nay. Cảm ơn bạn!</p>}
          {flaggedOnly ? <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">Đã ghi nhận lượt chấm của bạn, chờ quản lý xem lại (ngoài vùng hoặc máy lạ). Việc của ca vẫn làm bình thường.</p>
            : notCheckedIn && <p className="mt-3 text-xs text-stone-500">Chấm công vào ca để nhận việc của ca từ kho việc.</p>}
          {board.hiddenCare > 0 && <p className="mt-2 text-xs text-stone-500">Hiện {board.care.length} việc chăm khách ưu tiên nhất; còn {board.hiddenCare} việc khác ở <Link href="/crm/viec" className="underline">trang Việc</Link>.</p>}
        </Card>
        {counts && counts.total + counts.khoViec + counts.flaggedPunch > 0 ? (
          <Link href="/crm/duyet" className="block rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm hover:bg-amber-100">
            <div className="text-sm font-medium text-amber-900">Cần bạn duyệt</div>
            <div className="mt-1 text-4xl font-semibold tabular-nums text-amber-900">{counts.total}</div>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-amber-900/80">
              {counts.tasks > 0 && <span>{counts.tasks} việc đã xong</span>}
              {counts.leave > 0 && <span>{counts.leave} đơn từ</span>}
              {counts.ai > 0 && <span>{counts.ai} việc AI</span>}
              {counts.claims > 0 && <span>{counts.claims} ghép đơn sàn</span>}
              {counts.miniErrors > 0 && <span>{counts.miniErrors} đơn Mini App lỗi</span>}
              {counts.posts > 0 && <span>{counts.posts} bài Góc bếp</span>}
              {counts.khoViec > 0 && <span>{counts.khoViec} việc kho đề xuất</span>}
            </div>
            <div className="mt-2 text-sm font-medium text-amber-900">Mở hộp duyệt →</div>
          </Link>
        ) : approver ? (
          <Card title="Cần bạn duyệt"><p className="text-sm text-stone-500">Không có gì chờ duyệt.</p></Card>
        ) : null}
      </div>

      {game?.playing && (
        <Link href="/crm/san-choi" className="mt-4 flex items-center gap-3 rounded-2xl border border-lime-200 bg-gradient-to-r from-lime-50 to-amber-50 p-3 shadow-sm hover:shadow">
          <Com mood={game.tokens > 0 ? 'tu_hao' : 'vui'} size={52} className="shrink-0" />
          <div className="grid flex-1 grid-cols-3 gap-2 text-center">
            <div><div className="text-2xl font-bold tabular-nums text-orange-700">{game.streak}</div><div className="text-[11px] text-stone-600">ca liền · {game.level.icon} {game.level.name}</div></div>
            <div><div className="text-2xl font-bold tabular-nums text-emerald-700">{game.tokens}</div><div className="text-[11px] text-stone-600">lượt quay{game.waitingReview ? ` (+${game.waitingReview} chờ duyệt)` : ''}</div></div>
            <div><div className="text-2xl font-bold tabular-nums text-amber-700">{Math.floor(game.balance / 1000)}k</div><div className="text-[11px] text-stone-600">trong ví</div></div>
          </div>
          <span className="hidden text-sm font-semibold text-emerald-800 sm:block">{game.tokens > 0 ? 'Quay ngay →' : 'Sân chơi →'}</span>
        </Link>
      )}

      {projectTasks.length > 0 && (
        <Card className="mt-4" title={`Việc dự án 7 ngày tới · ${projectTasks.length}`} actions={<Link href="/crm/du-an" className="text-xs text-emerald-700">Dự án →</Link>}>
          <ul className="divide-y divide-stone-100 text-sm">
            {projectTasks.map(t => {
              const late = !!t.is_late
              return (
                <li key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 py-2">
                  <span className="min-w-0 flex-1 font-medium">{t.title}</span>
                  <Link href={`/crm/du-an/${t.project_id}`} className="text-xs text-stone-500 hover:underline">{t.project_name}</Link>
                  <span className={`text-xs ${late ? 'font-semibold text-rose-600' : 'text-amber-700'}`}>{late ? 'Trễ · ' : 'Hạn '}{relative(t.due_at)}</span>
                </li>
              )
            })}
          </ul>
          <p className="mt-2 text-xs text-stone-500">Làm và báo xong ở <Link href="/crm/viec" className="underline">trang Việc</Link>.</p>
        </Card>
      )}

      {waiting && waiting.total > 0 && (
        <Card className="mt-4" title={`Khách đang chờ trả lời trên Pancake · ${waiting.total}`}
          actions={waiting.late > 0 ? <Badge tone="red">{waiting.late} chờ quá 30 phút</Badge> : undefined}>
          <ul className="divide-y divide-stone-100 text-sm">
            {waiting.rows.map(w => (
              <li key={w.pancake_conversation_id} className="flex flex-wrap items-center gap-2 py-2">
                <span className={`w-16 shrink-0 tabular-nums ${w.wait_min >= 30 ? 'font-semibold text-rose-600' : 'text-stone-500'}`}>{w.wait_min < 60 ? `${w.wait_min}′` : `${Math.floor(w.wait_min / 60)}g${w.wait_min % 60 ? String(w.wait_min % 60).padStart(2, '0') : ''}`}</span>
                <span className="min-w-0 flex-1">
                  {w.customer_id ? <Link href={`/crm/khach-hang/${w.customer_id}`} className="font-medium text-emerald-800 hover:underline">{w.customer_name}</Link> : <span className="font-medium">{w.customer_name}</span>}
                  <span className="ml-2 text-stone-500">{w.last_message_preview}</span>
                </span>
                <a href={getPancakeConversationUrl(w.pancake_conversation_id)} target="_blank" rel="noreferrer" className="text-emerald-700 underline">Trả lời trên Pancake</a>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-stone-500">Đồng bộ mỗi giờ từ Pancake (chỉ đọc). Trả lời vẫn làm trên Pancake.</p>
        </Card>
      )}

      {syncStale && <div className="mt-4"><Note tone="warn">Đơn Pancake chưa đồng bộ hơn 3 giờ (lần cuối {lastSync[0]?.at ? dateTime(lastSync[0].at) : 'chưa có'}). Số doanh thu và việc chăm khách sau giao có thể thiếu.</Note></div>}

      {brief[0] && (
        <Card title={brief[0].title} className="mt-4" actions={<span className="text-xs text-stone-400">Trợ lý CEO · {dateTime(brief[0].executed_at)} · <Link href="/crm/bao-cao" className="text-emerald-700">Báo cáo →</Link></span>}>
          <pre className="whitespace-pre-wrap font-sans text-sm text-stone-700">{brief[0].body}</pre>
        </Card>
      )}

      <div className="mt-6 space-y-6">
        {groups.length === 0 && doneToday.length === 0 && (
          <Note>{shift ? 'Hôm nay chưa có việc nào. Chấm công vào ca để nhận việc của ca.' : 'Hôm nay bạn không có ca và không có việc nào.'}</Note>
        )}
        {groups.map(g => (
          <section key={g.key}>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">{g.title} · {g.items.length}</h2>
            <div className="grid gap-3 xl:grid-cols-2">
              {g.items.map(t => <TaskCard key={t.id as number} task={t as never} manager={manager} staff={staff.map(s => ({ id: s.id, name: s.name }))} mine />)}
            </div>
          </section>
        ))}
        {doneToday.length > 0 && (
          <details>
            <summary className="cursor-pointer text-sm font-semibold uppercase tracking-wide text-stone-500">Đã xong hôm nay · {doneToday.length}</summary>
            <div className="mt-2 grid gap-3 xl:grid-cols-2">
              {doneToday.map(t => <TaskCard key={t.id as number} task={t as never} manager={false} staff={[]} mine />)}
            </div>
          </details>
        )}
        <p className="text-xs text-stone-500">Cần xem tất cả việc, việc đã xong hay giao việc mới: <Link href="/crm/viec" className="text-emerald-700 underline">Ca &amp; việc → Việc</Link>.</p>
      </div>
    </>
  )
}
