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
  return getResend().emails.send({
    from: FROM_EMAIL,
    to: [to.email],
    subject: 'Cô Hạ vừa gửi quà cho bạn – Mở ngay! 🎁',
    html: `
<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f0fff0;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#003200,#006400);padding:36px 32px;text-align:center;">
      <p style="font-size:40px;margin:0 0 8px;">👩‍🍳</p>
      <h1 style="color:#fff;margin:0;font-size:26px;font-weight:800;">Cô Hạ Đã Gửi Quà Cho Bạn!</h1>
      <p style="margin:8px 0 0;font-size:14px;color:#dcfce7;">Khóa học Dưa Cà Muối Chuyên Sâu</p>
    </div>
    <div style="padding:36px 32px;">
      <h2 style="color:#006400;font-size:22px;margin-top:0;">Xin chào ${to.name}! 👋</h2>
      <p style="color:#374151;line-height:1.8;font-size:15px;">
        Quà tặng đặc biệt từ Cô Hạ đã được chuẩn bị riêng cho bạn. Đây là video hướng dẫn <strong>5 bí quyết dưa không bị nhớt</strong> – giải pháp hoàn hảo cho những ai yêu thích ăn dưa muối!
      </p>

      <div style="background:#f0fff0;border-left:4px solid #006400;border-radius:8px;padding:20px 24px;margin:24px 0;">
        <h3 style="color:#006400;margin-top:0;font-size:17px;">📹 Video quà tặng của bạn</h3>
        <p style="margin:0 0 12px;color:#374151;font-size:14px;">
          <strong>5 Bí Quyết Dưa Không Bị Nhớt</strong><br>
          <span style="color:#6b7280;font-size:13px;">Chi tiết từng bước, dễ làm theo – Thời lượng: 8 phút</span>
        </p>
        <a href="https://khoaduacamuoi.hacofood.vn/gift-email1" style="display:inline-block;background:#006400;color:#fff;padding:13px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;">
          📥 Xem video ngay
        </a>
      </div>

      <div style="background:#fff8f0;border-left:4px solid #f59e0b;border-radius:8px;padding:20px 24px;margin:24px 0;">
        <h3 style="color:#d97706;margin-top:0;font-size:16px;">🌟 Tại sao bạn nên xem?</h3>
        <ul style="color:#374151;line-height:1.8;margin:0;padding-left:20px;font-size:14px;">
          <li>Dưa luôn giòn rích, không bị nhệu</li>
          <li>Không cần công thức phức tạp – dễ làm tại nhà</li>
          <li>Áp dụng được ngay cho gia đình bạn</li>
        </ul>
      </div>

      <div style="background:#f0f9ff;border:2px solid #0ea5e9;border-radius:10px;padding:20px 24px;margin:24px 0;text-align:center;">
        <h3 style="color:#0369a1;margin-top:0;font-size:16px;">👥 Tham gia cộng đồng Cô Hạ</h3>
        <p style="color:#374151;margin:0 0 12px;font-size:14px;">
          149+ thành viên đang cùng học & chia sẻ kinh nghiệm nấu ăn
        </p>
        <a href="https://www.facebook.com/groups/nauancungcoha" style="display:inline-block;background:#0ea5e9;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;">
          👨‍👩‍👧‍👦 Vào Group Miễn Phí
        </a>
      </div>

      <p style="color:#6b7280;font-size:13px;line-height:1.7;margin-top:20px;">
        Cô Hạ sẵn sàng giúp bạn bất cứ lúc nào – chỉ cần nhắn vào group nhé! 🌸
      </p>
    </div>
    <div style="background:#f9fafb;padding:18px 32px;text-align:center;border-top:1px solid #e5e7eb;">
      <p style="color:#9ca3af;font-size:12px;margin:0;">
        © 2025 HaCo Food – Bếp Cô Hạ &nbsp;|&nbsp; <a href="https://khoaduacamuoi.hacofood.vn" style="color:#006400;text-decoration:none;">khoaduacamuoi.hacofood.vn</a><br>
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
  return getResend().emails.send({
    from: FROM_EMAIL,
    to: [to.email],
    subject: 'Có 149+ người đã làm được, tại sao bạn chưa? 🤔',
    html: `
<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f0fff0;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#0369a1,#075985);padding:36px 32px;text-align:center;">
      <p style="font-size:40px;margin:0 0 8px;">👥</p>
      <h1 style="color:#fff;margin:0;font-size:26px;font-weight:800;">149+ Thành Viên Đã Thành Công</h1>
      <p style="margin:8px 0 0;font-size:14px;color:#bae6fd;">Bạn sẽ là người tiếp theo?</p>
    </div>
    <div style="padding:36px 32px;">
      <h2 style="color:#0369a1;font-size:22px;margin-top:0;">Xin chào ${to.name}! 👋</h2>
      <p style="color:#374151;line-height:1.8;font-size:15px;">
        Chúng tôi vừa kiểm tra số liệu: <strong>90% học viên tuần đầu đã áp dụng thành công</strong> và thấy kết quả rõ rệt!
      </p>

      <div style="background:#eff6ff;border:2px solid #0369a1;border-radius:10px;padding:24px;margin:24px 0;">
        <h3 style="color:#0369a1;margin-top:0;font-size:16px;">📊 Số liệu từ học viên</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:12px 0;">
          <div style="background:#fff;border-radius:8px;padding:12px;text-align:center;border-left:3px solid #0ea5e9;">
            <p style="margin:0;font-size:24px;color:#0369a1;font-weight:800;">149+</p>
            <p style="margin:4px 0 0;font-size:12px;color:#6b7280;">Học viên tham gia</p>
          </div>
          <div style="background:#fff;border-radius:8px;padding:12px;text-align:center;border-left:3px solid #16a34a;">
            <p style="margin:0;font-size:24px;color:#16a34a;font-weight:800;">90%</p>
            <p style="margin:4px 0 0;font-size:12px;color:#6b7280;">Thành công tuần 1</p>
          </div>
        </div>
      </div>

      <div style="background:#fff8f0;border-radius:10px;padding:0;margin:24px 0;overflow:hidden;">
        <h3 style="color:#dc2626;margin:0;padding:16px 24px;background:#fff3e0;font-size:16px;">✨ 3 Câu Chuyện Thành Công</h3>

        <div style="padding:20px 24px;border-bottom:1px solid #e5e7eb;">
          <div style="display:flex;gap:12px;">
            <div style="flex-shrink:0;width:40px;height:40px;background:#16a34a;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;">A</div>
            <div style="flex:1;">
              <p style="margin:0 0 4px;font-weight:700;color:#1f2937;">Chị A – Bình Dương</p>
              <p style="margin:0;color:#4b5563;font-size:13px;line-height:1.5;">
                Dưa bán chạy hơn 40%, thu nhập tăng 3 triệu/tháng. "Cô Hạ thật tuyệt vời!"
              </p>
            </div>
          </div>
        </div>

        <div style="padding:20px 24px;border-bottom:1px solid #e5e7eb;">
          <div style="display:flex;gap:12px;">
            <div style="flex-shrink:0;width:40px;height:40px;background:#0ea5e9;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;">B</div>
            <div style="flex:1;">
              <p style="margin:0 0 4px;font-weight:700;color:#1f2937;">Chị B – Hà Nội</p>
              <p style="margin:0;color:#4b5563;font-size:13px;line-height:1.5;">
                Từ làm dưa lẻ, nay đã có khách đặt hàng định kỳ. Lợi nhuận tăng 5x.
              </p>
            </div>
          </div>
        </div>

        <div style="padding:20px 24px;">
          <div style="display:flex;gap:12px;">
            <div style="flex-shrink:0;width:40px;height:40px;background:#f59e0b;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;">C</div>
            <div style="flex:1;">
              <p style="margin:0 0 4px;font-weight:700;color:#1f2937;">Chị C – TP.HCM</p>
              <p style="margin:0;color:#4b5563;font-size:13px;line-height:1.5;">
                Dưa không còn bị hỏng, gia đình cực vui. "Đó chính là điều tôi cần!"
              </p>
            </div>
          </div>
        </div>
      </div>

      <div style="background:#fef08a;border:2px solid #eab308;border-radius:10px;padding:20px 24px;margin:24px 0;text-align:center;">
        <p style="color:#854d0e;margin:0 0 8px;font-size:13px;font-weight:700;">⏰ CẢNH BÁO: GIÁ SẮP TĂNG</p>
        <p style="color:#854d0e;margin:0;font-size:14px;">
          Giá hiện tại: <strong>299.000đ</strong><br>
          Giá từ ngày mai: <strong>399.000đ</strong>
        </p>
      </div>

      <div style="background:#f0fdf4;border-left:4px solid #006400;border-radius:8px;padding:20px 24px;margin:24px 0;">
        <h3 style="color:#006400;margin-top:0;font-size:16px;">🎁 Bonus: Checklist 12 Dấu Hiệu Dưa Sắp Hỏng</h3>
        <p style="color:#374151;margin:0 0 12px;font-size:14px;">
          Tặng kèm cho bạn – giúp bạn phát hiện & xử lý sớm trước khi dưa bị hỏng!
        </p>
      </div>

      <div style="text-align:center;margin:24px 0;">
        <a href="https://khoaduacamuoi.hacofood.vn#khoa-hoc" style="display:inline-block;background:#16a34a;color:#fff;padding:16px 40px;border-radius:8px;text-decoration:none;font-weight:800;font-size:16px;margin-bottom:12px;">
          🚀 Đăng ký khóa học ngay
        </a>
        <p style="color:#6b7280;font-size:12px;margin:12px 0 0;">Còn 299.000đ hôm nay – Giá tăng từ ngày mai</p>
      </div>

      <p style="color:#6b7280;font-size:13px;line-height:1.7;margin-top:20px;">
        Đừng để tiếc nuối – Hãy tham gia cùng 149+ thành viên hôm nay! 🌸
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
