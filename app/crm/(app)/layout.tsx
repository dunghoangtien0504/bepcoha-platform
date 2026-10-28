import { redirect } from 'next/navigation'
import { getDb } from '@/lib/db'
import { getCrmUser } from '@/lib/crm/session'
import { DEPARTMENT_LABEL, ROLE_LABEL } from '@/lib/crm/permissions'
import { approvalCounts, canApproveAnything } from '@/lib/crm/duyet'
import { isKho } from '@/lib/crm/san-choi'
import { Nav, OpenTabs, SectionTabs } from './nav'
import { SECTIONS, type Section } from './sections'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCrmUser()
  if (!user) redirect('/crm/dang-nhap')
  // Mỗi phân hệ chỉ giữ trang người này có quyền; phân hệ không còn trang nào thì ẩn (nhân viên bếp chỉ thấy vài mục)
  const sections: Section[] = SECTIONS
    .filter(s => s.key !== 'duyet' || canApproveAnything(user))
    .map(s => ({ ...s, tabs: s.tabs.filter(t => (!t.perm || user.permissions.includes(t.perm)) && (t.href !== '/crm/san-choi/kho' || isKho(user))) }))
    .filter(s => s.tabs.length > 0)
  const [approvals, site] = await Promise.all([
    canApproveAnything(user) ? approvalCounts(user).then(c => c.total).catch(() => 0) : Promise.resolve(0),
    getDb()`SELECT name FROM work_sites WHERE active ORDER BY id LIMIT 1`.catch(() => []),
  ])
  const words = user.name.trim().split(/\s+/)
  const initials = (words.length > 1 ? words[0][0] + words[words.length - 1][0] : user.name.slice(0, 2)).toUpperCase()
  return (
    <div className="lg:flex">
      <Nav sections={sections} approvals={approvals} siteName={site[0]?.name ?? null}
        user={{ name: user.name, role: ROLE_LABEL[user.role], dept: user.department ? DEPARTMENT_LABEL[user.department] : '', initials }} />
      <main className="min-w-0 flex-1 px-4 pb-28 pt-4 sm:px-6 lg:px-8 lg:pb-12 lg:pt-0">
        <OpenTabs sections={sections} />
        <SectionTabs sections={sections} />
        {children}
      </main>
    </div>
  )
}
