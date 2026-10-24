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
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    signal: AbortSignal.timeout(6_000),
  })
  // Telegram trả 4xx/5xx (vd 400 khi HTML lỗi): phải NÉM LỖI để nơi gọi biết, không được im lặng làm mất thông báo đơn
  // hoặc đánh dấu "đã báo" khi thực tế chưa báo được.
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Telegram sendMessage ${res.status}: ${detail.slice(0, 200)}`)
  }
}

export async function notifyFollowupFailed(data: { kind: string; ref: string; attempts: number; error: string }) {
  const msg = `🚨 <b>VIỆC SAU THANH TOÁN THẤT BẠI NHIỀU LẦN</b> 🚨

• Loại việc: <code>${esc(data.kind)}</code>
• Mã đơn: <code>${esc(data.ref)}</code>
• Đã thử: ${data.attempts} lần
• Lỗi cuối: ${esc(String(data.error).slice(0, 200))}

Khách đã trả tiền nhưng bước này chưa xong. Vui lòng xử lý tay (kiểm tra POScake / email khách).`
  await sendMessage(ORDER_GROUP_ID, msg)
}

export async function notifyPaymentUnmatched(data: { paymentRef: string; received: number; content: string }) {
  const msg = `🔴 <b>CÓ TIỀN VỀ NHƯNG KHÔNG TÌM THẤY ĐƠN</b> 🔴

• Mã trong nội dung CK: <code>${esc(data.paymentRef)}</code>
• Số tiền: <b>${data.received.toLocaleString('vi-VN')}đ</b>
• Nội dung CK: ${esc(data.content)}
• Thời gian: ${new Date().toLocaleString('vi-VN')}

Khách có thể ghi sai mã. Vui lòng đối chiếu và xử lý thủ công.`
  await sendMessage(ORDER_GROUP_ID, msg)
}

// Đơn website chưa có mã POScake = nhân viên kho sẽ KHÔNG thấy đơn để in/gửi. Phải báo động rõ.
const POS_MISSING_LINE = '\n🚨 <b>CHƯA CÓ ĐƠN TRÊN POSCAKE – TẠO TAY NGAY</b>'
function posMissingAlert(pancakeOrderId?: string): string {
  return pancakeOrderId
    ? ''
    : `\n\n${POS_MISSING_LINE.trim()}\nĐơn đã lưu trên website nhưng POScake không nhận. Kiểm tra POScake theo SĐT xem đã có đơn chưa (tránh tạo trùng), chưa có thì tạo tay theo thông tin ở trên.`
}
// Đơn tạo trên POScake ghi thu hộ (COD) = toàn bộ tiền hàng. Khách đã chuyển khoản thì không được thu hộ lần nữa.
const PAID_COD_NOTE = '\n\n💰 <b>ĐÃ NHẬN TIỀN CHUYỂN KHOẢN</b> – kiểm tra COD trên đơn POScake: KHÔNG thu hộ lại tiền hàng (chỉ thu phí ship nếu có).'

export async function notifyGiftLead(data: { name: string; email: string; phone: string }) {
  const msg = `🟢 <b>HỌC VIÊN NHẬN QUÀ MỚI</b>

• Tên: <b>${esc(data.name)}</b>
• Email: ${esc(data.email)}
• SĐT: ${esc(data.phone)}
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

• Tên: <b>${esc(data.name)}</b>
• Email: ${esc(data.email)}
• SĐT: ${esc(data.phone)}
• Mã giao dịch: <code>${esc(data.paymentRef)}</code>
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

• Tên: <b>${esc(data.name)}</b>
• SĐT: <b>${esc(data.phone)}</b>
• Địa chỉ: ${esc(data.address)}
• Sản phẩm: ${esc(data.product)} x${data.quantity}
• Tổng tiền: <b>${data.totalPrice.toLocaleString('vi-VN')}đ</b>
• Mã TT: <code>${esc(data.refCode)}</code>${data.pancakeOrderId ? `\n• Đơn POScake: <b>#${esc(data.pancakeOrderId)}</b>` : ''}${data.note ? `\n• Ghi chú: ${esc(data.note)}` : ''}
• Thời gian: ${new Date().toLocaleString('vi-VN')}

⏳ Khách đang xem hướng dẫn chuyển khoản`
  await sendMessage(ORDER_GROUP_ID, msg + posMissingAlert(data.pancakeOrderId))
}

export async function notifyStnPaid(data: {
  name: string; phone: string
  product: string; quantity: number; totalPrice: number
  refCode: string; pancakeOrderId?: string; pancakeUpdated: boolean
}) {
  const posLine = data.pancakeOrderId
    ? (data.pancakeUpdated
        ? `\n• POScake: <b>#${esc(data.pancakeOrderId)}</b> → Chờ chuyển hàng ✅`
        : `\n• POScake: <b>#${esc(data.pancakeOrderId)}</b> – cập nhật tay sang "Chờ chuyển hàng"`)
    : POS_MISSING_LINE
  const msg = `✅ <b>SỐT TRỘN NỘM – ĐÃ THANH TOÁN</b>

• Tên: <b>${esc(data.name)}</b>
• SĐT: <b>${esc(data.phone)}</b>
• Sản phẩm: ${esc(data.product)} x${data.quantity}
• Số tiền: <b>${data.totalPrice.toLocaleString('vi-VN')}đ ✓</b>
• Mã TT: <code>${esc(data.refCode)}</code>${posLine}
• Thời gian TT: ${new Date().toLocaleString('vi-VN')}`
  await sendMessage(ORDER_GROUP_ID, msg + PAID_COD_NOTE)
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

• Tên: <b>${esc(data.name)}</b>
• SĐT: <b>${esc(data.phone)}</b>
• Email: ${esc(data.email)}
• Địa chỉ: ${esc(data.address)}
• Sản phẩm: <b>${esc(data.product)}</b>
• Số lượng: <b>${data.quantity}</b>
• Tổng tiền: <b>${data.totalPrice.toLocaleString('vi-VN')}đ</b>${data.note ? `\n• Ghi chú: ${esc(data.note)}` : ''}
• Thời gian: ${new Date().toLocaleString('vi-VN')}`

  await sendMessage(ORDER_GROUP_ID, msg)
}

export async function notifyKdxPending(data: {
  name: string; phone: string; address: string
  product: string; quantity: number; totalPrice: number
  refCode: string; pancakeOrderId?: string; note?: string
}) {
  const msg = `🟡 <b>KHĂN ĐỒ XÔI – CHỜ THANH TOÁN</b>

• Tên: <b>${esc(data.name)}</b>
• SĐT: <b>${esc(data.phone)}</b>
• Địa chỉ: ${esc(data.address)}
• Sản phẩm: ${esc(data.product)} x${data.quantity}
• Tổng tiền: <b>${data.totalPrice.toLocaleString('vi-VN')}đ</b>
• Mã TT: <code>${esc(data.refCode)}</code>${data.pancakeOrderId ? `\n• Đơn POScake: <b>#${esc(data.pancakeOrderId)}</b>` : ''}${data.note ? `\n• Ghi chú: ${esc(data.note)}` : ''}
• Thời gian: ${new Date().toLocaleString('vi-VN')}

⏳ Khách đang xem hướng dẫn chuyển khoản`
  await sendMessage(ORDER_GROUP_ID, msg + posMissingAlert(data.pancakeOrderId))
}

export async function notifyKdxPaid(data: {
  name: string; phone: string
  product: string; quantity: number; totalPrice: number
  refCode: string; pancakeOrderId?: string; pancakeUpdated: boolean
}) {
  const posLine = data.pancakeOrderId
    ? (data.pancakeUpdated
        ? `\n• POScake: <b>#${esc(data.pancakeOrderId)}</b> → Chờ chuyển hàng ✅`
        : `\n• POScake: <b>#${esc(data.pancakeOrderId)}</b> – cập nhật tay sang "Chờ chuyển hàng"`)
    : POS_MISSING_LINE
  const msg = `✅ <b>KHĂN ĐỒ XÔI – ĐÃ THANH TOÁN</b>

• Tên: <b>${esc(data.name)}</b>
• SĐT: <b>${esc(data.phone)}</b>
• Sản phẩm: ${esc(data.product)} x${data.quantity}
• Số tiền: <b>${data.totalPrice.toLocaleString('vi-VN')}đ ✓</b>
• Mã TT: <code>${esc(data.refCode)}</code>${posLine}
• Thời gian TT: ${new Date().toLocaleString('vi-VN')}`
  await sendMessage(ORDER_GROUP_ID, msg + PAID_COD_NOTE)
}

export async function notifySxcPending(data: {
  name: string; phone: string; address: string
  product: string; quantity: number; totalPrice: number
  refCode: string; pancakeOrderId?: string; note?: string
}) {
  const msg = `🟡 <b>SÉT XÔI CỐM – CHỜ THANH TOÁN</b>

• Tên: <b>${esc(data.name)}</b>
• SĐT: <b>${esc(data.phone)}</b>
• Địa chỉ: ${esc(data.address)}
• Sản phẩm: ${esc(data.product)} x${data.quantity}
• Tổng tiền: <b>${data.totalPrice.toLocaleString('vi-VN')}đ</b>
• Mã TT: <code>${esc(data.refCode)}</code>${data.pancakeOrderId ? `\n• Đơn POScake: <b>#${esc(data.pancakeOrderId)}</b>` : ''}${data.note ? `\n• Ghi chú: ${esc(data.note)}` : ''}
• Thời gian: ${new Date().toLocaleString('vi-VN')}

⏳ Khách đang xem hướng dẫn chuyển khoản`
  await sendMessage(ORDER_GROUP_ID, msg + posMissingAlert(data.pancakeOrderId))
}

export async function notifySxcPaid(data: {
  name: string; phone: string
  product: string; quantity: number; totalPrice: number
  refCode: string; pancakeOrderId?: string; pancakeUpdated: boolean
}) {
  const posLine = data.pancakeOrderId
    ? (data.pancakeUpdated
        ? `\n• POScake: <b>#${esc(data.pancakeOrderId)}</b> → Chờ chuyển hàng ✅`
        : `\n• POScake: <b>#${esc(data.pancakeOrderId)}</b> – cập nhật tay sang "Chờ chuyển hàng"`)
    : POS_MISSING_LINE
  const msg = `✅ <b>SÉT XÔI CỐM – ĐÃ THANH TOÁN</b>

• Tên: <b>${esc(data.name)}</b>
• SĐT: <b>${esc(data.phone)}</b>
• Sản phẩm: ${esc(data.product)} x${data.quantity}
• Số tiền: <b>${data.totalPrice.toLocaleString('vi-VN')}đ ✓</b>
• Mã TT: <code>${esc(data.refCode)}</code>${posLine}
• Thời gian TT: ${new Date().toLocaleString('vi-VN')}`
  await sendMessage(ORDER_GROUP_ID, msg + PAID_COD_NOTE)
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
  await sendMessage(ORDER_GROUP_ID, msg + posMissingAlert(data.pancakeOrderId))
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
    : POS_MISSING_LINE
  const msg = `✅ <b>SỐT XÁ XÍU – ĐÃ THANH TOÁN</b>

• Tên: <b>${esc(data.name)}</b>
• SĐT: <b>${esc(data.phone)}</b>
• Sản phẩm: ${esc(data.product)} x${data.quantity}
• Số tiền: <b>${data.totalPrice.toLocaleString('vi-VN')}đ ✓</b>
• Mã TT: <code>${esc(data.refCode)}</code>${posLine}
• Thời gian TT: ${new Date().toLocaleString('vi-VN')}`
  await sendMessage(ORDER_GROUP_ID, msg + PAID_COD_NOTE)
}

// Cảnh báo khi khách chuyển KHÔNG ĐỦ tiền (vd test 10k) – gửi để admin xử lý tay
export async function notifyPaymentMismatch(data: {
  paymentRef: string
  received: number
  expected: number
  content: string
}) {
  const msg = `🔴 <b>CHUYỂN KHOẢN KHÔNG KHỚP – CẦN KIỂM TRA</b> 🔴

• Mã đơn: <code>${esc(data.paymentRef)}</code>
• Nhận được: <b>${data.received.toLocaleString('vi-VN')}đ</b>
• Cần đủ: <b>${data.expected.toLocaleString('vi-VN')}đ</b>
• Nội dung CK: ${esc(data.content)}
• Thời gian: ${new Date().toLocaleString('vi-VN')}

<b>Đơn CHƯA được kích hoạt.</b> Vui lòng kiểm tra & xử lý thủ công.`

  await sendMessage(COURSE_GROUP_ID, msg)
}

export async function notifyConversationAlert(data: { customerName: string; pageName: string; issue: string }) {
  const msg = `⚠️ <b>HỘI THOẠI CẦN XỬ LÝ</b>\n\n• Khách: ${esc(data.customerName)}\n• Kênh: ${esc(data.pageName)}\n• Vấn đề: ${esc(data.issue)}`
  await sendMessage(process.env.TELEGRAM_QC_GROUP_ID || ORDER_GROUP_ID, msg)
}
