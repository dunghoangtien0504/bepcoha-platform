# Bóc tách khung hình Buổi 2 (chị Hà · EasyERP) → bản dựng HACO (27/10/2026)

Cách làm: dùng AVFoundation (Swift) cắt khung hình bài 10–16, chỉ giữ khung khi màn hình đổi (chênh lệch điểm ảnh > ngưỡng),
ghép thành bảng xem có mốc thời gian, rồi phóng to vùng giao diện. 7 bài → ~250 khung có thay đổi.

**Giới hạn:** phần demo trực tiếp bị **làm mờ có chủ ý** trong video khoá học (trường `che` của khoa-hoc.json):
bài 11 (0:01–0:58, 2:17–3:49, 8:31–10:12, 11:00–14:28), bài 12 (3:11–3:55, 5:21–6:43), bài 15 (0:03–3:27), bài 16 gần hết.
Khung rõ còn lại: menu EasyERP + "Giao việc Cửa hàng" (bài 11 · 10:56), Vòng quay (bài 12 · 2:53–2:56, 5:20),
toàn bộ luồng Ví (bài 12 · 4:02–4:49), màn đăng nhập (bài 15 · 0:00). Màn chấm công trên điện thoại, xếp ca, Bảng Vàng,
Chuỗi bị mờ → chỉ biết bố cục thô + mô tả lời nói; phần đó HACO tự thiết kế, không chép.

## 1. Khung giao diện (shell)
- Nền sáng (trắng/kem), chữ xám đậm; màu nhấn **vàng hổ phách** (nút chính "Đổi voucher", "Áp tuần mẫu", mục đang chọn); xanh ngọc làm màu phụ (nút "Đóng").
- **Thanh bên trái trắng**: logo EasyERP + 3 icon (lịch sử, lưới ứng dụng, trợ giúp) · ô **"Tìm tính năng, trang… Ctrl K"** ·
  chọn điểm làm việc ("E08 – 6th Element…") · các **PHÂN HỆ** viết hoa, gập/mở: Quản trị, TaskList, Đào tạo, Chấm công, Sân chơi.
  Trong phân hệ có nhóm con (TaskList: CÀI ĐẶT / QUẢN TRỊ TASK / VẬN HÀNH TASK). Mục đang mở: nền vàng nhạt + vạch trái vàng.
  Đáy: thẻ người dùng (avatar, tên, vai trò) + hộp thư + hồ sơ + đăng xuất (đỏ).
- **Thanh tab trang đã mở** phía trên (như tab trình duyệt, có nút ×): "Ca mẫu · Chỉ tiêu ca · Xếp ca · Tổng quan · Giao việc Cửa hàng".
- Tiêu đề trang có icon vuông nền tím nhạt.

## 2. Menu đầy đủ đọc được
- **TaskList** — Cài đặt: Mẫu công việc (Cha) · Nhóm & Loại công việc · Việc con (Cửa hàng) · Giao việc Cửa hàng.
  Quản trị task: Task Tự Quản · Kiểm tra CTKM cửa hàng · Quản lý thiết bị. Vận hành task: Giao việc Cá nhân · Báo cáo TaskList · Báo cáo QC tháng · Đề nghị miễn KPI.
- **Chấm công** (tab): Ca mẫu · Chỉ tiêu ca · Xếp ca · Tổng quan.
- **Sân chơi**: Vòng quay của tôi · Vòng quay Trung thu · Săn Số Vàng · Bảng Vàng · Chuỗi của tôi · Tổ đội · Cấp / Bỏ lượt ·
  Danh sách trúng Trung thu · Quản trị Vòng Quay · Quản trị Săn Số Vàng · Quỹ lượt quay · Báo cáo.

## 3. "Giao việc Cửa hàng" (lưới tuần)
Lọc "Tất cả siêu thị" · điều hướng **Tuần 39 21/09–27/09** ‹ › · Hôm nay · Sao chép · Copy tuần trước · Lưu thành mẫu · **Áp tuần mẫu** · Mở khoá.
"Hiện bộ phận: Có phân quyền | Tất cả". Chú giải màu: Đã giao (chưa làm) · Đã giao NV · Chờ duyệt · Đã duyệt · Không HT · Chưa giao · Khoá (quá khứ/đã duyệt).

## 4. Sân chơi (cột giữa hẹp, kiểu app điện thoại)
- 7 tab: Vòng quay · Ví của tôi · Bảng tin · Săn Số Vàng · Bảng Vàng · Chuỗi của tôi · Tổ đội.
- Thẻ đầu: avatar chữ tắt, tên, **"1020 lượt quay · 940.000đ Ví ›"**, nút **Âm thanh**.
- Thẻ **VÒNG QUAY MAY MẮN · 17 phần quà** — "Mỗi lượt quay chắc chắn có quà"; bánh xe màu cầu vồng pastel, kim bên trái,
  nút giữa vàng "QUAY NGAY", chấm đèn quanh vành; "Xem quy tắc cấp lượt ›"; "Thể lệ v1.4 · cập nhật 18/09/2026".
  Ô quà gồm: chữ cái (E, A, S, Y, M, R, T…), tiền (10K), coupon 10/15/20%, quà hiện vật (bút, giấy, mực).
- **Kho chữ EASYMART** (0/20 chữ): cụm EASY 0/4, MART 0/4 — ghép đủ cụm thì nhận giải.
- **Ví của tôi** — 3 ví: Ví tiền thưởng · Ví chữ · Ví Voucher/Coupon.
  Số dư lớn + nút vàng **Đổi voucher** → hộp mệnh giá 10.000đ (hạn 5 ngày) / 20.000đ / 50.000đ / 100.000đ (hạn 3 ngày), "mỗi hoá đơn áp dụng 1 voucher".
  **Sổ giao dịch**: tên giao dịch, giờ · diễn giải, số tiền ±, **"Số dư: …" sau mỗi dòng**; có hoàn tiền voucher hết hạn, hoàn tiền chữ khi reset vòng quay.
  Thông báo xanh đáy màn: "Đã đổi voucher 10.000đ — mã KV10K-ZKDPP, hạn 5 ngày".
  **Voucher mua hàng nội bộ**: mệnh giá to, **mã vạch**, mã, hạn dùng, trạng thái, "Đưa mã này cho thu ngân quét khi thanh toán".
  Danh sách: nhãn Voucher (xanh) / Coupon (cam), Còn hạn / Hết hạn / Đã hoàn tiền, HSD.
- Linh vật EasyMy "danh đá" · Chuỗi khoa bảng (bị mờ — chỉ có lời: thưởng theo ngày giữ chuỗi, đi muộn là đứt).

## 5. HACO dựng thế nào (khác Easymart ở đâu)
- Màu: giữ bố cục sáng của EasyERP, nhưng dùng màu thương hiệu HACO (xanh lá #006E32, vàng #C28A12) — nhấn vàng, phụ xanh.
- Bỏ "Điểm làm việc nhiều siêu thị" → HACO 1 bếp + 1 kho; ô chọn chỉ hiện điểm làm việc đang có.
- Kho chữ **HACO FOOD** (HACO / FOOD) thay EASYMART; tiền ghép chữ **tính vào trần ngân sách chung** (phản biện CEO lần 1).
- Voucher đổi ở **kho HACO** (thủ kho nhập/quét mã) thay vì thu ngân siêu thị; hết hạn chưa dùng → tự hoàn tiền về ví.
- "Săn Số Vàng", "Vòng quay Trung thu": không rõ luật (bị mờ) → chưa làm, không bịa.

## 6. Phản biện CEO vòng 2 (28/10) — đã áp dụng
- **Kho chữ giữ lại nhưng không thủng ngân sách:** ô chữ lấy chỗ ô 2k (2k 40% → 20%, chữ 20%); chữ hiếm C, D = 3% phần chữ;
  HACO 30k, FOOD 30k, đủ cả hai +70k; mỗi cụm 1 lần/người/tháng; tiền ghép chữ tính vào trần chung, hết tuần thì xếp hàng trả tuần sau;
  chữ lẻ không ra tiền, hết quý làm mới. Tiền trung bình còn ≈ 4.100đ/lượt. Thể lệ ghi tỷ lệ thật từng ô.
- **Voucher kho:** 20k/50k/100k, hạn 7 ngày, tối đa 2/tuần, ghi tên người đổi, không thối tiền; thủ kho quét bằng camera (Code 128, đã thử giải mã đúng)
  hoặc gõ mã, trong khung 16:30–17:30 (quản trị được ngoài giờ); không tự nhận voucher của mình; hết hạn tự hoàn 1 lần, sau đó chờ 7 ngày.
  Cộng lương 100k–300k/tháng, kế toán duyệt. *Chưa làm:* tự sinh phiếu xuất kho/trừ tồn (CRM chưa có tồn kho) — hiện là danh sách phiếu xuất voucher.
- **Cấp/Bỏ lượt:** chỉ quyền Cài đặt; không tự cấp; lý do chọn sẵn + ghi chú; quỹ 60 lượt/tháng; quá 5 lượt cần người thứ hai; bỏ lượt chỉ lượt chưa quay, ghi dòng âm.
- **Điện thoại:** ẩn thanh bên, Ctrl K, tab trang; thanh đáy 4 nút Chấm công · Việc · Sân chơi · Tôi; Sân chơi 3 tab + "Thêm".

## 7. Đã dựng (28/10)
Khung mới (thanh bên trắng, phân hệ gập/mở, Ctrl K tìm không dấu, tab trang đã mở, thẻ người dùng, màu HACO) ·
Sân chơi 7 trang chơi (Vòng quay, Ví 3 ngăn, Chuỗi có lịch 5 tuần, Bảng tin, Bảng Vàng, Tổ đội, Luật chơi) + 5 trang quản trị
(Quét voucher tại kho, Cấp/Bỏ lượt, Quản trị vòng quay, Quỹ, Báo cáo) · **Giao việc theo tuần** (lưới người × ngày, màu trạng thái, tuần ISO).
Chưa làm: Săn Số Vàng và Vòng quay Trung thu (luật bị làm mờ), đổi giao diện trang đăng nhập.
