import Link from 'next/link'
import { getDb } from '@/lib/db'
import { pageUser, can } from '@/lib/crm/session'
import { moneyShort, date } from '@/lib/crm/format'
import { PageHeader, Tabs, Forbidden, Note } from '../../_components/ui'
import { StageSelect } from './opp-client'

export const metadata = { title: 'Cơ hội bán' }

const PIPE = { khoa_offline: 'Khoá offline', si: 'Khách sỉ', setup_quan: 'Setup quán F&B', khoa_online: 'Khoá online' } as const
const STAGES = [['moi', 'Mới'], ['tu_van', 'Đang tư vấn'], ['bao_gia', 'Đã báo giá'], ['dam_phan', 'Đàm phán'], ['da_chot', 'Đã chốt'], ['khong_chot', 'Không chốt']] as const

export default async function OppsPage(props: PageProps<'/crm/co-hoi'>) {
  const user = await pageUser()
  if (!can(user, 'co_hoi.xem')) return <Forbidden />
  const sp = await props.searchParams
  const pipe = (typeof sp.p === 'string' && sp.p in PIPE ? sp.p : 'khoa_offline') as keyof typeof PIPE
  const sql = getDb()
  const rows = await sql`
    SELECT o.id, o.title, o.stage, o.value, o.next_step_at, o.updated_at, o.lost_reason, o.customer_id, c.name AS customer_name, s.name AS owner
    FROM opportunities o JOIN customers c ON c.id = o.customer_id LEFT JOIN staff s ON s.id = o.assigned_staff_id
    WHERE o.pipeline = ${pipe} AND (o.stage NOT IN ('da_chot', 'khong_chot') OR o.updated_at > NOW() - INTERVAL '60 days')
    ORDER BY o.updated_at DESC`
  const counts = await sql`SELECT pipeline, COUNT(*) FILTER (WHERE stage NOT IN ('da_chot','khong_chot'))::int AS n FROM opportunities GROUP BY 1`
  const cnt = Object.fromEntries(counts.map(c => [c.pipeline, c.n as number]))
  const editable = can(user, 'co_hoi.sua')
  return (
    <>
      <PageHeader title="Cơ hội bán" sub="Bán giá trị cao chốt bằng điện thoại: khoá offline 4–6,5tr, combo sỉ, setup quán. Tạo cơ hội từ hồ sơ khách." />
      <Tabs current={pipe} items={Object.entries(PIPE).map(([k, v]) => ({ key: k, label: v, href: `/crm/co-hoi?p=${k}`, count: cnt[k] ?? 0 }))} />
      {rows.length === 0 && <div className="mb-4"><Note>Chưa có cơ hội ở mục này. Việc “Gọi khách lớn” tự sinh mỗi sáng là nguồn chính — mở hồ sơ khách và bấm “+ Thêm” ở ô Cơ hội bán.</Note></div>}
      <div className="flex gap-3 overflow-x-auto pb-4">
        {STAGES.map(([k, label]) => {
          const col = rows.filter(r => r.stage === k)
          const total = col.reduce((a, r) => a + Number(r.value), 0)
          return (
            <section key={k} className="w-64 shrink-0 rounded-xl bg-stone-200/60 p-2">
              <h2 className="mb-2 flex justify-between px-1 text-xs font-semibold text-stone-600"><span>{label} · {col.length}</span><span>{moneyShort(total)}</span></h2>
              <div className="space-y-2">
                {col.map(o => (
                  <article key={o.id} className="rounded-lg bg-white p-3 text-sm shadow-sm">
                    <div className="font-medium">{o.title}</div>
                    <Link href={`/crm/khach-hang/${o.customer_id}`} className="text-xs text-emerald-700 hover:underline">{o.customer_name || 'Khách #' + o.customer_id}</Link>
                    <div className="mt-1 flex justify-between text-xs text-stone-500"><span>{moneyShort(o.value)}</span><span>{o.owner ?? '—'}</span></div>
                    {o.next_step_at && <div className="text-xs text-stone-500">Bước tiếp: {date(o.next_step_at)}</div>}
                    {o.lost_reason && <div className="text-xs text-rose-600">{o.lost_reason}</div>}
                    {editable && <StageSelect id={o.id} stage={o.stage} />}
                  </article>
                ))}
              </div>
            </section>
          )
        })}
      </div>
    </>
  )
}
