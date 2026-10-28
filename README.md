# Haco-OS — web bán hàng, khoá học và HACO CRM của Bếp Cô Hạ

> **Kho công khai của Bếp Cô Hạ (HACO Food).**
> - **Không có khoá hay dữ liệu khách.** Mọi khoá bí mật lấy từ biến môi trường (`.env.local`, mẫu ở `.env.example`). Dữ liệu khách nằm trong database riêng, không bao giờ commit.
> - **Chạy thử:** `npm install` → `npm run dev:db` (PostgreSQL chạy trên máy, cổng 54329) → `npm run seed:dev` → `npm run dev`. Mật khẩu tài khoản thử được sinh ngẫu nhiên vào `.devdb/` trên máy bạn.
> - **Sơ đồ:** Pancake POS là nguồn số liệu đơn và khách; CRM ở `/crm`; API Mini App ở `/api/mini/*`; Mini App ở `/m`, build từ kho [`bepcoha-miniapp`](https://github.com/dunghoangtien0504/bepcoha-miniapp).
> - **Bản quyền:** lịch sử cũ của kho có mã bên thứ ba theo giấy phép AGPL, giữ nguyên ghi chú giấy phép gốc. Tên, logo, ảnh và công thức của Bếp Cô Hạ thuộc HACO Food, không dùng lại khi chưa được phép.
> - **Báo lỗi bảo mật:** nhắn riêng cho Bếp Cô Hạ qua Zalo 0965240587, đừng mở issue công khai.


Một ứng dụng Next.js 16 gồm:

- **Trang bán hàng & khoá học** (`/set-xoi-com`, `/sot-xa-xiu`, `/khan-do-xoi`, `/sot-tron-nom`, `/rau-ma-dau-xanh`, `/dua-ca-muoi`, `/khoahocduacamuoi`) — đặt hàng, SePay, Pancake POS, Telegram, email.
- **HACO CRM** (`/crm`) — chăm sóc khách theo vòng đời, việc hằng ngày, cơ hội bán, chiến dịch có nhóm đối chứng, QR & Mini App, chấm công & xếp ca, báo cáo, phân quyền, nhật ký. Hướng dẫn vận hành CRM là tài liệu nội bộ, không có trong kho công khai.
- **API cho Mini App khách** (`/api/mini/*`, do phiên "Mini app Zalo OA" viết) và bản build Mini App tại `/m`.

Nguồn sự thật về khách hàng và đơn hàng là **Pancake POS** (CRM chỉ đọc, đồng bộ mỗi giờ). Dữ liệu nằm trên PostgreSQL (Supabase).

## Chạy trên máy

Cần Node ≥ 20 (máy này dùng `~/.local/node`).

```bash
npm install
npm run dev:db        # PostgreSQL dev trong máy (cửa sổ riêng, giữ mở)
npm run seed:dev      # nạp đơn Pancake đã xuất, sản phẩm, tài khoản thử → .devdb/tai-khoan-thu.txt
node scripts/dev.mjs 3030
```

`.env.local` trên máy trỏ vào database dev (`127.0.0.1:54329/haco_dev`), không phải Supabase. Mẫu biến môi trường: `.env.example`.

## Kiểm thử

```bash
npm test          # logic thuần
npm run test:db   # thêm các test trên PostgreSQL (database haco_test, tự xoá tạo lại mỗi lần)
```
