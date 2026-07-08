const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''
const GIFT_GROUP_ID = process.env.TELEGRAM_GIFT_GROUP_ID || ''
const COURSE_GROUP_ID = process.env.TELEGRAM_COURSE_GROUP_ID || ''
const ORDER_GROUP_ID = process.env.TELEGRAM_ORDER_GROUP_ID || COURSE_GROUP_ID

// Escape ký tự đặc biệt để Telegram parse_mode=HTML không bị lỗi 400 hoặc bị chèn link giả
// (vd khách nhập tên/địa chỉ/ghi chú có <a href> hay & < > sẽ làm hỏng tin nhắn hoặc giả mạo link)
function esc(s: unknown): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

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

export async function notifyStnPending(data: {
  name: string; phone: string; address: string
  product: string; quantity: number; totalPrice: number
  refCode: string; pancakeOrderId?: string; note?: string
}) {
  const msg = `🟡 <b>SỐT TRỘN NỘM – CHỜ THANH TOÁN</b>

• Tên: <b>${data.name}</b>
• SĐT: <b>${data.phone}</b>
• Địa chỉ: ${data.address}
• Sản phẩm: ${data.product} x${data.quantity}
• Tổng tiền: <b>${data.totalPrice.toLocaleString('vi-VN')}đ</b>
• Mã TT: <code>${data.refCode}</code>${data.pancakeOrderId ? `\n• Đơn POScake: <b>#${data.pancakeOrderId}</b>` : ''}${data.note ? `\n• Ghi chú: ${data.note}` : ''}
• Thời gian: ${new Date().toLocaleString('vi-VN')}

⏳ Khách đang xem hướng dẫn chuyển khoản`
  await sendMessage(ORDER_GROUP_ID, msg)
}

export async function notifyStnPaid(data: {
  name: string; phone: string
  product: string; quantity: number; totalPrice: number
  refCode: string; pancakeOrderId?: string; pancakeUpdated: boolean
}) {
  const posLine = data.pancakeOrderId
    ? (data.pancakeUpdated
        ? `\n• POScake: <b>#${data.pancakeOrderId}</b> → Chờ chuyển hàng ✅`
        : `\n• POScake: <b>#${data.pancakeOrderId}</b> – cập nhật tay sang "Chờ chuyển hàng"`)
    : ''
  const msg = `✅ <b>SỐT TRỘN NỘM – ĐÃ THANH TOÁN</b>

• Tên: <b>${data.name}</b>
• SĐT: <b>${data.phone}</b>
• Sản phẩm: ${data.product} x${data.quantity}
• Số tiền: <b>${data.totalPrice.toLocaleString('vi-VN')}đ ✓</b>
• Mã TT: <code>${data.refCode}</code>${posLine}
• Thời gian TT: ${new Date().toLocaleString('vi-VN')}`
  await sendMessage(ORDER_GROUP_ID, msg)
}

export async function notifyOrder(data: {
  name: string
  phone: string
  email: string
  address: string
  product: string
  quantity: number
  totalPrice: number
  note?: string
}) {
  const msg = `🛒 <b>ĐƠN HÀNG SỐT TRỘN NỘM MỚI</b>

• Tên: <b>${data.name}</b>
• SĐT: <b>${data.phone}</b>
• Email: ${data.email}
• Địa chỉ: ${data.address}
• Sản phẩm: <b>${data.product}</b>
• Số lượng: <b>${data.quantity}</b>
• Tổng tiền: <b>${data.totalPrice.toLocaleString('vi-VN')}đ</b>${data.note ? `\n• Ghi chú: ${data.note}` : ''}
• Thời gian: ${new Date().toLocaleString('vi-VN')}`

  await sendMessage(ORDER_GROUP_ID, msg)
}

export async function notifyKdxPending(data: {
  name: string; phone: string; address: string
  product: string; quantity: number; totalPrice: number
  refCode: string; pancakeOrderId?: string; note?: string
}) {
  const msg = `🟡 <b>KHĂN ĐỒ XÔI – CHỜ THANH TOÁN</b>

• Tên: <b>${data.name}</b>
• SĐT: <b>${data.phone}</b>
• Địa chỉ: ${data.address}
• Sản phẩm: ${data.product} x${data.quantity}
• Tổng tiền: <b>${data.totalPrice.toLocaleString('vi-VN')}đ</b>
• Mã TT: <code>${data.refCode}</code>${data.pancakeOrderId ? `\n• Đơn POScake: <b>#${data.pancakeOrderId}</b>` : ''}${data.note ? `\n• Ghi chú: ${data.note}` : ''}
• Thời gian: ${new Date().toLocaleString('vi-VN')}

⏳ Khách đang xem hướng dẫn chuyển khoản`
  await sendMessage(ORDER_GROUP_ID, msg)
}

export async function notifyKdxPaid(data: {
  name: string; phone: string
  product: string; quantity: number; totalPrice: number
  refCode: string; pancakeOrderId?: string; pancakeUpdated: boolean
}) {
  const posLine = data.pancakeOrderId
    ? (data.pancakeUpdated
        ? `\n• POScake: <b>#${data.pancakeOrderId}</b> → Chờ chuyển hàng ✅`
        : `\n• POScake: <b>#${data.pancakeOrderId}</b> – cập nhật tay sang "Chờ chuyển hàng"`)
    : ''
  const msg = `✅ <b>KHĂN ĐỒ XÔI – ĐÃ THANH TOÁN</b>

• Tên: <b>${data.name}</b>
• SĐT: <b>${data.phone}</b>
• Sản phẩm: ${data.product} x${data.quantity}
• Số tiền: <b>${data.totalPrice.toLocaleString('vi-VN')}đ ✓</b>
• Mã TT: <code>${data.refCode}</code>${posLine}
• Thời gian TT: ${new Date().toLocaleString('vi-VN')}`
  await sendMessage(ORDER_GROUP_ID, msg)
}

export async function notifySxcPending(data: {
  name: string; phone: string; address: string
  product: string; quantity: number; totalPrice: number
  refCode: string; pancakeOrderId?: string; note?: string
}) {
  const msg = `🟡 <b>SÉT XÔI CỐM – CHỜ THANH TOÁN</b>

• Tên: <b>${data.name}</b>
• SĐT: <b>${data.phone}</b>
• Địa chỉ: ${data.address}
• Sản phẩm: ${data.product} x${data.quantity}
• Tổng tiền: <b>${data.totalPrice.toLocaleString('vi-VN')}đ</b>
• Mã TT: <code>${data.refCode}</code>${data.pancakeOrderId ? `\n• Đơn POScake: <b>#${data.pancakeOrderId}</b>` : ''}${data.note ? `\n• Ghi chú: ${data.note}` : ''}
• Thời gian: ${new Date().toLocaleString('vi-VN')}

⏳ Khách đang xem hướng dẫn chuyển khoản`
  await sendMessage(ORDER_GROUP_ID, msg)
}

export async function notifySxcPaid(data: {
  name: string; phone: string
  product: string; quantity: number; totalPrice: number
  refCode: string; pancakeOrderId?: string; pancakeUpdated: boolean
}) {
  const posLine = data.pancakeOrderId
    ? (data.pancakeUpdated
        ? `\n• POScake: <b>#${data.pancakeOrderId}</b> → Chờ chuyển hàng ✅`
        : `\n• POScake: <b>#${data.pancakeOrderId}</b> – cập nhật tay sang "Chờ chuyển hàng"`)
    : ''
  const msg = `✅ <b>SÉT XÔI CỐM – ĐÃ THANH TOÁN</b>

• Tên: <b>${data.name}</b>
• SĐT: <b>${data.phone}</b>
• Sản phẩm: ${data.product} x${data.quantity}
• Số tiền: <b>${data.totalPrice.toLocaleString('vi-VN')}đ ✓</b>
• Mã TT: <code>${data.refCode}</code>${posLine}
• Thời gian TT: ${new Date().toLocaleString('vi-VN')}`
  await sendMessage(ORDER_GROUP_ID, msg)
}

export async function notifySxxPending(data: {
  name: string; phone: string; address: string
  product: string; quantity: number; totalPrice: number
  refCode: string; pancakeOrderId?: string; note?: string
}) {
  const msg = `🟡 <b>SỐT XÁ XÍU – CHỜ THANH TOÁN</b>

• Tên: <b>${esc(data.name)}</b>
• SĐT: <b>${esc(data.phone)}</b>
• Địa chỉ: ${esc(data.address)}
• Sản phẩm: ${esc(data.product)} x${data.quantity}
• Tổng tiền: <b>${data.totalPrice.toLocaleString('vi-VN')}đ</b>
• Mã TT: <code>${esc(data.refCode)}</code>${data.pancakeOrderId ? `\n• Đơn POScake: <b>#${esc(data.pancakeOrderId)}</b>` : ''}${data.note ? `\n• Ghi chú: ${esc(data.note)}` : ''}
• Thời gian: ${new Date().toLocaleString('vi-VN')}

⏳ Khách đang xem hướng dẫn chuyển khoản`
  await sendMessage(ORDER_GROUP_ID, msg)
}

export async function notifySxxPaid(data: {
  name: string; phone: string
  product: string; quantity: number; totalPrice: number
  refCode: string; pancakeOrderId?: string; pancakeUpdated: boolean
}) {
  const posLine = data.pancakeOrderId
    ? (data.pancakeUpdated
        ? `\n• POScake: <b>#${esc(data.pancakeOrderId)}</b> → Chờ chuyển hàng ✅`
        : `\n• POScake: <b>#${esc(data.pancakeOrderId)}</b> – cập nhật tay sang "Chờ chuyển hàng"`)
    : ''
  const msg = `✅ <b>SỐT XÁ XÍU – ĐÃ THANH TOÁN</b>

• Tên: <b>${esc(data.name)}</b>
• SĐT: <b>${esc(data.phone)}</b>
• Sản phẩm: ${esc(data.product)} x${data.quantity}
• Số tiền: <b>${data.totalPrice.toLocaleString('vi-VN')}đ ✓</b>
• Mã TT: <code>${esc(data.refCode)}</code>${posLine}
• Thời gian TT: ${new Date().toLocaleString('vi-VN')}`
  await sendMessage(ORDER_GROUP_ID, msg)
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
