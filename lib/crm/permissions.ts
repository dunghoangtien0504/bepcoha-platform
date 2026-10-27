// Phân quyền CRM (viên gạch "Phân quyền" — B2 Z03, Z06).
// Quyền là danh sách hành động cứng; vai trò + bộ phận quyết định quyền mặc định, admin có thể cấp thêm từng người.
// Agent/AI gọi API bằng token của người dùng nên chỉ làm được đúng những gì người đó được làm.

export const ROLES = ['admin', 'quan_ly', 'staff'] as const
export type Role = typeof ROLES[number]

export const DEPARTMENTS = ['ban_giam_doc', 'sale_cskh', 'marketing', 'san_tmdt', 'bep', 'kho_van', 'dao_tao'] as const
export type Department = typeof DEPARTMENTS[number]

export const DEPARTMENT_LABEL: Record<Department, string> = {
  ban_giam_doc: 'Ban giám đốc',
  sale_cskh: 'Sale & CSKH',
  marketing: 'Marketing & Content',
  san_tmdt: 'Vận hành sàn',
  bep: 'Bếp sản xuất',
  kho_van: 'Kho & đóng gói',
  dao_tao: 'Đào tạo (khoá học)',
}

export const ROLE_LABEL: Record<Role, string> = { admin: 'Quản trị', quan_ly: 'Quản lý', staff: 'Nhân viên' }

export const PERMISSIONS = [
  'khach.xem',          // xem danh sách + hồ sơ khách
  'khach.xem_sdt',      // thấy đủ số điện thoại (không bị che)
  'khach.sua',          // đổi giai đoạn, nhóm, ghi chú, người phụ trách
  'khach.xuat',         // xuất danh sách (dữ liệu cá nhân)
  'viec.cua_toi',       // xem + làm việc được giao cho mình
  'viec.giao',          // tạo/giao việc cho người khác, duyệt kết quả
  'co_hoi.xem',
  'co_hoi.sua',
  'chien_dich.xem',
  'chien_dich.tao',
  'qr.xem',
  'qr.quan_ly',         // tạo lô QR, duyệt ghép đơn sàn
  'su_kien.quan_ly',    // tạo sự kiện, soạn thông báo trong Mini App
  'ai.xem',             // xem Trung tâm AI, bấm DỪNG KHẨN CẤP (dừng thì ai cũng được bấm)
  'ai.duyet',           // duyệt / từ chối / hoàn tác việc agent đề xuất
  'ai.quan_ly',         // đổi mức tự chủ agent, bật/tắt agent, mô phỏng, cho chạy lại sau dừng khẩn cấp
  'cham_cong.cua_toi',  // tự chấm công, xem ca của mình, gửi đơn
  'cham_cong.phan_ca',  // xếp ca cho bộ phận mình
  'cham_cong.duyet',    // duyệt đơn từ, sửa công
  'cham_cong.bang_cong',// xem bảng công toàn công ty
  'bao_cao.xem',        // bảng 6 con số, chỉ số giữ khách
  'nhan_vien.quan_ly',
  'nhat_ky.xem',
  'cai_dat.sua',
] as const
export type Permission = typeof PERMISSIONS[number]

export const PERMISSION_LABEL: Record<Permission, string> = {
  'khach.xem': 'Xem khách hàng',
  'khach.xem_sdt': 'Thấy đủ số điện thoại',
  'khach.sua': 'Sửa hồ sơ khách',
  'khach.xuat': 'Xuất danh sách khách',
  'viec.cua_toi': 'Làm việc của mình',
  'viec.giao': 'Giao việc, duyệt việc',
  'co_hoi.xem': 'Xem cơ hội bán',
  'co_hoi.sua': 'Sửa cơ hội bán',
  'chien_dich.xem': 'Xem chiến dịch',
  'chien_dich.tao': 'Tạo chiến dịch',
  'qr.xem': 'Xem lô QR & Mini App',
  'qr.quan_ly': 'Quản lý lô QR, duyệt ghép đơn',
  'su_kien.quan_ly': 'Tạo sự kiện, gửi thông báo Mini App',
  'ai.xem': 'Xem Trung tâm AI, dừng khẩn cấp',
  'ai.duyet': 'Duyệt việc agent AI đề xuất',
  'ai.quan_ly': 'Quản lý agent AI, cho chạy lại sau dừng',
  'cham_cong.cua_toi': 'Tự chấm công, gửi đơn',
  'cham_cong.phan_ca': 'Xếp ca bộ phận',
  'cham_cong.duyet': 'Duyệt đơn, sửa công',
  'cham_cong.bang_cong': 'Xem bảng công toàn công ty',
  'bao_cao.xem': 'Xem báo cáo',
  'nhan_vien.quan_ly': 'Quản lý nhân viên',
  'nhat_ky.xem': 'Xem nhật ký thao tác',
  'cai_dat.sua': 'Sửa cài đặt',
}

const BASE: Permission[] = ['viec.cua_toi', 'cham_cong.cua_toi']
const CUSTOMER_FACING: Permission[] = ['khach.xem', 'khach.xem_sdt', 'khach.sua', 'co_hoi.xem', 'co_hoi.sua', 'chien_dich.xem', 'qr.xem', 'ai.xem']

const BY_DEPARTMENT: Record<Department, Permission[]> = {
  ban_giam_doc: [...PERMISSIONS],
  sale_cskh: CUSTOMER_FACING,
  marketing: ['khach.xem', 'chien_dich.xem', 'qr.xem', 'su_kien.quan_ly', 'bao_cao.xem', 'ai.xem'],
  san_tmdt: ['khach.xem', 'qr.xem', 'qr.quan_ly'],
  bep: [],
  kho_van: ['qr.xem'],
  dao_tao: ['khach.xem', 'khach.xem_sdt', 'co_hoi.xem', 'co_hoi.sua'],
}

const MANAGER_EXTRA: Permission[] = ['viec.giao', 'cham_cong.phan_ca', 'cham_cong.duyet', 'bao_cao.xem', 'chien_dich.tao', 'ai.xem', 'ai.duyet']

export function permissionsFor(role: Role, department: Department | null, extra: string[] = []): Permission[] {
  if (role === 'admin') return [...PERMISSIONS]
  const set = new Set<Permission>(BASE)
  for (const p of department ? BY_DEPARTMENT[department] : []) set.add(p)
  if (role === 'quan_ly') for (const p of MANAGER_EXTRA) set.add(p)
  for (const p of extra) if ((PERMISSIONS as readonly string[]).includes(p)) set.add(p as Permission)
  return [...set]
}

export function isRole(v: unknown): v is Role { return typeof v === 'string' && (ROLES as readonly string[]).includes(v) }
export function isDepartment(v: unknown): v is Department { return typeof v === 'string' && (DEPARTMENTS as readonly string[]).includes(v) }
