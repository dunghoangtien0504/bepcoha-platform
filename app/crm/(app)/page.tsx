import Link from 'next/link'
import { getDb } from '@/lib/db'
import { pageUser, can } from '@/lib/crm/session'
import { mondaySix, revenueByMonth, reportAsOf } from '@/lib/crm/reports'
import { timesheet, onTimeStreak, DAY_STATUS_LABEL, type DayStatus } from '@/lib/crm/attendance'
import { TASK_KINDS, type TaskKind } from '@/lib/crm/tasks'
import { money, moneyShort, num, pct, time, todayVN, dateTime, date } from '@/lib/crm/format'
import { Card, PageHeader, Stat, Badge, Note } from '../_components/ui'

export const metadata = { title: 'Tổng quan' }

export default async function Dashboard() {
  const user = await pageUser()
  const sql = getDb()
  const today = todayVN()
  const [myShifts, streak, myTasks, lastSync] = await Promise.all([
    timesheet(today, today, user.id),
    onTimeStreak(user.id),
    sql`SELECT kind, COUNT(*)::int AS n, COUNT(*) FILTER (WHERE due_at < NOW())::int AS overdue
        FROM crm_tasks WHERE assigned_staff_id = ${user.id} AND status IN ('can_lam', 'dang_lam') GROUP BY kind ORDER BY n DESC`,
    sql`SELECT kind, finished_at, detail FROM sync_runs WHERE ok ORDER BY id DESC LIMIT 1`,
  ])
  const showReport = can(user, 'bao_cao.xem')
  const asOf = await reportAsOf()
  const [six, months] = showReport ? await Promise.all([mondaySix(30, asOf.asOf), revenueByMonth(13)]) : [null, []]
  const openTotal = myTasks.reduce((a, r) => a + r.n, 0)
  const overdue = myTasks.reduce((a, r) => a + r.overdue, 0)
  const maxRev = Math.max(1, ...months.map(m => Number(m.revenue)))

  return (
    <>
      <PageHeader title={`Chào ${user.name}`} sub={`Hôm nay ${new Date().toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', weekday: 'long', day: '2-digit', month: '2-digit' })}`} />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Ca hôm nay" actions={<Link href="/crm/cham-cong" className="text-sm font-medium text-emerald-700">Chấm công →</Link>}>
          {myShifts.length === 0 ? <p className="text-sm text-stone-500">Hôm nay bạn không có ca.</p> : myShifts.map(s => (
            <div key={s.assignment_id} className="flex items-center justify-between py-1">
              <div>
                <div className="font-medium">{s.shift_name}</div>
                <div className="text-sm text-stone-500">{time(s.start_at)}–{time(s.end_at)} · vào {s.in_at ? time(s.in_at) : '—'} · ra {s.out_at ? time(s.out_at) : '—'}</div>
              </div>
              <Badge tone={s.day_status === 'du_cong' ? 'green' : s.day_status === 'chua_den' || s.day_status === 'dang_lam' ? 'blue' : 'amber'}>{DAY_STATUS_LABEL[s.day_status as DayStatus]}</Badge>
            </div>
          ))}
          <p className="mt-3 text-sm text-stone-600">Chuỗi đúng giờ: <b className="text-emerald-700">{streak} ca</b> liên tiếp</p>
        </Card>
        <Card title="Việc của tôi" actions={<Link href="/crm/viec" className="text-sm font-medium text-emerald-700">Mở danh sách →</Link>}>
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-semibold tabular-nums">{openTotal}</span><span className="text-sm text-stone-500">việc đang mở</span>
            {overdue > 0 && <Badge tone="red">{overdue} quá hạn</Badge>}
          </div>
          <ul className="mt-3 space-y-1 text-sm">
            {myTasks.slice(0, 6).map(r => <li key={r.kind} className="flex justify-between"><span>{TASK_KINDS[r.kind as TaskKind] ?? r.kind}</span><span className="tabular-nums text-stone-500">{r.n}</span></li>)}
          </ul>
        </Card>
        <Card title="Nguồn dữ liệu">
          <p className="text-sm text-stone-600">Đơn hàng lấy từ Pancake POS (chỉ đọc). Lần nạp gần nhất:</p>
          <p className="mt-1 text-sm font-medium">{lastSync[0] ? dateTime(lastSync[0].finished_at) : 'chưa đồng bộ'}</p>
          {lastSync[0]?.detail && <p className="mt-1 text-xs text-stone-500">{lastSync[0].detail}</p>}
          <Note tone="warn">Máy chỉ tạo việc cho người thật. Không tin nào tự gửi tới khách.</Note>
        </Card>
      </div>

      {six && (
        <>
          <h2 className="mb-3 mt-8 text-base font-semibold">6 con số thứ Hai <span className="font-normal text-stone-500">· 30 ngày tính đến {date(asOf.asOf)}</span></h2>
          {asOf.stale && <div className="mb-3"><Note tone="warn">Dữ liệu đơn chưa đồng bộ tới hôm nay (đơn mới nhất trước {date(asOf.asOf)}). Số liệu dưới đây tính đến ngày có dữ liệu. Bật đồng bộ Pancake hằng giờ để cập nhật.</Note></div>}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Stat label="① Doanh thu từ khách cũ" value={pct(six.oldCustomerRevenue.fromOld, six.oldCustomerRevenue.total)}
              hint={`${moneyShort(six.oldCustomerRevenue.fromOld)} / ${moneyShort(six.oldCustomerRevenue.total)}`} href="/crm/bao-cao" />
            <Stat label="② Khách mua lần 2 (trong 90 ngày)" value={pct(six.repeat90.repeated, six.repeat90.cohort)}
              hint={`Nhóm mua đầu 90–180 ngày trước: ${num(six.repeat90.cohort)} người`} href="/crm/bao-cao" />
            <Stat label="③ Luồng ra đơn nhiều nhất" value={six.flows[0]?.orders ? (TASK_KINDS[six.flows[0].kind as TaskKind] ?? six.flows[0].kind) : '—'}
              hint={six.flows[0]?.orders ? `${six.flows[0].orders} đơn / ${six.flows[0].done} việc xong`
                : six.flows.length ? `Chưa luồng nào ra đơn (${six.flows.reduce((a, f) => a + f.done, 0)} việc đã xong)` : 'Chưa có việc hoàn thành'} href="/crm/bao-cao" />
            <Stat label="④ Tỷ lệ khách từ chối" value={pct(six.refusal.refused, six.refusal.contacted)}
              tone={six.refusal.contacted && six.refusal.refused / six.refusal.contacted > 0.02 ? 'bad' : 'default'}
              hint="Ngưỡng tự dừng luồng: 2%" />
            <Stat label="⑤ Đăng ký khoá offline" value={num(six.offlineCourse.won)} hint={`${six.offlineCourse.open} cơ hội đang mở`} href="/crm/co-hoi" />
            <Stat label="⑥ Khách mới để lại SĐT (7 ngày)" value={num(six.newLeads.all)} hint={`Từ Mini App: ${six.newLeads.mini}`} href="/crm/khach-hang?sort=new" />
          </div>

          <Card title="Doanh thu đơn thật theo tháng" className="mt-6">
            <div className="flex h-48 items-end gap-1.5 overflow-x-auto">
              {months.map(m => (
                <div key={m.month} className="flex min-w-[34px] flex-1 flex-col items-center gap-1" title={`${m.month}: ${money(m.revenue)} · ${num(m.orders)} đơn`}>
                  <span className="text-[10px] tabular-nums text-stone-500">{moneyShort(m.revenue)}</span>
                  <div className="w-full rounded-t bg-emerald-600" style={{ height: `${Math.max(2, Number(m.revenue) / maxRev * 140)}px` }} />
                  <span className="text-[10px] text-stone-500">{m.month.slice(5)}/{m.month.slice(2, 4)}</span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-stone-500">Đơn thật = đã xác nhận / chờ hàng / đang giao / đã nhận và có tiền &gt; 0 (định nghĩa đã chốt với Cô Hạ 20/09).</p>
          </Card>
        </>
      )}
    </>
  )
}
