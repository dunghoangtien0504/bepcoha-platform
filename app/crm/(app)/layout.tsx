import { redirect } from 'next/navigation'
import { getCrmUser } from '@/lib/crm/session'
import { DEPARTMENT_LABEL, ROLE_LABEL } from '@/lib/crm/permissions'
import { Nav, type NavItem } from './nav'

const NAV: NavItem[] = [
  { href: '/crm', label: 'Tổng quan', icon: '◎', perm: null },
  { href: '/crm/viec', label: 'Việc của tôi', icon: '✓', perm: 'viec.cua_toi' },
  { href: '/crm/khach-hang', label: 'Khách hàng', icon: '☺', perm: 'khach.xem' },
  { href: '/crm/co-hoi', label: 'Cơ hội bán', icon: '◆', perm: 'co_hoi.xem' },
  { href: '/crm/chien-dich', label: 'Chiến dịch', icon: '✉', perm: 'chien_dich.xem' },
  { href: '/crm/qr', label: 'QR & Mini App', icon: '▦', perm: 'qr.xem' },
  { href: '/crm/cong-dong', label: 'Góc bếp chị em', icon: '❀', perm: 'su_kien.quan_ly' },
  { href: '/crm/cham-cong', label: 'Chấm công', icon: '◷', perm: 'cham_cong.cua_toi', group: 'Nhân sự' },
  { href: '/crm/phan-ca', label: 'Xếp ca', icon: '▤', perm: 'cham_cong.phan_ca', group: 'Nhân sự' },
  { href: '/crm/bang-cong', label: 'Bảng công', icon: '▥', perm: 'cham_cong.cua_toi', group: 'Nhân sự' },
  { href: '/crm/don-tu', label: 'Đơn từ', icon: '✎', perm: 'cham_cong.cua_toi', group: 'Nhân sự' },
  { href: '/crm/bao-cao', label: 'Báo cáo', icon: '▲', perm: 'bao_cao.xem', group: 'Quản trị' },
  { href: '/crm/nhan-vien', label: 'Nhân viên & quyền', icon: '♟', perm: 'nhan_vien.quan_ly', group: 'Quản trị' },
  { href: '/crm/nhat-ky', label: 'Nhật ký thao tác', icon: '≡', perm: 'nhat_ky.xem', group: 'Quản trị' },
  { href: '/crm/cai-dat', label: 'Cài đặt', icon: '⚙', perm: 'cai_dat.sua', group: 'Quản trị' },
]

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCrmUser()
  if (!user) redirect('/crm/dang-nhap')
  const items = NAV.filter(n => !n.perm || user.permissions.includes(n.perm))
  const who = `${user.name} · ${user.department ? DEPARTMENT_LABEL[user.department] : ROLE_LABEL[user.role]}`
  return (
    <div className="lg:flex">
      <Nav items={items} who={who} />
      <main className="min-w-0 flex-1 px-4 pb-24 pt-4 sm:px-6 lg:px-8 lg:pt-8">{children}</main>
    </div>
  )
}
