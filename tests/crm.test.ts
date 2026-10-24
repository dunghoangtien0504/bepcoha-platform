// Logic thuần của CRM v2 (không cần database).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeRef, platformRefFromId, lineOf, platformOf, isMaskedPhone, fromExportRow, lineBreakdown, orderMoney } from '../lib/crm/orders'
import { productGroup, isWholesaleGroup, isClosedStatus, countsRevenue, regionOf, provinceName } from '../lib/crm/labels'
import { permissionsFor } from '../lib/crm/permissions'
import { distanceMeters } from '../lib/crm/attendance'
import { weekdayShort, mondayOf, addDays, moneyShort } from '../lib/crm/format'

test('mã đơn: chuẩn hoá bỏ khoảng trắng, gạch, #, dấu chấm và viết hoa', () => {
  assert.equal(normalizeRef(' c5400123.0001 '), 'C54001230001')
  assert.equal(normalizeRef('#2606-20jx gg0ct7'), '260620JXGG0CT7')
  assert.equal(normalizeRef(null), '')
})

test('mã đơn sàn lấy từ id Pancake: chỉ TikTok 18 số và Shopee dạng ngày + chữ', () => {
  assert.equal(platformRefFromId('586154301206201613', 'tiktok'), '586154301206201613')
  assert.equal(platformRefFromId('260620JXGG0CT7', 'shopee'), '260620JXGG0CT7')
  assert.equal(platformRefFromId('42308', 'shopee'), null)
  assert.equal(platformRefFromId('42308', 'facebook'), null)
  assert.equal(platformRefFromId('586154301206201613', 'facebook'), null)
})

test('kênh và dòng sản phẩm theo tên/mã', () => {
  assert.equal(platformOf('Facebook'), 'facebook')
  assert.equal(platformOf('Tiktok'), 'tiktok')
  assert.equal(platformOf('Webcake'), 'web')
  assert.equal(platformOf(''), 'khac')
  assert.equal(lineOf({ name: 'Sét xôi cốm sen dừa', sku: 'SXC' }), 'xoi_com')
  assert.equal(lineOf({ name: 'Sét chè cốm', sku: 'SCC' }), 'che_com')
  assert.equal(lineOf({ name: 'Cốm 1KG', sku: 'COM1KG' }), 'com_kho')
  assert.equal(lineOf({ name: 'Khăn đồ xôi', sku: 'KDX' }), 'khan')
  assert.equal(lineOf({ name: 'Sốt xá xíu 500G', sku: 'SXX500' }), 'sot_xa_xiu')
  assert.equal(lineOf({ name: 'Bột khúc 100G', sku: 'BOTKHUC100G' }), 'bot_khuc')
})

test('SĐT bị sàn che không dùng làm khoá khách', () => {
  assert.equal(isMaskedPhone('+84378****73'), true)
  assert.equal(isMaskedPhone('0912345678'), false)
})

test('dòng xuất Pancake: đơn TikTok có mã đơn sàn, đơn thiếu id/ngày bị bỏ', () => {
  const r = fromExportRow({ id: '584298761978938380', at: '2026-09-01T03:00:00Z', st: 3, stn: 'delivered', total: 148000, srcn: 'Tiktok', phone: '+84378****73', items: [{ name: 'Sét xôi cốm', sku: 'SXC', q: 1, p: 148000 }] })
  assert.ok(r)
  assert.equal(r!.platform, 'tiktok')
  assert.equal(r!.platformOrderRef, '584298761978938380')
  assert.equal(r!.items[0].line, 'xoi_com')
  assert.equal(fromExportRow({ id: 'x' }), null)
})

test('phân quyền: nhân viên bếp chỉ tự chấm công + việc của mình; quản lý sale được giao việc, xếp ca; admin có tất cả', () => {
  const bep = permissionsFor('staff', 'bep')
  assert.deepEqual([...bep].sort(), ['cham_cong.cua_toi', 'viec.cua_toi'])
  const ql = permissionsFor('quan_ly', 'sale_cskh')
  for (const p of ['viec.giao', 'cham_cong.phan_ca', 'cham_cong.duyet', 'khach.xem_sdt'] as const) assert.ok(ql.includes(p), p)
  assert.ok(!ql.includes('nhan_vien.quan_ly'))
  assert.ok(!permissionsFor('staff', 'sale_cskh').includes('khach.xuat'))
  assert.ok(permissionsFor('admin', null).includes('nhan_vien.quan_ly'))
  // quyền cấp thêm phải là quyền hợp lệ
  assert.ok(permissionsFor('staff', 'bep', ['bao_cao.xem', 'khong_ton_tai']).includes('bao_cao.xem'))
  assert.ok(!(permissionsFor('staff', 'bep', ['khong_ton_tai']) as string[]).includes('khong_ton_tai'))
})

test('khoảng cách GPS (mét)', () => {
  assert.equal(Math.round(distanceMeters(21.0285, 105.8542, 21.0285, 105.8542)), 0)
  const d = distanceMeters(21.0285, 105.8542, 21.0294, 105.8542) // ~100m về phía bắc
  assert.ok(d > 95 && d < 105, String(d))
})

test('định dạng ngày/tiền tiếng Việt', () => {
  assert.equal(weekdayShort('2026-10-26'), 'T2')
  assert.equal(weekdayShort('2026-10-25'), 'CN')
  assert.equal(mondayOf('2026-10-25'), '2026-10-19')
  assert.equal(addDays('2026-10-31', 1), '2026-11-01')
  assert.equal(moneyShort(1_796_000_000), '1,8 tỷ')
  assert.equal(moneyShort(345_000_000), '345tr')
})

test('quy tắc Pancake: đơn chốt trừ Mới/Hủy/Xóa; doanh thu trừ thêm Đã hoàn, Đang hoàn vẫn tính', () => {
  for (const s of [1, 2, 3, 4, 5, 8, 9, 11, 12, 13, 15, 16, 20]) assert.equal(isClosedStatus(s), true, String(s))
  for (const s of [0, 6, 7]) assert.equal(isClosedStatus(s), false, String(s))
  assert.equal(countsRevenue(4), true)
  assert.equal(countsRevenue(5), false)
})

test('doanh thu: đơn sàn = COD + trả trước chia theo dòng; đơn web = SL × giá − giảm giá', () => {
  const items = [{ sku: 'SXC', name: 'Sét xôi cốm', qty: 2, price: 148000, bonus: false, wholesale: false, line: 'xoi_com' as const },
                 { sku: 'KDX', name: 'Khăn đồ xôi', qty: 1, price: 49000, bonus: false, wholesale: false, line: 'khan' as const, seller: 'Thảo' }]
  assert.deepEqual(orderMoney({ platform: 'facebook', cod: 0, prepaid: 0, discount: 45000, items }), { itemsValue: 345000, revenue: 300000 })
  assert.deepEqual(orderMoney({ platform: 'tiktok', cod: 327750, prepaid: 0, discount: 0, items }), { itemsValue: 345000, revenue: 327750 })
  const lines = lineBreakdown({ platform: 'tiktok', cod: 327750, prepaid: 0, discount: 0, items })
  assert.deepEqual(lines.map(l => l.seller), ['Hệ thống', 'Thảo'])
  assert.deepEqual(lines.map(l => l.group), ['Sét Xôi Cốm', 'Khăn đồ xôi'])
  // đơn web không có người ở dòng → lấy người của đơn
  assert.equal(lineBreakdown({ platform: 'facebook', cod: 0, prepaid: 0, discount: 0, items: [items[0]], seller: 'Hiền' })[0].seller, 'Hiền')
})

test('nhóm sản phẩm & vùng miền theo bảng của skill báo cáo', () => {
  assert.equal(productGroup('Ba chỉ dê', null), 'Ba chỉ dê (sỉ)')
  assert.equal(isWholesaleGroup(productGroup('Tai cuộn 1kg', null)), true)
  assert.equal(productGroup('Sét chè cốm', 'SCC'), 'Sét Chè Cốm')
  assert.equal(productGroup('Cốm 1KG', 'COM1KG'), 'Cốm Khô')
  assert.equal(productGroup('Bột khúc 100G', 'BOTKHUC100G'), 'Bột Khúc Sấy Lạnh')
  assert.equal(productGroup('Thứ gì đó', 'XYZ'), 'Khác')
  assert.equal(regionOf(provinceName('Thành phố Hồ Chí Minh')), 'Miền Nam')
  assert.equal(regionOf(provinceName('Hà Nội')), 'Miền Bắc')
  assert.equal(regionOf(provinceName('Đà Nẵng')), 'Miền Trung & Tây Nguyên')
  assert.equal(regionOf(provinceName('')), 'Không rõ')
})
