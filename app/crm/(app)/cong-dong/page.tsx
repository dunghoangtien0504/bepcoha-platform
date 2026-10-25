import { pageUser, can } from '@/lib/crm/session'
import { dateTime } from '@/lib/crm/format'
import { ensureCrmSchema } from '@/lib/crm/schema'
import { listForReview, type PostStatus } from '@/lib/mini/community'
import { PageHeader, Card, Badge, Forbidden, Note, Tabs } from '../../_components/ui'
import { ModerateButtons } from './moderate-client'

export const metadata = { title: 'Góc bếp chị em' }

const STATUS: Record<PostStatus, { label: string; tone: 'amber' | 'green' | 'red' | 'gray' }> = {
  cho_duyet: { label: 'Chờ duyệt', tone: 'amber' },
  da_duyet: { label: 'Đã đăng', tone: 'green' },
  tu_choi: { label: 'Từ chối', tone: 'red' },
  an: { label: 'Đã ẩn', tone: 'gray' },
}

// Duyệt ảnh khách đăng ở Góc bếp chị em (Mini App). Chỉ bài đã duyệt mới hiện cho người khác.
export default async function CommunityReviewPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await pageUser()
  if (!can(user, 'su_kien.quan_ly')) return <Forbidden />
  await ensureCrmSchema()
  const { tab = 'cho_duyet' } = await searchParams
  const status = (['cho_duyet', 'da_duyet', 'tu_choi', 'an', 'tat_ca'].includes(tab) ? tab : 'cho_duyet') as PostStatus | 'tat_ca'
  const rows = await listForReview(status)
  return (
    <>
      <PageHeader title="Góc bếp chị em" sub="Ảnh món khách đăng trong Mini App. Duyệt xong mới hiện cho người khác." />
      <div className="mb-4">
        <Note>
          Duyệt trong 24 giờ. Từ chối khi: ảnh không phải món ăn, ảnh có mặt người hoặc thông tin cá nhân, nội dung quảng cáo hay lời lẽ không phù hợp.
          Mini App không có thả tim, bình luận (chính sách Zalo 4.6) — khen bằng nút &quot;Duyệt + khen&quot;.
        </Note>
      </div>
      <Tabs
        current={status}
        items={[
          { key: 'cho_duyet', label: 'Chờ duyệt', href: '/crm/cong-dong?tab=cho_duyet' },
          { key: 'da_duyet', label: 'Đã đăng', href: '/crm/cong-dong?tab=da_duyet' },
          { key: 'tu_choi', label: 'Từ chối', href: '/crm/cong-dong?tab=tu_choi' },
          { key: 'an', label: 'Đã ẩn', href: '/crm/cong-dong?tab=an' },
          { key: 'tat_ca', label: 'Tất cả', href: '/crm/cong-dong?tab=tat_ca' },
        ]}
      />
      <Card pad={false} className="mt-4">
        {rows.length === 0 ? (
          <p className="p-4 text-sm text-stone-500">Không có bài nào.</p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {rows.map(p => {
              const st = STATUS[p.status as PostStatus]
              return (
                <li key={p.id} className="flex flex-col gap-3 p-4 sm:flex-row">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/crm/community/${p.id}/image`} alt="" className="h-40 w-40 flex-none rounded-lg object-cover" />
                  <div className="min-w-0 flex-1 space-y-1 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={st.tone}>{st.label}</Badge>
                      {p.praised && <Badge tone="green">Cô Hạ khen</Badge>}
                      {p.pinned && <Badge tone="amber">Ghim</Badge>}
                      <span className="text-stone-500">{dateTime(p.created_at)}</span>
                    </div>
                    <p className="whitespace-pre-wrap">{p.caption}</p>
                    <p className="text-stone-500">
                      {p.display_name || '(không ghi tên)'} {p.area && `· ${p.area}`} {p.recipe_slug && `· món: ${p.recipe_slug}`}
                      {p.customer_id && <> · khách #{p.customer_id}</>}
                    </p>
                    {p.reject_reason && <p className="text-rose-700">Lý do từ chối: {p.reject_reason}</p>}
                    {p.reviewer && <p className="text-xs text-stone-400">Người duyệt: {p.reviewer}</p>}
                    <ModerateButtons id={p.id} status={p.status as PostStatus} pinned={!!p.pinned} />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </>
  )
}
