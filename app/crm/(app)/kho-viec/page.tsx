import { getDb } from '@/lib/db'
import { pageUser, can } from '@/lib/crm/session'
import { listTemplates, REPEAT_LABEL, type Repeat } from '@/lib/crm/kho-viec'
import { DEPARTMENT_LABEL, managesDept, type Department } from '@/lib/crm/permissions'
import { PageHeader, Card, Badge, Forbidden, Note } from '../../_components/ui'
import { TemplateForm, TemplateRowActions, EMPTY_TEMPLATE } from './kho-client'

export const metadata = { title: 'Kho việc' }

const offsetLabel = (m: number | null) => m == null ? 'trước hết ca' : m < 60 ? `${m} phút đầu ca` : `${Math.floor(m / 60)} giờ${m % 60 ? ` ${m % 60}′` : ''} đầu ca`

export default async function KhoViecPage() {
  const user = await pageUser()
  if (!can(user, 'viec.giao')) return <Forbidden />
  const sql = getDb()
  const [all, shifts] = await Promise.all([listTemplates(), sql`SELECT code, name FROM shift_templates WHERE active ORDER BY start_time`])
  // Quản lý chỉ thấy và sửa kho việc bộ phận mình; ban giám đốc / admin thấy tất cả
  const rows = all.filter(r => managesDept(user, r.department))
  const shiftList = shifts.map(s => ({ code: s.code as string, name: s.name as string }))
  const byDept = new Map<string, Map<string, typeof rows>>()
  for (const r of rows) {
    const d = byDept.get(r.department) ?? new Map(); byDept.set(r.department, d)
    const g = d.get(r.group_name || 'Khác') ?? []; g.push(r); d.set(r.group_name || 'Khác', g)
  }
  const proposed = rows.filter(r => r.source === 'de_xuat' && !r.active).length
  return (
    <>
      <PageHeader title="Kho việc" sub="Việc cha → việc con → bộ phận. Nhân viên chấm công vào ca là nhận ngay việc của bộ phận mình cho ca đó (5–10 việc), mỗi việc là một danh sách cần làm." />
      <div className="mb-4 space-y-2">
        <Note>Dựng kho việc từ hành trình khách và tiêu chuẩn dịch vụ (cứng · mềm), cộng các mốc việc hằng ngày (Buổi 2 · Easymart). Việc nào cần ảnh thì ghi “chụp ảnh” trong danh sách.</Note>
        {proposed > 0 && <Note tone="warn">Có {proposed} việc đề xuất sẵn cho HACO (đang tắt). Đọc, sửa cho đúng thực tế bếp rồi bấm “Duyệt &amp; bật”.</Note>}
      </div>
      <Card title="Thêm việc vào kho" className="mb-6"><TemplateForm initial={{ ...EMPTY_TEMPLATE, department: user.department && user.department !== 'ban_giam_doc' ? user.department : EMPTY_TEMPLATE.department }} shifts={shiftList} /></Card>
      {[...byDept.entries()].map(([dept, groups]) => (
        <section key={dept} className="mb-6">
          <h2 className="mb-2 font-semibold">{DEPARTMENT_LABEL[dept as Department] ?? dept}</h2>
          <div className="space-y-3">
            {[...groups.entries()].map(([group, items]) => (
              <Card key={group} title={group} pad={false}>
                <ul className="divide-y divide-stone-100">
                  {items.map(t => {
                    const checklist = (t.checklist as { text: string }[]) ?? []
                    return (
                      <li key={t.id} className={`px-4 py-3 ${t.active ? '' : 'bg-stone-50'}`}>
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-medium">{t.title}</div>
                            <div className="mt-0.5 text-xs text-stone-500">{REPEAT_LABEL[t.repeat as Repeat]} · xong {offsetLabel(t.due_offset_min)}{t.shift_code ? ` · chỉ ca ${t.shift_code}` : ''}</div>
                            {checklist.length > 0 && <ul className="mt-1 list-inside list-disc text-xs text-stone-600">{checklist.map((c, i) => <li key={i}>{c.text}</li>)}</ul>}
                          </div>
                          <Badge tone={t.active ? 'green' : t.source === 'de_xuat' ? 'amber' : 'gray'}>{t.active ? 'Đang dùng' : t.source === 'de_xuat' ? 'Đề xuất chờ duyệt' : 'Đang tắt'}</Badge>
                        </div>
                        <div className="mt-2">
                          <TemplateRowActions active={t.active} proposed={t.source === 'de_xuat'} shifts={shiftList} value={{
                            id: t.id, department: t.department, group_name: t.group_name, title: t.title, checklist: checklist.map(c => c.text).join('\n'),
                            repeat: t.repeat, due_offset_min: t.due_offset_min == null ? '' : String(t.due_offset_min), shift_code: t.shift_code ?? '', sort: String(t.sort),
                          }} />
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </Card>
            ))}
          </div>
        </section>
      ))}
    </>
  )
}
