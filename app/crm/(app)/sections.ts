// Menu theo PHÂN HỆ kiểu EasyERP (Buổi 2 · Easymart, khung hình bài 11 · 10:56 và bài 12 · 2:53 — xem EASYERP-BOC-KHUNG-HINH.md):
// thanh bên trái gập/mở từng phân hệ, mỗi phân hệ chia nhóm nhỏ (VẬN HÀNH / CÀI ĐẶT / QUẢN TRỊ).
// "Hôm nay" và "Cần duyệt" đứng riêng trên cùng vì nhân viên mở app là vào đó.
import type { Permission } from '@/lib/crm/permissions'

export interface SectionTab { href: string; label: string; perm: Permission | null; icon?: string; sub?: string }
export interface Section { key: string; label: string; icon: string; tabs: SectionTab[]; group?: string; module?: boolean }

export const SECTIONS: Section[] = [
  { key: 'hom-nay', label: 'Hôm nay', icon: 'sun', tabs: [{ href: '/crm', label: 'Hôm nay', perm: null, icon: 'sun' }] },
  { key: 'duyet', label: 'Cần duyệt', icon: 'check', tabs: [{ href: '/crm/duyet', label: 'Cần duyệt', perm: null, icon: 'check' }] },
  { key: 'tasklist', label: 'Phân hệ TaskList', icon: 'list', module: true, tabs: [
    { href: '/crm/viec', label: 'Việc của tôi', perm: 'viec.cua_toi', icon: 'list', sub: 'Vận hành' },
    { href: '/crm/viec/tuan', label: 'Giao việc theo tuần', perm: 'viec.cua_toi', icon: 'calendar', sub: 'Vận hành' },
    { href: '/crm/du-an', label: 'Dự án & hạn chót', perm: 'viec.cua_toi', icon: 'folder', sub: 'Vận hành' },
    { href: '/crm/kho-viec', label: 'Kho việc (mẫu việc)', perm: 'viec.giao', icon: 'clipboard', sub: 'Cài đặt' },
  ] },
  { key: 'cham-cong', label: 'Phân hệ Chấm công', icon: 'clock', module: true, tabs: [
    { href: '/crm/cham-cong', label: 'Chấm công của tôi', perm: 'cham_cong.cua_toi', icon: 'clock' },
    { href: '/crm/phan-ca', label: 'Xếp ca', perm: 'cham_cong.phan_ca', icon: 'calendar' },
    { href: '/crm/bang-cong', label: 'Bảng công', perm: 'cham_cong.cua_toi', icon: 'file' },
    { href: '/crm/don-tu', label: 'Đơn từ', perm: 'cham_cong.cua_toi', icon: 'inbox' },
  ] },
  // Sân chơi (B2 bài 12): đủ 6 trang của Easymart (trừ "Săn Số Vàng" — luật không rõ vì bị làm mờ) + 4 trang quản trị
  { key: 'san-choi', label: 'Sân chơi', icon: 'gift', module: true, tabs: [
    { href: '/crm/san-choi', label: 'Vòng quay của tôi', perm: 'cham_cong.cua_toi', icon: 'gift' },
    { href: '/crm/san-choi/vi', label: 'Ví của tôi', perm: 'cham_cong.cua_toi', icon: 'wallet' },
    { href: '/crm/san-choi/bang-tin', label: 'Bảng tin', perm: 'cham_cong.cua_toi', icon: 'news' },
    { href: '/crm/san-choi/bang-vang', label: 'Bảng Vàng', perm: 'cham_cong.cua_toi', icon: 'trophy' },
    { href: '/crm/san-choi/chuoi', label: 'Chuỗi của tôi', perm: 'cham_cong.cua_toi', icon: 'flame' },
    { href: '/crm/san-choi/to-doi', label: 'Tổ đội', perm: 'cham_cong.cua_toi', icon: 'team' },
    { href: '/crm/san-choi/kho', label: 'Quét voucher tại kho', perm: 'qr.xem', icon: 'scan', sub: 'Quản trị' },
    { href: '/crm/san-choi/cap-luot', label: 'Cấp / Bỏ lượt', perm: 'cai_dat.sua', icon: 'users', sub: 'Quản trị' },
    { href: '/crm/san-choi/quan-tri', label: 'Quản trị vòng quay', perm: 'cai_dat.sua', icon: 'settings', sub: 'Quản trị' },
    { href: '/crm/san-choi/quy', label: 'Quỹ lượt quay & đổi thưởng', perm: 'cai_dat.sua', icon: 'coins', sub: 'Quản trị' },
    { href: '/crm/san-choi/bao-cao', label: 'Báo cáo Sân chơi', perm: 'cai_dat.sua', icon: 'chart', sub: 'Quản trị' },
  ] },
  { key: 'khach', label: 'Phân hệ Khách hàng', icon: 'heart', module: true, tabs: [
    { href: '/crm/khach-hang', label: 'Khách hàng', perm: 'khach.xem', icon: 'users' },
    { href: '/crm/co-hoi', label: 'Cơ hội bán', perm: 'co_hoi.xem', icon: 'target' },
    { href: '/crm/chien-dich', label: 'Chiến dịch', perm: 'chien_dich.xem', icon: 'news' },
  ] },
  { key: 'mini', label: 'Phân hệ Mini App', icon: 'phone', module: true, tabs: [
    { href: '/crm/qr', label: 'QR & đơn Mini App', perm: 'qr.xem', icon: 'scan' },
    { href: '/crm/su-kien', label: 'Sự kiện', perm: 'su_kien.quan_ly', icon: 'calendar' },
    { href: '/crm/thong-bao', label: 'Thông báo', perm: 'su_kien.quan_ly', icon: 'inbox' },
    { href: '/crm/cong-dong', label: 'Góc bếp chị em', perm: 'su_kien.quan_ly', icon: 'heart' },
  ] },
  { key: 'ai', label: 'Trung tâm AI', icon: 'bot', module: true, tabs: [
    { href: '/crm/ai', label: 'Bản đồ & điều khiển', perm: 'ai.xem', icon: 'bot' },
    { href: '/crm/ai/duyet', label: 'Duyệt việc AI', perm: 'ai.xem', icon: 'check' },
  ] },
  { key: 'bao-cao', label: 'Báo cáo', icon: 'chart', module: true, tabs: [{ href: '/crm/bao-cao', label: 'Báo cáo kinh doanh', perm: 'bao_cao.xem', icon: 'chart' }] },
  { key: 'quan-tri', label: 'Phân hệ Quản trị', icon: 'settings', module: true, tabs: [
    { href: '/crm/nhan-vien', label: 'Nhân viên & quyền', perm: 'nhan_vien.quan_ly', icon: 'users' },
    { href: '/crm/nhat-ky', label: 'Nhật ký thao tác', perm: 'nhat_ky.xem', icon: 'log' },
    { href: '/crm/cai-dat', label: 'Cài đặt', perm: 'cai_dat.sua', icon: 'settings' },
  ] },
]

/** Mục đang mở: tab có đường dẫn khớp dài nhất (vd /crm/ai/duyet thuộc Trung tâm AI, /crm thuộc Hôm nay). */
export function activeTab(path: string, sections: Section[]) {
  let best: { section: Section; tab: SectionTab } | null = null
  for (const section of sections) for (const tab of section.tabs) {
    const hit = tab.href === '/crm' ? path === '/crm' : path === tab.href || path.startsWith(tab.href + '/')
    if (hit && (!best || tab.href.length > best.tab.href.length)) best = { section, tab }
  }
  return best
}
