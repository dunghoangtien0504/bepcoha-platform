import Link from 'next/link'
import { getDb } from '@/lib/db'
import { pageUser, can } from '@/lib/crm/session'
import { approvalCounts, canApproveAnything } from '@/lib/crm/duyet'
import { listClaims } from '@/lib/crm/mini'
import { maskPhone } from '@/lib/crm/customers'
import { ACTION_KINDS, type ActionKind } from '@/lib/crm/ai'
import { LEAVE_KINDS, type LeaveKind } from '@/lib/crm/labels'
import { DEPARTMENT_LABEL, type Department } from '@/lib/crm/permissions'
import { date, dateTime } from '@/lib/crm/format'
import { PageHeader, Card, Badge, Forbidden, Empty, Table, Td } from '../../_components/ui'
import { TaskCard } from '../viec/task-client'
import { LeaveActions } from '../don-tu/leave-client'
import { ActionControls } from '../ai/ai-client'
import { ClaimActions } from '../qr/qr-client'
import { AcceptPunch } from './duyet-client'

export const metadata = { title: 'Cần duyệt' }

type Row = Record<string, unknown>
const LOOKUP = { khop_sdt: 'Khớp SĐT', don_san: 'Đơn sàn (SĐT bị che)', nhieu_don: 'Trùng nhiều đơn', sai_sdt: 'Sai SĐT — xem kỹ', chua_thay: 'Chưa thấy đơn' } as const

/** Một hộp duyệt cho quản lý: việc đã xong (duyệt trong 24 giờ), đơn từ, việc AI, ghép đơn sàn, đơn Mini App lỗi, bài Góc bếp. */
export default async function ApprovalsPage() {
  const user = await pageUser()
  if (!canApproveAnything(user)) return <Forbidden />
  const sql = getDb()
  const all = user.role === 'admin' || user.department === 'ban_giam_doc'
  const dept = user.department ?? ''
  const [counts, tasks, leaves, ai, claims, flagged] = await Promise.all([
    approvalCounts(user),
    can(user, 'viec.giao') ? sql`
      SELECT t.*, c.name AS customer_name, c.phone AS customer_phone, c.phone_verified_at, s.name AS assignee_name, NULL AS reviewer_name,
             t.done_at < NOW() - INTERVAL '24 hours' AS review_late
      FROM crm_tasks t LEFT JOIN customers c ON c.id = t.customer_id LEFT JOIN staff s ON s.id = t.assigned_staff_id
      WHERE t.status IN ('xong', 'bo_qua') AND t.reviewed_at IS NULL AND t.done_at > NOW() - INTERVAL '7 days' AND t.assigned_staff_id <> ${user.id}
        AND t.kind NOT IN ('duyet_don_tu', 'ghep_don') AND COALESCE(t.edit_reason, '') NOT LIKE 'Hết hạn tự động%'
        AND (${all} OR t.department = ${dept})
      ORDER BY (t.status = 'bo_qua') DESC, t.done_at LIMIT 30` : Promise.resolve([]),
    can(user, 'cham_cong.duyet') ? sql`
      SELECT l.*, s.name AS staff_name, s.department FROM leave_requests l JOIN staff s ON s.id = l.staff_id
      WHERE l.status = 'cho_duyet' AND l.staff_id <> ${user.id} AND (${all} OR s.department = ${dept}) ORDER BY l.created_at LIMIT 30` : Promise.resolve([]),
    can(user, 'ai.duyet') ? sql`
      SELECT a.id, a.status, a.kind, a.title, a.body, a.rationale, a.customer_id, g.name AS agent_name, c.name AS customer_name
      FROM ai_actions a JOIN ai_agents g ON g.code = a.agent_code LEFT JOIN customers c ON c.id = a.customer_id
      WHERE a.status IN ('cho_duyet', 'de_xuat') ORDER BY a.created_at LIMIT 5` : Promise.resolve([]),
    can(user, 'qr.quan_ly') ? listClaims('cho_duyet') : Promise.resolve([]),
    can(user, 'cham_cong.duyet') ? sql`
      SELECT l.id, l.staff_id, l.kind, l.at, l.validity, l.distance_m, s.name AS staff_name
      FROM attendance_logs l JOIN staff s ON s.id = l.staff_id
      WHERE l.validity <> 'hop_le' AND l.at > NOW() - INTERVAL '7 days' AND (${all} OR s.department = ${dept})
      ORDER BY l.at DESC LIMIT 20` : Promise.resolve([]),
  ])
  const showPhone = can(user, 'khach.xem_sdt')
  const staff = await sql`SELECT id, name FROM staff WHERE status = 'active' ORDER BY name`
  const cards = (tasks as unknown as Row[]).map((r): Row => ({
    ...r, customer_phone: r.customer_phone ? (showPhone ? String(r.customer_phone) : maskPhone(String(r.customer_phone))) : null,
    due_at: r.due_at ? new Date(r.due_at as string).toISOString() : null, done_at: r.done_at ? new Date(r.done_at as string).toISOString() : null,
  }))
  const nothing = counts.total === 0 && counts.khoViec === 0 && counts.flaggedPunch === 0

  return (
    <>
      <PageHeader title="Cần duyệt" sub="Mọi thứ đang chờ bạn quyết định ở một chỗ. Việc nhân viên đã xong nên duyệt trong 24 giờ; QC chỉ cần kiểm ngẫu nhiên." />
      {nothing && <Empty>Không có gì chờ duyệt. Tốt lắm!</Empty>}

      <div className="mb-6 flex flex-wrap gap-2 text-sm">
        {[
          ['#viec', 'Việc đã xong', counts.tasks], ['#don-tu', 'Đơn từ', counts.leave], ['#ai', 'Việc AI', counts.ai],
          ['#ghep-don', 'Ghép đơn sàn', counts.claims], ['#khac', 'Mini App & Góc bếp', counts.miniErrors + counts.posts],
          ['#can-xem', 'Cần xem', counts.khoViec + counts.flaggedPunch],
        ].filter(([, , n]) => (n as number) > 0).map(([href, label, n]) => (
          <a key={href as string} href={href as string} className="rounded-full bg-white px-3 py-1 ring-1 ring-stone-200 hover:ring-emerald-400">{label} <b className="tabular-nums">{n as number}</b></a>
        ))}
      </div>

      {cards.length > 0 && (
        <section id="viec" className="mb-8">
          <h2 className="mb-1 font-semibold">Việc nhân viên đã xong hoặc bỏ qua · {counts.tasks}</h2>
          <p className="mb-2 text-xs text-stone-500">Việc bị bỏ qua đưa lên đầu. Thẻ viền đỏ là đã chờ duyệt quá 24 giờ.</p>
          <div className="grid gap-3 xl:grid-cols-2">
            {cards.map(t => (
              <div key={t.id as number} className={t.review_late ? 'rounded-xl ring-2 ring-rose-300' : ''}>
                <TaskCard task={t as never} manager staff={staff.map(s => ({ id: s.id, name: s.name }))} mine={false} />
              </div>
            ))}
          </div>
        </section>
      )}

      {leaves.length > 0 && (
        <Card title={`Đơn từ · ${counts.leave}`} pad={false} className="mb-8" actions={<Link href="/crm/don-tu" className="text-sm text-emerald-700">Tất cả đơn từ →</Link>}>
          <div id="don-tu" />
          <Table head={['Người gửi', 'Loại', 'Ngày', 'Lý do', '']}>
            {leaves.map(l => (
              <tr key={l.id}>
                <Td><div className="font-medium">{l.staff_name}</div><div className="text-xs text-stone-500">{DEPARTMENT_LABEL[l.department as Department]} · {dateTime(l.created_at)}</div></Td>
                <Td>{LEAVE_KINDS[l.kind as LeaveKind]}{l.minutes ? ` · ${l.minutes}′` : ''}</Td>
                <Td>{date(l.from_date)}{l.to_date > l.from_date ? ` → ${date(l.to_date)}` : ''}</Td>
                <Td className="max-w-xs">{l.reason}</Td>
                <Td><LeaveActions id={l.id} mode="review" /></Td>
              </tr>
            ))}
          </Table>
        </Card>
      )}

      {ai.length > 0 && (
        <section id="ai" className="mb-8">
          <div className="mb-2 flex items-baseline justify-between"><h2 className="font-semibold">Việc AI đề xuất · {counts.ai}</h2>
            <Link href="/crm/ai/duyet" className="text-sm text-emerald-700">Tất cả →</Link></div>
          <div className="space-y-3">
            {ai.map(a => (
              <div key={a.id} className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap gap-2 text-xs text-stone-500"><Badge tone="amber">{a.agent_name}</Badge><span>{ACTION_KINDS[a.kind as ActionKind]}</span>
                  {a.customer_id && <Link href={`/crm/khach-hang/${a.customer_id}`} className="text-emerald-800 hover:underline">{a.customer_name || `khách #${a.customer_id}`}</Link>}</div>
                <div className="mt-1 font-medium">{a.title}</div>
                {a.rationale && <div className="text-xs text-stone-500">Vì sao: {a.rationale}</div>}
                <div className="mt-2"><ActionControls id={a.id} status={a.status} body={a.body} editable={a.kind === 'gui_tin' || a.kind === 'tao_viec'} executedRecently={false} /></div>
              </div>
            ))}
          </div>
        </section>
      )}

      {claims.length > 0 && (
        <Card title={`Ghép đơn sàn · ${counts.claims}`} pad={false} className="mb-8" actions={<Link href="/crm/qr" className="text-sm text-emerald-700">QR & Mini App →</Link>}>
          <div id="ghep-don" />
          <Table head={['Gửi lúc', 'Mã khách gõ', 'Kết quả tra', 'Đơn tìm thấy', '']}>
            {claims.slice(0, 20).map(c => (
              <tr key={c.id}>
                <Td>{dateTime(c.created_at)}</Td>
                <Td className="font-mono text-xs">{c.order_ref_raw}</Td>
                <Td><Badge tone={c.lookup_result === 'sai_sdt' ? 'red' : 'amber'}>{LOOKUP[c.lookup_result as keyof typeof LOOKUP]}</Badge>
                  <div className="text-xs text-stone-500">{c.session_phone ? (showPhone ? c.session_phone : maskPhone(c.session_phone)) : ''}</div></Td>
                <Td className="text-xs">{c.matched_pancake_order_id ? <>{c.matched_pancake_order_id}<div className="text-stone-500">{c.order_name}</div></> : '—'}</Td>
                <Td><ClaimActions id={c.id} sessionId={c.mini_session_id} hasOrder={!!c.matched_pancake_order_id} /></Td>
              </tr>
            ))}
          </Table>
        </Card>
      )}

      {(counts.miniErrors > 0 || counts.posts > 0) && (
        <Card title="Mini App" className="mb-8"><div id="khac" />
          <ul className="space-y-2 text-sm">
            {counts.miniErrors > 0 && <li><Link href="/crm/qr" className="text-emerald-800 underline">{counts.miniErrors} đơn Mini App chưa lên POScake</Link> — tạo tay trên POScake rồi kiểm lại.</li>}
            {counts.posts > 0 && <li><Link href="/crm/cong-dong" className="text-emerald-800 underline">{counts.posts} bài Góc bếp chị em chờ duyệt</Link></li>}
          </ul>
        </Card>
      )}

      {(counts.khoViec > 0 || counts.flaggedPunch > 0) && (
        <Card title="Cần xem (không gấp)"><div id="can-xem" />
          <ul className="space-y-2 text-sm">
            {counts.khoViec > 0 && <li><Link href="/crm/kho-viec" className="text-emerald-800 underline">{counts.khoViec} việc đề xuất trong kho việc</Link> — đọc, sửa rồi bật để nhân viên nhận việc khi vào ca.</li>}
          </ul>
          {flagged.length > 0 && <>
            <p className="mt-3 text-sm font-medium">Lượt chấm công bị gắn cờ (7 ngày) — kiểm tra rồi chấp nhận nếu nhân viên thật sự có mặt:</p>
            <ul className="mt-2 divide-y divide-stone-100 text-sm">
              {flagged.map(l => (
                <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>{l.staff_name} · {l.kind === 'vao' ? 'vào' : 'ra'} {dateTime(l.at)} · {{ ngoai_vung: `ngoài vùng ${l.distance_m ?? '?'}m`, thiet_bi_la: 'máy lạ', khong_vi_tri: 'không có vị trí' }[l.validity as string] ?? l.validity}</span>
                  <AcceptPunch logId={l.id} staffId={l.staff_id} />
                </li>
              ))}
            </ul>
          </>}
        </Card>
      )}
    </>
  )
}
