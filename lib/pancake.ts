const PANCAKE_API_BASE = 'https://pos.pages.fm/api/v1'
const SHOP_ID = process.env.PANCAKE_SHOP_ID || '1328295718'
const API_KEY = process.env.PANCAKE_API_KEY || ''

// ── Pancake Pages (public_api) ────────────────────────────────────────────────
export const PANCAKE_USER_API = 'https://pages.fm/api/v1'
export const PANCAKE_PAGE_API = 'https://pages.fm/api/public_api/v1'

// Slug của page trên pancake.vn dùng để mở thẳng 1 hội thoại (https://pancake.vn/{slug}?c_id={conversation_id}).
// Hiện chỉ có 1 page duy nhất ("Cô Hạ Dạy Nấu Ăn") nên hardcode qua env, có default.
const PANCAKE_PAGE_SLUG = process.env.PANCAKE_PAGE_SLUG || 'hacasau1987'

/** Link mở thẳng 1 hội thoại trên pancake.vn để nhân viên đọc lại nếu cần. */
export function getPancakeConversationUrl(pancakeConversationId: string): string {
  return `https://pancake.vn/${PANCAKE_PAGE_SLUG}?c_id=${pancakeConversationId}`
}

export interface PancakePage {
  pageId: string
  token: string
  name: string
}

/**
 * Lấy danh sách page + page_access_token.
 * Ưu tiên: PANCAKE_USER_TOKEN (1 token, tự lấy hết qua /pages).
 * Fallback: các cặp PANCAKE_PAGE_ID(_n) + PANCAKE_PAGE_TOKEN(_n).
 */
let _pagesCache: { at: number; pages: PancakePage[] } | null = null
const PAGES_CACHE_MS = 60_000

export async function getPancakePages(): Promise<PancakePage[]> {
  if (_pagesCache && Date.now() - _pagesCache.at < PAGES_CACHE_MS) return _pagesCache.pages
  const pages = await loadPancakePages()
  if (pages.length) _pagesCache = { at: Date.now(), pages }
  return pages
}

async function loadPancakePages(): Promise<PancakePage[]> {
  const userToken = process.env.PANCAKE_USER_TOKEN || process.env.PANCAKE_ACCESS_TOKEN
  if (userToken) {
    try {
      const res = await fetch(`${PANCAKE_USER_API}/pages?access_token=${userToken}`, {
        next: { revalidate: 0 },
      })
      if (res.ok) {
        const data = await res.json()
        const list = data?.pages || data?.data || data?.categorized?.activated || []
        const pages: PancakePage[] = []
        for (const p of list) {
          const token = p.page_access_token || p.settings?.page_access_token || ''
          const pageId = String(p.id || p.page_id || '')
          if (token && pageId) {
            pages.push({ pageId, token, name: String(p.name || `Page ${pageId}`) })
          }
        }
        if (pages.length) return pages
      }
    } catch {
      // rơi xuống fallback
    }
  }

  // Fallback: cặp page_id + page_token thủ công
  const pages: PancakePage[] = []
  const pairs: Array<[string | undefined, string | undefined, string]> = [
    [process.env.PANCAKE_PAGE_ID, process.env.PANCAKE_PAGE_TOKEN, 'Page 1'],
  ]
  for (let i = 1; i <= 10; i++) {
    pairs.push([
      process.env[`PANCAKE_PAGE_ID_${i}`],
      process.env[`PANCAKE_PAGE_TOKEN_${i}`],
      `Page ${i + 1}`,
    ])
  }
  for (const [pageId, token, name] of pairs) {
    if (pageId && token) pages.push({ pageId, token, name })
  }
  return pages
}

export async function getPancakePageById(pageId: string): Promise<PancakePage | undefined> {
  const pages = await getPancakePages()
  return pages.find(p => p.pageId === pageId)
}

/** Parse cột tags (JSON text) → mảng string. */
export function parseTags(raw: string | null | undefined): string[] {
  if (!raw) return []
  try { const a = JSON.parse(raw); return Array.isArray(a) ? a.map(String) : [] } catch { return [] }
}

/** Làm sạch nội dung tin nhắn Pancake (HTML → text thuần). */
export function cleanPancakeText(raw: string): string {
  if (!raw) return ''
  return raw
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(div|p)>/gi, '\n')
    .replace(/<a[^>]*href=['"]([^'"]+)['"][^>]*>(.*?)<\/a>/gi, (_m, url, text) =>
      (text && text.trim() && !/^link/i.test(text.trim())) ? `${text.trim()} (${url})` : String(url))
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim()
}

// Variation IDs (env) của từng sản phẩm trong POScake
const VARIATION_IDS: Record<string, string> = {
  '500g': process.env.PANCAKE_VAR_500G || '',
  '1kg':  process.env.PANCAKE_VAR_1KG  || '',
}
const KDX_VARIATION_IDS: Record<string, string> = {
  'lon': process.env.PANCAKE_KDX_VAR || '',
}
const SXC_VARIATION_ID = process.env.PANCAKE_VAR_SXC || ''
const SXX_VARIATION_IDS: Record<string, string> = {
  '500g': process.env.PANCAKE_VAR_SXX_500G || '',
  '1kg':  process.env.PANCAKE_VAR_SXX_1KG  || '',
}

export interface PancakeOrderInput {
  name: string
  phone: string
  email?: string
  address: string
  /** Mỗi dòng hàng: variation_id đã resolve + số lượng + đơn giá (nếu bỏ trống sẽ lấy totalPrice / tổng số lượng). */
  items: Array<{ variationId: string; quantity: number; unitPrice?: number }>
  totalPrice: number
  note?: string
  /** Nhãn nguồn ghi vào note đơn, vd "Đặt qua website hacofood.vn/sot-tron-nom". */
  sourceLabel: string
  /** Tên ngắn dùng cho log. */
  logTag: string
}

/** Hàm tạo đơn Pancake dùng chung cho mọi sản phẩm/kênh (landing page, AI agent...). */
export async function createPancakeOrderGeneric(data: PancakeOrderInput) {
  if (!API_KEY) { console.warn('[pancake] PANCAKE_API_KEY chưa cấu hình — bỏ qua'); return null }
  const items = data.items.filter(i => i.variationId && i.quantity > 0)
  if (!items.length) { console.warn(`[pancake] ${data.logTag}: chưa có variation_id hợp lệ (kiểm tra biến môi trường PANCAKE_VAR_*) — bỏ qua`); return null }

  const totalQty = items.reduce((s, i) => s + i.quantity, 0)
  const body = {
    bill_full_name: data.name,
    bill_phone_number: data.phone,
    bill_email: data.email || undefined,
    note: [data.note ? `Ghi chú: ${data.note}` : '', data.sourceLabel].filter(Boolean).join(' | '),
    cod: data.totalPrice,
    shipping_address: { full_name: data.name, phone_number: data.phone, full_address: data.address },
    items: items.map(i => ({
      variation_id: i.variationId,
      quantity: i.quantity,
      variation_info: { retail_price: i.unitPrice ?? Math.round(data.totalPrice / totalQty) },
    })),
  }
  const url = `${PANCAKE_API_BASE}/shops/${SHOP_ID}/orders?api_key=${API_KEY}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) { console.warn(`[pancake] Tạo đơn ${data.logTag} thất bại:`, res.status, await res.text()); return null }
  const json = await res.json()
  console.log(`[pancake] Tạo đơn ${data.logTag} thành công, ID:`, json?.data?.id || json?.id)
  return json
}

type LandingOrder = { name: string; phone: string; email: string; address: string; quantity: number; totalPrice: number; note?: string }

export function createSxcPancakeOrder(data: LandingOrder) {
  return createPancakeOrderGeneric({
    ...data, items: [{ variationId: SXC_VARIATION_ID, quantity: data.quantity }],
    sourceLabel: 'Đặt qua website hacofood.vn/set-xoi-com', logTag: 'SXC',
  })
}

export function createSxxPancakeOrder(data: LandingOrder & { product: '500g' | '1kg' }) {
  return createPancakeOrderGeneric({
    ...data, items: [{ variationId: SXX_VARIATION_IDS[data.product], quantity: data.quantity }],
    sourceLabel: 'Đặt qua website hacofood.vn/sot-xa-xiu', logTag: 'SXX',
  })
}

export function createPancakeOrder(data: LandingOrder & { product: '500g' | '1kg' }) {
  return createPancakeOrderGeneric({
    ...data, items: [{ variationId: VARIATION_IDS[data.product], quantity: data.quantity }],
    sourceLabel: 'Đặt qua website hacofood.vn/sot-tron-nom', logTag: 'STN',
  })
}

export function createKdxPancakeOrder(data: LandingOrder & { product: 'nho' | 'lon' }) {
  return createPancakeOrderGeneric({
    ...data, items: [{ variationId: KDX_VARIATION_IDS[data.product], quantity: data.quantity }],
    sourceLabel: 'Đặt qua website hacofood.vn/khan-do-xoi', logTag: 'KDX',
  })
}


export async function updatePancakeOrderStatus(orderId: string, status: number) {
  if (!API_KEY) return null
  const url = `${PANCAKE_API_BASE}/shops/${SHOP_ID}/orders/${orderId}?api_key=${API_KEY}`
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
    signal: AbortSignal.timeout(5_000),
  })
  if (!res.ok) {
    console.warn('[pancake] updateOrderStatus thất bại:', res.status, await res.text())
    return null
  }
  return await res.json()
}


// ── Khách hàng (Pancake POS customers) ────────────────────────────────────────
export interface PancakeCustomerRaw {
  pancakeCustomerId: string
  name: string
  phone: string
  email?: string
  address?: string
  tags?: string[]
  orderCount?: number
  totalSpent?: number
  lastOrderAt?: string | null
}

const PANCAKE_CUSTOMERS_PAGE_SIZE = 100
const PANCAKE_CUSTOMERS_MAX_PAGES = 1000 // an toàn: chặn vòng lặp vô hạn nếu API trả sai total_pages (1000 trang × 100 = 100.000 khách)
const PANCAKE_FETCH_TIMEOUT_MS = 20_000 // fetch() gốc không có timeout -> 1 request treo sẽ treo cả sync mãi mãi
const PANCAKE_FETCH_MAX_RETRIES = 2

/** fetch() có timeout (AbortController) + retry với backoff — tránh treo vô hạn khi API Pancake không phản hồi. */
async function fetchPancakeWithRetry(url: string): Promise<Response | null> {
  for (let attempt = 0; attempt <= PANCAKE_FETCH_MAX_RETRIES; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), PANCAKE_FETCH_TIMEOUT_MS)
    try {
      const res = await fetch(url, { signal: controller.signal })
      return res
    } catch (err) {
      const isLastAttempt = attempt === PANCAKE_FETCH_MAX_RETRIES
      console.warn(
        `[pancake] fetch thất bại (lần ${attempt + 1}/${PANCAKE_FETCH_MAX_RETRIES + 1})${isLastAttempt ? ', bỏ cuộc' : ', thử lại'}:`,
        err instanceof Error ? err.message : err
      )
      if (isLastAttempt) return null
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
    } finally {
      clearTimeout(timer)
    }
  }
  return null
}

function mapPancakeCustomer(raw: Record<string, unknown>): PancakeCustomerRaw | null {
  const phoneNumbers = raw.phone_numbers
  const phone = Array.isArray(phoneNumbers) ? phoneNumbers[0] : undefined
  if (!phone) return null

  const addresses = raw.shop_customer_addresses
  const firstAddress = Array.isArray(addresses) ? (addresses[0] as Record<string, unknown> | undefined) : undefined
  const address = firstAddress ? String(firstAddress.full_address || firstAddress.address || '') : ''

  const rawTags = raw.tags
  const tags = Array.isArray(rawTags)
    ? rawTags
        .map((t: unknown) => (typeof t === 'string' ? t : (t as { name?: string } | undefined)?.name))
        .filter((t: unknown): t is string => Boolean(t))
    : []

  const emails = raw.emails
  const email = Array.isArray(emails) ? (emails[0] as string | undefined) : undefined

  return {
    pancakeCustomerId: String(raw.id || raw.customer_id || ''),
    name: String(raw.name || ''),
    phone: String(phone),
    email,
    address,
    tags,
    orderCount: Number(raw.order_count) || 0,
    totalSpent: Number(raw.purchased_amount) || 0,
    lastOrderAt: (raw.last_order_at as string | null) || null,
  }
}

/** Kéo toàn bộ danh sách khách hàng của shop từ Pancake POS, tự phân trang. */
export async function getPancakeCustomers(): Promise<PancakeCustomerRaw[]> {
  if (!API_KEY) {
    console.warn('[pancake] PANCAKE_API_KEY chưa cấu hình — không thể đồng bộ khách hàng')
    return []
  }
  const all: PancakeCustomerRaw[] = []
  let page = 1
  let totalPages = 1
  do {
    const url = `${PANCAKE_API_BASE}/shops/${SHOP_ID}/customers?api_key=${API_KEY}&page_number=${page}&page_size=${PANCAKE_CUSTOMERS_PAGE_SIZE}`
    const res = await fetchPancakeWithRetry(url)
    if (!res) {
      console.warn(`[pancake] Trang ${page} treo/lỗi mạng sau khi retry — dừng phân trang, giữ lại dữ liệu đã lấy được (${all.length} khách hàng)`)
      break
    }
    if (!res.ok) {
      console.warn('[pancake] Lấy danh sách khách hàng thất bại:', res.status, await res.text())
      break
    }
    const json = await res.json()
    const list: Record<string, unknown>[] = json?.data || []
    for (const item of list) {
      const mapped = mapPancakeCustomer(item)
      if (mapped) all.push(mapped)
    }
    totalPages = Number(json?.total_pages) || 1
    page++
  } while (page <= totalPages && page <= PANCAKE_CUSTOMERS_MAX_PAGES)

  // Không được cắt cụt im lặng: nếu còn trang chưa lấy thì phải báo rõ
  if (page <= totalPages) {
    console.warn(`[pancake] CẢNH BÁO: dừng ở trang ${page - 1}/${totalPages} — còn khách chưa được đồng bộ (đã lấy ${all.length}).`)
  }
  console.log(`[pancake] Đã lấy ${all.length} khách hàng từ ${totalPages} trang`)
  return all
}


// ── Đơn hàng POS (đọc danh sách, để đồng bộ về CRM) ────────────────────────────
export interface PosOrderRaw {
  posOrderId: string
  phone: string
  name: string
  totalPrice: number
  status: number
  statusName: string
  items: Array<{ name: string; quantity: number }>
  insertedAt: string | null
}

function mapPosOrder(raw: Record<string, unknown>): PosOrderRaw | null {
  const id = raw.id ?? raw.system_id
  if (id === undefined || id === null) return null
  const items = Array.isArray(raw.items)
    ? (raw.items as Record<string, unknown>[]).map(i => ({
        name: String((i.variation_info as Record<string, unknown> | undefined)?.display_id || i.product_id || 'Sản phẩm'),
        quantity: Number(i.quantity) || 0,
      }))
    : []
  return {
    posOrderId: String(id),
    phone: String(raw.bill_phone_number || raw.shipping_address && (raw.shipping_address as Record<string, unknown>).phone_number || ''),
    name: String(raw.bill_full_name || ''),
    totalPrice: Number(raw.total_price) || 0,
    status: Number(raw.status) || 0,
    statusName: String(raw.status_name || ''),
    items,
    insertedAt: (raw.inserted_at as string) || null,
  }
}

/** Lấy 1 trang đơn hàng POS, mới nhất trước. Dùng để đồng bộ đơn về CRM (giá trị, khách, sản phẩm). */
export async function getPancakePosOrdersPage(pageNumber: number, pageSize = 100): Promise<{ orders: PosOrderRaw[]; total: number } | null> {
  if (!API_KEY) { console.warn('[pancake] PANCAKE_API_KEY chưa cấu hình'); return null }
  const url = `${PANCAKE_API_BASE}/shops/${SHOP_ID}/orders?api_key=${API_KEY}&page_number=${pageNumber}&page_size=${pageSize}`
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) })
  if (!res.ok) { console.warn('[pancake] Lấy đơn POS thất bại:', res.status, await res.text()); return null }
  const json = await res.json()
  const list: Record<string, unknown>[] = json?.data || []
  const orders = list.map(mapPosOrder).filter((o): o is PosOrderRaw => o !== null)
  return { orders, total: Number(json?.total) || 0 }
}
