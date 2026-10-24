// Tin Telegram cho đơn Mini App, gửi vào nhóm đơn hàng (cùng biến môi trường với lib/telegram.ts).
// Viết riêng để không phụ thuộc hàm nội bộ của lib/telegram.ts. Lỗi thì NÉM để nơi gọi ghi log, không làm hỏng đơn.
const BOT_TOKEN = () => process.env.TELEGRAM_BOT_TOKEN || ''
const ORDER_GROUP_ID = () => process.env.TELEGRAM_ORDER_GROUP_ID || process.env.TELEGRAM_COURSE_GROUP_ID || ''

/** Escape cho parse_mode=HTML: tên, địa chỉ, ghi chú do khách gõ không được chèn thẻ hay link giả. */
export function esc(s: unknown): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export async function notifyOrderGroup(html: string): Promise<void> {
  const token = BOT_TOKEN()
  const chatId = ORDER_GROUP_ID()
  if (!token || !chatId) return
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: html, parse_mode: 'HTML' }),
    signal: AbortSignal.timeout(6_000),
  })
  if (!res.ok) throw new Error(`Telegram sendMessage ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`)
}
