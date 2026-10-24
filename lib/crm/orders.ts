// Đơn Pancake → bảng pancake_orders (bản sao chỉ đọc) → số liệu trên hồ sơ khách.
// Số liệu tính ĐÚNG quy tắc màn Thống kê Pancake (skill hacofood-baocao bản 2, xem lib/crm/labels.ts):
//  - đơn chốt = trừ Mới/Đã hủy/Đã xóa; doanh thu = đơn chốt trừ Đã hoàn
//  - tiền doanh thu: đơn sàn = COD + trả trước (tiền sàn trả); đơn khác = SL × đơn giá − giảm giá
//  - nhân viên theo TỪNG DÒNG sản phẩm; dòng đơn sàn không có người = "Hệ thống"
// "Đơn thật" (is_real) dùng cho vòng đời khách/mua lại = đơn tính doanh thu VÀ có tiền > 0.
import { getDb } from '../db'
import { normalizePhone } from '../phone'
import { isClosedStatus, countsRevenue, MARKETPLACES, productGroup, isWholesaleGroup, type Platform, type ProductLine } from './labels'
export { STATUS_LABEL, PLATFORM_LABEL, PRODUCT_LINES, type Platform, type ProductLine } from './labels'

type Sql = ReturnType<typeof getDb>

export function platformOf(sourceName: string | null | undefined): Platform {
  const s = (sourceName || '').toLowerCase()
  if (s.includes('facebook') || s.includes('messenger') || s.includes('instagram')) return 'facebook'
  if (s.includes('tiktok')) return 'tiktok'
  if (s.includes('shopee')) return 'shopee'
  if (s.includes('lazada')) return 'lazada'
  if (s.includes('zalo')) return 'zalo'
  if (s.includes('webcake') || s.includes('web') || s.includes('landing')) return 'web'
  if (s.includes('tại quầy') || s.includes('pos') || s.includes('cửa hàng')) return 'bep'
  return 'khac'
}

const nfc = (s: string | null | undefined) => (s || '').normalize('NFC').toLowerCase()

export function lineOf(item: { name?: string | null; sku?: string | null }): ProductLine {
  const n = nfc(item.name), s = (item.sku || '').toLowerCase()
  if (n.includes('chè cốm') || s === 'scc') return 'che_com'
  if (n.includes('xôi cốm') || n.includes('combo cốm') || n.includes('set cốm') || n.includes('sét cốm') ||
      ['sxc', 'comboxoicom', 'si10sxc', 'sisxc25', '2settang1khan'].includes(s)) return 'xoi_com'
  if (n.includes('cốm') || s.startsWith('com1kg') || s.startsWith('sicom')) return 'com_kho'
  if (n.includes('xá xíu') || s.startsWith('sxx') || s.startsWith('sisxx') || s.startsWith('sotxaxiu')) return 'sot_xa_xiu'
  if (n.includes('nướng') || /^(sn|sisn|sotnuong|sotthitnuong)/.test(s)) return 'sot_nuong'
  if (n.includes('nộm') || s.startsWith('stn') || s.startsWith('sistn')) return 'sot_tron_nom'
  if (n.includes('sườn') || s.startsWith('sotchuangot') || s.includes('sotsuon')) return 'sot_suon'
  if (n.includes('chấm gà') || s.startsWith('sotchamga')) return 'sot_cham_ga'
  if (n.includes('sốt thái') || s.startsWith('sotthai')) return 'sot_thai'
  if (n.includes('hạt sen') || s.startsWith('hatsen') || s.startsWith('sihatsen')) return 'hat_sen'
  if (n.includes('khăn') || ['khandoxoi', 'kdx', 'tangkhan'].includes(s)) return 'khan'
  if (n.includes('khúc') || s.startsWith('botkhuc') || ['nlxk', 'sinlxk', 'sbk'].includes(s)) return 'bot_khuc'
  if (n.includes('gà ủ muối') || s.startsWith('giavigaumuoi') || s === 'gaumuoi') return 'ga_u_muoi'
  if (n.includes('bột chiên') || s.startsWith('botchien')) return 'bot_chien'
  if (n.includes('cốt dừa') || s.startsWith('botcotdua')) return 'cot_dua'
  if (n.includes('bưởi')) return 'buoi'
  if (n.includes('khoá') || n.includes('khóa học') || n.includes('khoa hoc')) return 'khoa_hoc'
  if (n.includes('máy') || s.startsWith('mst')) return 'thiet_bi'
  if (n.includes('trà') || n.includes('cà phê') || s.startsWith('coffee')) return 'do_uong'
  if (n.includes('sốt') || n.includes('sot ')) return 'sot_khac'
  if (n.includes('tiêu') || n.includes('ngũ vị') || n.includes('hành phi') || n.includes('bột chè')) return 'gia_vi'
  return 'khac'
}

/** Chuẩn hoá mã đơn/mã vận đơn khách gõ: viết hoa, bỏ khoảng trắng, '-', '#', '.'. */
export function normalizeRef(raw: string | null | undefined): string {
  return (raw || '').toUpperCase().replace(/[\s\-#.]/g, '')
}

export function isMaskedPhone(raw: string | null | undefined): boolean {
  return /\*/.test(raw || '')
}

export interface OrderItem {
  sku: string | null; name: string; qty: number; price: number; bonus: boolean; wholesale: boolean; line: ProductLine
  seller?: string | null   // nhân viên xử lý dòng sản phẩm (items[].assigning_seller)
}

/** Tiền và người của từng dòng, đúng cách màn Thống kê Pancake tính. */
export interface LineMoney { group: string; seller: string; value: number; revenue: number; qty: number; sku: string | null; name: string }

export function lineBreakdown(o: { platform: string; cod: number; prepaid: number; discount: number; items: OrderItem[]; seller?: string | null }): LineMoney[] {
  const vals = o.items.map(i => (Number(i.qty) || 0) * (Number(i.price) || 0))
  const tot = vals.reduce((a, b) => a + b, 0)
  const paid = (Number(o.cod) || 0) + (Number(o.prepaid) || 0)
  const san = (MARKETPLACES as readonly string[]).includes(o.platform)
  return o.items.map((i, k) => {
    const share = tot > 0 ? vals[k] / tot : 0
    const web = vals[k] - (Number(o.discount) || 0) * share
    const revenue = san && paid * share > 0 ? paid * share : web
    const seller = i.seller || (san ? 'Hệ thống' : (o.seller || 'Hệ thống'))
    return { group: productGroup(i.name, i.sku), seller, value: vals[k], revenue, qty: Number(i.qty) || 0, sku: i.sku, name: i.name }
  })
}

export function orderMoney(o: { platform: string; cod: number; prepaid: number; discount: number; items: OrderItem[] }) {
  const lines = lineBreakdown(o)
  return { itemsValue: Math.round(lines.reduce((a, l) => a + l.value, 0)), revenue: Math.round(lines.reduce((a, l) => a + l.revenue, 0)) }
}

export interface OrderRow {
  posOrderId: string
  pancakeCustomerId: string | null
  phoneRaw: string
  name: string
  platform: Platform
  status: number
  statusName: string
  total: number
  cod: number
  prepaid: number
  shippingFee: number
  discount: number
  items: OrderItem[]
  tags: string[]
  province: string
  platformOrderRef: string | null
  trackingCode: string | null
  insertedAt: string
  updatedAt: string | null
  sellerName?: string | null      // assigning_seller của đơn
  careName?: string | null        // assigning_care
  marketerName?: string | null
  adId?: string | null            // đơn gắn quảng cáo Facebook
  utmCampaign?: string | null
}

type Json = Record<string, unknown>
const str = (v: unknown) => (v === null || v === undefined ? '' : String(v))
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0)

export function platformRefFromId(id: string, platform: Platform): string | null {
  if (platform === 'tiktok' && /^\d{15,}$/.test(id)) return id
  if (platform === 'shopee' && /^\d{6}[A-Z0-9]{6,}$/.test(id) && /[A-Z]/.test(id)) return id
  return null
}

/** Dòng đã rút gọn từ HACO-LOOP/scripts/export_orders.mjs (orders.jsonl). */
export function fromExportRow(o: Json): OrderRow | null {
  if (!o.id || !o.at) return null
  const items = (Array.isArray(o.items) ? o.items : []) as Json[]
  return {
    posOrderId: str(o.id),
    pancakeCustomerId: o.cid ? str(o.cid) : null,
    phoneRaw: str(o.phone),
    name: str(o.name),
    platform: platformOf(str(o.srcn)),
    status: num(o.st),
    statusName: str(o.stn),
    total: num(o.total), cod: num(o.cod), prepaid: num(o.prepaid), shippingFee: num(o.ship), discount: num(o.disc),
    items: items.map(i => ({
      sku: i.sku ? str(i.sku) : null, name: str(i.name), qty: num(i.q) || 1, price: num(i.p),
      bonus: !!i.bonus, wholesale: !!i.ws, line: lineOf({ name: str(i.name), sku: str(i.sku) }), seller: i.sel ? str(i.sel) : null,
    })),
    tags: Array.isArray(o.tags) ? (o.tags as unknown[]).map(str).filter(Boolean) : [],
    province: str(o.prov),
    // Đơn sàn: Pancake dùng chính mã đơn của sàn làm id (TikTok 18 chữ số, Shopee dạng 260620JXGG0CT7) — khách thấy mã này trong app sàn.
    platformOrderRef: platformRefFromId(str(o.id), platformOf(str(o.srcn))),
    trackingCode: null,
    insertedAt: str(o.at),
    updatedAt: o.upd ? str(o.upd) : null,
  }
}

/**
 * Đơn thô từ Pancake POS API (/shops/:id/orders). Tên trường đã đối chiếu với đơn thật (24/10/2026):
 * mã vận đơn = partner.extend_code; nhân viên theo dòng = items[].assigning_seller; đơn quảng cáo = ad_id.
 * Mã đơn sàn: Pancake dùng chính mã đơn sàn làm id (xem platformRefFromId).
 */
export function fromPancakeRaw(o: Json): OrderRow | null {
  const c = (o.customer || {}) as Json
  const ship = (o.shipping_address || {}) as Json
  const partner = (o.partner || {}) as Json
  const items = (Array.isArray(o.items) ? o.items : []) as Json[]
  const who = (v: unknown) => str((v as Json | null | undefined)?.name) || null
  const row = fromExportRow({
    id: o.id, at: o.inserted_at, upd: o.updated_at, st: o.status, stn: o.status_name,
    total: o.total_price, cod: o.cod, prepaid: o.prepaid, ship: o.shipping_fee, disc: o.total_discount,
    srcn: o.order_sources_name, cid: c.customer_id || c.id,
    phone: o.bill_phone_number || (Array.isArray(c.phone_numbers) ? c.phone_numbers[0] : ''),
    name: o.bill_full_name || c.name, prov: ship.province_name || ship.new_province_name,
    tags: (Array.isArray(o.tags) ? o.tags : []).map(t => (typeof t === 'string' ? t : (t as Json)?.name)),
    items: items.map(i => {
      const v = (i.variation_info || {}) as Json
      return { sku: v.display_id, name: v.name, q: i.quantity, p: v.retail_price, bonus: i.is_bonus_product, ws: i.is_wholesale, sel: who(i.assigning_seller) }
    }),
  })
  return row ? {
    ...row, trackingCode: str(partner.extend_code) || null,
    sellerName: who(o.assigning_seller), careName: who(o.assigning_care), marketerName: who(o.marketer),
    adId: str(o.ad_id) || null, utmCampaign: str(o.p_utm_campaign) || null,
  } : null
}

/** Ghi một loạt đơn vào pancake_orders, gắn/khởi tạo khách theo SĐT thật. Trả về số đơn đã ghi. */
export async function upsertOrders(rows: OrderRow[], sql: Sql = getDb()): Promise<number> {
  if (!rows.length) return 0
  // 1) khách theo SĐT thật (SĐT bị sàn che thì không tạo hồ sơ — không liên hệ ngoài sàn được)
  const byPhone = new Map<string, OrderRow>()
  const firstSeen = new Map<string, string>()
  for (const r of rows) {
    const p = isMaskedPhone(r.phoneRaw) ? '' : normalizePhone(r.phoneRaw)
    if (p.length === 10 && p.startsWith('0')) {
      const prev = byPhone.get(p)
      if (!prev || prev.insertedAt < r.insertedAt) byPhone.set(p, r)
      if (!firstSeen.has(p) || r.insertedAt < firstSeen.get(p)!) firstSeen.set(p, r.insertedAt)
    }
  }
  const phones = [...byPhone.keys()]
  if (phones.length) {
    const vals = phones.map(p => {
      const r = byPhone.get(p)!
      return { phone: p, name: r.name.slice(0, 200), pid: r.pancakeCustomerId, province: r.province, seen: firstSeen.get(p) }
    })
    await sql`
      INSERT INTO customers (phone, name, pancake_customer_id, source, province, phone_verified_at, first_seen_at)
      SELECT x.phone, x.name, x.pid, 'pancake', COALESCE(x.province, ''), NOW(), x.seen
      FROM jsonb_to_recordset(${sql.json(vals as never)}::jsonb) AS x(phone text, name text, pid text, province text, seen timestamptz)
      ON CONFLICT (phone) DO UPDATE SET
        name = CASE WHEN customers.name = '' THEN EXCLUDED.name ELSE customers.name END,
        pancake_customer_id = COALESCE(customers.pancake_customer_id, EXCLUDED.pancake_customer_id),
        province = CASE WHEN customers.province = '' THEN EXCLUDED.province ELSE customers.province END,
        first_seen_at = LEAST(customers.first_seen_at, EXCLUDED.first_seen_at),
        updated_at = NOW()
    `
  }
  const idRows = phones.length ? await sql`SELECT id, phone FROM customers WHERE phone = ANY(${phones})` : []
  const idByPhone = new Map(idRows.map(r => [r.phone as string, r.id as number]))

  const vals = rows.map(r => {
    const masked = isMaskedPhone(r.phoneRaw)
    const phone = masked ? '' : normalizePhone(r.phoneRaw)
    const money = orderMoney({ platform: r.platform, cod: r.cod, prepaid: r.prepaid, discount: r.discount, items: r.items })
    const closed = isClosedStatus(r.status), revCounts = countsRevenue(r.status)
    const real = revCounts && money.revenue > 0
    // Khách sỉ: dòng đánh dấu giá sỉ, hoặc mua nhóm hàng sỉ (thịt cuộn/dê…) theo bảng nhóm của báo cáo
    const ws = r.items.some(i => i.wholesale || isWholesaleGroup(productGroup(i.name, i.sku)))
    return {
      ws,
      closed, rev_counts: revCounts, items_value: money.itemsValue, revenue: money.revenue,
      seller: r.sellerName ?? null, care: r.careName ?? null, mkt: r.marketerName ?? null, ad: r.adId ?? null, utm: r.utmCampaign ?? null,
      id: r.posOrderId, cid: idByPhone.get(phone) ?? null, pcid: r.pancakeCustomerId, phone, masked, name: r.name.slice(0, 200),
      platform: r.platform, status: r.status, status_name: r.statusName, real, total: r.total, cod: r.cod, prepaid: r.prepaid,
      ship: r.shippingFee, disc: r.discount, items: r.items, lines: [...new Set(r.items.filter(i => !i.bonus).map(i => i.line))],
      tags: r.tags, province: r.province, pref: r.platformOrderRef, pref_n: r.platformOrderRef ? normalizeRef(r.platformOrderRef) : null,
      trk: r.trackingCode, trk_n: r.trackingCode ? normalizeRef(r.trackingCode) : null, id_n: normalizeRef(r.posOrderId), at: r.insertedAt, upd: r.updatedAt,
    }
  })
  await sql`
    INSERT INTO pancake_orders (pos_order_id, customer_id, pancake_customer_id, phone_norm, phone_masked, name, platform, status, status_name,
      is_real, total, cod, prepaid, shipping_fee, discount, items, product_lines, tags, province, platform_order_ref, platform_order_ref_norm,
      tracking_code, tracking_code_norm, pos_order_id_norm, inserted_at, updated_at, synced_at,
      is_closed, counts_revenue, items_value, revenue, seller_name, care_name, marketer_name, ad_id, utm_campaign, has_wholesale)
    SELECT x.id, x.cid, x.pcid, x.phone, x.masked, x.name, x.platform, x.status, x.status_name, x.real, x.total, x.cod, x.prepaid,
      x.ship, x.disc, x.items, ARRAY(SELECT jsonb_array_elements_text(x.lines)), x.tags, COALESCE(x.province, ''), x.pref, x.pref_n,
      x.trk, x.trk_n, x.id_n, x.at, x.upd, NOW(),
      x.closed, x.rev_counts, x.items_value, x.revenue, x.seller, x.care, x.mkt, x.ad, x.utm, x.ws
    FROM jsonb_to_recordset(${sql.json(vals as never)}::jsonb) AS x(id text, cid int, pcid text, phone text, masked boolean, name text,
      platform text, status int, status_name text, real boolean, total bigint, cod bigint, prepaid bigint, ship bigint, disc bigint,
      items jsonb, lines jsonb, tags jsonb, province text, pref text, pref_n text, trk text, trk_n text, id_n text, at timestamptz, upd timestamptz,
      closed boolean, rev_counts boolean, items_value bigint, revenue bigint, seller text, care text, mkt text, ad text, utm text, ws boolean)
    ON CONFLICT (pos_order_id) DO UPDATE SET
      customer_id = COALESCE(EXCLUDED.customer_id, pancake_orders.customer_id), status = EXCLUDED.status, status_name = EXCLUDED.status_name,
      is_real = EXCLUDED.is_real, total = EXCLUDED.total, cod = EXCLUDED.cod, prepaid = EXCLUDED.prepaid, shipping_fee = EXCLUDED.shipping_fee,
      discount = EXCLUDED.discount, items = EXCLUDED.items, product_lines = EXCLUDED.product_lines, tags = EXCLUDED.tags,
      platform_order_ref = COALESCE(EXCLUDED.platform_order_ref, pancake_orders.platform_order_ref),
      platform_order_ref_norm = COALESCE(EXCLUDED.platform_order_ref_norm, pancake_orders.platform_order_ref_norm),
      tracking_code = COALESCE(EXCLUDED.tracking_code, pancake_orders.tracking_code),
      tracking_code_norm = COALESCE(EXCLUDED.tracking_code_norm, pancake_orders.tracking_code_norm),
      has_wholesale = EXCLUDED.has_wholesale, is_closed = EXCLUDED.is_closed, counts_revenue = EXCLUDED.counts_revenue, items_value = EXCLUDED.items_value, revenue = EXCLUDED.revenue,
      seller_name = COALESCE(EXCLUDED.seller_name, pancake_orders.seller_name), care_name = COALESCE(EXCLUDED.care_name, pancake_orders.care_name),
      marketer_name = COALESCE(EXCLUDED.marketer_name, pancake_orders.marketer_name), ad_id = COALESCE(EXCLUDED.ad_id, pancake_orders.ad_id),
      utm_campaign = COALESCE(EXCLUDED.utm_campaign, pancake_orders.utm_campaign),
      updated_at = EXCLUDED.updated_at, synced_at = NOW()
  `
  return rows.length
}

/** Tính lại số liệu mua hàng trên hồ sơ khách từ đơn thật (chỉ những khách có trong danh sách, hoặc tất cả nếu không truyền). */
export async function recomputeCustomerStats(customerIds?: number[], sql: Sql = getDb()): Promise<void> {
  const only = customerIds ?? null
  await sql`
    WITH s AS (
      SELECT customer_id,
        COUNT(DISTINCT (inserted_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date) AS buy_days,
        SUM(revenue) AS spent, MIN(inserted_at) AS first_at, MAX(inserted_at) AS last_at,
        MODE() WITHIN GROUP (ORDER BY platform) AS main_channel,
        BOOL_OR(has_wholesale) AS ws
      FROM pancake_orders
      WHERE is_real AND customer_id IS NOT NULL AND (${only}::int[] IS NULL OR customer_id = ANY(${only}::int[]))
      GROUP BY customer_id
    )
    UPDATE customers c SET order_count = s.buy_days, total_spent = s.spent, first_order_at = s.first_at, last_order_at = s.last_at,
      main_channel = s.main_channel, is_wholesale = s.ws,
      segments = CASE WHEN s.ws AND NOT ('B' = ANY(c.segments)) THEN array_append(c.segments, 'B') ELSE c.segments END,
      updated_at = NOW()
    FROM s WHERE c.id = s.customer_id
  `
}
