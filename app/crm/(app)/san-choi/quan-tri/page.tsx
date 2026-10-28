import { getDb } from '@/lib/db'
import { pageUser, can } from '@/lib/crm/session'
import { DEPARTMENT_LABEL, DEPARTMENTS } from '@/lib/crm/permissions'
import { ensureSanChoiSchema, getSettings } from '@/lib/crm/san-choi'
import { money } from '@/lib/crm/format'
import { Card, PageHeader, Forbidden, Table } from '../../../_components/ui'
import { SettingsForm, PrizeRow } from './admin-client'

export const metadata = { title: 'Quản trị vòng quay' }

/** Quản trị vòng quay: trần ngân sách, bộ phận chơi, voucher, quỹ cấp tay; tỷ lệ từng ô quà. */
export default async function SanChoiAdmin() {
  const user = await pageUser()
  if (!can(user, 'cai_dat.sua')) return <Forbidden />
  await ensureSanChoiSchema()
  const [s, prizes] = await Promise.all([getSettings(), getDb()`SELECT * FROM sc_prizes ORDER BY sort, id`])
  const r = { settings: s }
  const totalWeight = prizes.filter(p => p.active).reduce((a, p) => a + Number(p.weight), 0)
  const ev = prizes.filter(p => p.active && p.kind === 'tien').reduce((a, p) => a + Number(p.value) * Number(p.weight), 0) / (totalWeight || 1)
  return (
    <>
      <PageHeader title="Quản trị vòng quay" sub="Đổi tỷ lệ là đổi chi phí: tiền trung bình mỗi lượt hiện ở tiêu đề bảng ô quà." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Trần ngân sách & bộ phận thí điểm">
          <SettingsForm settings={r.settings} departments={DEPARTMENTS.map(d => ({ key: d, label: DEPARTMENT_LABEL[d] }))} />
        </Card>
        <Card title={`Ô quà vòng quay · trung bình ≈ ${money(Math.round(ev))}/lượt`} pad={false}>
          <Table head={['Ô quà', 'Tỷ lệ', 'Bật', '']}>
            {prizes.map(p => <PrizeRow key={p.id} prize={{ id: p.id, label: p.label, weight: Number(p.weight), active: p.active }} total={totalWeight} />)}
          </Table>
          <p className="p-3 text-xs text-stone-500">Tỷ lệ tính trên tổng các ô đang bật. Hết ngân sách tuần thì ô tiền tạm khoá, vòng quay chỉ ra quà không tốn tiền.</p>
        </Card>
      </div>
    </>
  )
}
