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

export async function sendCourseConfirmEmail(to: { name: string; email: string }) {
  const courseGroupLink = process.env.COURSE_GROUP_LINK || '#'

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
            <td style="color:#dc2626;font-weight:800;text-align:right;font-size:18px;">299.000đ</td>
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
  return getResend().emails.send({
    from: FROM_EMAIL,
    to: [to.email],
    subject: '5 sai lầm khiến dưa bị hỏng – Chỉ 1% người biết #3 👀',
    html: `
<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f0fff0;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#dc2626,#991b1b);padding:36px 32px;text-align:center;">
      <p style="font-size:40px;margin:0 0 8px;">⚠️</p>
      <h1 style="color:#fff;margin:0;font-size:26px;font-weight:800;">5 Sai Lầm Khiến Dưa Bị Hỏng</h1>
      <p style="margin:8px 0 0;font-size:14px;color:#fecaca;">Giải pháp đơn giản từ Cô Hạ</p>
    </div>
    <div style="padding:36px 32px;">
      <h2 style="color:#dc2626;font-size:22px;margin-top:0;">Xin chào ${to.name}! 👋</h2>
      <p style="color:#374151;line-height:1.8;font-size:15px;">
        Hôm qua Cô Hạ nhận được tin nhắn từ chị T: <em>"Dưa của mình lúc nào cũng bị nhệu, mặn lợm, không biết sai chỗ nào!"</em>
      </p>
      <p style="color:#374151;line-height:1.8;font-size:15px;">
        Chị T đã mắc phải những sai lầm mà 95% người làm dưa cũng mắc. Hôm nay, Cô Hạ sẽ chia sẻ <strong>5 sai lầm</strong> này với bạn – để bạn KHÔNG bao giờ phải trải qua cảm giác vỡ mộng đó! 😅
      </p>

      <div style="background:#fff8f0;border-radius:10px;padding:24px;margin:24px 0;">
        <h3 style="color:#dc2626;margin-top:0;font-size:16px;margin-bottom:16px;">❌ 5 SAI LẦM DƯỚI ĐÂY</h3>

        <div style="background:#fff;border-left:4px solid #dc2626;padding:16px;margin-bottom:12px;border-radius:4px;">
          <p style="margin:0;color:#1f2937;font-weight:700;color:#dc2626;">Sai lầm #1: Không chuẩn bị hóa chất đúng</p>
          <p style="margin:8px 0 0;color:#4b5563;font-size:13px;">Dùng muối sai loại hoặc tỉ lệ sai = dưa mặn lợm</p>
        </div>

        <div style="background:#fff;border-left:4px solid #dc2626;padding:16px;margin-bottom:12px;border-radius:4px;">
          <p style="margin:0;color:#1f2937;font-weight:700;color:#dc2626;">Sai lầm #2: Không rửa sạch dưa trước khi ngâm</p>
          <p style="margin:8px 0 0;color:#4b5563;font-size:13px;">Bụi bẩn + vi khuẩn = dưa nhanh bị hỏng</p>
        </div>

        <div style="background:#fef2f2;border-left:4px solid #991b1b;padding:16px;margin-bottom:12px;border-radius:4px;position:relative;">
          <span style="position:absolute;top:8px;right:12px;background:#dc2626;color:#fff;font-size:11px;font-weight:700;padding:4px 8px;border-radius:4px;">🔥 CHÌA KHÓA</span>
          <p style="margin:0;color:#1f2937;font-weight:700;color:#dc2626;">Sai lầm #3: Để dưa ở nơi quá ẩm/quá nóng</p>
          <p style="margin:8px 0 0;color:#4b5563;font-size:13px;">Chỉ một độ ẩm/nhiệt sai = dưa nhanh bị mốc, thối</p>
        </div>

        <div style="background:#fff;border-left:4px solid #dc2626;padding:16px;margin-bottom:12px;border-radius:4px;">
          <p style="margin:0;color:#1f2937;font-weight:700;color:#dc2626;">Sai lầm #4: Không có lịch kiểm tra & lật dưa</p>
          <p style="margin:8px 0 0;color:#4b5563;font-size:13px;">Ngâm xong quên kiểm tra = một phần bị hỏng, phần kia ngon</p>
        </div>

        <div style="background:#fff;border-left:4px solid #dc2626;padding:16px;margin-bottom:12px;border-radius:4px;">
          <p style="margin:0;color:#1f2937;font-weight:700;color:#dc2626;">Sai lầm #5: Dùng bình, hũ không sạch 100%</p>
          <p style="margin:8px 0 0;color:#4b5563;font-size:13px;">Bình bẩn = vi khuẩn xâm nhập ngay trong 24 giờ</p>
        </div>
      </div>

      <div style="background:#f0fdf4;border:2px solid #006400;border-radius:10px;padding:20px 24px;margin:24px 0;">
        <h3 style="color:#006400;margin-top:0;font-size:16px;">✨ Chị T SAU KHI SỬA</h3>
        <div style="display:flex;gap:16px;margin:12px 0;">
          <div style="flex:1;text-align:center;">
            <p style="color:#6b7280;font-size:12px;margin:0;">TRƯỚC</p>
            <p style="font-size:28px;color:#dc2626;margin:4px 0 0;">❌</p>
          </div>
          <div style="flex:1;text-align:center;">
            <p style="color:#6b7280;font-size:12px;margin:0;">SAU</p>
            <p style="font-size:28px;color:#16a34a;margin:4px 0 0;">✅</p>
          </div>
        </div>
        <p style="color:#374151;line-height:1.6;margin:12px 0 0;font-size:14px;font-style:italic;">
          "Dưa của tôi bây giờ luôn giòn rích, ngon cơm. Cô Hạ đã cứu mệnh tôi!" – Chị T, TPHCM
        </p>
      </div>

      <div style="text-align:center;margin:24px 0;">
        <a href="https://khoaduacamuoi.hacofood.vn/gift-email2" style="display:inline-block;background:#006400;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;margin-bottom:12px;">
          📖 Xem hướng dẫn chi tiết
        </a>
      </div>

      <p style="color:#6b7280;font-size:13px;line-height:1.7;margin-top:20px;">
        Câu hỏi? Hãy nhắn vào group – Cô Hạ sẵn sàng giải đáp! 🌸
      </p>
    </div>
    <div style="background:#f9fafb;padding:18px 32px;text-align:center;border-top:1px solid #e5e7eb;">
      <p style="color:#9ca3af;font-size:12px;margin:0;">
        © 2025 HaCo Food – Bếp Cô Hạ &nbsp;|&nbsp; <a href="https://khoaduacamuoi.hacofood.vn" style="color:#006400;text-decoration:none;">khoaduacamuoi.hacofood.vn</a>
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
    subject: 'Khóa học Dưa Cà Muối Chuyên Sâu – Chỉ 299.000đ (hôm nay!) 🎓',
    html: `
<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f0fff0;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#16a34a,#166534);padding:36px 32px;text-align:center;">
      <p style="font-size:40px;margin:0 0 8px;">🎓</p>
      <h1 style="color:#fff;margin:0;font-size:26px;font-weight:800;">Từ 5 Sai Lầm → 5 Bí Quyết Hoàn Hảo</h1>
      <p style="margin:8px 0 0;font-size:14px;color:#dcfce7;">Khóa học Dưa Cà Muối Chuyên Sâu</p>
    </div>
    <div style="padding:36px 32px;">
      <h2 style="color:#006400;font-size:22px;margin-top:0;">Xin chào ${to.name}! 👋</h2>
      <p style="color:#374151;line-height:1.8;font-size:15px;">
        Bạn đã xem 2 email từ Cô Hạ. Bây giờ, hãy cùng bước sang chương tiếp theo – <strong>học chuyên sâu và thành thạo kỹ thuật</strong> làm dưa hoàn hảo!
      </p>

      <div style="background:#fef3c7;border:2px solid #f59e0b;border-radius:10px;padding:24px;margin:24px 0;text-align:center;">
        <p style="color:#92400e;margin:0 0 8px;font-size:14px;">💰 GIÁ KHÓA HỌC</p>
        <table style="width:100%;margin:12px 0;border-collapse:collapse;">
          <tr>
            <td style="color:#6b7280;text-align:center;padding:8px;font-size:13px;">
              Giá gốc<br><del style="font-size:18px;color:#9ca3af;">1.095.000đ</del>
            </td>
            <td style="color:#dc2626;text-align:center;padding:8px;font-size:13px;">
              Giá khóa<br><strong style="font-size:28px;">299.000đ</strong>
            </td>
            <td style="color:#16a34a;text-align:center;padding:8px;font-size:13px;">
              Bạn tiết kiệm<br><strong style="font-size:20px;">796.000đ</strong>
            </td>
          </tr>
        </table>
        <p style="color:#92400e;margin:12px 0 0;font-size:13px;font-style:italic;">⏰ Giảm giá hôm nay – Giá sẽ tăng lên 399.000đ từ ngày mai</p>
      </div>

      <div style="background:#f0fdf4;border:2px solid #006400;border-radius:10px;padding:24px;margin:24px 0;">
        <h3 style="color:#006400;margin-top:0;font-size:17px;">📚 Bạn sẽ nhận được</h3>
        <ul style="color:#374151;line-height:1.8;margin:0;padding-left:20px;font-size:14px;">
          <li><strong>5 video hướng dẫn chi tiết</strong> (từ cơ bản đến chuyên sâu)</li>
          <li><strong>Công thức chuẩn 100%</strong> từ Cô Hạ – áp dụng ngay</li>
          <li><strong>Group 149+ thành viên – Hỗ trợ 24/7</strong> từ Cô Hạ & team</li>
          <li><strong>Tài liệu PDF</strong> tổng hợp bí quyết & các sai lầm cần tránh</li>
          <li><strong>Access trọn đời</strong> – xem lại bất cứ lúc nào</li>
        </ul>
      </div>

      <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:10px;padding:20px 24px;margin:24px 0;">
        <h3 style="color:#1e293b;margin-top:0;font-size:15px;">🌟 Kết quả từ học viên</h3>
        <div style="background:#fff;border-radius:8px;padding:16px;border-left:4px solid #16a34a;">
          <p style="margin:0 0 8px;color:#1e293b;font-weight:700;">Chị A, Bình Dương</p>
          <p style="margin:0;color:#4b5563;font-size:13px;line-height:1.6;">
            "Sau 3 tuần học khóa, dưa của tôi bán chạy hơn 40%. Thu nhập tăng 3 triệu/tháng. Tuyệt vời quá!" 😍
          </p>
        </div>
      </div>

      <div style="text-align:center;margin:24px 0;">
        <a href="https://khoaduacamuoi.hacofood.vn#khoa-hoc" style="display:inline-block;background:#16a34a;color:#fff;padding:16px 40px;border-radius:8px;text-decoration:none;font-weight:800;font-size:16px;margin-bottom:12px;border:3px solid #16a34a;">
          ✅ Đăng ký khóa học – 299.000đ
        </a>
        <p style="color:#6b7280;font-size:12px;margin:12px 0 0;">Thanh toán an toàn – Được hỗ trợ 24/7 từ Cô Hạ</p>
      </div>

      <p style="color:#6b7280;font-size:13px;line-height:1.7;margin-top:20px;">
        Bạn là một trong 149+ thành viên sẽ tham gia khóa học. Hãy quyết định hôm nay – để không tiếc nuối ngày mai! 🌸
      </p>
    </div>
    <div style="background:#f9fafb;padding:18px 32px;text-align:center;border-top:1px solid #e5e7eb;">
      <p style="color:#9ca3af;font-size:12px;margin:0;">
        © 2025 HaCo Food – Bếp Cô Hạ &nbsp;|&nbsp; <a href="https://khoaduacamuoi.hacofood.vn" style="color:#006400;text-decoration:none;">khoaduacamuoi.hacofood.vn</a>
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
    subject: '🔥 LAST CHANCE – 199.000đ (hết hôm nay!)',
    html: `
<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#fef2f2;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.15);">
    <div style="background:linear-gradient(135deg,#dc2626,#991b1b);padding:36px 32px;text-align:center;position:relative;overflow:hidden;">
      <div style="position:absolute;top:0;left:0;right:0;bottom:0;opacity:0.1;background:repeating-linear-gradient(45deg,transparent,transparent 35px,rgba(255,255,255,.2) 35px,rgba(255,255,255,.2) 70px);"></div>
      <p style="font-size:40px;margin:0 0 8px;position:relative;z-index:1;">🔥</p>
      <h1 style="color:#fff;margin:0;font-size:28px;font-weight:900;position:relative;z-index:1;">LAST CHANCE!</h1>
      <p style="margin:8px 0 0;font-size:14px;color:#fecaca;position:relative;z-index:1;">Giảm độc quyền chỉ hôm nay</p>
    </div>

    <div style="background:#fef2f2;padding:24px 32px;text-align:center;border-bottom:3px solid #dc2626;">
      <p style="color:#4b5563;margin:0 0 12px;font-size:13px;">GIẢM GIÁ ĐỘC QUYỀN</p>
      <div style="background:#fff;border-radius:12px;padding:20px;margin:0 auto;max-width:300px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="text-align:center;padding:0 8px;">
              <p style="color:#6b7280;font-size:12px;margin:0;">Giá gốc</p>
              <p style="color:#9ca3af;font-size:18px;margin:4px 0;text-decoration:line-through;">299.000đ</p>
            </td>
            <td style="color:#d1d5db;padding:0;">→</td>
            <td style="text-align:center;padding:0 8px;">
              <p style="color:#dc2626;font-size:12px;margin:0;font-weight:700;">GIÁ HOT</p>
              <p style="color:#dc2626;font-size:28px;margin:4px 0;font-weight:900;">199.000đ</p>
            </td>
          </tr>
        </table>
        <p style="color:#16a34a;font-size:13px;margin:12px 0 0;font-weight:700;">Tiết kiệm: 100.000đ (33%)</p>
      </div>
    </div>

    <div style="padding:36px 32px;">
      <h2 style="color:#dc2626;font-size:22px;margin-top:0;">Xin chào ${to.name}! ⏰</h2>
      <p style="color:#374151;line-height:1.8;font-size:15px;">
        Đây là email cuối cùng – và <strong>đây là mức giá cuối cùng</strong> Cô Hạ có thể cung cấp cho bạn.
      </p>

      <div style="background:#fef08a;border:3px solid #dc2626;border-radius:12px;padding:20px 24px;margin:24px 0;text-align:center;">
        <p style="color:#854d0e;margin:0 0 8px;font-size:13px;font-weight:700;text-transform:uppercase;">⏱️ COUNTDOWN</p>
        <p style="color:#dc2626;font-size:24px;margin:0;font-weight:900;">HẾT LÚC 23H59 HÔM NAY!</p>
        <p style="color:#854d0e;font-size:12px;margin:8px 0 0;">Sau thời gian này, mức giá 199k sẽ không còn</p>
      </div>

      <div style="background:#fff3e0;border-left:4px solid #f59e0b;border-radius:8px;padding:20px 24px;margin:24px 0;">
        <h3 style="color:#d97706;margin-top:0;font-size:16px;">⚡ Tại sao bạn nên quyết định NGAY?</h3>
        <ul style="color:#374151;line-height:1.8;margin:0;padding-left:20px;font-size:14px;">
          <li>Bạn đã xem 4 email – bạn đã sẵn sàng</li>
          <li>149+ thành viên khác đang học – bạn sẽ bị lại phía sau</li>
          <li>Giá 199k là <strong>ưu đãi duy nhất</strong> – sau hôm nay là 499.000đ</li>
          <li>Mỗi ngày trì hoãn = một ngày mất cơ hội</li>
        </ul>
      </div>

      <div style="background:#f0fdf4;border:2px solid #006400;border-radius:10px;padding:24px;margin:24px 0;">
        <h3 style="color:#006400;margin-top:0;font-size:17px;text-align:center;">✅ KHÓA HỌC BẠN NHẬN</h3>
        <ul style="color:#374151;line-height:1.8;margin:0;padding-left:20px;font-size:14px;">
          <li>5 video hướng dẫn chi tiết (1.2GB dữ liệu)</li>
          <li>Công thức chuẩn 100% từ Cô Hạ</li>
          <li>Group 149+ thành viên – Hỗ trợ 24/7</li>
          <li>Tài liệu PDF + Checklist 12 dấu hiệu</li>
          <li>Access trọn đời – xem lại bất cứ lúc nào</li>
        </ul>
      </div>

      <div style="text-align:center;margin:24px 0;">
        <a href="https://khoaduacamuoi.hacofood.vn#khoa-hoc" style="display:block;background:#dc2626;color:#fff;padding:18px 40px;border-radius:10px;text-decoration:none;font-weight:900;font-size:18px;margin-bottom:12px;border:3px solid #991b1b;box-shadow:0 4px 12px rgba(220,38,38,0.3);">
          🚀 ĐỀ NGAY – 199.000đ
        </a>
        <p style="color:#6b7280;font-size:12px;margin:12px 0 0;">Đơn hàng cuối cùng được áp giá 199k – hết hôm nay!</p>
      </div>

      <div style="background:#fee2e2;border-radius:8px;padding:16px 24px;margin:24px 0;text-align:center;">
        <p style="color:#7f1d1d;margin:0;font-size:13px;font-style:italic;">
          "Nếu bạn không hành động hôm nay, bạn sẽ phải trả 499.000đ cho cùng một khóa học. <strong>Tiếc nuối sẽ tìm đến bạn.</strong>"<br>
          – Cô Hạ
        </p>
      </div>

      <p style="color:#6b7280;font-size:13px;line-height:1.7;margin-top:20px;">
        Quyết định hôm nay – Thành công từ ngày mai! 🌸
      </p>
    </div>
    <div style="background:#f9fafb;padding:18px 32px;text-align:center;border-top:1px solid #e5e7eb;">
      <p style="color:#9ca3af;font-size:12px;margin:0;">
        © 2025 HaCo Food – Bếp Cô Hạ &nbsp;|&nbsp; <a href="https://khoaduacamuoi.hacofood.vn" style="color:#006400;text-decoration:none;">khoaduacamuoi.hacofood.vn</a>
      </p>
    </div>
  </div>
</body>
</html>
    `,
  })
}
