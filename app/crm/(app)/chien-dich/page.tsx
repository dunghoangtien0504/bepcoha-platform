import { listCampaigns, getCampaignArmStats } from '@/lib/db'
import { compareArms } from '@/lib/campaigns'
import { pageUser, can } from '@/lib/crm/session'
import { date, num, money } from '@/lib/crm/format'
import { PageHeader, Card, Badge, Forbidden, Note, Empty } from '../../_components/ui'
import { NewCampaign, CampaignActions } from './campaign-client'

export const metadata = { title: 'Chiến dịch' }

const VERDICT = {
  'chua-du-mau': ['Chưa đủ mẫu để kết luận', 'gray'], 'co-tac-dung': ['Có tác dụng', 'green'],
  'khong-khac-biet': ['Không khác nhóm đối chứng', 'amber'], 'tac-dung-am': ['Tác dụng ngược', 'red'],
} as const

export default async function CampaignsPage() {
  const user = await pageUser()
  if (!can(user, 'chien_dich.xem')) return <Forbidden />
  const camps = await listCampaigns()
  const stats = await Promise.all(camps.map(c => getCampaignArmStats(c.id)))
  return (
    <>
      <PageHeader title="Chiến dịch" sub="Mỗi chiến dịch giữ lại một nhóm KHÔNG liên hệ (nhóm đối chứng) để đo hiệu quả thật. Nhân viên không biết ai thuộc nhóm này." />
      <div className="mb-4"><Note>Chỉ chọn khách đã xác minh SĐT, chưa từ chối nhận tin, không nằm trong chiến dịch khác 120 ngày gần đây. Ưu đãi lấy theo bảng giá Cô Hạ duyệt — không tự ghi giá.</Note></div>
      {can(user, 'chien_dich.tao') && <div className="mb-6"><NewCampaign /></div>}
      {camps.length === 0 ? <Empty>Chưa có chiến dịch nào.</Empty> : (
        <div className="grid gap-4 lg:grid-cols-2">
          {camps.map((c, i) => {
            const s = stats[i]
            const cmp = compareArms(s.treatment, s.holdout)
            const v = VERDICT[cmp.verdict]
            return (
              <Card key={c.id} title={c.name} actions={<Badge tone={v[1]}>{v[0]}</Badge>}>
                <div className="text-xs text-stone-500">Tạo {date(c.created_at)} · mục tiêu {c.goal === 'course' ? 'mời sang khoá học' : 'mua lại'}</div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg bg-emerald-50 p-3"><div className="text-xs text-emerald-800">Nhóm liên hệ</div>
                    <div className="text-lg font-semibold tabular-nums">{num(s.treatment.hits)} / {num(s.treatment.n)}</div>
                    <div className="text-xs">{cmp.rateTreatment !== null ? (cmp.rateTreatment * 100).toFixed(1) + '%' : '—'} · {money(s.treatment.revenue)}</div></div>
                  <div className="rounded-lg bg-stone-100 p-3"><div className="text-xs text-stone-600">Nhóm đối chứng</div>
                    <div className="text-lg font-semibold tabular-nums">{num(s.holdout.hits)} / {num(s.holdout.n)}</div>
                    <div className="text-xs">{cmp.rateHoldout !== null ? (cmp.rateHoldout * 100).toFixed(1) + '%' : '—'} · {money(s.holdout.revenue)}</div></div>
                </div>
                {cmp.ci95 && <p className="mt-2 text-xs text-stone-500">Chênh lệch {(cmp.lift! * 100).toFixed(1)} điểm % (khoảng tin cậy 95%: {(cmp.ci95[0] * 100).toFixed(1)} → {(cmp.ci95[1] * 100).toFixed(1)})</p>}
                <CampaignActions id={c.id} canCreate={can(user, 'chien_dich.tao')} canExport={can(user, 'khach.xuat')} />
              </Card>
            )
          })}
        </div>
      )}
    </>
  )
}
