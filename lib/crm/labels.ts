// Nhãn & hằng số dùng chung cho cả máy chủ và trình duyệt (KHÔNG import thư viện database ở đây).

export const TASK_KINDS = {
  sau_giao: 'Hỏi thăm sau giao hàng',
  hoi_ket_qua: 'Hỏi kết quả, xin ảnh/review',
  goi_y_tiep: 'Gợi ý sản phẩm kế tiếp',
  goi_vip: 'Gọi khách lớn (mời khoá offline/sỉ)',
  danh_thuc: 'Đánh thức khách lâu không mua',
  khach_hoi: 'Theo đuổi khách hỏi chưa chốt',
  sinh_nhat: 'Chúc mừng sinh nhật',
  gioi_thieu: 'Tri ân người giới thiệu',
  ghep_don: 'Duyệt ghép đơn sàn (Mini App)',
  duyet_don_tu: 'Duyệt đơn từ chấm công',
  noi_bo: 'Việc nội bộ / theo ca',
  khac: 'Khác',
} as const
export type TaskKind = keyof typeof TASK_KINDS

export const TASK_RESULTS = {
  da_lien_he: 'Đã liên hệ, khách phản hồi tốt',
  chot_don: 'Khách đặt đơn',
  hen_lai: 'Hẹn gọi lại',
  khong_nghe: 'Không nghe máy / chưa đọc',
  tu_choi: 'Khách không muốn nhận tin nữa',
  sai_so: 'Sai số / không phải khách',
  da_xong: 'Đã xong (việc nội bộ)',
} as const
export type TaskResult = keyof typeof TASK_RESULTS


/** Gợi ý món kế tiếp theo dòng sản phẩm đã mua (00-MASTER-BLUEPRINT, L5). */
export const NEXT_OFFER: Partial<Record<ProductLine, string>> = {
  xoi_com: 'Khăn đồ xôi (nếu chưa có), Cốm 1kg, Bột khúc',
  com_kho: 'Bột cốt dừa, Khăn đồ xôi',
  bot_khuc: 'Sét nguyên liệu xôi khúc',
  sot_xa_xiu: 'Sốt trộn nộm, Sốt nướng',
  sot_nuong: 'Sốt xá xíu, Sốt chấm gà',
  sot_tron_nom: 'Sốt xá xíu',
  che_com: 'Cốm 1kg, Bột cốt dừa',
  hat_sen: 'Sét chè cốm, Bột cốt dừa',
  khoa_hoc: 'Khoá offline (gọi điện tư vấn)',
}


export const LEAVE_KINDS = {
  nghi_phep: 'Nghỉ phép', nghi_om: 'Nghỉ ốm', nghi_khong_luong: 'Nghỉ không lương', doi_ca: 'Đổi ca',
  quen_cham_cong: 'Quên chấm công', di_muon_ve_som: 'Đi muộn / về sớm có lý do', tang_ca: 'Tăng ca',
} as const
export type LeaveKind = keyof typeof LEAVE_KINDS

export const DAY_STATUS_LABEL = {
  du_cong: 'Đủ công', di_muon: 'Đi muộn', ve_som: 'Về sớm', muon_som: 'Muộn + sớm', thieu_cham: 'Thiếu lượt chấm',
  vang: 'Vắng', nghi_co_phep: 'Nghỉ có phép', chua_den: 'Chưa tới ca', dang_lam: 'Đang trong ca',
} as const
export type DayStatus = keyof typeof DAY_STATUS_LABEL


/** Trục F (số lần mua) và R (độ mới) — HACO-LOOP/01 mục 2. */
export const LIFECYCLE = {
  lead: 'Chưa mua (khách hỏi)',
  moi_mua: 'Mua 1 lần, còn mới (≤ 60 ngày)',
  mua_lai: 'Mua ≥ 2 lần, còn mới',
  sap_ngu: 'Lâu chưa mua (61–120 ngày)',
  ngu_dong: 'Ngủ đông (> 120 ngày)',
} as const
export type Lifecycle = keyof typeof LIFECYCLE

export const CUSTOMER_STAGE_LABEL: Record<string, string> = {
  moi: 'Mới', dang_tu_van: 'Đang tư vấn', da_chot: 'Đã chốt', can_cham_soc: 'Cần chăm sóc', khong_chot: 'Không chốt',
}

export const SEGMENT_LABEL: Record<string, string> = {
  A: 'A · Bữa cơm nhà', B: 'B · Kiếm thêm từ bếp (sỉ)', C: 'C · Học nấu bài bản', D: 'D · Mở quán',
}


// ── Quy tắc số liệu khớp màn Thống kê Pancake (skill hacofood-baocao bản 2, đối chiếu 19/10/2026) ──────────
// Đơn chốt  = mọi trạng thái trừ Mới (0), Đã hủy (6), Đã xóa (7).
// Doanh thu = đơn chốt trừ thêm Đã hoàn (5). Đang hoàn (4) vẫn tính.
// Tỷ lệ hủy = Đã hủy / (đơn trừ Mới). Tỷ lệ hoàn = (Đã hoàn + Đang hoàn) / đơn chốt.
export const STATUS_LABEL: Record<number, string> = {
  0: 'Mới', 1: 'Đã xác nhận', 2: 'Đã gửi hàng', 3: 'Đã nhận', 4: 'Đang hoàn', 5: 'Đã hoàn', 6: 'Đã hủy', 7: 'Đã xóa',
  8: 'Đang đóng hàng', 9: 'Chờ chuyển hàng', 11: 'Chờ hàng', 12: 'Chờ in', 13: 'Đã in', 15: 'Hoàn một phần', 16: 'Đã thu tiền', 20: 'Đã đặt hàng',
}
export const NOT_CLOSED_STATUSES = [0, 6, 7] as const
export const NOT_REVENUE_STATUSES = [0, 5, 6, 7] as const
export const RETURNING_STATUSES = [4, 5] as const
export const isClosedStatus = (s: number) => !(NOT_CLOSED_STATUSES as readonly number[]).includes(s)
export const countsRevenue = (s: number) => !(NOT_REVENUE_STATUSES as readonly number[]).includes(s)

export type Platform = 'facebook' | 'tiktok' | 'shopee' | 'lazada' | 'web' | 'zalo' | 'bep' | 'khac'
export const PLATFORM_LABEL: Record<Platform, string> = {
  facebook: 'Facebook', tiktok: 'TikTok Shop', shopee: 'Shopee', lazada: 'Lazada', web: 'Landing Page', zalo: 'Zalo',
  bep: 'Tại bếp', khac: 'Nhập tay / Khác',
}
/** Đơn sàn: doanh thu = tiền sàn trả (COD + trả trước), không phải giá niêm yết. */
export const MARKETPLACES: readonly Platform[] = ['shopee', 'tiktok', 'lazada']

/** Nhóm sản phẩm cho báo cáo — đúng bảng RULES của skill hacofood-baocao (scripts/common.py). Thứ tự quan trọng. */
const GROUP_RULES: [RegExp, string][] = [
  [/tai cuộn|taicuon/, 'Tai cuộn (sỉ)'], [/bắp cuộn|bapcuon/, 'Bắp cuộn (sỉ)'],
  [/ba chỉ dê|bachide/, 'Ba chỉ dê (sỉ)'], [/cổ dê|\bcode\b/, 'Cổ dê (sỉ)'], [/giò nây|gionay/, 'Giò nây (sỉ)'],
  [/khăn|\bkdx\b|tangkhan/, 'Khăn đồ xôi'],
  [/si10sxc|sỉ.*sét xôi|10 sét|sét xôi cốm|set xoi|\bsxc\b|xôi cốm|combo.*cốm ngon|combo xôi cốm/, 'Sét Xôi Cốm'],
  [/chè cốm|\bscc\b/, 'Sét Chè Cốm'], [/chè bưởi|\bscb\b|combo2setche|sét chè/, 'Sét Chè Bưởi'],
  [/bánh khúc|xôi khúc|nlxk|\bsbk\b/, 'Sét Bánh/Xôi Khúc'],
  [/bột khúc|botkhuc/, 'Bột Khúc Sấy Lạnh'],
  [/cốm|\bcom1kg|sicom|comsay|com50/, 'Cốm Khô'],
  [/combo.*sốt|combo2sot|combo5sot/, 'Combo Sốt'],
  [/xá xíu|sxx/, 'Sốt Xá Xíu'], [/trộn nộm|stn\d|nộm/, 'Sốt Trộn Nộm'],
  [/ướp nướng|thịt nướng|sốt nướng|sn500|sn1000|sisn|nướng/, 'Sốt Ướp Nướng'],
  [/sườn|chua ngọt|sotchuangot/, 'Sốt Sườn Chua Ngọt'], [/chấm gà|chấm đa năng|sốt chấm/, 'Sốt Chấm'],
  [/sốt thái|sotthai/, 'Sốt Thái'], [/sốt me|sotme/, 'Sốt Me'], [/mắm tép|\bmt400/, 'Mắm Tép'],
  [/mắm tỏi|sốt mắm|\bsm500/, 'Sốt Mắm Tỏi'], [/heo khô|bò khô/, 'Sốt Heo/Bò Khô'],
  [/chiên chuối|chiên bánh chuối|botchienchuoi/, 'Bột Chiên Chuối'], [/chiên|botchien/, 'Bột Chiên Tổng Hợp'],
  [/cốt dừa|cotdua/, 'Bột Cốt Dừa'], [/hạt sen|sen khô|hatsen/, 'Hạt Sen Khô'],
  [/gà ủ muối|gaumuoi|giavigau/, 'Gia Vị Gà Ủ Muối'], [/ngũ vị|nvh/, 'Ngũ Vị Hương'],
  [/hành.*phi|hanhphi/, 'Hành Phi'], [/cùi bưởi|cuibuoi/, 'Cùi Bưởi'], [/tiêu|hattieu/, 'Hạt Tiêu'],
  [/máy xay|mstue/, 'Máy Xay Thịt'], [/coffee|cà phê/, 'Cà Phê'], [/trà nhài/, 'Trà Nhài'],
  [/đỗ xanh|doxanh/, 'Đỗ Xanh'], [/bột chè|botche|botnauche/, 'Bột Nấu Chè'],
  [/nồi xôi|thúng xôi/, 'Nồi / Thúng xôi'], [/máy say|máy đánh|cân điện|bình bơm|phin cf/, 'Dụng cụ & máy khác'],
  [/hoa đậu|hoa hiên/, 'Hoa khô'], [/bột tẻ|bột gạo|màu thực phẩm|muối hồng|pate/, 'Nguyên liệu khác'],
]
export function productGroup(name: string | null | undefined, sku: string | null | undefined): string {
  const t = `${name ?? ''} ${sku ?? ''}`.normalize('NFC').toLowerCase()
  for (const [re, g] of GROUP_RULES) if (re.test(t)) return g
  return 'Khác'
}
/** Nhóm hàng sỉ (thịt cuộn/dê…): khách mua nhóm này là khách sỉ, không phải đối tượng mời khoá học. */
export const isWholesaleGroup = (g: string) => g.endsWith('(sỉ)')

const BAC = new Set('Hà Nội,Hải Phòng,Bắc Ninh,Hưng Yên,Phú Thọ,Ninh Bình,Quảng Ninh,Thái Nguyên,Thái Bình,Hải Dương,Nam Định,Bắc Giang,Lạng Sơn,Vĩnh Phúc,Hà Nam,Hòa Bình,Cao Bằng,Hà Giang,Lai Châu,Lào Cai,Sơn La,Tuyên Quang,Yên Bái,Điện Biên,Bắc Kạn'.split(','))
const NAM = new Set('Hồ Chí Minh,Đồng Nai,Bình Dương,Bình Phước,Bà Rịa-Vũng Tàu,Bà Rịa - Vũng Tàu,Tây Ninh,Long An,Cần Thơ,An Giang,Kiên Giang,Cà Mau,Bạc Liêu,Sóc Trăng,Hậu Giang,Vĩnh Long,Trà Vinh,Bến Tre,Tiền Giang,Đồng Tháp'.split(','))
export function provinceName(t: string | null | undefined): string {
  const s = (t ?? '').trim().replace('Hoá', 'Hóa').replace('Hoà', 'Hòa')
  if (!s) return 'Không rõ'
  return ({ 'Thừa Thiên Huế': 'Huế', 'TP Hồ Chí Minh': 'Hồ Chí Minh', 'Thành phố Hồ Chí Minh': 'Hồ Chí Minh' } as Record<string, string>)[s] ?? s
}
export function regionOf(province: string): string {
  if (province === 'Không rõ') return 'Không rõ'
  return BAC.has(province) ? 'Miền Bắc' : NAM.has(province) ? 'Miền Nam' : 'Miền Trung & Tây Nguyên'
}


/** Dòng sản phẩm: dùng cho mua lại cùng dòng, gợi ý món kế tiếp, nhắc dùng hết. Quy tắc lấy từ HACO-LOOP/scripts/repeat_analysis.py. */
export const PRODUCT_LINES = {
  xoi_com: 'Sét xôi cốm', com_kho: 'Cốm khô', che_com: 'Sét chè cốm', khan: 'Khăn đồ xôi', bot_khuc: 'Bột khúc / xôi khúc',
  sot_xa_xiu: 'Sốt xá xíu', sot_nuong: 'Sốt nướng', sot_tron_nom: 'Sốt trộn nộm', sot_suon: 'Sốt sườn', sot_cham_ga: 'Sốt chấm gà',
  sot_thai: 'Sốt thái', sot_khac: 'Sốt khác', hat_sen: 'Hạt sen', ga_u_muoi: 'Gà ủ muối', bot_chien: 'Bột chiên', cot_dua: 'Bột cốt dừa',
  buoi: 'Chè bưởi / cùi bưởi', gia_vi: 'Gia vị khô', thiet_bi: 'Thiết bị bếp', do_uong: 'Trà / cà phê', khoa_hoc: 'Khoá học', khac: 'Khác',
} as const
export type ProductLine = keyof typeof PRODUCT_LINES

