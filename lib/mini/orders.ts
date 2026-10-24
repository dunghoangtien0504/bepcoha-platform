// Đặt hàng trong Mini App (đợt v2-B) → lưu mini_orders → tạo đơn POScake. Bảng mini_orders do phiên CRM tạo (schema).
// Thiết kế: Mini-App/NGHIEN-CUU-TOP5-VA-THIET-KE-v2.md mục 4–5. Quy tắc:
//  - Giá, giảm giá, tổng tiền do máy chủ tính (lib/mini/catalog.ts). Tổng chưa gồm ship; nhân viên báo phí khi gọi xác nhận.
//  - SĐT nhận hàng = SĐT của phiên; khách không gõ số khác ở bước đặt (voucher khoá theo SĐT phiên).
//  - Phiên chưa xác minh vẫn đặt được, nhưng đơn không gắn khách (customer_id NULL) và KHÔNG tiêu được Hạt Cốm.
//  - Voucher: chỉ voucher khoá đúng SĐT phiên, còn hạn, chưa dùng. Đánh dấu đã dùng cùng transaction với đơn.
//  - Lưu đơn TRƯỚC, gọi POScake SAU: POScake lỗi hoặc treo thì đơn vẫn còn (pos_status 'loi') và có tin Telegram báo.
//  - Bản Zalo bắt buộc thanh toán qua Checkout SDK (làm khi OA đã xác thực); bản web dùng COD hoặc chuyển khoản SePay.
import { randomBytes } from 'node:crypto'
import { getDb } from '../db'
import { createPancakeOrderGeneric } from '../pancake'
import { buildQRPayload } from '../sepay'
import { findSku, variationId } from './catalog'
import { pointsBalance } from './checkin'
import { MiniError, badRequest, noSession } from './errors'
import { esc, notifyOrderGroup } from './notify'
import { loadSession, maskPhone, type SessionRow } from './service'

type Sql = ReturnType<typeof getDb>

export const ORDER_LIMITS = { perSessionHour: 3, perPhoneDay: 5, maxLines: 10, maxQtyLine: 20, maxQtyTotal: 50 }
const PAYMENTS = ['cod', 'chuyen_khoan'] as const
type Payment = (typeof PAYMENTS)[number]

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '')

export interface RedeemRules {
  vnd_per_point: number
  max_pct: number
}

/** Quy đổi Hạt Cốm ra tiền: app_settings 'mini_points'.redeem = { vnd_per_point, max_pct }. Chưa có → tắt tiêu điểm. */
export async function redeemRules(sql: Sql = getDb()): Promise<RedeemRules | null> {
  const r = await sql`SELECT value -> 'redeem' AS v FROM app_settings WHERE key = 'mini_points'`
  const v = r[0]?.v as Partial<RedeemRules> | null | undefined
  if (!v || !Number.isInteger(v.vnd_per_point) || (v.vnd_per_point as number) <= 0) return null
  if (!Number.isInteger(v.max_pct) || (v.max_pct as number) <= 0 || (v.max_pct as number) > 100) return null
  return { vnd_per_point: v.vnd_per_point as number, max_pct: v.max_pct as number }
}

interface Line { sku: string; label: string; qty: number; unit_price: number }

function parseItems(raw: unknown): Line[] {
  if (!Array.isArray(raw) || raw.length === 0) throw new MiniError(400, 'empty_cart', 'Giỏ hàng đang trống.')
  const qty = new Map<string, number>()
  for (const it of raw) {
    const sku = typeof it?.sku === 'string' ? it.sku : ''
    const q = it?.qty
    if (!findSku(sku) || !Number.isInteger(q) || q < 1) throw badRequest('Có món trong giỏ không còn bán, chị xoá đi rồi đặt lại giúp Cô nhé.')
    qty.set(sku, (qty.get(sku) ?? 0) + q)
  }
  const lines = [...qty].map(([sku, q]) => {
    const c = findSku(sku)!
    return { sku, label: `${c.name} ${c.variant}`, qty: q, unit_price: c.price }
  })
  const total = lines.reduce((s, l) => s + l.qty, 0)
  if (lines.length > ORDER_LIMITS.maxLines || lines.some(l => l.qty > ORDER_LIMITS.maxQtyLine) || total > ORDER_LIMITS.maxQtyTotal) {
    throw badRequest('Đơn nhiều quá, chị nhắn Cô Hạ để được báo giá sỉ nhé.')
  }
  return lines
}

interface VoucherRow { id: number; code: string; amount: number }

async function findVoucher(s: SessionRow, codeRaw: unknown, sql: Sql): Promise<VoucherRow | null> {
  if (codeRaw === undefined || codeRaw === null || codeRaw === '') return null
  const code = typeof codeRaw === 'string' ? codeRaw.trim().toUpperCase() : ''
  if (!/^[A-Z0-9]{4,20}$/.test(code) || !s.phone) throw voucherInvalid()
  const r = await sql`
    SELECT id, code, amount FROM reward_ledger
    WHERE code = ${code} AND kind = 'voucher' AND locked_phone = ${s.phone} AND status = 'da_cap'
      AND (expires_at IS NULL OR expires_at > NOW())`
  if (!r[0]) throw voucherInvalid()
  return { id: r[0].id, code: r[0].code, amount: Number(r[0].amount) }
}

const voucherInvalid = () => new MiniError(400, 'voucher_invalid', 'Mã ưu đãi không dùng được cho số điện thoại này, hoặc đã hết hạn.')

export interface Quote {
  items: Line[]
  subtotal: number
  voucher: { code: string; amount: number } | null
  points: { available: number; usable: number; used: number; amount: number; vnd_per_point: number } | null
  total: number
  shipping_note: string
}

const SHIPPING_NOTE = 'Chưa gồm phí ship. Cô Hạ gọi xác nhận và báo phí ship theo khu vực (thường 20–40k).'

/** Tính tiền một giỏ hàng (dùng cho cả bước xem trước và bước đặt). Chỉ phiên đã xác minh mới tiêu được Hạt Cốm. */
export async function quote(s: SessionRow, body: Record<string, unknown>, sql: Sql): Promise<Quote & { voucherRow: VoucherRow | null }> {
  const items = parseItems(body.items)
  const subtotal = items.reduce((t, l) => t + l.qty * l.unit_price, 0)
  const voucherRow = await findVoucher(s, body.voucher_code, sql)
  const voucherAmount = voucherRow ? Math.min(voucherRow.amount, subtotal) : 0

  let points: Quote['points'] = null
  const rules = s.verified && s.customer_id ? await redeemRules(sql) : null
  if (rules) {
    const available = await pointsBalance(s, sql)
    const cap = Math.floor(((subtotal - voucherAmount) * rules.max_pct) / 100 / rules.vnd_per_point)
    const usable = Math.max(0, Math.min(available, cap))
    const want = body.use_points === undefined || body.use_points === null ? 0 : body.use_points
    if (!Number.isInteger(want) || (want as number) < 0) throw badRequest()
    const used = Math.min(want as number, usable)
    points = { available, usable, used, amount: used * rules.vnd_per_point, vnd_per_point: rules.vnd_per_point }
  }
  const total = subtotal - voucherAmount - (points?.amount ?? 0)
  return {
    items,
    subtotal,
    voucher: voucherRow ? { code: voucherRow.code, amount: voucherAmount } : null,
    points,
    total,
    shipping_note: SHIPPING_NOTE,
    voucherRow,
  }
}

async function requireOrderSession(sessionId: number | null, sql: Sql): Promise<SessionRow> {
  const s = await loadSession(sessionId, sql)
  if (!s || !s.phone) throw noSession()
  return s
}

export async function previewOrder(sessionId: number | null, body: Record<string, unknown>, sql: Sql = getDb()): Promise<Quote> {
  const s = await requireOrderSession(sessionId, sql)
  const q: Partial<Awaited<ReturnType<typeof quote>>> = await quote(s, body, sql)
  delete q.voucherRow
  return q as Quote
}

/** Mã đơn = mã nội dung chuyển khoản: HMA + 4 số cuối SĐT + 6 số giờ + 4 ký tự ngẫu nhiên (khó đoán, giống SXX). */
export function generateMiniRef(phone: string): string {
  return `HMA${phone.replace(/\D/g, '').slice(-4)}${Date.now().toString().slice(-6)}${randomBytes(2).toString('hex').toUpperCase()}`
}

export async function placeOrder(sessionId: number | null, body: Record<string, unknown>, ctx: { zalo: boolean }, sql: Sql = getDb()) {
  const s0 = await requireOrderSession(sessionId, sql)
  const name = clean(body.name, 100)
  const address = clean(body.address, 500)
  const note = clean(body.note, 500)
  const payment = body.payment as Payment
  if (name.length < 2) throw badRequest('Chị cho Cô xin tên người nhận nhé.')
  if (address.length < 10) throw badRequest('Chị ghi rõ địa chỉ nhận hàng (số nhà, phường/xã, tỉnh) giúp Cô nhé.')
  if (!PAYMENTS.includes(payment)) throw badRequest()
  // Bản Zalo phải thanh toán qua Checkout SDK (chính sách Zalo Mini App) — chưa làm, nên chặn ở máy chủ.
  if (ctx.zalo) throw new MiniError(400, 'checkout_required', 'Bản Zalo đang chờ cổng thanh toán Zalo, chị đặt qua tin nhắn với Cô Hạ giúp nhé.')

  const order = await sql.begin(async tx => {
    // Khoá theo SĐT (và theo khách nếu đã xác minh): 2 lần bấm đặt cùng lúc không vượt giới hạn, không tiêu trùng điểm/voucher.
    await tx`SELECT pg_advisory_xact_lock(hashtext(${'mini-order:' + s0.phone}))`
    const s = (await loadSession(s0.id, tx as unknown as Sql))!
    if (s.verified && s.customer_id) await tx`SELECT pg_advisory_xact_lock(hashtext(${'mini-order-c:' + s.customer_id}))`

    const recent = await tx`
      SELECT COUNT(*) FILTER (WHERE mini_session_id = ${s.id} AND created_at > NOW() - INTERVAL '1 hour')::int AS by_session,
             COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours')::int AS by_phone
      FROM mini_orders WHERE phone = ${s.phone} AND created_at > NOW() - INTERVAL '24 hours'`
    if (recent[0].by_session >= ORDER_LIMITS.perSessionHour || recent[0].by_phone >= ORDER_LIMITS.perPhoneDay) {
      throw new MiniError(429, 'order_limit', 'Chị vừa đặt mấy đơn rồi. Cần sửa đơn thì nhắn Cô Hạ giúp Cô nhé.')
    }

    const q = await quote(s, body, tx as unknown as Sql)
    if (body.expected_total !== undefined && body.expected_total !== q.total) {
      throw new MiniError(409, 'price_changed', 'Giá vừa thay đổi, chị xem lại tổng tiền rồi đặt lại giúp Cô nhé.', { quote: { ...q, voucherRow: undefined } })
    }
    const ref = generateMiniRef(s.phone!)
    const cid = s.verified ? s.customer_id : null
    const row = (await tx`
      INSERT INTO mini_orders (ref_code, mini_session_id, customer_id, phone, name, address, note, items, subtotal,
                               voucher_id, voucher_amount, points_used, points_amount, total, payment, channel)
      VALUES (${ref}, ${s.id}, ${cid}, ${s.phone}, ${name}, ${address}, ${note}, ${tx.json(q.items as never)}, ${q.subtotal},
              ${q.voucherRow?.id ?? null}, ${q.voucher?.amount ?? 0}, ${q.points?.used ?? 0}, ${q.points?.amount ?? 0}, ${q.total},
              ${payment}, 'web')
      RETURNING *`)[0]

    if (q.voucherRow) {
      const used = await tx`UPDATE reward_ledger SET status = 'da_dung', order_id = ${ref}
                            WHERE id = ${q.voucherRow.id} AND status = 'da_cap' RETURNING id`
      if (!used.length) throw voucherInvalid()
    }
    if (q.points && q.points.used > 0) {
      await tx`INSERT INTO points_ledger (mini_session_id, customer_id, delta, reason, ref, note)
               VALUES (${s.id}, ${cid}, ${-q.points.used}, 'dung_don', ${ref}, ${'Trừ vào đơn ' + ref})`
    }
    await tx`
      INSERT INTO funnel_events (mini_session_id, customer_id, anon_id, step, name, batch_code, props)
      VALUES (${s.id}, ${cid}, ${s.anon_id}, 7, 'order_placed', ${s.batch_code},
              ${tx.json({ ref, total: q.total, payment, lines: q.items.length, voucher: !!q.voucher, points: q.points?.used ?? 0 })})`
    return row as OrderRow
  })

  await pushToPos(order, sql)
  const fresh = (await sql`SELECT * FROM mini_orders WHERE id = ${order.id}`)[0]
  await notifyNewOrder(fresh).catch(err => console.error('[mini-order] Telegram', err))
  return {
    order: publicOrder(fresh),
    qr: payment === 'chuyen_khoan' ? buildQRPayload(fresh.ref_code, Number(fresh.total)) : null,
  }
}

type OrderRow = Record<string, unknown> & { id: number; ref_code: string; items: Line[] }

/** Tạo đơn trên POScake. Thiếu variation của bất kỳ món nào thì KHÔNG gửi (hàm chung sẽ lặng lẽ bỏ món đó → đơn thiếu hàng). */
export async function pushToPos(o: OrderRow, sql: Sql = getDb()): Promise<void> {
  const missing = o.items.filter(l => !variationId(findSku(l.sku)!)).map(l => l.sku)
  let posId: string | null = null
  let error: string | null = missing.length ? 'thieu_variation:' + missing.join(',') : null
  if (!error) {
    // Giảm giá ghi vào ghi chú đơn; cod = số khách phải trả. (Gửi total_discount khi lib/pancake.ts hỗ trợ.)
    const parts = [`Đặt qua Mini App HACO · ${o.ref_code}`, o.payment === 'chuyen_khoan' ? 'Chuyển khoản' : 'COD']
    if (Number(o.voucher_amount)) parts.push(`Voucher -${Number(o.voucher_amount).toLocaleString('vi-VN')}đ`)
    if (Number(o.points_amount)) parts.push(`Hạt Cốm -${Number(o.points_amount).toLocaleString('vi-VN')}đ (${o.points_used} hạt)`)
    try {
      const res = await createPancakeOrderGeneric({
        name: o.name as string,
        phone: o.phone as string,
        address: o.address as string,
        items: o.items.map(l => ({ variationId: variationId(findSku(l.sku)!), quantity: l.qty, unitPrice: l.unit_price })),
        totalPrice: Number(o.total),
        note: (o.note as string) || undefined,
        sourceLabel: parts.join(' | '),
        logTag: 'HMA',
      })
      const r = res as { data?: { id?: unknown }; id?: unknown } | null
      const id = r?.data?.id ?? r?.id
      if (id !== undefined && id !== null) posId = String(id)
      else error = 'pos_khong_tao_duoc'
    } catch (e) {
      error = 'pos_loi:' + String((e as Error).message ?? e).slice(0, 200)
    }
  }
  await sql`UPDATE mini_orders SET pos_order_id = ${posId}, pos_status = ${posId ? 'da_tao' : 'loi'}, pos_error = ${error}, updated_at = NOW()
            WHERE id = ${o.id}`
}

const money = (n: unknown) => Number(n).toLocaleString('vi-VN') + 'đ'

async function notifyNewOrder(o: Record<string, unknown>) {
  const items = (o.items as Line[]).map(l => `  - ${esc(l.label)} × ${l.qty}`).join('\n')
  const pos = o.pos_status === 'da_tao' ? `POScake: <b>${esc(o.pos_order_id)}</b>` : `⚠️ <b>CHƯA CÓ ĐƠN TRÊN POSCAKE</b> (${esc(o.pos_error)})`
  const discounts = [
    Number(o.voucher_amount) ? `voucher -${money(o.voucher_amount)}` : '',
    Number(o.points_amount) ? `Hạt Cốm -${money(o.points_amount)}` : '',
  ].filter(Boolean).join(', ')
  await notifyOrderGroup(`🛒 <b>ĐƠN MINI APP</b> · ${esc(o.ref_code)}

• Tên: <b>${esc(o.name)}</b>
• SĐT: <b>${esc(o.phone)}</b>
• Địa chỉ: ${esc(o.address)}
• Hàng:
${items}
• Tạm tính: ${money(o.subtotal)}${discounts ? `\n• Giảm: ${discounts}` : ''}
• Khách trả: <b>${money(o.total)}</b> + ship · ${o.payment === 'chuyen_khoan' ? 'chuyển khoản (chờ tiền)' : 'COD'}${o.note ? `\n• Ghi chú: ${esc(o.note)}` : ''}
• ${pos}`)
}

export interface PublicOrder {
  ref_code: string
  created_at: string
  items: Line[]
  subtotal: number
  voucher_amount: number
  points_used: number
  points_amount: number
  total: number
  payment: Payment
  payment_status: string
  status: string
  status_label: string
  phone_masked: string
}

function publicOrder(o: Record<string, unknown>): PublicOrder {
  return {
    ref_code: o.ref_code as string,
    created_at: new Date(o.created_at as string).toISOString(),
    items: o.items as Line[],
    subtotal: Number(o.subtotal),
    voucher_amount: Number(o.voucher_amount),
    points_used: Number(o.points_used),
    points_amount: Number(o.points_amount),
    total: Number(o.total),
    payment: o.payment as Payment,
    payment_status: o.payment_status as string,
    status: o.status as string,
    // Khách chỉ thấy trạng thái chung; lỗi POScake là việc nội bộ, nhân viên tạo đơn tay.
    status_label: o.status === 'huy' ? 'Đã huỷ' : (o.pos_status_name as string) || 'Cô Hạ đã nhận đơn',
    phone_masked: maskPhone(o.phone as string),
  }
}

/** Đơn của tôi: đã xác minh thì mọi đơn của khách; chưa thì chỉ đơn đặt từ phiên này. Trạng thái lấy từ đơn POScake đã đồng bộ. */
export async function listOrders(sessionId: number | null, sql: Sql = getDb()) {
  const s = await loadSession(sessionId, sql)
  if (!s) throw noSession()
  const cid = s.verified ? s.customer_id : null
  const rows = cid
    ? await sql`SELECT m.*, p.status_name AS pos_status_name FROM mini_orders m LEFT JOIN pancake_orders p ON p.pos_order_id = m.pos_order_id
                WHERE m.customer_id = ${cid} OR m.mini_session_id = ${s.id} ORDER BY m.created_at DESC LIMIT 30`
    : await sql`SELECT m.*, p.status_name AS pos_status_name FROM mini_orders m LEFT JOIN pancake_orders p ON p.pos_order_id = m.pos_order_id
                WHERE m.mini_session_id = ${s.id} ORDER BY m.created_at DESC LIMIT 30`
  return { orders: rows.map(publicOrder) }
}

/** Đơn chuyển khoản: app hỏi lại để biết đã nhận tiền chưa (SePay webhook đánh dấu). Chỉ chủ đơn mới xem được. */
export async function orderStatus(sessionId: number | null, ref: string, sql: Sql = getDb()) {
  const s = await loadSession(sessionId, sql)
  if (!s) throw noSession()
  const cid = s.verified ? s.customer_id : null
  const r = await sql`SELECT m.*, p.status_name AS pos_status_name FROM mini_orders m LEFT JOIN pancake_orders p ON p.pos_order_id = m.pos_order_id
                      WHERE m.ref_code = ${ref} AND (m.mini_session_id = ${s.id} OR (${cid}::int IS NOT NULL AND m.customer_id = ${cid}))`
  if (!r[0]) throw new MiniError(404, 'not_found', 'Không tìm thấy đơn này.')
  const o = r[0]
  return { order: publicOrder(o), qr: o.payment === 'chuyen_khoan' && o.payment_status === 'chua_tra' ? buildQRPayload(o.ref_code, Number(o.total)) : null }
}

// ── SePay: tiền chuyển khoản có nội dung HMA… (đăng ký ở lib/product-handlers.ts) ─────────────

export async function getMiniOrderByRef(ref: string) {
  const r = await getDb()`SELECT * FROM mini_orders WHERE ref_code = ${ref.toUpperCase()} AND status <> 'huy'`
  const o = r[0]
  if (!o) return undefined
  const items = o.items as Line[]
  return {
    name: o.name as string,
    phone: o.phone as string,
    product: items.map(l => `${l.label} × ${l.qty}`).join(', '),
    quantity: items.reduce((t, l) => t + l.qty, 0),
    total_price: Number(o.total),
    payment_status: o.payment_status === 'da_tra' ? 'paid' : 'pending',
    pancake_order_id: (o.pos_order_id as string | null) ?? null,
  }
}

/** Nguyên tử: true chỉ khi CHÍNH lần gọi này chuyển đơn sang đã trả (SePay có thể gọi webhook trùng). */
export async function confirmMiniPayment(ref: string): Promise<boolean> {
  const r = await getDb()`UPDATE mini_orders SET payment_status = 'da_tra', updated_at = NOW()
                          WHERE ref_code = ${ref.toUpperCase()} AND payment_status = 'chua_tra' AND status <> 'huy' RETURNING id`
  return r.length > 0
}

export async function notifyMiniPaid(d: {
  name: string; phone: string; product: string; quantity: number; totalPrice: number
  refCode: string; pancakeOrderId?: string; pancakeUpdated: boolean
}) {
  const pos = d.pancakeOrderId
    ? d.pancakeUpdated ? `POScake ${esc(d.pancakeOrderId)}: đã chuyển "Chờ chuyển hàng"` : `⚠️ POScake ${esc(d.pancakeOrderId)}: CHƯA cập nhật được, đang thử lại`
    : '⚠️ <b>CHƯA CÓ ĐƠN TRÊN POSCAKE</b>'
  await notifyOrderGroup(`💰 <b>MINI APP ĐÃ CHUYỂN KHOẢN</b> · ${esc(d.refCode)}

• Tên: <b>${esc(d.name)}</b> · ${esc(d.phone)}
• Hàng: ${esc(d.product)}
• Đã nhận: <b>${money(d.totalPrice)}</b> (chưa gồm ship)
• ${pos}`)
}
