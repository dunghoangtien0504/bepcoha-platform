const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''
const GIFT_GROUP_ID = process.env.TELEGRAM_GIFT_GROUP_ID || ''
const COURSE_GROUP_ID = process.env.TELEGRAM_COURSE_GROUP_ID || ''

async function sendMessage(chatId: string, text: string) {
  if (!BOT_TOKEN || !chatId) return
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  })
}

export async function notifyGiftLead(data: { name: string; email: string; phone: string }) {
  const msg = `🟢 <b>HỌC VIÊN NHẬN QUÀ MỚI</b>

• Tên: <b>${data.name}</b>
• Email: ${data.email}
• SĐT: ${data.phone}
• Thời gian: ${new Date().toLocaleString('vi-VN')}`

  await sendMessage(GIFT_GROUP_ID, msg)
}

export async function notifyCourseLead(data: {
  name: string
  email: string
  phone: string
  paymentRef: string
  status: 'pending' | 'paid'
  amount?: number
}) {
  // Telegram không hỗ trợ chữ màu → dùng ô vuông màu để nổi bật: 🟢 xanh (đã TT), 🔴 đỏ (chờ TT)
  const isPaid = data.status === 'paid'
  const square = isPaid ? '🟢' : '🔴'
  const statusText = isPaid ? 'ĐÃ THANH TOÁN' : 'CHỜ THANH TOÁN'
  const amountText = (data.amount ?? 299000).toLocaleString('vi-VN') + 'đ'

  const msg = `${square} <b>KHÓA DƯA CÀ MUỐI – ${statusText}</b> ${square}

• Tên: <b>${data.name}</b>
• Email: ${data.email}
• SĐT: ${data.phone}
• Mã giao dịch: <code>${data.paymentRef}</code>
• Số tiền: <b>${amountText}</b>
• Thời gian: ${new Date().toLocaleString('vi-VN')}`

  await sendMessage(COURSE_GROUP_ID, msg)
}

// Cảnh báo khi khách chuyển KHÔNG ĐỦ tiền (vd test 10k) – gửi để admin xử lý tay
export async function notifyPaymentMismatch(data: {
  paymentRef: string
  received: number
  expected: number
  content: string
}) {
  const msg = `🔴 <b>CHUYỂN KHOẢN KHÔNG KHỚP – CẦN KIỂM TRA</b> 🔴

• Mã đơn: <code>${data.paymentRef}</code>
• Nhận được: <b>${data.received.toLocaleString('vi-VN')}đ</b>
• Cần đủ: <b>${data.expected.toLocaleString('vi-VN')}đ</b>
• Nội dung CK: ${data.content}
• Thời gian: ${new Date().toLocaleString('vi-VN')}

<b>Đơn CHƯA được kích hoạt.</b> Vui lòng kiểm tra & xử lý thủ công.`

  await sendMessage(COURSE_GROUP_ID, msg)
}
