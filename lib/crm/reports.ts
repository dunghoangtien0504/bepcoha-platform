// Báo cáo: 6 con số Cô Hạ xem mỗi thứ Hai (HACO-LOOP/02) + chỉ số giữ khách (B4 Z01).
import { getDb } from '../db'
import { lineBreakdown, type OrderItem } from './orders'
import { STATUS_LABEL, PLATFORM_LABEL, RETURNING_STATUSES, provinceName, regionOf, type Platform } from './labels'

type Sql = ReturnType<typeof getDb>

/** Mốc tính báo cáo: hôm nay, hoặc ngày có đơn mới nhất +1 nếu dữ liệu đơn chưa đồng bộ tới hôm nay (để không ra số 0 giả). */
export async function reportAsOf(sql: Sql = getDb()): Promise<{ asOf: Date; stale: boolean }> {
  const [r] = await sql`SELECT MAX(inserted_at) AS last FROM pancake_orders`
  const last = r?.last ? new Date(r.last) : null
  if (!last) return { asOf: new Date(), stale: false }
  const stale = Date.now() - last.getTime() > 2 * 86400000
  return { asOf: stale ? new Date(last.getTime() + 86400000) : new Date(), stale }
}

export async function mondaySix(days = 30, asOf: Date = new Date(), sql: Sql = getDb()) {
  const now = asOf
  const [rev] = await sql`
    SELECT COALESCE(SUM(o.revenue), 0)::bigint AS total,
           COALESCE(SUM(o.revenue) FILTER (WHERE c.first_order_at < ${now}::timestamptz - make_interval(days => ${days})), 0)::bigint AS from_old
    FROM pancake_orders o LEFT JOIN customers c ON c.id = o.customer_id
    WHERE o.counts_revenue AND o.inserted_at > ${now}::timestamptz - make_interval(days => ${days})`
  // Mua lại trong 90 ngày: nhóm khách có lần mua đầu cách đây 90–180 ngày (đủ thời gian quan sát)
  const [rep] = await sql`
    WITH f AS (
      SELECT customer_id, MIN(inserted_at) AS first_at FROM pancake_orders WHERE is_real AND customer_id IS NOT NULL GROUP BY 1
    )
    SELECT COUNT(*)::int AS cohort,
           COUNT(*) FILTER (WHERE EXISTS (
             SELECT 1 FROM pancake_orders o WHERE o.customer_id = f.customer_id AND o.is_real
               AND (o.inserted_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date > (f.first_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
               AND o.inserted_at <= f.first_at + INTERVAL '90 days'))::int AS repeated
    FROM f WHERE f.first_at BETWEEN ${now}::timestamptz - INTERVAL '180 days' AND ${now}::timestamptz - INTERVAL '90 days'`
  const flows = await sql`
    SELECT kind, COUNT(*)::int AS done,
           COUNT(*) FILTER (WHERE result IN ('da_lien_he', 'chot_don'))::int AS good,
           COUNT(*) FILTER (WHERE result = 'chot_don')::int AS orders,
           COUNT(*) FILTER (WHERE result = 'tu_choi')::int AS refused
    FROM crm_tasks WHERE status = 'xong' AND done_at > ${now}::timestamptz - make_interval(days => ${days}) AND customer_id IS NOT NULL
    GROUP BY kind ORDER BY orders DESC, good DESC`
  const [refuse] = await sql`
    SELECT COUNT(*) FILTER (WHERE result = 'tu_choi')::int AS refused, COUNT(*)::int AS contacted
    FROM crm_tasks WHERE status = 'xong' AND done_at > ${now}::timestamptz - make_interval(days => ${days}) AND customer_id IS NOT NULL`
  const [offline] = await sql`
    SELECT COUNT(*) FILTER (WHERE stage = 'da_chot')::int AS won, COUNT(*) FILTER (WHERE stage NOT IN ('da_chot', 'khong_chot'))::int AS open
    FROM opportunities WHERE pipeline = 'khoa_offline' AND (stage NOT IN ('da_chot', 'khong_chot') OR updated_at > ${now}::timestamptz - make_interval(days => ${days}))`
  const [leads] = await sql`
    SELECT COUNT(*) FILTER (WHERE source = 'mini')::int AS mini, COUNT(*)::int AS all_new
    FROM customers WHERE COALESCE(first_seen_at, created_at) BETWEEN ${now}::timestamptz - INTERVAL '7 days' AND ${now}::timestamptz`
  return {
    days,
    oldCustomerRevenue: { total: Number(rev.total), fromOld: Number(rev.from_old) },
    repeat90: { cohort: rep.cohort as number, repeated: rep.repeated as number },
    flows: flows.map(f => ({ kind: f.kind as string, done: f.done as number, good: f.good as number, orders: f.orders as number, refused: f.refused as number })),
    refusal: { refused: refuse.refused as number, contacted: refuse.contacted as number },
    offlineCourse: { won: offline.won as number, open: offline.open as number },
    newLeads: { mini: leads.mini as number, all: leads.all_new as number },
  }
}

export async function revenueByMonth(months = 13, sql: Sql = getDb()) {
  return sql`
    SELECT to_char(date_trunc('month', inserted_at AT TIME ZONE 'Asia/Ho_Chi_Minh'), 'YYYY-MM') AS month,
           COUNT(*)::int AS orders, SUM(revenue)::bigint AS revenue,
           COUNT(*) FILTER (WHERE platform = 'facebook')::int AS fb, COUNT(*) FILTER (WHERE platform = 'tiktok')::int AS tiktok,
           COUNT(*) FILTER (WHERE platform = 'shopee')::int AS shopee
    FROM pancake_orders
    WHERE counts_revenue AND inserted_at > date_trunc('month', NOW()) - make_interval(months => ${months - 1})
    GROUP BY 1 ORDER BY 1`
}

/** B4 Z01: tỷ lệ quét QR theo lô, mua lại 30/90 ngày, giá trị đơn trung bình, giá trị vòng đời 12 tháng. */
export async function retention(sql: Sql = getDb()) {
  const [r] = await sql`
    WITH f AS (SELECT customer_id, MIN(inserted_at) AS first_at FROM pancake_orders WHERE is_real AND customer_id IS NOT NULL GROUP BY 1),
    w AS (
      SELECT f.customer_id, f.first_at,
        EXISTS (SELECT 1 FROM pancake_orders o WHERE o.customer_id = f.customer_id AND o.is_real
          AND (o.inserted_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date > (f.first_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
          AND o.inserted_at <= f.first_at + INTERVAL '30 days') AS r30
      FROM f WHERE f.first_at BETWEEN NOW() - INTERVAL '120 days' AND NOW() - INTERVAL '30 days')
    SELECT (SELECT COUNT(*) FROM w)::int AS cohort30, (SELECT COUNT(*) FILTER (WHERE r30) FROM w)::int AS rep30,
      (SELECT AVG(revenue) FROM pancake_orders WHERE counts_revenue AND inserted_at > NOW() - INTERVAL '90 days')::int AS aov90,
      (SELECT AVG(s) FROM (SELECT SUM(revenue) AS s FROM pancake_orders WHERE counts_revenue AND customer_id IS NOT NULL
         AND inserted_at > NOW() - INTERVAL '365 days' GROUP BY customer_id) x)::int AS ltv12,
      (SELECT COUNT(*) FROM customers WHERE order_count >= 1 AND last_order_at < NOW() - INTERVAL '120 days')::int AS dormant`
  const batches = await sql`
    SELECT b.code, b.sku, b.channel, b.cta, b.printed_qty, b.created_at,
      (SELECT COUNT(DISTINCT anon_id) FROM funnel_events e WHERE e.batch_code = b.code AND e.step = 1)::int AS scans,
      (SELECT COUNT(DISTINCT m.id) FROM mini_sessions m WHERE m.batch_code = b.code AND m.phone IS NOT NULL)::int AS identified,
      (SELECT COUNT(*) FROM order_claims oc JOIN mini_sessions m ON m.id = oc.mini_session_id WHERE m.batch_code = b.code AND oc.status = 'da_khop')::int AS matched
    FROM qr_batches b ORDER BY b.created_at DESC`
  return {
    cohort30: r.cohort30 as number, rep30: r.rep30 as number, aov90: Number(r.aov90 ?? 0), ltv12: Number(r.ltv12 ?? 0), dormant: r.dormant as number, batches,
  }
}

export async function funnelByStep(batch: string | null, sql: Sql = getDb()) {
  return sql`
    SELECT step, name, COUNT(DISTINCT anon_id)::int AS people
    FROM funnel_events WHERE (${batch}::text IS NULL OR batch_code = ${batch})
    GROUP BY step, name ORDER BY step`
}


// ── Tổng hợp kinh doanh theo đúng quy tắc & bố cục của skill hacofood-baocao (khớp màn Thống kê Pancake) ──────
const rate = (n: number, d: number) => (d ? n / d : 0)

export interface BizRow { k: string; don: number; chot: number; dt_don: number; huy: number; hoan: number; doanh_thu: number; tien_hang: number; ty_le_huy: number; aov: number; ty_trong: number }

export async function businessSummary(from: string, to: string, sql: ReturnType<typeof getDb> = getDb()) {
  const rows = await sql`
    SELECT pos_order_id, status, platform, cod, prepaid, discount, items, revenue, items_value, is_closed, counts_revenue,
           seller_name, ad_id, province, (inserted_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date::text AS day
    FROM pancake_orders
    WHERE inserted_at >= (${from}::date)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'
      AND inserted_at < ((${to}::date + 1))::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'`
  const orders = rows.map(r => ({
    status: r.status as number, platform: r.platform as Platform, revenue: Number(r.revenue ?? 0), value: Number(r.items_value ?? 0),
    closed: !!r.is_closed, rev: !!r.counts_revenue, ad: !!r.ad_id, day: r.day as string, province: provinceName(r.province as string),
    lines: lineBreakdown({ platform: r.platform as string, cod: Number(r.cod), prepaid: Number(r.prepaid), discount: Number(r.discount),
      items: (r.items as OrderItem[]) ?? [], seller: r.seller_name as string | null }),
  }))
  const R = orders.filter(o => o.rev), C = orders.filter(o => o.closed), base = orders.filter(o => o.status !== 0)
  const TOT = R.reduce((a, o) => a + o.revenue, 0)
  const huy = orders.filter(o => o.status === 6).length
  const ret = orders.filter(o => (RETURNING_STATUSES as readonly number[]).includes(o.status)).length
  const tong = {
    don_moi: orders.filter(o => o.status === 0).length, don_chot: C.length, don_dt: R.length, huy,
    da_hoan: orders.filter(o => o.status === 5).length, dang_hoan: orders.filter(o => o.status === 4).length,
    doanh_thu: TOT, tien_hang: R.reduce((a, o) => a + o.value, 0), aov: rate(TOT, R.length),
    ty_le_huy: rate(huy, base.length), ty_le_hoan: rate(ret, C.length),
    don_qc: R.filter(o => o.ad).length, doanh_thu_qc: R.filter(o => o.ad).reduce((a, o) => a + o.revenue, 0),
  }
  const groupOrders = (key: (o: typeof orders[number]) => string): BizRow[] => {
    const m = new Map<string, typeof orders>()
    for (const o of orders) { const k = key(o); m.set(k, [...(m.get(k) ?? []), o]) }
    return [...m.entries()].map(([k, xs]) => {
      const xr = xs.filter(o => o.rev), xb = xs.filter(o => o.status !== 0)
      const dt = xr.reduce((a, o) => a + o.revenue, 0)
      const h = xs.filter(o => o.status === 6).length
      return { k, don: xb.length, chot: xs.filter(o => o.closed).length, dt_don: xr.length, huy: h,
        hoan: xs.filter(o => (RETURNING_STATUSES as readonly number[]).includes(o.status)).length,
        doanh_thu: dt, tien_hang: xr.reduce((a, o) => a + o.value, 0), ty_le_huy: rate(h, xb.length), aov: rate(dt, xr.length), ty_trong: rate(dt, TOT) }
    }).sort((a, b) => b.doanh_thu - a.doanh_thu)
  }
  // Theo dòng sản phẩm (nhóm, nhân viên) — chỉ dòng của đơn tính doanh thu
  const byLine = (key: (l: ReturnType<typeof lineBreakdown>[number]) => string) => {
    const m = new Map<string, { k: string; don: Set<number>; sl: number; doanh_thu: number }>()
    R.forEach((o, idx) => o.lines.forEach(l => {
      const k = key(l)
      const v = m.get(k) ?? { k, don: new Set<number>(), sl: 0, doanh_thu: 0 }
      v.don.add(idx); v.sl += l.qty; v.doanh_thu += l.revenue; m.set(k, v)
    }))
    return [...m.values()].map(v => ({ k: v.k, don: v.don.size, sl: v.sl, doanh_thu: Math.round(v.doanh_thu), ty_trong: rate(v.doanh_thu, TOT) }))
      .sort((a, b) => b.doanh_thu - a.doanh_thu)
  }
  const nhom = byLine(l => l.group)
  const ngay = new Map<string, { don: number; doanh_thu: number }>()
  for (const o of R) { const v = ngay.get(o.day) ?? { don: 0, doanh_thu: 0 }; v.don++; v.doanh_thu += o.revenue; ngay.set(o.day, v) }
  return {
    from, to, tong,
    trang_thai: groupOrders(o => STATUS_LABEL[o.status] ?? String(o.status)).sort((a, b) => b.don + b.chot - a.don - a.chot),
    kenh: groupOrders(o => PLATFORM_LABEL[o.platform] ?? o.platform),
    mien: groupOrders(o => regionOf(o.province)),
    nhom_sp: nhom,
    khac_ty_trong: nhom.find(n => n.k === 'Khác')?.ty_trong ?? 0,
    nhan_vien: byLine(l => l.seller),
    ngay: [...ngay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => ({ k, ...v })),
  }
}
