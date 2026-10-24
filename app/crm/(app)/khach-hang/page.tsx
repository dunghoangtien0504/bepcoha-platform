import Link from 'next/link'
import { getDb } from '@/lib/db'
import { pageUser, can } from '@/lib/crm/session'
import { listCustomers, lifecycleCounts, maskPhone } from '@/lib/crm/customers'
import { LIFECYCLE, CUSTOMER_STAGE_LABEL, SEGMENT_LABEL, PLATFORM_LABEL, type Platform } from '@/lib/crm/labels'
import { moneyShort, date, num } from '@/lib/crm/format'
import { PageHeader, Card, Table, Td, Badge, Forbidden } from '../../_components/ui'

export const metadata = { title: 'Khách hàng' }

const LC_TONE: Record<string, 'gray' | 'green' | 'blue' | 'amber' | 'red'> = { lead: 'gray', moi_mua: 'blue', mua_lai: 'green', sap_ngu: 'amber', ngu_dong: 'red' }

export default async function CustomersPage(props: PageProps<'/crm/khach-hang'>) {
  const user = await pageUser()
  if (!can(user, 'khach.xem')) return <Forbidden />
  const sp = await props.searchParams
  const s = (k: string) => (typeof sp[k] === 'string' && sp[k] !== '' ? (sp[k] as string) : undefined)
  const page = Math.max(1, Number(s('trang')) || 1)
  const assigned = s('phu_trach') === 'toi' ? user.id : s('phu_trach') === 'chua' ? 'none' as const : undefined
  const [data, counts, staff] = await Promise.all([
    listCustomers({ q: s('q'), segment: s('nhom'), lifecycle: s('vong_doi'), stage: s('giai_doan'), channel: s('kenh'), assigned,
      verified: s('xac_minh') as 'yes' | 'no' | undefined, sort: (s('sort') as 'last_order' | 'spent' | 'new') ?? 'last_order', page }),
    lifecycleCounts(),
    getDb()`SELECT COUNT(*)::int AS n FROM customers WHERE opted_out_at IS NOT NULL`,
  ])
  const showPhone = can(user, 'khach.xem_sdt')
  const cnt = Object.fromEntries(counts.map(c => [c.lifecycle, c.n as number]))
  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams()
    for (const [k, v] of Object.entries({ ...Object.fromEntries(Object.entries(sp).filter(([, v]) => typeof v === 'string')), ...patch })) if (v) p.set(k, v as string)
    return '/crm/khach-hang?' + p.toString()
  }
  const pages = Math.ceil(data.total / data.pageSize)

  return (
    <>
      <PageHeader title="Khách hàng" sub={`${num(data.total)} khách khớp bộ lọc · ${num(staff[0].n)} khách đã từ chối nhận tin (không bao giờ được liên hệ chủ động)`} />
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {Object.entries(LIFECYCLE).map(([k, v]) => (
          <Link key={k} href={qs({ vong_doi: s('vong_doi') === k ? undefined : k, trang: undefined })}
            className={`rounded-xl border bg-white p-3 text-sm shadow-sm ${s('vong_doi') === k ? 'border-emerald-600 ring-2 ring-emerald-100' : 'border-stone-200'}`}>
            <div className="text-xs text-stone-500">{v}</div>
            <div className="mt-1 text-lg font-semibold tabular-nums">{num(cnt[k] ?? 0)}</div>
          </Link>
        ))}
      </div>
      <Card pad={false}>
        <form className="grid gap-2 border-b border-stone-100 p-3 sm:grid-cols-6" action="/crm/khach-hang">
          <input name="q" defaultValue={s('q')} placeholder="Tên, SĐT, mã giới thiệu…" className="rounded-lg border border-stone-300 px-3 py-2 text-sm sm:col-span-2" />
          <select name="nhom" defaultValue={s('nhom') ?? ''} className="rounded-lg border border-stone-300 px-2 py-2 text-sm">
            <option value="">Mọi nhóm</option>{Object.entries(SEGMENT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select name="giai_doan" defaultValue={s('giai_doan') ?? ''} className="rounded-lg border border-stone-300 px-2 py-2 text-sm">
            <option value="">Mọi giai đoạn</option>{Object.entries(CUSTOMER_STAGE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select name="kenh" defaultValue={s('kenh') ?? ''} className="rounded-lg border border-stone-300 px-2 py-2 text-sm">
            <option value="">Mọi kênh</option>{Object.entries(PLATFORM_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select name="sort" defaultValue={s('sort') ?? 'last_order'} className="rounded-lg border border-stone-300 px-2 py-2 text-sm">
            <option value="last_order">Mua gần nhất</option><option value="spent">Chi tiêu nhiều</option><option value="new">Mới vào hệ thống</option>
          </select>
          <select name="phu_trach" defaultValue={s('phu_trach') ?? ''} className="rounded-lg border border-stone-300 px-2 py-2 text-sm">
            <option value="">Mọi người phụ trách</option><option value="toi">Tôi phụ trách</option><option value="chua">Chưa có người phụ trách</option>
          </select>
          <select name="xac_minh" defaultValue={s('xac_minh') ?? ''} className="rounded-lg border border-stone-300 px-2 py-2 text-sm">
            <option value="">SĐT: tất cả</option><option value="yes">Đã xác minh</option><option value="no">Chưa xác minh</option>
          </select>
          {s('vong_doi') && <input type="hidden" name="vong_doi" value={s('vong_doi')} />}
          <button className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-medium text-white">Lọc</button>
          <Link href="/crm/khach-hang" className="px-3 py-2 text-sm text-stone-500">Xoá lọc</Link>
        </form>
        <Table head={['Khách', 'SĐT', 'Nhóm', 'Vòng đời', 'Số lần mua', 'Tổng chi', 'Mua gần nhất', 'Kênh', 'Phụ trách']}>
          {data.rows.map(c => (
            <tr key={c.id} className="hover:bg-stone-50">
              <Td><Link href={`/crm/khach-hang/${c.id}`} className="font-medium text-emerald-800 hover:underline">{c.name || `Khách #${c.id}`}</Link>
                <div className="mt-0.5 flex flex-wrap gap-1">
                  {c.opted_out_at && <Badge tone="red">Từ chối nhận tin</Badge>}
                  {!c.phone_verified_at && <Badge tone="amber">Chưa xác minh</Badge>}
                  {c.is_wholesale && <Badge tone="violet">Sỉ</Badge>}
                  {c.stars && <span className="text-xs text-amber-500">{'★'.repeat(c.stars)}</span>}
                </div></Td>
              <Td className="tabular-nums">{showPhone ? c.phone : maskPhone(c.phone)}</Td>
              <Td>{(c.segments as string[]).join(', ') || '—'}</Td>
              <Td><Badge tone={LC_TONE[c.lifecycle] ?? 'gray'}>{LIFECYCLE[c.lifecycle as keyof typeof LIFECYCLE]?.split(' (')[0].split(',')[0] ?? c.lifecycle}</Badge></Td>
              <Td className="tabular-nums">{c.order_count}</Td>
              <Td className="tabular-nums">{moneyShort(c.total_spent)}</Td>
              <Td>{date(c.last_order_at)}</Td>
              <Td>{c.main_channel ? PLATFORM_LABEL[c.main_channel as Platform] : '—'}</Td>
              <Td>{c.assignee_name ?? <span className="text-stone-400">—</span>}</Td>
            </tr>
          ))}
        </Table>
        <div className="flex items-center justify-between border-t border-stone-100 px-3 py-2 text-sm text-stone-500">
          <span>Trang {page}/{Math.max(1, pages)}</span>
          <span className="flex gap-2">
            {page > 1 && <Link className="rounded border border-stone-300 px-2 py-1" href={qs({ trang: String(page - 1) })}>← Trước</Link>}
            {page < pages && <Link className="rounded border border-stone-300 px-2 py-1" href={qs({ trang: String(page + 1) })}>Sau →</Link>}
          </span>
        </div>
      </Card>
    </>
  )
}
