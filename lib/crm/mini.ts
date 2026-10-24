// Logic dữ liệu Mini App phía CRM (hợp đồng đã chốt với phiên "Mini app Zalo OA"):
// - Phiên chưa xác minh SĐT không được chạm hồ sơ khách đang có.
// - Xác minh (zalo_phone_token / otp / staff / order_match) → promoteMiniSession() gắn mọi dữ liệu của phiên vào khách trong 1 giao dịch.
// - Ghép mã đơn: tra cả 3 cột mã trên pancake_orders, chỉ tự khớp khi đúng 1 đơn VÀ trùng SĐT của phiên.
import { getDb } from '../db'
import { normalizeRef } from './orders'
import { logAction } from './audit'

type Sql = ReturnType<typeof getDb>
export type VerifiedVia = 'zalo_phone_token' | 'otp' | 'staff' | 'order_match'

export class ClaimConflictError extends Error {}

export const CLAIM_LIMIT_PER_SESSION = 5
export const CLAIM_LIMIT_PER_PHONE = 10

export async function promoteMiniSession(sessionId: number, via: VerifiedVia, actor: { type: 'staff' | 'customer' | 'system'; id: number | null }, sql: Sql = getDb()) {
  return sql.begin(async tx => {
    const t = tx as unknown as Sql
    const s = (await t`SELECT * FROM mini_sessions WHERE id = ${sessionId} FOR UPDATE`)[0]
    if (!s || !s.phone) throw new Error('Phiên không tồn tại hoặc chưa có SĐT')
    // Khách theo SĐT: có rồi thì dùng, chưa có thì tạo (source = mini)
    const cust = (await t`
      INSERT INTO customers (phone, source, stage, phone_verified_at) VALUES (${s.phone}, 'mini', 'moi', NOW())
      ON CONFLICT (phone) DO UPDATE SET phone_verified_at = COALESCE(customers.phone_verified_at, NOW()), updated_at = NOW()
      RETURNING id`)[0]
    const cid = cust.id as number
    await t`UPDATE mini_sessions SET verified = TRUE, verified_via = ${via}, verified_at = NOW(), customer_id = ${cid} WHERE id = ${sessionId}`
    // Chỉ gom event ẩn danh TRƯỚC bước identify (mini_session_id IS NULL). Cùng máy có thể có phiên khác chưa xác minh của người khác.
    await t`UPDATE funnel_events SET customer_id = ${cid}
            WHERE mini_session_id = ${sessionId} OR (anon_id = ${s.anon_id} AND mini_session_id IS NULL AND customer_id IS NULL)`
    await t`UPDATE order_claims SET customer_id = ${cid} WHERE mini_session_id = ${sessionId}`
    await t`UPDATE mini_orders SET customer_id = ${cid}, updated_at = NOW() WHERE mini_session_id = ${sessionId} AND customer_id IS NULL`
    // lesson_progress KHÔNG gộp dòng: mỗi phiên giữ dòng riêng. Mọi chỗ đọc tiến độ của khách phải dùng
    // MAX(watched_pct), MIN(completed_at) … GROUP BY customer_id, lesson_no.
    await t`UPDATE lesson_progress SET customer_id = ${cid} WHERE mini_session_id = ${sessionId}`
    await t`UPDATE reward_ledger SET customer_id = ${cid} WHERE mini_session_id = ${sessionId}`
    // v2-A: điểm danh / Hạt Cốm / sổ tay. Dòng trùng với dữ liệu khách đã có từ phiên/máy khác (cùng ngày điểm danh,
    // cùng mốc chuỗi, thưởng đăng ký) thì GIỮ customer_id NULL — không gộp, để không cộng điểm 2 lần.
    // Số dư của khách = SUM(delta) WHERE customer_id = khách; của phiên chưa xác minh = SUM(delta) WHERE mini_session_id = phiên.
    await t`UPDATE daily_checkins d SET customer_id = ${cid} WHERE d.mini_session_id = ${sessionId} AND d.customer_id IS NULL
            AND NOT EXISTS (SELECT 1 FROM daily_checkins x WHERE x.customer_id = ${cid} AND x.day = d.day)`
    await t`UPDATE points_ledger p SET customer_id = ${cid} WHERE p.mini_session_id = ${sessionId} AND p.customer_id IS NULL
            AND (p.reason NOT IN ('diem_danh', 'moc_chuoi', 'dang_ky')
                 OR NOT EXISTS (SELECT 1 FROM points_ledger x WHERE x.customer_id = ${cid} AND x.reason = p.reason AND x.ref = p.ref))`
    await t`UPDATE saved_recipes SET customer_id = ${cid} WHERE mini_session_id = ${sessionId}`
    await t`UPDATE consents SET customer_id = ${cid}, verified = TRUE WHERE mini_session_id = ${sessionId}`
    // Đồng ý/rút lại từ phiên giờ mới được áp vào cờ "không liên hệ". Quy tắc (chặn thừa có chủ đích):
    // lượt mới nhất của phiên là RÚT LẠI ở BẤT KỲ kênh nào → bật opted_out_at cho cả khách. Không bao giờ tự tắt opted_out_at.
    const last = (await t`SELECT revoked_at FROM consents WHERE mini_session_id = ${sessionId} ORDER BY COALESCE(revoked_at, granted_at) DESC LIMIT 1`)[0]
    if (last?.revoked_at) await t`UPDATE customers SET opted_out_at = COALESCE(opted_out_at, NOW()) WHERE id = ${cid}`
    await t`
      INSERT INTO customer_activities (customer_id, kind, content, staff_id)
      VALUES (${cid}, 'mini_xac_minh', ${'Xác minh SĐT qua Mini App (' + via + ')' + (s.batch_code ? ', lô QR ' + s.batch_code : '')}, ${actor.type === 'staff' ? actor.id : null})`
    await logAction({ actorType: actor.type, actorId: actor.id, action: 'VERIFY', table: 'mini_sessions', recordId: sessionId, after: { via, customer_id: cid } }, t)
    return cid
  })
}

export interface ClaimLookup { result: 'khop_sdt' | 'don_san' | 'nhieu_don' | 'sai_sdt' | 'chua_thay'; orderId: string | null; refKind: string | null; platform: string | null }

export async function lookupOrderRef(raw: string, sessionPhone: string | null, sql: Sql = getDb()): Promise<ClaimLookup> {
  const ref = normalizeRef(raw)
  if (ref.length < 4) return { result: 'chua_thay', orderId: null, refKind: null, platform: null }
  const hits = await sql`
    SELECT pos_order_id, platform, phone_norm, phone_masked,
      CASE WHEN tracking_code_norm = ${ref} THEN 'tracking_code' WHEN platform_order_ref_norm = ${ref} THEN 'platform_order_ref' ELSE 'pos_order_id' END AS kind
    FROM pancake_orders
    WHERE tracking_code_norm = ${ref} OR platform_order_ref_norm = ${ref} OR pos_order_id_norm = ${ref}
    LIMIT 5`
  if (!hits.length) return { result: 'chua_thay', orderId: null, refKind: null, platform: null }
  if (hits.length > 1) return { result: 'nhieu_don', orderId: null, refKind: null, platform: null }
  const h = hits[0]
  const base = { orderId: h.pos_order_id as string, refKind: h.kind as string, platform: h.platform as string }
  if (h.phone_masked || !h.phone_norm) return { result: 'don_san', ...base }
  if (sessionPhone && h.phone_norm === sessionPhone) return { result: 'khop_sdt', ...base }
  return { result: 'sai_sdt', ...base }
}

/** Nhân viên duyệt 1 yêu cầu ghép đơn. Duyệt khớp chỉ chuyển ĐƠN đó; muốn xác minh cả phiên thì gọi promoteMiniSession(…, 'staff'). */
export async function reviewClaim(id: number, staffId: number, approve: boolean, orderId: string | null, note: string, ip: string, sql: Sql = getDb()) {
  return sql.begin(async tx => {
    const t = tx as unknown as Sql
    const before = (await t`SELECT * FROM order_claims WHERE id = ${id} FOR UPDATE`)[0]
    if (!before || before.status !== 'cho_duyet') return before ?? null
    const matched = approve ? (orderId || before.matched_pancake_order_id) : null
    if (approve && !matched) throw new Error('Cần chọn đơn Pancake để ghép')
    if (approve) {
      const taken = (await t`SELECT id, mini_session_id FROM order_claims WHERE matched_pancake_order_id = ${matched} AND status = 'da_khop' AND id <> ${id}`)[0]
      if (taken) throw new ClaimConflictError(`Đơn này đã được ghép cho phiên #${taken.mini_session_id} (yêu cầu #${taken.id})`)
    }
    const after = (await t`
      UPDATE order_claims SET status = ${approve ? 'da_khop' : 'tu_choi'}, matched_pancake_order_id = ${matched},
        reviewed_by = ${staffId}, reviewed_at = NOW(), review_note = ${note}
      WHERE id = ${id} RETURNING *`)[0]
    await logAction({ actorId: staffId, action: approve ? 'APPROVE' : 'REJECT', table: 'order_claims', recordId: id, before, after, reason: note, ip }, t)
    return after
  })
}

export async function listClaims(status: 'cho_duyet' | 'da_khop' | 'tu_choi' = 'cho_duyet', sql: Sql = getDb()) {
  return sql`
    SELECT oc.*, m.phone AS session_phone, m.verified AS session_verified, m.batch_code,
           po.name AS order_name, po.phone_norm AS order_phone, po.total AS order_total, po.inserted_at AS order_at, po.status_name AS order_status
    FROM order_claims oc JOIN mini_sessions m ON m.id = oc.mini_session_id
    LEFT JOIN pancake_orders po ON po.pos_order_id = oc.matched_pancake_order_id
    WHERE oc.status = ${status} AND (${status} <> 'cho_duyet' OR oc.lookup_result <> 'chua_thay' OR oc.retry_until < NOW())
    ORDER BY oc.created_at LIMIT 300`
}

// ── Đơn đặt trong Mini App (v2-B). Phiên Mini App tạo đơn; CRM xem và huỷ. ─────────────────────

export async function listMiniOrders(status: 'moi' | 'huy' = 'moi', sql: Sql = getDb()) {
  return sql`
    SELECT mo.id, mo.ref_code, mo.customer_id, mo.phone, mo.name, mo.items, mo.subtotal, mo.voucher_amount, mo.points_used, mo.points_amount,
           mo.total, mo.payment, mo.payment_status, mo.pos_order_id, mo.pos_status, mo.pos_error, mo.status, mo.cancel_reason, mo.created_at,
           m.verified AS session_verified, po.status_name AS pos_status_name
    FROM mini_orders mo JOIN mini_sessions m ON m.id = mo.mini_session_id
    LEFT JOIN pancake_orders po ON po.pos_order_id = mo.pos_order_id
    WHERE mo.status = ${status} ORDER BY mo.created_at DESC LIMIT 200`
}

/**
 * Huỷ đơn Mini App: trả voucher về 'da_cap', trả Hạt Cốm đã tiêu ('hoan_don'), ghi nhật ký — trong 1 giao dịch.
 * CRM chỉ đọc POScake nên KHÔNG huỷ đơn trên POScake; trả về pos_order_id để nhân viên huỷ tay. Đơn đã chuyển khoản phải hoàn tiền tay.
 */
export async function cancelMiniOrder(id: number, staffId: number, reason: string, ip: string, sql: Sql = getDb()) {
  return sql.begin(async tx => {
    const t = tx as unknown as Sql
    const before = (await t`SELECT * FROM mini_orders WHERE id = ${id} FOR UPDATE`)[0]
    if (!before) return null
    if (before.status === 'huy') return { order: before, already: true }
    const after = (await t`UPDATE mini_orders SET status = 'huy', cancelled_by = ${staffId}, cancel_reason = ${reason}, updated_at = NOW()
                           WHERE id = ${id} RETURNING *`)[0]
    let voucherRestored = false
    if (before.voucher_id) {
      const v = await t`UPDATE reward_ledger SET status = 'da_cap', order_id = NULL
                        WHERE id = ${before.voucher_id} AND status = 'da_dung' AND order_id = ${before.ref_code} RETURNING id`
      voucherRestored = v.length > 0
    }
    let pointsRestored = 0
    if (before.points_used > 0) {
      const p = await t`INSERT INTO points_ledger (mini_session_id, customer_id, delta, reason, ref, note, created_by)
                        VALUES (${before.mini_session_id}, ${before.customer_id}, ${before.points_used}, 'hoan_don', ${before.ref_code},
                                ${'Trả lại khi huỷ đơn ' + before.ref_code}, ${staffId})
                        ON CONFLICT (mini_session_id, reason, ref) DO NOTHING RETURNING delta`
      pointsRestored = p.length ? Number(p[0].delta) : 0
    }
    await logAction({ actorId: staffId, action: 'CANCEL', table: 'mini_orders', recordId: id, recordKey: before.ref_code,
      before: { status: before.status }, after: { status: 'huy', voucherRestored, pointsRestored }, reason, ip }, t)
    return { order: after, already: false, voucherRestored, pointsRestored }
  })
}
