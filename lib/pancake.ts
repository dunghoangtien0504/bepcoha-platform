const PANCAKE_API_BASE = 'https://pos.pages.fm/api/v1'
const SHOP_ID = process.env.PANCAKE_SHOP_ID || '1328295718'
const API_KEY = process.env.PANCAKE_API_KEY || ''

// ── Pancake Pages (public_api) ────────────────────────────────────────────────
export const PANCAKE_USER_API = 'https://pages.fm/api/v1'
export const PANCAKE_PAGE_API = 'https://pages.fm/api/public_api/v1'

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
export async function getPancakePages(): Promise<PancakePage[]> {
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

// Variation IDs (or SKU) của sản phẩm trong POScake
const VARIATION_IDS: Record<string, string> = {
  '500g': process.env.PANCAKE_VAR_500G || '',
  '1kg':  process.env.PANCAKE_VAR_1KG  || '',
}

export async function createPancakeOrder(data: {
  name: string
  phone: string
  email: string
  address: string
  product: '500g' | '1kg'
  quantity: number
  totalPrice: number
  note?: string
}) {
  if (!API_KEY) {
    console.warn('[pancake] PANCAKE_API_KEY chưa được cấu hình — bỏ qua')
    return null
  }

  const variationId = VARIATION_IDS[data.product]
  if (!variationId) {
    console.warn(`[pancake] PANCAKE_VAR_${data.product.toUpperCase()} chưa được cấu hình — bỏ qua`)
    return null
  }

  const unitPrice = data.totalPrice / data.quantity

  const body = {
    bill_full_name: data.name,
    bill_phone_number: data.phone,
    bill_email: data.email || undefined,
    note: [
      data.note ? `Ghi chú: ${data.note}` : '',
      `Đặt qua website hacofood.vn/sot-tron-nom`,
    ].filter(Boolean).join(' | '),
    cod: data.totalPrice,
    shipping_address: {
      full_name: data.name,
      phone_number: data.phone,
      full_address: data.address,
    },
    items: [
      {
        variation_id: variationId,
        quantity: data.quantity,
        variation_info: {
          retail_price: unitPrice,
        },
      },
    ],
  }

  const url = `${PANCAKE_API_BASE}/shops/${SHOP_ID}/orders?api_key=${API_KEY}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('[pancake] Tạo đơn thất bại:', res.status, err)
    return null
  }

  const json = await res.json()
  console.log('[pancake] Tạo đơn thành công, ID:', json?.data?.id || json?.id)
  return json
}
