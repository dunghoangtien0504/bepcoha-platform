// Chạy: node scripts/generate-gift-pdf.js
// Output: public/qua-tang-dua-ca-muoi.pdf

const PDFDocument = require('pdfkit')
const fs = require('fs')
const path = require('path')

const FONT_N = 'C:\\Windows\\Fonts\\arial.ttf'
const FONT_B = 'C:\\Windows\\Fonts\\arialbd.ttf'
const OUT = path.join(__dirname, '..', 'public', 'qua-tang-dua-ca-muoi.pdf')

// Brand colors
const RED     = '#C0392B'
const ORANGE  = '#E07B39'
const GREEN   = '#27AE60'
const DARK    = '#2C3E50'
const GRAY    = '#7F8C8D'
const L_RED   = '#FDEDEC'
const L_ORG   = '#FEF9E7'
const L_GRN   = '#EAFAF1'
const WHITE   = '#FFFFFF'

const doc = new PDFDocument({
  size: 'A4',
  margins: { top: 55, bottom: 55, left: 55, right: 55 },
  info: { Title: 'Bộ 3 Quà Tặng – Bếp Cô Hạ', Author: 'Bếp Cô Hạ – HaCo Food' }
})

doc.registerFont('n', FONT_N)
doc.registerFont('b', FONT_B)
const stream = fs.createWriteStream(OUT)
doc.pipe(stream)

const PW = doc.page.width   // 595.28
const PH = doc.page.height  // 841.89
const ML = 55, MR = 55
const CW = PW - ML - MR    // ~485

// ── HELPERS ──────────────────────────────────────────────────────────────

function bars(accent = ORANGE) {
  doc.rect(0, 0, PW, 7).fill(accent)
  doc.rect(0, PH - 7, PW, 7).fill(accent)
}

function pageFooter(num, total) {
  doc.font('n').fontSize(9).fillColor(GRAY)
    .text(`Trang ${num} / ${total}   |   Bếp Cô Hạ – HaCo Food   |   khoaduacamuoi.hacofood.vn`,
      0, PH - 38, { width: PW, align: 'center' })
}

function giftHeader(num, title, color = RED) {
  const y = doc.y
  // Left accent bar
  doc.rect(ML, y, 5, 40).fill(color)
  // Number tag
  doc.rect(ML + 5, y, 38, 40).fill(color)
  doc.font('b').fontSize(22).fillColor(WHITE)
    .text(num, ML + 5, y + 7, { width: 38, align: 'center' })
  // Title background
  doc.rect(ML + 43, y, CW - 43, 40).fill(color + '18')
  doc.font('b').fontSize(13.5).fillColor(color)
    .text(title, ML + 55, y + 12, { width: CW - 60 })
  doc.y = y + 50
  doc.moveDown(0.5)
}

function subHead(text, color = DARK) {
  doc.moveDown(0.4)
  const y = doc.y
  doc.rect(ML, y, CW, 26).fill(color + '15')
  doc.font('b').fontSize(11).fillColor(color)
    .text(text, ML + 10, y + 7, { width: CW - 20 })
  doc.y = y + 32
  doc.moveDown(0.2)
}

function row(label, value, shade = false) {
  const y = doc.y
  const rowH = 22
  if (shade) doc.rect(ML, y, CW, rowH).fill('#F7F9FA')
  doc.rect(ML, y, CW, rowH).stroke('#E0E0E0').lineWidth(0.3)
  doc.font('b').fontSize(10).fillColor(DARK)
    .text(label, ML + 8, y + 6, { width: CW * 0.38 })
  doc.font('n').fontSize(10).fillColor(DARK)
    .text(value, ML + CW * 0.38 + 8, y + 6, { width: CW * 0.62 - 16 })
  doc.y = y + rowH
}

function tableHeader(cols) {
  // cols = [{label, w}]
  const y = doc.y
  let x = ML
  for (const c of cols) {
    doc.rect(x, y, c.w, 24).fill(DARK)
    doc.font('b').fontSize(9.5).fillColor(WHITE)
      .text(c.label, x + 4, y + 7, { width: c.w - 8, align: c.align || 'left' })
    x += c.w
  }
  doc.y = y + 24
}

function tableRow(cols, values, shade = false) {
  const y = doc.y
  const rowH = cols.some((_, i) => {
    const txt = String(values[i] || '')
    return txt.length > 30
  }) ? 30 : 22
  let x = ML
  for (let i = 0; i < cols.length; i++) {
    const c = cols[i]
    if (shade) doc.rect(x, y, c.w, rowH).fill('#F7F9FA')
    doc.rect(x, y, c.w, rowH).stroke('#E0E0E0').lineWidth(0.3)
    doc.font('n').fontSize(9.5).fillColor(DARK)
      .text(String(values[i] || ''), x + 4, y + (rowH === 30 ? 9 : 6),
        { width: c.w - 8, align: c.align || 'left' })
    x += c.w
  }
  doc.y = y + rowH
}

function check(text, indent = 0) {
  const baseX = ML + indent
  const y = doc.y
  doc.font('b').fontSize(11).fillColor(GREEN).text('✓', baseX, y)
  doc.font('n').fontSize(10.5).fillColor(DARK)
    .text(text, baseX + 18, y, { width: CW - indent - 18 })
  doc.moveDown(0.35)
}

function bullet(text, indent = 0, color = DARK) {
  const baseX = ML + indent
  const y = doc.y
  doc.font('n').fontSize(10).fillColor(ORANGE).text('•', baseX, y)
  doc.font('n').fontSize(10).fillColor(color)
    .text(text, baseX + 14, y, { width: CW - indent - 14 })
  doc.moveDown(0.3)
}

function tip(title, body, color = ORANGE) {
  const fullText = `${title}  ${body}`
  const h = doc.heightOfString(body, { width: CW - 70, font: 'n', fontSize: 10 }) + 24
  const y = doc.y
  doc.rect(ML, y, CW, h).fill(color + '15')
  doc.rect(ML, y, 4, h).fill(color)
  doc.font('b').fontSize(10).fillColor(color).text(title, ML + 14, y + 10)
  const tw = doc.widthOfString(title + '  ')
  doc.font('n').fontSize(10).fillColor(DARK)
    .text(body, ML + 14 + tw, y + 10, { width: CW - 28 - tw })
  doc.y = y + h + 8
}

function noteBox(text, color = ORANGE) {
  const h = doc.heightOfString(text, { width: CW - 28, font: 'n', fontSize: 10 }) + 22
  const y = doc.y
  doc.rect(ML, y, CW, h).fill(color + '12')
  doc.rect(ML, y, 4, h).fill(color)
  doc.font('n').fontSize(10).fillColor(DARK)
    .text(text, ML + 14, y + 11, { width: CW - 28 })
  doc.y = y + h + 8
}

function hr(color = '#DDDDDD') {
  doc.moveDown(0.5)
  doc.moveTo(ML, doc.y).lineTo(ML + CW, doc.y).lineWidth(0.5).strokeColor(color).stroke()
  doc.moveDown(0.5)
}

// ══════════════════════════════════════════════════════════════════════
// PAGE 1 – BÌA
// ══════════════════════════════════════════════════════════════════════
bars(RED)

doc.moveDown(2.5)
doc.font('b').fontSize(11).fillColor(ORANGE)
  .text('BẾP CÔ HẠ – HACO FOOD', { align: 'center' })
doc.moveDown(0.6)
doc.font('b').fontSize(34).fillColor(RED)
  .text('BỘ 3 QUÀ TẶNG', { align: 'center' })
doc.font('b').fontSize(34).fillColor(RED)
  .text('ĐẶC BIỆT', { align: 'center' })
doc.moveDown(0.4)
doc.font('n').fontSize(14).fillColor(DARK)
  .text('Dành Tặng Học Viên Khóa Học', { align: 'center' })
doc.font('b').fontSize(17).fillColor(ORANGE)
  .text('Dưa Cà Muối Chuẩn Vị', { align: 'center' })

doc.moveDown(1.5)
doc.moveTo(ML + 60, doc.y).lineTo(ML + CW - 60, doc.y).lineWidth(2).strokeColor(RED).stroke()
doc.moveDown(1.5)

// 3 gift cards on cover
const gifts = [
  { n: '01', t: 'Bảng Tỷ Lệ Nước Ngâm Chuẩn Vị 5 Món',
    d: 'Không bao giờ nhầm tỷ lệ – dùng mãi mãi', c: RED },
  { n: '02', t: 'Checklist 12 Dấu Hiệu Chọn Nguyên Liệu Tươi',
    d: 'Mua đúng ngay từ lần đầu tại chợ', c: ORANGE },
  { n: '03', t: 'Bí Quyết Bảo Quản Giữ Dưa Giòn 30 Ngày',
    d: 'Không cần tủ lạnh – phù hợp bán hàng', c: GREEN },
]
for (const g of gifts) {
  const y = doc.y
  doc.rect(ML, y, CW, 60).fill(g.c + '12')
  doc.rect(ML, y, 4, 60).fill(g.c)
  doc.rect(ML + 4, y, 48, 60).fill(g.c)
  doc.font('b').fontSize(24).fillColor(WHITE).text(g.n, ML + 4, y + 15, { width: 48, align: 'center' })
  doc.font('b').fontSize(13).fillColor(DARK).text(g.t, ML + 62, y + 10, { width: CW - 130 })
  doc.font('n').fontSize(10.5).fillColor(GRAY).text(g.d, ML + 62, doc.y + 2, { width: CW - 130 })
  // Badge
  const bx = ML + CW - 62
  doc.rect(bx, y + 14, 55, 24).fill(g.c)
  doc.font('b').fontSize(10).fillColor(WHITE).text('99.000đ', bx, y + 20, { width: 55, align: 'center' })
  doc.y = y + 68
}

doc.moveDown(1.5)
doc.font('n').fontSize(9.5).fillColor(GRAY)
  .text('Tài liệu độc quyền dành cho học viên. Vui lòng không sao chép hoặc chia sẻ rộng rãi.', { align: 'center' })

pageFooter(1, 5)

// ══════════════════════════════════════════════════════════════════════
// PAGE 2 – QUÀ 1: BẢNG TỶ LỆ NƯỚC NGÂM
// ══════════════════════════════════════════════════════════════════════
doc.addPage()
bars(RED)

doc.moveDown(0.5)
giftHeader('01', 'BẢNG TỶ LỆ NƯỚC NGÂM CHUẨN VỊ 5 MÓN', RED)

doc.font('n').fontSize(10.5).fillColor(GRAY)
  .text('Tất cả tỷ lệ dưới đây tính cho 1 lít nước ngâm (sau khi đun sôi để nguội hoàn toàn)', { width: CW })
doc.moveDown(0.8)

// ── MÓN 1: Dưa cải chua ─────────────────────────
subHead('① Dưa Cải Chua (cải bẹ xanh / cải thảo)', RED)
const colsDuaCai = [
  { label: 'Thành phần', w: CW * 0.32 },
  { label: 'Lượng dùng (/ 1 lít nước)', w: CW * 0.38 },
  { label: 'Ghi chú', w: CW * 0.30 },
]
tableHeader(colsDuaCai)
tableRow(colsDuaCai, ['Muối hạt thô', '30g  (= 2 thìa canh đầy)', 'Không dùng muối iốt'], false)
tableRow(colsDuaCai, ['Đường trắng', '20g  (= 1.5 thìa canh)', 'Giúp lên men nhanh hơn'], true)
tableRow(colsDuaCai, ['Giấm gạo', 'Không cần', '—'], false)
tableRow(colsDuaCai, ['Thời gian ngâm', '2–3 ngày (nhiệt độ phòng)', 'Mùa hè: 2 ngày đủ'], true)
doc.moveDown(0.4)
noteBox('Lưu ý quan trọng: Cải phải phơi héo qua đêm (hoặc 6–8 tiếng) trước khi ngâm. Khi héo, cải mất bớt nước và sẽ không bị nhũn sau khi ngâm. Luôn dùng vật nặng đè cải xuống dưới mặt nước.')

doc.moveDown(0.5)

// ── MÓN 2: Cà muối ─────────────────────────────
subHead('② Cà Muối (cà pháo / cà bát)', RED)
const colsCa = [
  { label: 'Thành phần', w: CW * 0.32 },
  { label: 'Lượng dùng (/ 1 lít nước)', w: CW * 0.38 },
  { label: 'Ghi chú', w: CW * 0.30 },
]
tableHeader(colsCa)
tableRow(colsCa, ['Muối hạt thô', '40g  (= 3 thìa canh đầy)', 'Mặn hơn để bảo quản lâu'], false)
tableRow(colsCa, ['Đường trắng', '10g  (= 1 thìa canh)', 'Cân bằng vị mặn'], true)
tableRow(colsCa, ['Giấm gạo', 'Không cần', '—'], false)
tableRow(colsCa, ['Thời gian ngâm', '3–5 ngày', 'Cà bát cần 5 ngày'], true)
doc.moveDown(0.4)
noteBox('Lưu ý: Rạch một đường chữ thập trên đáy cà để nước ngấm vào bên trong. Đậy nắp kín, đè vật nặng. Cà đã ngâm đủ sẽ có màu vàng đều, không bị thâm hay xanh.')

pageFooter(2, 5)

// ══════════════════════════════════════════════════════════════════════
// PAGE 3 – QUÀ 1 tiếp theo
// ══════════════════════════════════════════════════════════════════════
doc.addPage()
bars(RED)
doc.moveDown(0.5)

// ── MÓN 3: Dưa chuột ────────────────────────────
subHead('③ Dưa Chuột Muối Chua', RED)
const colsDuaChuot = [
  { label: 'Thành phần', w: CW * 0.32 },
  { label: 'Lượng dùng (/ 1 lít nước)', w: CW * 0.38 },
  { label: 'Ghi chú', w: CW * 0.30 },
]
tableHeader(colsDuaChuot)
tableRow(colsDuaChuot, ['Muối hạt thô', '25g  (= 2 thìa canh)', 'Ít muối hơn để vị thanh'], false)
tableRow(colsDuaChuot, ['Đường trắng', '30g  (= 2.5 thìa canh)', 'Vị ngọt nhẹ dễ ăn'], true)
tableRow(colsDuaChuot, ['Giấm gạo', '50ml  (= 3.5 thìa canh)', 'Tạo vị chua nhanh'], false)
tableRow(colsDuaChuot, ['Tỏi + ớt', 'Tùy khẩu vị', 'Băm nhỏ cho vào nước ngâm'], true)
tableRow(colsDuaChuot, ['Thời gian ngâm', '1–2 ngày', 'Ăn được ngay sau 24h'], false)
doc.moveDown(0.4)
noteBox('Lưu ý: Cắt bỏ 2 đầu dưa chuột (đặc biệt đầu núm). Khứa nhẹ 4–5 đường dọc thân để nước ngâm thấm đều. Dưa chuột không cần phơi héo như dưa cải.')

doc.moveDown(0.6)

// ── MÓN 4: Su hào ───────────────────────────────
subHead('④ Su Hào Ngâm Chua Ngọt', ORANGE)
const colsSuHao = [
  { label: 'Thành phần', w: CW * 0.32 },
  { label: 'Lượng dùng (/ 1 lít nước)', w: CW * 0.38 },
  { label: 'Ghi chú', w: CW * 0.30 },
]
tableHeader(colsSuHao)
tableRow(colsSuHao, ['Muối hạt thô', '20g  (= 1.5 thìa canh)', 'Mặn nhẹ'], false)
tableRow(colsSuHao, ['Đường trắng', '50g  (= 4 thìa canh)', 'Ngọt đậm tạo vị đặc trưng'], true)
tableRow(colsSuHao, ['Giấm gạo', '100ml  (= 7 thìa canh)', 'Chua nhiều, giòn lâu'], false)
tableRow(colsSuHao, ['Thời gian ngâm', '4–6 tiếng là ăn được', 'Chua ngọt, giòn ngay'], true)
doc.moveDown(0.4)
noteBox('Lưu ý: Thái su hào mỏng 2–3mm để ngấm nhanh và đều. Không cần đun nước, có thể dùng nước nguội trộn đều muối + đường + giấm là ngâm được luôn. Bảo quản tủ lạnh dùng được 7–10 ngày.')

doc.moveDown(0.6)

// ── MÓN 5: Đồ chua ──────────────────────────────
subHead('⑤ Đồ Chua (Cà Rốt + Củ Cải Trắng)', ORANGE)
const colsDoChua = [
  { label: 'Thành phần', w: CW * 0.32 },
  { label: 'Lượng dùng (/ 1 lít nước)', w: CW * 0.38 },
  { label: 'Ghi chú', w: CW * 0.30 },
]
tableHeader(colsDoChua)
tableRow(colsDoChua, ['Muối hạt thô', '15g  (= 1 thìa canh)', 'Ít muối hơn vì ủ khô trước'], false)
tableRow(colsDoChua, ['Đường trắng', '80g  (= 6.5 thìa canh)', 'Ngọt đậm, màu đẹp'], true)
tableRow(colsDoChua, ['Giấm gạo', '200ml (= 14 thìa canh)', 'Chua mạnh, giữ màu tươi'], false)
tableRow(colsDoChua, ['Thời gian ngâm', '30 phút – 1 tiếng', 'Dùng ngay hoặc tủ lạnh'], true)
doc.moveDown(0.4)
noteBox('Bước quan trọng (KHÔNG bỏ qua): Sau khi thái sợi, rắc 1 thìa muối lên rau, trộn đều và ủ 15 phút. Sau đó VẮTÉP thật ráo nước (dùng tay bóp). Bước này giúp đồ chua giòn và thấm nước ngâm nhanh hơn nhiều. Màu cam đỏ của cà rốt sẽ đẹp hơn.')

doc.moveDown(0.6)
hr()
doc.font('b').fontSize(10).fillColor(RED)
  .text('⚡ MẸO VÀNG: ', ML, doc.y, { continued: true })
doc.font('n').fontSize(10).fillColor(DARK)
  .text('Luôn dùng nước đun sôi để nguội (không dùng nước máy lạnh). Nước máy có clo có thể ức chế quá trình lên men tự nhiên, làm dưa chua chậm hơn và đôi khi có mùi lạ.', { width: CW - 80 })

pageFooter(3, 5)

// ══════════════════════════════════════════════════════════════════════
// PAGE 4 – QUÀ 2: CHECKLIST 12 DẤU HIỆU
// ══════════════════════════════════════════════════════════════════════
doc.addPage()
bars(ORANGE)
doc.moveDown(0.5)

giftHeader('02', 'CHECKLIST 12 DẤU HIỆU CHỌN NGUYÊN LIỆU TƯƠI', ORANGE)

doc.font('n').fontSize(10.5).fillColor(GRAY)
  .text('In ra và mang theo chợ – kiểm tra trước khi mua để đảm bảo dưa ngon, giòn, bảo quản được lâu', { width: CW })
doc.moveDown(0.8)

// Nhóm 1
subHead('NHÓM 1: NHÌN – Quan sát bằng mắt  👁️', ORANGE)
check('Màu sắc tươi sáng, bóng tự nhiên – không úa vàng, không thâm đen hay đốm nâu')
check('Bề mặt không có vết dập, thối, mốc trắng hoặc chảy nhớt')
check('Lá/vỏ còn nguyên, không rách nát, không có lỗ sâu đục')
check('Khi mua cả bó: cuống cắt còn ướt, xanh – không bị khô và đen ở đầu cuống')

doc.moveDown(0.3)

// Nhóm 2
subHead('NHÓM 2: SỜ – Kiểm tra bằng tay  ✋', ORANGE)
check('Cầm lên thấy chắc tay, nặng so với kích thước – rau/củ đủ nước bên trong')
check('Vỏ không bị nhăn, không khô héo – nhăn vỏ = đã để lâu, mất nước')
check('Bóp nhẹ không thấy mềm nhão – nhão = đã ủng bên trong')
check('Gõ nhẹ vào thân củ nghe tiếng đặc, không rỗng – rỗng = lõi bị hư hoặc già')

doc.moveDown(0.3)

// Nhóm 3
subHead('NHÓM 3: NGỬI – Kiểm tra bằng mũi  👃', ORANGE)
check('Có mùi tự nhiên đặc trưng của loại rau/củ đó – cải có mùi hăng nhẹ, cà có mùi thơm đặc')
check('Không có mùi chua lên men, mùi thối hoặc mùi hóa chất bảo quản lạ')

doc.moveDown(0.3)

// Nhóm 4
subHead('NHÓM 4: HỎI & CHỌN THỜI ĐIỂM MUA  🕐', ORANGE)
check('Mua ở chợ lúc 6h–8h sáng: hàng mới nhập từ đêm/sáng sớm, chưa bị nắng làm héo')
check('Hỏi người bán: "Hàng về lúc mấy giờ sáng nay?" – hàng về sáng cùng ngày là tươi nhất')

doc.moveDown(0.8)

// Summary box
const y4 = doc.y
doc.rect(ML, y4, CW, 70).fill(ORANGE + '18')
doc.rect(ML, y4, 4, 70).fill(ORANGE)
doc.font('b').fontSize(11).fillColor(ORANGE).text('TÓM TẮT NHANH', ML + 14, y4 + 10)
doc.font('n').fontSize(10).fillColor(DARK)
  .text('Nguyên liệu tươi = màu đẹp + chắc tay + mùi tự nhiên + mua buổi sáng sớm.', ML + 14, y4 + 26, { width: CW - 28 })
doc.font('n').fontSize(10).fillColor(DARK)
  .text('Nguyên liệu kém tươi sẽ làm dưa nhanh hỏng, mùi lạ và khó bảo quản lâu dù tỷ lệ ngâm chuẩn.', ML + 14, doc.y + 2, { width: CW - 28 })
doc.y = y4 + 78

pageFooter(4, 5)

// ══════════════════════════════════════════════════════════════════════
// PAGE 5 – QUÀ 3: BÍ QUYẾT BẢO QUẢN
// ══════════════════════════════════════════════════════════════════════
doc.addPage()
bars(GREEN)
doc.moveDown(0.5)

giftHeader('03', 'BÍ QUYẾT BẢO QUẢN GIỮ DƯA GIÒN 30 NGÀY', GREEN)

doc.font('n').fontSize(10.5).fillColor(GRAY)
  .text('6 bí quyết này áp dụng cho cà muối, dưa cải, dưa chuột – bất kỳ loại ngâm nào', { width: CW })
doc.moveDown(0.8)

// Bí quyết 1
subHead('BÍ QUYẾT 1: Tỷ Lệ Muối Đúng Là Nền Tảng', GREEN)
bullet('Muối ít quá → lên men không đủ → dưa chua nhanh, hỏng trong 3–5 ngày')
bullet('Muối nhiều quá → mặn chát, nhưng bảo quản được 30–45 ngày dễ dàng')
bullet('Nguyên tắc vàng: 3–4% muối theo trọng lượng nước = 30–40g muối / 1 lít nước')
tip('Tip quan trọng:', 'Dùng muối hạt thô (muối biển, muối hầm) – KHÔNG dùng muối iốt bột mịn. Muối iốt có thể làm mềm rau và làm chậm quá trình lên men tự nhiên.')

doc.moveDown(0.3)

// Bí quyết 2
subHead('BÍ QUYẾT 2: Dụng Cụ Và Hũ Đựng Đúng Chuẩn', GREEN)
bullet('Dùng hũ thủy tinh (tốt nhất) hoặc hũ sành sứ – TUYỆT ĐỐI không dùng hũ nhựa mỏng')
bullet('Hũ phải rửa sạch, tráng nước sôi và để KHÔ HOÀN TOÀN trước khi dùng')
bullet('Đậy nắp kín sau mỗi lần lấy – tránh bụi, côn trùng và không khí vào')
bullet('Không dùng thìa/đũa kim loại để lấy dưa – dễ bị gỉ sét nhiễm vào hũ')

doc.moveDown(0.3)

// Bí quyết 3
subHead('BÍ QUYẾT 3: Ép Nguyên Liệu Ngập Hoàn Toàn', GREEN)
bullet('Rau/củ PHẢI ngập 100% dưới mặt nước ngâm – không để nổi lên')
bullet('Phần nổi lên tiếp xúc không khí → mốc và thối trong 1–2 ngày')
bullet('Cách đơn giản nhất: cho túi ziplock chứa nước vào trên cùng để đè')
bullet('Hoặc dùng đĩa nhỏ vừa miệng hũ để đè rau xuống')

doc.moveDown(0.3)

// Bí quyết 4
subHead('BÍ QUYẾT 4: Kiểm Soát Nhiệt Độ Đúng Giai Đoạn', GREEN)
bullet('Giai đoạn lên men (1–3 ngày đầu): để ở nhiệt độ phòng 25–30°C', 0, DARK)
bullet('Sau khi đã chua đúng vị: chuyển vào ngăn mát tủ lạnh 4–8°C ngay', 0, DARK)
bullet('Tủ lạnh làm chậm vi khuẩn → dưa không chua thêm, giữ được 25–30 ngày', 0, DARK)
tip('Bảo quản không tủ lạnh:', 'Để ở nơi thoáng mát, tránh ánh nắng trực tiếp. Dùng trong 7–10 ngày. Thêm muối (5–10g) để giữ được lâu hơn – phù hợp khi bán hàng số lượng lớn.')

doc.moveDown(0.3)

// Bí quyết 5
subHead('BÍ QUYẾT 5: Tránh Nhiễm Khuẩn Khi Sử Dụng', GREEN)
bullet('Tay phải sạch và khô khi lấy dưa – không lấy khi tay còn dầu mỡ thức ăn')
bullet('Dùng đũa/thìa khô sạch riêng, không dùng đồ dùng đã ăn dở')
bullet('Lấy đủ lượng ăn rồi đậy nắp ngay, không để hở lâu')
bullet('Nếu thấy váng trắng mỏng nổi lên: đây là men lên men tự nhiên, vớt bỏ và dưa vẫn ăn được')

doc.moveDown(0.3)

// Bí quyết 6
subHead('BÍ QUYẾT 6: Nhận Biết Dưa Đã Hỏng', GREEN)
bullet('❌ Mùi: hôi, thối – khác hẳn với mùi chua tự nhiên thơm nhẹ')
bullet('❌ Màu: thay đổi bất thường (xanh đậm, đen, nâu sẫm)')
bullet('❌ Kết cấu: nhớt và nhũn hoàn toàn – không còn độ giòn')
bullet('❌ Mốc: thấy mốc xanh/đen trên bề mặt → bỏ toàn bộ, không ăn')
bullet('✅ Dưa tốt: mùi chua thơm dịu, màu tươi đều, vẫn còn giòn khi cắn')

doc.moveDown(0.5)
const yFinal = doc.y
doc.rect(ML, yFinal, CW, 42).fill(GREEN + '18')
doc.rect(ML, yFinal, 4, 42).fill(GREEN)
doc.font('b').fontSize(10.5).fillColor(GREEN)
  .text('Chúc bạn làm dưa ngon và bảo quản thành công! 🥒', ML + 14, yFinal + 8, { width: CW - 28 })
doc.font('n').fontSize(10).fillColor(DARK)
  .text('Khóa học đầy đủ sẽ hướng dẫn chi tiết từng bước với video minh họa. Bất kỳ câu hỏi nào hãy nhắn tin cho Cô Hạ nhé!', ML + 14, doc.y + 2, { width: CW - 28 })

pageFooter(5, 5)

// ── DONE ──────────────────────────────────────────────────────────────────
doc.end()
stream.on('finish', () => console.log('✅ PDF tạo xong:', OUT))
stream.on('error', (e) => { console.error('❌ Lỗi:', e); process.exit(1) })
