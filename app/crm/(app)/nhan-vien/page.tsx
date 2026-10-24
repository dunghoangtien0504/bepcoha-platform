import { getDb } from '@/lib/db'
import { pageUser, can } from '@/lib/crm/session'
import { DEPARTMENT_LABEL, ROLE_LABEL, PERMISSION_LABEL, permissionsFor, isDepartment, isRole, type Department } from '@/lib/crm/permissions'
import { dateTime } from '@/lib/crm/format'
import { PageHeader, Card, Badge, Forbidden, Note } from '../../_components/ui'
import { NewStaff, StaffRow } from './staff-client'

export const metadata = { title: 'Nhân viên & quyền' }

export default async function StaffPage() {
  const user = await pageUser()
  if (!can(user, 'nhan_vien.quan_ly')) return <Forbidden />
  const rows = await getDb()`SELECT id, name, email, role, department, title, status, extra_permissions, last_login, locked_until, registered_device IS NOT NULL AS has_device
    FROM staff ORDER BY status, department NULLS LAST, role, name`
  return (
    <>
      <PageHeader title="Nhân viên & quyền" sub="Quyền theo vai trò + bộ phận, cấp thêm từng người khi cần. Agent/AI làm việc bằng tài khoản của ai thì chỉ có đúng quyền của người đó (B2 Z06)." />
      <div className="mb-4"><Note>Đổi vai trò, bộ phận, quyền, khoá tài khoản hay đặt lại mật khẩu đều đăng xuất người đó khỏi mọi máy ngay lập tức. Mọi thay đổi được ghi nhật ký.</Note></div>
      <div className="mb-4"><NewStaff isAdmin={user.role === 'admin'} /></div>
      <Card pad={false}>
        <div className="divide-y divide-stone-100">
          {rows.map(s => {
            const dept = isDepartment(s.department) ? s.department : null
            const perms = isRole(s.role) ? permissionsFor(s.role, dept, s.extra_permissions) : []
            return (
              <div key={s.id} className={`grid gap-3 p-4 lg:grid-cols-[1fr_2fr] ${s.status !== 'active' ? 'opacity-60' : ''}`}>
                <div>
                  <div className="font-medium">{s.name} {s.status !== 'active' && <Badge tone="red">Đã khoá</Badge>} {s.locked_until && new Date(s.locked_until) > new Date() && <Badge tone="amber">Tạm khoá do nhập sai</Badge>}</div>
                  <div className="text-sm text-stone-500">{s.email}</div>
                  <div className="mt-1 text-xs text-stone-500">{ROLE_LABEL[s.role as keyof typeof ROLE_LABEL]} · {dept ? DEPARTMENT_LABEL[dept as Department] : '—'}{s.title ? ` · ${s.title}` : ''}</div>
                  <div className="text-xs text-stone-400">Đăng nhập: {dateTime(s.last_login)} · {s.has_device ? 'đã đăng ký máy chấm công' : 'chưa đăng ký máy'}</div>
                  <div className="mt-2 flex flex-wrap gap-1">{perms.map(p => <span key={p} className="rounded bg-stone-100 px-1.5 py-0.5 text-[11px] text-stone-600">{PERMISSION_LABEL[p]}</span>)}</div>
                </div>
                <StaffRow staff={{ id: s.id, role: s.role, department: s.department, title: s.title, status: s.status, extra: s.extra_permissions }} self={s.id === user.id} isAdmin={user.role === 'admin'} />
              </div>
            )
          })}
        </div>
      </Card>
    </>
  )
}
