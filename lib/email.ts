import { Resend } from 'resend'

function getResend() {
  return new Resend(process.env.RESEND_API_KEY || 'dummy_key_for_build')
}
const FROM_EMAIL = process.env.FROM_EMAIL || 'Bếp Cô Hạ <no-reply@hacofood.vn>'

export async function sendGiftEmail(to: { name: string; email: string }) {
  const driveLink = process.env.DRIVE_LINK_GIFT || '#'

  return getResend().emails.send({
    from: FROM_EMAIL,
    to: [to.email],
    subject: '🎁 Quà tặng từ HaCo Food – Công thức Cà Muối Mắm Giòn 7 Ngày!',
    html: `
<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f0fff0;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

    <!-- HEADER -->
    <div style="background:linear-gradient(135deg,#003200,#006400);padding:36px 32px;text-align:center;">
      <p style="font-size:40px;margin:0 0 8px;">👩‍🍳</p>
      <h1 style="color:#fff;margin:0;font-size:26px;font-weight:800;">HaCo Food – Bếp Cô Hạ</h1>
      <p style="margin:6px 0 0;font-size:14px;">
        <a href="https://khoaduacamuoi.hacofood.vn" style="color:#ffffff;opacity:0.85;text-decoration:underline;">khoaduacamuoi.hacofood.vn</a>
      </p>
    </div>

    <!-- BODY -->
    <div style="padding:36px 32px;">
      <h2 style="color:#006400;font-size:22px;margin-top:0;">Xin chào ${to.name}! 👋</h2>
      <p style="color:#374151;line-height:1.8;font-size:15px;">
        Cảm ơn bạn đã quan tâm! Đây là phần quà Cô Hạ dành riêng cho bạn:
      </p>

      <!-- QUÀ TẶNG -->
      <div style="background:#f0fff0;border-left:4px solid #006400;border-radius:8px;padding:20px 24px;margin:20px 0;">
        <h3 style="color:#006400;margin-top:0;font-size:17px;">🎁 Quà của bạn</h3>
        <p style="margin:0 0 12px;color:#374151;font-size:14px;">
          <strong>📹 Công thức Cà Muối Mắm Giòn 7 Ngày</strong> – video & tài liệu chi tiết từ Cô Hạ
        </p>
        <a href="${driveLink}"
          style="display:inline-block;background:#006400;color:#fff;padding:13px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;">
          📥 Nhận công thức ngay
        </a>
      </div>

      <!-- CỘNG ĐỒNG -->
      <div style="margin:20px 0;">
        <h3 style="color:#006400;font-size:16px;margin-bottom:12px;">&#128101; Tham gia cộng đồng <strong>MIỄN PHÍ</strong> của Cô Hạ:</h3>
        <table style="width:100%;border-collapse:collapse;">
          ${[
            { tag: 'FB', tagColor: '#1877F2', name: 'Nấu ăn cùng Cô Hạ',         desc: 'Group tổng – chia sẻ kinh nghiệm nấu ăn',  href: 'https://www.facebook.com/groups/nauancungcoha' },
            { tag: 'FB', tagColor: '#1877F2', name: 'Công thức nấu ăn miễn phí',  desc: 'Hàng trăm công thức từ Cô Hạ',            href: 'https://www.facebook.com/groups/congthuccoha' },
            { tag: 'FB', tagColor: '#1877F2', name: 'Nấu ăn kinh doanh',          desc: 'Bí quyết kinh doanh ẩm thực F&B',         href: 'https://www.facebook.com/groups/nauankinhdoanh' },
            { tag: 'FB', tagColor: '#1877F2', name: 'Khởi nghiệp F&B',            desc: 'Cộng đồng khởi nghiệp ẩm thực',          href: 'https://www.facebook.com/groups/fnbcoha' },
            { tag: 'YT', tagColor: '#FF0000', name: 'YouTube Cô Hạ Dạy Nấu Ăn',  desc: 'Video hướng dẫn chi tiết, dễ làm theo',  href: 'https://www.youtube.com/@Cohadaynauan8386/featured' },
            { tag: 'TT', tagColor: '#010101', name: 'TikTok Cô Hạ',               desc: 'Clip ngắn, mẹo nấu ăn hay mỗi ngày',     href: 'https://www.tiktok.com/@hacasau' },
          ].map(l => `
          <tr>
            <td style="padding:5px 0;">
              <a href="${l.href}" style="display:table;width:100%;background:#f8fffe;border:1px solid #d1fae5;border-radius:10px;padding:0;text-decoration:none;box-sizing:border-box;">
                <table style="width:100%;border-collapse:collapse;">
                  <tr>
                    <td style="width:44px;padding:12px 0 12px 14px;vertical-align:middle;">
                      <span style="display:inline-block;background:${l.tagColor};color:#fff;font-size:10px;font-weight:800;padding:3px 6px;border-radius:4px;letter-spacing:0.5px;">${l.tag}</span>
                    </td>
                    <td style="padding:12px 14px 12px 8px;vertical-align:middle;">
                      <strong style="display:block;color:#111827;font-size:13px;margin-bottom:2px;">${l.name}</strong>
                      <span style="color:#6b7280;font-size:12px;">${l.desc}</span>
                    </td>
                    <td style="padding:12px 14px 12px 0;vertical-align:middle;white-space:nowrap;">
                      <span style="background:#dcfce7;color:#166534;font-size:10px;font-weight:700;padding:3px 8px;border-radius:20px;">MIỄN PHÍ</span>
                    </td>
                  </tr>
                </table>
              </a>
            </td>
          </tr>`).join('')}
        </table>
      </div>

      <!-- UPSELL -->
      <div style="background:#fff8f0;border:2px solid #006400;border-radius:10px;padding:20px 24px;margin:20px 0;text-align:center;">
        <p style="color:#374151;margin:0 0 8px;font-size:14px;">💡 <strong>Muốn học chuyên sâu hơn?</strong></p>
        <p style="color:#374151;margin:0 0 12px;font-size:14px;">
          Khóa học <strong>Dưa Cà Muối Chuyên Sâu</strong> – chỉ
          <strong style="color:#dc2626;font-size:19px;">299.000đ</strong>
          <del style="color:#9ca3af;font-size:13px;">(gốc 999.000đ)</del>
        </p>
        <a href="https://khoaduacamuoi.hacofood.vn#khoa-hoc"
          style="display:inline-block;background:#dc2626;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;">
          🎓 Xem khóa học ngay
        </a>
      </div>

      <p style="color:#6b7280;font-size:13px;line-height:1.7;margin-top:20px;">
        Có câu hỏi gì cứ nhắn vào group nhé! Cô Hạ luôn hỗ trợ bạn. 🌸
      </p>
    </div>

    <!-- FOOTER -->
    <div style="background:#f9fafb;padding:18px 32px;text-align:center;border-top:1px solid #e5e7eb;">
      <p style="color:#9ca3af;font-size:12px;margin:0;">
        © 2025 HaCo Food – Bếp Cô Hạ &nbsp;|&nbsp; <a href="https://khoaduacamuoi.hacofood.vn" style="color:#006400;">khoaduacamuoi.hacofood.vn</a><br>
        Bạn nhận email này vì đã đăng ký nhận quà tại website của chúng tôi.
      </p>
    </div>
  </div>
</body>
</html>
    `,
  })
}

export async function sendCourseConfirmEmail(to: { name: string; email: string; amount?: number }) {
  const courseGroupLink = process.env.COURSE_GROUP_LINK || '#'
  const amount = to.amount ?? 299000
  const amountText = amount.toLocaleString('vi-VN') + 'đ'
  // Ghi chú riêng cho khách nhận ưu đãi đặc biệt (giá dưới 299k, vd promo 199k từ Email cuối)
  const promoNote = amount < 299000 ? `
      <div style="background:#fef2f2;border:2px solid #dc2626;border-radius:10px;padding:16px 20px;margin:0 0 24px;">
        <p style="margin:0;color:#991b1b;font-size:14px;line-height:1.7;">
          🎉 <strong>Chúc mừng ${to.name}!</strong> Bạn đã nhận được <strong>ƯU ĐÃI ĐẶC BIỆT cuối cùng</strong> từ Cô Hạ với mức giá <strong>${amountText}</strong> (thay vì 299.000đ). Đây là phần thưởng cho những học viên đồng hành cùng Cô đến phút chót. Cảm ơn bạn đã tin tưởng! 💚
        </p>
      </div>` : ''

  return getResend().emails.send({
    from: FROM_EMAIL,
    to: [to.email],
    subject: '✅ Đăng ký thành công – Khóa học Dưa Cà Muối Chuyên Sâu!',
    html: `
<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#fef9f0;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#16a34a,#166534);padding:40px 32px;text-align:center;">
      <div style="font-size:48px;margin-bottom:8px;">✅</div>
      <h1 style="color:#fff;margin:0;font-size:26px;font-weight:800;">Thanh toán thành công!</h1>
      <p style="color:#bbf7d0;margin:8px 0 0;font-size:16px;">Chào mừng bạn đến với Khóa học Dưa Cà Muối Chuyên Sâu</p>
    </div>
    <div style="padding:40px 32px;">
      <h2 style="color:#166534;font-size:22px;margin-top:0;">Xin chào ${to.name}! 🎉</h2>
      <p style="color:#4b5563;line-height:1.8;font-size:16px;">
        Cô Hạ rất vui khi bạn đã tham gia khóa học! Dưới đây là thông tin bước tiếp theo:
      </p>
${promoNote}

      <div style="background:#f0fdf4;border:2px solid #16a34a;border-radius:12px;padding:24px;margin:24px 0;">
        <h3 style="color:#166534;margin-top:0;font-size:18px;">📚 Bước tiếp theo của bạn</h3>
        <ol style="color:#4b5563;line-height:2;padding-left:20px;margin:0;">
          <li>Nhấn vào nút bên dưới để <strong>tham gia Group học viên</strong></li>
          <li>Trong group sẽ có đầy đủ video bài giảng và tài liệu</li>
          <li>Cô Hạ và team sẽ hỗ trợ bạn trong suốt quá trình học</li>
        </ol>
        <a href="${courseGroupLink}" style="display:inline-block;background:#16a34a;color:#fff;padding:16px 32px;border-radius:10px;text-decoration:none;font-weight:800;font-size:18px;margin-top:16px;width:100%;text-align:center;box-sizing:border-box;">
          👥 Vào Group Học Viên Ngay
        </a>
      </div>

      <div style="background:#fef3c7;border-radius:8px;padding:20px 24px;margin:24px 0;">
        <h3 style="color:#92400e;margin-top:0;font-size:16px;">📋 Thông tin đơn hàng</h3>
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="color:#6b7280;padding:6px 0;">Khóa học:</td>
            <td style="color:#1f2937;font-weight:600;text-align:right;">Dưa Cà Muối Chuyên Sâu</td>
          </tr>
          <tr>
            <td style="color:#6b7280;padding:6px 0;">Hình thức:</td>
            <td style="color:#1f2937;text-align:right;">Online – Group Facebook</td>
          </tr>
          <tr>
            <td style="color:#6b7280;padding:6px 0;">Giá trị:</td>
            <td style="color:#dc2626;font-weight:800;text-align:right;font-size:18px;">${amountText}</td>
          </tr>
        </table>
      </div>

      <p style="color:#6b7280;font-size:14px;line-height:1.7;">
        Nếu có bất kỳ câu hỏi nào, hãy nhắn tin trong group học viên hoặc liên hệ Cô Hạ nhé! 🌸
      </p>
    </div>
    <div style="background:#f9fafb;padding:20px 32px;text-align:center;border-top:1px solid #e5e7eb;">
      <p style="color:#9ca3af;font-size:13px;margin:0;">
        © 2024 Bếp Cô Hạ – Hacofood.vn
      </p>
    </div>
  </div>
</body>
</html>
    `,
  })
}

// ── Email Sequence Functions ────────────────────────────────────────────────

export async function sendGiftSequenceEmail1(to: { name: string; email: string }) {
  const communityLink = process.env.COMMUNITY_GROUP_LINK || 'https://www.facebook.com/groups/nauancungcoha'
  const driveLink = process.env.DRIVE_LINK_GIFT || '#'

  return getResend().emails.send({
    from: FROM_EMAIL,
    to: [to.email],
    subject: `${to.name} ơi, bạn đã xem video chưa? 🎬`,
    html: `
<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f0fff0;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#003200,#006400);padding:36px 32px;text-align:center;">
      <p style="font-size:40px;margin:0 0 8px;">👩‍🍳</p>
      <h1 style="color:#fff;margin:0;font-size:24px;font-weight:800;">Bạn đã xem video quà tặng chưa?</h1>
      <p style="margin:8px 0 0;font-size:14px;color:#dcfce7;">Cô Hạ đang chờ nghe kết quả của bạn!</p>
    </div>
    <div style="padding:36px 32px;">
      <h2 style="color:#006400;font-size:20px;margin-top:0;">Xin chào ${to.name}! 👋</h2>
      <p style="color:#374151;line-height:1.8;font-size:15px;">
        Hôm qua Cô Hạ đã gửi cho bạn video hướng dẫn làm <strong>Cà Muối Mắm Giòn</strong> – không biết bạn đã có dịp xem chưa?
      </p>
      <p style="color:#374151;line-height:1.8;font-size:15px;">
        Cô hỏi thật nhé: <strong>Bạn đã thử làm chưa? Kết quả ra sao?</strong> 😄
      </p>

      <div style="background:#f0fff0;border-left:4px solid #006400;border-radius:8px;padding:20px 24px;margin:24px 0;">
        <h3 style="color:#006400;margin-top:0;font-size:16px;">📹 Xem lại video nếu chưa kịp xem</h3>
        <p style="margin:0 0 14px;color:#6b7280;font-size:14px;">
          Công thức chi tiết từng bước – chỉ cần 15 phút là có ngay hũ dưa ngon!
        </p>
        <a href="${driveLink}" style="display:inline-block;background:#006400;color:#fff;padding:13px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;">
          ▶️ Xem video ngay
        </a>
      </div>

      <div style="background:#fff8f0;border-left:4px solid #f59e0b;border-radius:8px;padding:20px 24px;margin:24px 0;">
        <h3 style="color:#d97706;margin-top:0;font-size:16px;">🏆 Đã làm thử rồi? Chia sẻ thành quả nhé!</h3>
        <p style="color:#374151;font-size:14px;line-height:1.7;margin:0 0 12px;">
          Nếu bạn đã thử làm và có hũ dưa thành phẩm – đừng ngại đăng ảnh lên nhóm cộng đồng nhé! Cô Hạ và mọi người rất muốn xem kết quả của bạn. 🥒✨
        </p>
        <p style="color:#374151;font-size:14px;line-height:1.7;margin:0 0 16px;">
          Nhiều bạn trong nhóm cũng đang học – vừa được động viên, vừa được Cô góp ý trực tiếp!
        </p>
        <a href="${communityLink}" style="display:inline-block;background:#f59e0b;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;">
          📸 Đăng thành quả lên nhóm
        </a>
      </div>

      <p style="color:#374151;line-height:1.8;font-size:14px;">
        Dù chưa làm hay đã làm – cứ vào nhóm hỏi Cô Hạ nhé, Cô luôn ở đây để hỗ trợ bạn! 💚
      </p>
    </div>
    <div style="background:#f9fafb;padding:18px 32px;text-align:center;border-top:1px solid #e5e7eb;">
      <p style="color:#9ca3af;font-size:12px;margin:0;">
        © 2025 HaCo Food – Bếp Cô Hạ &nbsp;|&nbsp;
        <a href="https://khoaduacamuoi.hacofood.vn" style="color:#006400;text-decoration:none;">khoaduacamuoi.hacofood.vn</a><br>
        Bạn nhận email này vì đã đăng ký nhận quà tại website của chúng tôi.
      </p>
    </div>
  </div>
</body>
</html>
    `,
  })
}

export async function sendGiftSequenceEmail2(to: { name: string; email: string }) {
  const communityLink = process.env.COMMUNITY_GROUP_LINK || 'https://www.facebook.com/groups/nauancungcoha'
  return getResend().emails.send({
    from: FROM_EMAIL,
    to: [to.email],
    subject: '5 sai lầm khiến dưa bị hỏng – và cách sửa ngay hôm nay 🔧',
    html: `
<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f0fff0;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

    <div style="background:linear-gradient(135deg,#991b1b,#dc2626);padding:36px 32px;text-align:center;">
      <p style="font-size:40px;margin:0 0 8px;">⚠️</p>
      <h1 style="color:#fff;margin:0;font-size:24px;font-weight:800;">5 Sai Lầm Khiến Dưa Bị Hỏng</h1>
      <p style="margin:8px 0 0;font-size:14px;color:#fecaca;">Mỗi sai lầm có cách sửa cụ thể – đọc hết để không bao giờ mắc lại!</p>
    </div>

    <div style="padding:36px 32px;">
      <h2 style="color:#dc2626;font-size:20px;margin-top:0;">Xin chào ${to.name}! 👋</h2>
      <p style="color:#374151;line-height:1.8;font-size:15px;">
        Hôm qua Cô Hạ nhận tin nhắn từ chị T ở TP.HCM:
      </p>
      <div style="background:#fef2f2;border-left:4px solid #dc2626;border-radius:6px;padding:14px 18px;margin:16px 0;">
        <p style="margin:0;color:#374151;font-size:14px;font-style:italic;line-height:1.7;">
          "Cô ơi, dưa của con làm mấy lần rồi mà lần nào cũng bị nhệu, mặn lợm, chỉ để được 2–3 ngày là hỏng. Con không biết sai chỗ nào nữa!"
        </p>
      </div>
      <p style="color:#374151;line-height:1.8;font-size:15px;">
        Sau khi Cô hỏi kỹ lại từng bước chị T làm, Cô tìm ra <strong>5 sai lầm</strong> mà hầu hết mọi người đều mắc phải. Hôm nay Cô chia sẻ hết với bạn – kèm cách sửa cụ thể luôn nhé!
      </p>

      <!-- SAI LẦM 1 -->
      <div style="border:2px solid #dc2626;border-radius:12px;overflow:hidden;margin:20px 0;">
        <div style="background:#dc2626;padding:12px 20px;display:flex;align-items:center;gap:10px;">
          <span style="color:#fff;font-size:18px;font-weight:900;">❌ #1</span>
          <p style="margin:0;color:#fff;font-weight:800;font-size:15px;">Dùng muối iốt để làm dưa</p>
        </div>
        <div style="padding:16px 20px;">
          <p style="margin:0 0 8px;color:#374151;font-size:14px;line-height:1.7;">
            <strong>Tại sao hỏng?</strong> Muối iốt chứa chất kháng khuẩn – nó không chỉ diệt vi khuẩn có hại mà còn diệt luôn vi khuẩn lactic có lợi cần thiết để lên men. Kết quả: dưa không chua đúng cách, nhanh bị nhớt và thối.
          </p>
          <div style="background:#f0fdf4;border-radius:8px;padding:12px 16px;border-left:3px solid #16a34a;">
            <p style="margin:0;color:#166534;font-size:14px;font-weight:700;">✅ Cách sửa:</p>
            <p style="margin:6px 0 0;color:#374151;font-size:13px;line-height:1.7;">
              Chỉ dùng <strong>muối hạt trắng thô thông thường</strong> (muối biển, muối hầm). Nhìn nhãn bao bì – nếu thấy chữ "iốt" thì không dùng. Mua muối hạt ở chợ hoặc siêu thị, giá rất rẻ.
            </p>
          </div>
        </div>
      </div>

      <!-- SAI LẦM 2 -->
      <div style="border:2px solid #dc2626;border-radius:12px;overflow:hidden;margin:20px 0;">
        <div style="background:#dc2626;padding:12px 20px;display:flex;align-items:center;gap:10px;">
          <span style="color:#fff;font-size:18px;font-weight:900;">❌ #2</span>
          <p style="margin:0;color:#fff;font-weight:800;font-size:15px;">Không để ráo nước sau khi rửa rau</p>
        </div>
        <div style="padding:16px 20px;">
          <p style="margin:0 0 8px;color:#374151;font-size:14px;line-height:1.7;">
            <strong>Tại sao hỏng?</strong> Nước còn đọng trên rau làm loãng nước muối đã pha đúng tỉ lệ. Nồng độ muối giảm → vi khuẩn có hại sinh sôi nhanh hơn → dưa hỏng trong 1–2 ngày.
          </p>
          <div style="background:#f0fdf4;border-radius:8px;padding:12px 16px;border-left:3px solid #16a34a;">
            <p style="margin:0;color:#166534;font-size:14px;font-weight:700;">✅ Cách sửa:</p>
            <p style="margin:6px 0 0;color:#374151;font-size:13px;line-height:1.7;">
              Sau khi rửa rau, <strong>để trên rổ thưa ít nhất 30 phút</strong> cho ráo hoàn toàn. Hoặc dùng khăn sạch thấm khô từng miếng rau trước khi cho vào hũ. Không vội vàng bước này!
            </p>
          </div>
        </div>
      </div>

      <!-- SAI LẦM 3 -->
      <div style="border:2px solid #991b1b;border-radius:12px;overflow:hidden;margin:20px 0;position:relative;">
        <div style="position:absolute;top:12px;right:12px;background:#f59e0b;color:#fff;font-size:11px;font-weight:800;padding:4px 10px;border-radius:20px;z-index:1;">🔥 HAY MẮC NHẤT</div>
        <div style="background:#991b1b;padding:12px 20px;display:flex;align-items:center;gap:10px;">
          <span style="color:#fff;font-size:18px;font-weight:900;">❌ #3</span>
          <p style="margin:0;color:#fff;font-weight:800;font-size:15px;">Để hũ dưa ở chỗ nóng hoặc có ánh nắng</p>
        </div>
        <div style="padding:16px 20px;">
          <p style="margin:0 0 8px;color:#374151;font-size:14px;line-height:1.7;">
            <strong>Tại sao hỏng?</strong> Nhiệt độ trên 30°C khiến vi khuẩn có hại nhân lên rất nhanh, đồng thời làm hỏng cấu trúc rau củ khiến dưa bị nhệu, mềm. Nhiều người hay để hũ dưa trên mặt bếp hoặc cạnh cửa sổ – đây là lỗi phổ biến nhất!
          </p>
          <div style="background:#f0fdf4;border-radius:8px;padding:12px 16px;border-left:3px solid #16a34a;">
            <p style="margin:0;color:#166534;font-size:14px;font-weight:700;">✅ Cách sửa:</p>
            <p style="margin:6px 0 0;color:#374151;font-size:13px;line-height:1.7;">
              Để hũ dưa ở <strong>góc tối trong nhà, tránh xa bếp và cửa sổ</strong>. Lý tưởng nhất là ngăn dưới tủ bếp hoặc gầm cầu thang – nơi mát, tối và ít gió lùa. Nhiệt độ lý tưởng: 18–25°C.
            </p>
          </div>
        </div>
      </div>

      <!-- SAI LẦM 4 -->
      <div style="border:2px solid #dc2626;border-radius:12px;overflow:hidden;margin:20px 0;">
        <div style="background:#dc2626;padding:12px 20px;display:flex;align-items:center;gap:10px;">
          <span style="color:#fff;font-size:18px;font-weight:900;">❌ #4</span>
          <p style="margin:0;color:#fff;font-weight:800;font-size:15px;">Để dưa nổi lên trên mặt nước muối</p>
        </div>
        <div style="padding:16px 20px;">
          <p style="margin:0 0 8px;color:#374151;font-size:14px;line-height:1.7;">
            <strong>Tại sao hỏng?</strong> Phần dưa nổi lên tiếp xúc với không khí sẽ bị mốc trắng sau 1–2 ngày. Nhiều người tưởng mốc là bình thường – nhưng không phải! Mốc trắng lan xuống làm hỏng cả hũ dưa.
          </p>
          <div style="background:#f0fdf4;border-radius:8px;padding:12px 16px;border-left:3px solid #16a34a;">
            <p style="margin:0;color:#166534;font-size:14px;font-weight:700;">✅ Cách sửa:</p>
            <p style="margin:6px 0 0;color:#374151;font-size:13px;line-height:1.7;">
              Dùng <strong>túi zip nhỏ đổ đầy nước, buộc kín</strong> rồi nhét vào miệng hũ để ép dưa xuống chìm hoàn toàn. Hoặc dùng một miếng nhựa thực phẩm phủ kín mặt dưa. Kiểm tra mỗi ngày – nếu thấy dưa nổi lên thì ép xuống lại ngay.
            </p>
          </div>
        </div>
      </div>

      <!-- SAI LẦM 5 -->
      <div style="border:2px solid #dc2626;border-radius:12px;overflow:hidden;margin:20px 0;">
        <div style="background:#dc2626;padding:12px 20px;display:flex;align-items:center;gap:10px;">
          <span style="color:#fff;font-size:18px;font-weight:900;">❌ #5</span>
          <p style="margin:0;color:#fff;font-weight:800;font-size:15px;">Đậy nắp quá kín trong khi dưa đang lên men</p>
        </div>
        <div style="padding:16px 20px;">
          <p style="margin:0 0 8px;color:#374151;font-size:14px;line-height:1.7;">
            <strong>Tại sao hỏng?</strong> Trong 3–5 ngày đầu lên men, vi khuẩn lactic tạo ra khí CO₂. Nếu đậy nắp quá kín, khí không thoát được → áp suất trong hũ tăng → nước muối trào ra ngoài, vi khuẩn có hại xâm nhập → dưa hỏng và hũ có thể nứt vỡ.
          </p>
          <div style="background:#f0fdf4;border-radius:8px;padding:12px 16px;border-left:3px solid #16a34a;">
            <p style="margin:0;color:#166534;font-size:14px;font-weight:700;">✅ Cách sửa:</p>
            <p style="margin:6px 0 0;color:#374151;font-size:13px;line-height:1.7;">
              Trong <strong>3–5 ngày đầu lên men</strong>: đậy nắp nhẹ tay, không vặn chặt – để khí CO₂ thoát ra tự nhiên. Sau khi dưa đã chua đúng vị (ngày 4–5) mới đậy kín hoàn toàn để bảo quản lâu dài.
            </p>
          </div>
        </div>
      </div>

      <!-- KẾT QUẢ CHỊ T -->
      <div style="background:#f0fdf4;border:2px solid #16a34a;border-radius:10px;padding:20px 24px;margin:24px 0;">
        <h3 style="color:#166534;margin-top:0;font-size:15px;">✨ Chị T sau khi sửa 5 sai lầm trên:</h3>
        <p style="color:#374151;font-size:14px;line-height:1.7;margin:0 0 12px;font-style:italic;">
          "Cô ơi, con làm lại từ đầu theo đúng chỉ dẫn. Lần này dưa giòn rích, chua vừa, để được 2 tuần rồi mà vẫn ngon. Cảm ơn Cô Hạ nhiều lắm!" 🥰
        </p>
        <p style="margin:0;color:#6b7280;font-size:12px;">— Chị T, TP.HCM</p>
      </div>

      <p style="color:#374151;line-height:1.8;font-size:15px;">
        Bạn đang mắc sai lầm nào trong 5 cái trên không? Thử đối chiếu lại xem nhé! Có thắc mắc gì cứ vào nhóm hỏi Cô Hạ – Cô trả lời tất cả! 💚
      </p>

      <div style="text-align:center;margin:24px 0;">
        <a href="${communityLink}" style="display:inline-block;background:#006400;color:#fff;padding:13px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;">
          💬 Hỏi Cô Hạ trong nhóm
        </a>
      </div>

      <p style="color:#6b7280;font-size:13px;line-height:1.7;">
        Cô Hạ còn có thêm điều hay muốn chia sẻ – hẹn gặp lại ở email tiếp theo! 🌸
      </p>
    </div>

    <div style="background:#f9fafb;padding:18px 32px;text-align:center;border-top:1px solid #e5e7eb;">
      <p style="color:#9ca3af;font-size:12px;margin:0;">
        © 2025 HaCo Food – Bếp Cô Hạ &nbsp;|&nbsp;
        <a href="https://khoaduacamuoi.hacofood.vn" style="color:#006400;text-decoration:none;">khoaduacamuoi.hacofood.vn</a><br>
        Bạn nhận email này vì đã đăng ký nhận quà tại website của chúng tôi.
      </p>
    </div>
  </div>
</body>
</html>
    `,
  })
}

export async function sendGiftSequenceEmail3(to: { name: string; email: string }) {
  return getResend().emails.send({
    from: FROM_EMAIL,
    to: [to.email],
    subject: `${to.name} ơi – Cô Hạ muốn mời bạn vào một điều đặc biệt 🎓`,
    html: `
<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f0fff0;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

    <div style="background:linear-gradient(135deg,#166534,#16a34a);padding:36px 32px;text-align:center;">
      <p style="font-size:40px;margin:0 0 8px;">🎓</p>
      <h1 style="color:#fff;margin:0;font-size:24px;font-weight:800;">Khóa Học Dưa Cà Muối Chuyên Sâu</h1>
      <p style="margin:8px 0 0;font-size:14px;color:#dcfce7;">Học một lần – Dùng cả đời</p>
    </div>

    <div style="padding:36px 32px;">
      <h2 style="color:#006400;font-size:20px;margin-top:0;">Xin chào ${to.name}! 👋</h2>
      <p style="color:#374151;line-height:1.8;font-size:15px;">
        Mấy ngày qua Cô Hạ đã chia sẻ với bạn về những sai lầm khi làm dưa và cách bảo quản đúng. Cô hi vọng bạn đã thử và thấy có ích!
      </p>
      <p style="color:#374151;line-height:1.8;font-size:15px;">
        Hôm nay Cô muốn kể bạn nghe câu chuyện của <strong>chị Lan ở Bình Dương</strong>:
      </p>

      <div style="background:#f0fdf4;border-left:4px solid #16a34a;border-radius:6px;padding:16px 20px;margin:20px 0;">
        <p style="margin:0;color:#374151;font-size:14px;font-style:italic;line-height:1.8;">
          "Mình làm dưa bán ở chợ được 2 năm rồi nhưng lúc nào cũng bán không được nhiều vì dưa hay bị nhệu, để không lâu. Sau khi học khóa của Cô Hạ, mình biết mình sai ở đâu, sửa lại hết. Bây giờ dưa giòn hơn, để được lâu hơn, khách mua xong hay quay lại. Doanh thu tăng gần gấp đôi chỉ sau 1 tháng."
        </p>
        <p style="margin:10px 0 0;color:#166534;font-size:13px;font-weight:700;">— Chị Lan, Bình Dương</p>
      </div>

      <p style="color:#374151;line-height:1.8;font-size:15px;">
        Chị Lan không phải trường hợp đặc biệt. Đây là điều Cô Hạ chứng kiến mỗi ngày từ học viên của mình.
      </p>

      <!-- KHÓA HỌC DẠY GÌ -->
      <div style="background:#f8fafc;border:2px solid #006400;border-radius:12px;overflow:hidden;margin:24px 0;">
        <div style="background:#006400;padding:14px 20px;">
          <p style="margin:0;color:#fff;font-weight:800;font-size:15px;">📚 Khóa học dạy bạn những gì?</p>
        </div>
        <div style="padding:20px;">
          <div style="display:flex;gap:12px;align-items:flex-start;padding:10px 0;border-bottom:1px solid #e5e7eb;">
            <span style="font-size:20px;flex-shrink:0;">🥒</span>
            <div>
              <p style="margin:0 0 4px;color:#1f2937;font-weight:700;font-size:14px;">Bài 1 – Dưa cải bẹ muối chua giòn</p>
              <p style="margin:0;color:#6b7280;font-size:13px;">Công thức tỉ lệ chuẩn, cách chọn cải, xử lý & ủ đúng để dưa vàng ươm, giòn tan</p>
            </div>
          </div>
          <div style="display:flex;gap:12px;align-items:flex-start;padding:10px 0;border-bottom:1px solid #e5e7eb;">
            <span style="font-size:20px;flex-shrink:0;">🥕</span>
            <div>
              <p style="margin:0 0 4px;color:#1f2937;font-weight:700;font-size:14px;">Bài 2 – Dưa góp hỗn hợp (cà rốt, đu đủ, củ cải)</p>
              <p style="margin:0;color:#6b7280;font-size:13px;">Cách cắt đẹp, tỉ lệ giấm-đường-muối hoàn hảo, màu sắc bắt mắt để bán được giá</p>
            </div>
          </div>
          <div style="display:flex;gap:12px;align-items:flex-start;padding:10px 0;border-bottom:1px solid #e5e7eb;">
            <span style="font-size:20px;flex-shrink:0;">🍆</span>
            <div>
              <p style="margin:0 0 4px;color:#1f2937;font-weight:700;font-size:14px;">Bài 3 – Cà muối mắm giòn 7 ngày</p>
              <p style="margin:0;color:#6b7280;font-size:13px;">Công thức mắm ngâm độc quyền, cà giòn suốt 30 ngày, hương vị chuẩn miền Nam</p>
            </div>
          </div>
          <div style="display:flex;gap:12px;align-items:flex-start;padding:10px 0;border-bottom:1px solid #e5e7eb;">
            <span style="font-size:20px;flex-shrink:0;">🧅</span>
            <div>
              <p style="margin:0 0 4px;color:#1f2937;font-weight:700;font-size:14px;">Bài 4 – Sung muối & củ kiệu ngâm chua ngọt</p>
              <p style="margin:0;color:#6b7280;font-size:13px;">Các loại đặc sản muối chua ít người biết làm – bán được giá cao, ít đối thủ cạnh tranh</p>
            </div>
          </div>
          <div style="display:flex;gap:12px;align-items:flex-start;padding:10px 0;">
            <span style="font-size:20px;flex-shrink:0;">💼</span>
            <div>
              <p style="margin:0 0 4px;color:#1f2937;font-weight:700;font-size:14px;">Bài 5 – Kinh doanh dưa cà muối từ nhà</p>
              <p style="margin:0;color:#6b7280;font-size:13px;">Cách đóng gói đẹp, định giá bán, tìm kênh phân phối và xây dựng khách hàng quen</p>
            </div>
          </div>
        </div>
      </div>

      <!-- GIÁ -->
      <div style="background:#fef3c7;border:2px solid #f59e0b;border-radius:10px;padding:20px 24px;margin:24px 0;text-align:center;">
        <p style="color:#92400e;margin:0 0 12px;font-size:13px;font-weight:700;">💰 ĐẦU TƯ CHO KHÓA HỌC</p>
        <table style="width:100%;border-collapse:collapse;margin-bottom:12px;">
          <tr>
            <td style="text-align:center;padding:8px;">
              <p style="color:#9ca3af;font-size:12px;margin:0 0 4px;">Giá gốc</p>
              <p style="color:#9ca3af;font-size:20px;margin:0;text-decoration:line-through;">1.095.000đ</p>
            </td>
            <td style="text-align:center;padding:8px;">
              <p style="color:#92400e;font-size:12px;margin:0 0 4px;font-weight:700;">Giá ưu đãi</p>
              <p style="color:#dc2626;font-size:32px;font-weight:900;margin:0;">299.000đ</p>
            </td>
            <td style="text-align:center;padding:8px;">
              <p style="color:#166534;font-size:12px;margin:0 0 4px;">Tiết kiệm</p>
              <p style="color:#16a34a;font-size:20px;font-weight:800;margin:0;">796.000đ</p>
            </td>
          </tr>
        </table>
        <p style="color:#92400e;margin:0;font-size:13px;font-style:italic;">⏰ Mức giá này chỉ dành cho bạn đọc email của Cô Hạ</p>
      </div>

      <!-- CTA -->
      <div style="text-align:center;margin:28px 0;">
        <a href="https://khoaduacamuoi.hacofood.vn#khoa-hoc"
           style="display:inline-block;background:#16a34a;color:#fff;padding:16px 40px;border-radius:10px;text-decoration:none;font-weight:900;font-size:17px;letter-spacing:0.3px;">
          ✅ Tôi muốn tham gia – 299.000đ
        </a>
        <p style="color:#6b7280;font-size:12px;margin:12px 0 0;">Thanh toán an toàn qua chuyển khoản ngân hàng · Hỗ trợ 24/7</p>
      </div>

      <p style="color:#374151;line-height:1.8;font-size:14px;">
        Nếu bạn còn đang phân vân – hãy nghĩ đến chị Lan. Chị ấy cũng từng không chắc. Nhưng 299.000đ đã giúp chị thay đổi cả nguồn thu nhập. Còn bạn thì sao? 🌸
      </p>
    </div>

    <div style="background:#f9fafb;padding:18px 32px;text-align:center;border-top:1px solid #e5e7eb;">
      <p style="color:#9ca3af;font-size:12px;margin:0;">
        © 2025 HaCo Food – Bếp Cô Hạ &nbsp;|&nbsp;
        <a href="https://khoaduacamuoi.hacofood.vn" style="color:#006400;text-decoration:none;">khoaduacamuoi.hacofood.vn</a><br>
        Bạn nhận email này vì đã đăng ký nhận quà tại website của chúng tôi.
      </p>
    </div>
  </div>
</body>
</html>
    `,
  })
}

export async function sendGiftSequenceEmail4(to: { name: string; email: string }) {
  const communityLink = process.env.COMMUNITY_GROUP_LINK || 'https://www.facebook.com/groups/nauancungcoha'
  return getResend().emails.send({
    from: FROM_EMAIL,
    to: [to.email],
    subject: 'Bí quyết giữ dưa ngon 30 ngày – không cần tủ lạnh 🥒',
    html: `
<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f0fff0;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

    <div style="background:linear-gradient(135deg,#003200,#006400);padding:36px 32px;text-align:center;">
      <p style="font-size:40px;margin:0 0 8px;">🥒</p>
      <h1 style="color:#fff;margin:0;font-size:24px;font-weight:800;">Giữ Dưa Ngon 30 Ngày – Không Cần Tủ Lạnh</h1>
      <p style="margin:8px 0 0;font-size:14px;color:#dcfce7;">Hướng dẫn từng bước – ai cũng làm được!</p>
    </div>

    <div style="padding:36px 32px;">
      <h2 style="color:#006400;font-size:20px;margin-top:0;">Xin chào ${to.name}! 👋</h2>
      <p style="color:#374151;line-height:1.8;font-size:15px;">
        Cô Hạ hay nhận được câu hỏi: <em>"Làm dưa xong để được bao lâu? Có cần bỏ tủ lạnh không?"</em>
      </p>
      <p style="color:#374151;line-height:1.8;font-size:15px;">
        Câu trả lời là: <strong style="color:#006400;">Dưa cà muối đúng cách có thể để 30 ngày ở nhiệt độ phòng mà vẫn giòn, ngon, an toàn.</strong> Hôm nay Cô sẽ hướng dẫn chi tiết từng bước để bạn tự làm được ngay!
      </p>

      <!-- BƯỚC 1 -->
      <div style="border:2px solid #006400;border-radius:12px;overflow:hidden;margin:20px 0;">
        <div style="background:#006400;padding:12px 20px;">
          <p style="margin:0;color:#fff;font-weight:800;font-size:15px;">🧂 BƯỚC 1 – Pha nước muối đúng tỉ lệ</p>
        </div>
        <div style="padding:16px 20px;background:#f0fff0;">
          <p style="margin:0 0 10px;color:#374151;font-size:14px;line-height:1.7;">
            Đây là bước quan trọng nhất. Dùng <strong>muối hạt trắng thông thường</strong> – KHÔNG dùng muối iốt vì iốt sẽ giết chết vi khuẩn có lợi.
          </p>
          <div style="background:#fff;border-radius:8px;padding:14px 16px;margin-top:10px;">
            <p style="margin:0 0 8px;color:#006400;font-weight:700;font-size:13px;">📐 Công thức tỉ lệ chuẩn:</p>
            <table style="width:100%;border-collapse:collapse;font-size:13px;">
              <tr style="background:#dcfce7;">
                <td style="padding:8px 12px;font-weight:700;color:#166534;border-radius:4px 0 0 0;">Lượng rau củ</td>
                <td style="padding:8px 12px;font-weight:700;color:#166534;">Muối cần dùng</td>
                <td style="padding:8px 12px;font-weight:700;color:#166534;border-radius:0 4px 0 0;">Nước lọc</td>
              </tr>
              <tr style="border-bottom:1px solid #e5e7eb;">
                <td style="padding:8px 12px;color:#374151;">500g</td>
                <td style="padding:8px 12px;color:#374151;">15–20g (~1 muỗng canh)</td>
                <td style="padding:8px 12px;color:#374151;">500ml</td>
              </tr>
              <tr style="border-bottom:1px solid #e5e7eb;">
                <td style="padding:8px 12px;color:#374151;">1kg</td>
                <td style="padding:8px 12px;color:#374151;"><strong>30–40g (~2 muỗng canh)</strong></td>
                <td style="padding:8px 12px;color:#374151;">1 lít</td>
              </tr>
              <tr>
                <td style="padding:8px 12px;color:#374151;">2kg</td>
                <td style="padding:8px 12px;color:#374151;">60–80g (~4 muỗng canh)</td>
                <td style="padding:8px 12px;color:#374151;">2 lít</td>
              </tr>
            </table>
          </div>
          <p style="margin:10px 0 0;color:#6b7280;font-size:13px;line-height:1.6;">
            ⚠️ <strong>Ít muối hơn</strong> → dưa chua nhanh, dễ bị nhớt, hỏng trong 3–5 ngày.<br>
            ⚠️ <strong>Nhiều muối hơn</strong> → dưa mặn lợm, không lên men được, cứng và không ngon.
          </p>
        </div>
      </div>

      <!-- BƯỚC 2 -->
      <div style="border:2px solid #006400;border-radius:12px;overflow:hidden;margin:20px 0;">
        <div style="background:#006400;padding:12px 20px;">
          <p style="margin:0;color:#fff;font-weight:800;font-size:15px;">🫙 BƯỚC 2 – Chuẩn bị hũ đúng cách</p>
        </div>
        <div style="padding:16px 20px;background:#f0fff0;">
          <p style="margin:0 0 10px;color:#374151;font-size:14px;line-height:1.7;">
            Chọn <strong>hũ thủy tinh hoặc sành sứ</strong> – tuyệt đối không dùng hũ kim loại vì acid trong dưa sẽ ăn mòn kim loại, làm dưa đổi màu và có mùi lạ.
          </p>
          <p style="margin:0 0 6px;color:#006400;font-weight:700;font-size:13px;">Cách khử trùng hũ (bắt buộc!):</p>
          <ol style="margin:0;padding-left:20px;color:#374151;font-size:14px;line-height:2;">
            <li>Rửa hũ bằng nước rửa chén, tráng sạch</li>
            <li>Đổ nước sôi vào hũ, đậy nắp, lắc đều 30 giây</li>
            <li>Đổ nước sôi ra, úp ngược hũ lên khăn sạch cho ráo</li>
            <li>Để nguội hoàn toàn trước khi cho dưa vào</li>
          </ol>
        </div>
      </div>

      <!-- BƯỚC 3 -->
      <div style="border:2px solid #006400;border-radius:12px;overflow:hidden;margin:20px 0;">
        <div style="background:#006400;padding:12px 20px;">
          <p style="margin:0;color:#fff;font-weight:800;font-size:15px;">🥢 BƯỚC 3 – Xếp dưa và dìm chìm hoàn toàn</p>
        </div>
        <div style="padding:16px 20px;background:#f0fff0;">
          <p style="margin:0 0 10px;color:#374151;font-size:14px;line-height:1.7;">
            Đây là bí quyết cốt lõi: <strong>dưa phải chìm 100% dưới mặt nước muối</strong>. Vi khuẩn có hại cần oxy để sống – nếu phần dưa nào nổi lên tiếp xúc với không khí, phần đó sẽ bị mốc trước.
          </p>
          <p style="margin:0 0 6px;color:#006400;font-weight:700;font-size:13px;">Cách dìm dưa:</p>
          <ol style="margin:0;padding-left:20px;color:#374151;font-size:14px;line-height:2;">
            <li>Xếp dưa vào hũ, nén chặt tay</li>
            <li>Đổ nước muối vào ngập hơn dưa 2–3cm</li>
            <li>Lấy <strong>túi zip nhỏ đổ đầy nước</strong>, buộc kín rồi đặt lên trên mặt dưa để ép xuống</li>
            <li>Đậy nắp hũ – không đậy quá chặt để khí CO₂ thoát ra khi lên men</li>
          </ol>
          <p style="margin:10px 0 0;color:#6b7280;font-size:13px;font-style:italic;">
            💡 Mẹo: Không có túi zip? Dùng lá chuối gấp lại hoặc một miếng nhựa thực phẩm ép xuống cũng được!
          </p>
        </div>
      </div>

      <!-- BƯỚC 4 -->
      <div style="border:2px solid #006400;border-radius:12px;overflow:hidden;margin:20px 0;">
        <div style="background:#006400;padding:12px 20px;">
          <p style="margin:0;color:#fff;font-weight:800;font-size:15px;">🌡️ BƯỚC 4 – Để đúng chỗ và kiểm tra mỗi ngày</p>
        </div>
        <div style="padding:16px 20px;background:#f0fff0;">
          <p style="margin:0 0 10px;color:#374151;font-size:14px;line-height:1.7;">
            <strong>Đặt hũ ở nơi thoáng mát, không có ánh nắng trực tiếp.</strong> Góc bếp tối, ngăn dưới tủ bếp, hoặc góc phòng đều ổn.
          </p>
          <p style="margin:0 0 6px;color:#006400;font-weight:700;font-size:13px;">Lịch kiểm tra:</p>
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <tr style="background:#dcfce7;">
              <td style="padding:8px 12px;font-weight:700;color:#166534;">Ngày</td>
              <td style="padding:8px 12px;font-weight:700;color:#166534;">Dấu hiệu bình thường</td>
            </tr>
            <tr style="border-bottom:1px solid #e5e7eb;">
              <td style="padding:8px 12px;color:#374151;font-weight:600;">Ngày 1</td>
              <td style="padding:8px 12px;color:#374151;">Nước còn trong, dưa còn giòn</td>
            </tr>
            <tr style="border-bottom:1px solid #e5e7eb;">
              <td style="padding:8px 12px;color:#374151;font-weight:600;">Ngày 2</td>
              <td style="padding:8px 12px;color:#374151;">Nước hơi đục nhẹ – bình thường! Đây là vi khuẩn có lợi hoạt động</td>
            </tr>
            <tr style="border-bottom:1px solid #e5e7eb;">
              <td style="padding:8px 12px;color:#374151;font-weight:600;">Ngày 3</td>
              <td style="padding:8px 12px;color:#374151;">Nước đục, dưa bắt đầu chua nhẹ, bọt khí nhỏ xuất hiện</td>
            </tr>
            <tr>
              <td style="padding:8px 12px;color:#374151;font-weight:600;">Ngày 4–5</td>
              <td style="padding:8px 12px;color:#374151;">Dưa chua vừa, giòn → <strong>ăn được rồi!</strong></td>
            </tr>
          </table>
        </div>
      </div>

      <!-- BƯỚC 5 -->
      <div style="border:2px solid #006400;border-radius:12px;overflow:hidden;margin:20px 0;">
        <div style="background:#006400;padding:12px 20px;">
          <p style="margin:0;color:#fff;font-weight:800;font-size:15px;">❄️ BƯỚC 5 – Bảo quản sau khi dưa đã chín</p>
        </div>
        <div style="padding:16px 20px;background:#f0fff0;">
          <p style="margin:0 0 10px;color:#374151;font-size:14px;line-height:1.7;">
            Khi dưa đã chua đúng vị (ngày 4–5), làm ngay 2 việc này để giữ được thêm 3–4 tuần:
          </p>
          <ol style="margin:0;padding-left:20px;color:#374151;font-size:14px;line-height:2;">
            <li><strong>Đậy nắp hũ thật kín</strong> – lúc này không cần thoát khí nữa</li>
            <li><strong>Chuyển hũ sang nơi mát hơn</strong> – ngăn mát tủ lạnh hoặc chỗ tối trong nhà dưới 20°C</li>
          </ol>
          <div style="background:#fff;border-radius:8px;padding:12px 16px;margin-top:12px;border-left:3px solid #f59e0b;">
            <p style="margin:0;color:#374151;font-size:13px;line-height:1.7;">
              🌡️ <strong>Không có tủ lạnh?</strong> Bọc kín hũ bằng vải tối màu, để nơi không có gió lùa. Mùa hè dưa sẽ hết sau 2 tuần, mùa mát có thể để đến 30 ngày.
            </p>
          </div>
        </div>
      </div>

      <!-- DẤU HIỆU HỎNG -->
      <div style="background:#fef2f2;border:2px solid #dc2626;border-radius:10px;padding:20px 24px;margin:20px 0;">
        <h3 style="color:#dc2626;margin-top:0;font-size:15px;">🚨 Dấu hiệu dưa bị hỏng – bỏ ngay đừng ăn!</h3>
        <ul style="margin:0;padding-left:20px;color:#374151;font-size:14px;line-height:2;">
          <li>Nước chuyển màu hồng, xanh hoặc đen</li>
          <li>Có mùi thối, mùi khó chịu (khác với mùi chua bình thường)</li>
          <li>Xuất hiện mốc xanh/đen trên mặt nước</li>
          <li>Dưa trở nên nhớt, nhũn hoàn toàn</li>
        </ul>
      </div>

      <p style="color:#374151;line-height:1.8;font-size:15px;">
        Bạn thử làm theo từng bước trên xem sao nhé! Nếu có thắc mắc bước nào – cứ vào nhóm hỏi Cô Hạ, Cô luôn ở đây! 💚
      </p>

      <div style="text-align:center;margin:24px 0;">
        <a href="${communityLink}" style="display:inline-block;background:#006400;color:#fff;padding:13px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;">
          💬 Hỏi Cô Hạ trong nhóm
        </a>
      </div>

      <p style="color:#6b7280;font-size:13px;line-height:1.7;">
        Cô Hạ còn có một điều muốn nói với bạn – hẹn gặp lại ở email tiếp theo nhé! 🌸
      </p>
    </div>

    <div style="background:#f9fafb;padding:18px 32px;text-align:center;border-top:1px solid #e5e7eb;">
      <p style="color:#9ca3af;font-size:12px;margin:0;">
        © 2025 HaCo Food – Bếp Cô Hạ &nbsp;|&nbsp;
        <a href="https://khoaduacamuoi.hacofood.vn" style="color:#006400;text-decoration:none;">khoaduacamuoi.hacofood.vn</a><br>
        Bạn nhận email này vì đã đăng ký nhận quà tại website của chúng tôi.
      </p>
    </div>
  </div>
</body>
</html>
    `,
  })
}

export async function sendGiftSequenceEmail5(to: { name: string; email: string }) {
  return getResend().emails.send({
    from: FROM_EMAIL,
    to: [to.email],
    subject: `Cô Hạ muốn nói thật với ${to.name} một điều – đọc trước 23h59 nhé 🙏`,
    html: `
<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#fff8f0;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">

    <div style="background:linear-gradient(135deg,#991b1b,#dc2626);padding:36px 32px;text-align:center;">
      <p style="font-size:40px;margin:0 0 8px;">🙏</p>
      <h1 style="color:#fff;margin:0;font-size:22px;font-weight:800;">Email cuối cùng từ Cô Hạ</h1>
      <p style="margin:8px 0 0;font-size:14px;color:#fecaca;">Cô muốn nói thật với bạn</p>
    </div>

    <!-- GIÁ NỔI BẬT -->
    <div style="background:#fef2f2;padding:20px 32px;text-align:center;border-bottom:3px solid #dc2626;">
      <p style="color:#6b7280;font-size:12px;margin:0 0 8px;text-transform:uppercase;letter-spacing:1px;">Ưu đãi cuối – chỉ hôm nay</p>
      <p style="margin:0;font-size:14px;color:#9ca3af;text-decoration:line-through;">299.000đ</p>
      <p style="margin:4px 0;font-size:36px;font-weight:900;color:#dc2626;">199.000đ</p>
      <p style="margin:0;font-size:13px;color:#16a34a;font-weight:700;">Tiết kiệm 100.000đ · Hết lúc 23h59 hôm nay</p>
    </div>

    <div style="padding:36px 32px;">
      <h2 style="color:#1f2937;font-size:19px;margin-top:0;">Xin chào ${to.name}! 👋</h2>

      <p style="color:#374151;line-height:1.8;font-size:15px;">
        Đây là email cuối cùng Cô Hạ gửi cho bạn trong chuỗi này. Và Cô muốn nói thật – không phải để bán hàng, mà vì Cô thật sự quan tâm.
      </p>

      <p style="color:#374151;line-height:1.8;font-size:15px;">
        Mấy ngày qua bạn đã nhận được từ Cô:
      </p>
      <ul style="color:#374151;font-size:14px;line-height:2;margin:0 0 16px;padding-left:20px;">
        <li>Công thức làm dưa cà muối mắm giòn</li>
        <li>5 sai lầm hay gặp và cách sửa cụ thể</li>
        <li>Kỹ thuật bảo quản dưa 30 ngày không cần tủ lạnh</li>
      </ul>
      <p style="color:#374151;line-height:1.8;font-size:15px;">
        Những thứ đó đều miễn phí. Và <strong>nếu bạn chỉ cần làm dưa cho gia đình ăn</strong> – bạn hoàn toàn đã có đủ rồi, không cần mua thêm gì cả.
      </p>

      <div style="background:#fff8f0;border-left:4px solid #f59e0b;border-radius:8px;padding:18px 20px;margin:24px 0;">
        <p style="margin:0 0 8px;color:#92400e;font-weight:700;font-size:14px;">Nhưng nếu bạn muốn hơn thế...</p>
        <p style="margin:0;color:#374151;font-size:14px;line-height:1.8;">
          Muốn làm được nhiều loại dưa cà muối khác nhau. Muốn dưa ngon hơn, đẹp hơn, bán được. Muốn có người đồng hành và hỏi được Cô Hạ trực tiếp khi gặp vấn đề – thì khóa học này là dành cho bạn.
        </p>
      </div>

      <!-- CÂU HỎI THẬT -->
      <p style="color:#374151;line-height:1.8;font-size:15px;">
        Cô Hạ tự hỏi: <em>Điều gì đang khiến bạn chần chừ?</em>
      </p>

      <div style="background:#f8fafc;border-radius:10px;padding:20px 24px;margin:20px 0;">
        <div style="display:flex;gap:12px;align-items:flex-start;padding:10px 0;border-bottom:1px solid #e5e7eb;">
          <span style="color:#dc2626;font-size:16px;flex-shrink:0;">❓</span>
          <div>
            <p style="margin:0 0 4px;color:#1f2937;font-weight:700;font-size:14px;">"Tôi chưa chắc mình sẽ dùng được"</p>
            <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.6;">→ Khóa học quay video chi tiết từng bước, xem lại bất cứ lúc nào, không giới hạn thời gian.</p>
          </div>
        </div>
        <div style="display:flex;gap:12px;align-items:flex-start;padding:10px 0;border-bottom:1px solid #e5e7eb;">
          <span style="color:#dc2626;font-size:16px;flex-shrink:0;">❓</span>
          <div>
            <p style="margin:0 0 4px;color:#1f2937;font-weight:700;font-size:14px;">"Tôi không có nhiều tiền"</p>
            <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.6;">→ 199.000đ bằng 2 ly cà phê mỗi tháng. Nếu bán được thêm 1 hũ dưa/tuần, bạn thu hồi vốn trong 2 tuần.</p>
          </div>
        </div>
        <div style="display:flex;gap:12px;align-items:flex-start;padding:10px 0;">
          <span style="color:#dc2626;font-size:16px;flex-shrink:0;">❓</span>
          <div>
            <p style="margin:0 0 4px;color:#1f2937;font-weight:700;font-size:14px;">"Tôi không có thời gian"</p>
            <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.6;">→ Mỗi video chỉ 10–15 phút. Xem lúc rảnh, tua lại chỗ chưa hiểu. Không cần học liên tục.</p>
          </div>
        </div>
      </div>

      <!-- NHẮC LẠI KHÓA HỌC -->
      <div style="background:#f0fdf4;border:2px solid #006400;border-radius:10px;padding:20px 24px;margin:24px 0;">
        <p style="margin:0 0 12px;color:#166534;font-weight:800;font-size:15px;">✅ Bạn nhận được khi tham gia:</p>
        <ul style="margin:0;padding-left:20px;color:#374151;font-size:14px;line-height:2;">
          <li>5 bài học video chi tiết: dưa cải, dưa góp, cà muối mắm, sung muối, củ kiệu</li>
          <li>Công thức PDF chuẩn của Cô Hạ – in ra làm tài liệu luôn</li>
          <li>Vào group học viên – hỏi Cô Hạ trực tiếp bất cứ lúc nào</li>
          <li>Học xong biết làm, biết bán – không lý thuyết suông</li>
          <li>Xem lại trọn đời – không mất đi sau khi học xong</li>
        </ul>
      </div>

      <!-- GIÁ VÀ CTA -->
      <div style="background:#fef2f2;border:3px solid #dc2626;border-radius:12px;padding:24px;margin:24px 0;text-align:center;">
        <p style="margin:0 0 6px;color:#6b7280;font-size:13px;">Giá ưu đãi cuối – chỉ hôm nay</p>
        <p style="margin:0 0 4px;font-size:14px;color:#9ca3af;text-decoration:line-through;">299.000đ</p>
        <p style="margin:0 0 16px;font-size:34px;font-weight:900;color:#dc2626;">199.000đ</p>
        <a href="https://khoaduacamuoi.hacofood.vn/?promo=199#khoa-hoc"
           style="display:block;background:#dc2626;color:#fff;padding:16px 32px;border-radius:10px;text-decoration:none;font-weight:900;font-size:17px;box-shadow:0 4px 12px rgba(220,38,38,0.25);">
          🎓 Tôi muốn tham gia – 199.000đ
        </a>
        <p style="color:#6b7280;font-size:12px;margin:12px 0 0;">Hết lúc 23h59 hôm nay · Thanh toán chuyển khoản an toàn</p>
      </div>

      <p style="color:#374151;line-height:1.8;font-size:14px;">
        Dù bạn có tham gia hay không – Cô Hạ cũng cảm ơn bạn đã đọc đến email cuối này. Cô chúc bạn làm được những hũ dưa thật ngon, thật giòn cho gia đình! 💚
      </p>
      <p style="color:#374151;line-height:1.8;font-size:14px;">
        Thân mến,<br>
        <strong>Cô Hạ – Bếp Cô Hạ / HaCo Food</strong> 🌸
      </p>
    </div>

    <div style="background:#f9fafb;padding:18px 32px;text-align:center;border-top:1px solid #e5e7eb;">
      <p style="color:#9ca3af;font-size:12px;margin:0;">
        © 2025 HaCo Food – Bếp Cô Hạ &nbsp;|&nbsp;
        <a href="https://khoaduacamuoi.hacofood.vn" style="color:#006400;text-decoration:none;">khoaduacamuoi.hacofood.vn</a><br>
        Bạn nhận email này vì đã đăng ký nhận quà tại website của chúng tôi.
      </p>
    </div>
  </div>
</body>
</html>
    `,
  })
}
