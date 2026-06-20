# AI Governance Gateway — VSCode Extension

Đăng nhập AI Governance Gateway và **giao việc cho AI ngay trong VSCode**, tránh phải gõ tay
lại mã task (giảm sai sót). Hỗ trợ 2 gói dịch vụ:

- **Gói API key doanh nghiệp** — extension cấu hình định tuyến request AI qua Gateway kèm header
  governance (`X-Task-ID`, `X-Project-ID`, `X-Conversation-ID`). Gateway proxy + enforce hạn ngạch token.
- **Gói Claude Pro cá nhân** — Gateway không proxy được subscription; extension gán task + **báo cáo
  usage ước tính** về Gateway để dashboard vẫn quy chi phí theo User · Project · Task.

## Tính năng

| Lệnh | Mô tả |
|---|---|
| `AIGG: Đăng nhập` | Email + mật khẩu tài khoản Gateway; tự lấy internal token (`storo_live_`). |
| `AIGG: Giao việc cho AI` | Chọn từ **Công việc của tôi** (tạo ai_task), **AI task đã có**, hoặc **tạo mới**. |
| `AIGG: Cấu hình định tuyến` | Ghi `.aigg/routing.json` + mẫu Continue.dev trỏ qua Gateway (gói API key). |
| `AIGG: Copy headers/cURL` | Copy lệnh cURL kèm token + headers của task đang hoạt động. |
| `AIGG: Báo cáo usage` | Gửi usage ước tính (gói Claude Pro). |
| `AIGG: Xem hạn ngạch token` | Hạn ngạch DAILY/WEEKLY/MONTHLY/TASK (ngân sách token theo task có fallback). |

## Cấu hình (Settings)

- `aigg.baseUrl` — địa chỉ Gateway (mặc định `http://localhost:3900`).
- `aigg.serviceTier` — `api_key` hoặc `claude_pro`.
- `aigg.estimationModel` — model ước lượng token khi báo cáo usage.

## Cài đặt (dành cho người dùng — không cần biết code)

Bạn chỉ cần **file `aigg-vscode.vsix`** (người quản trị gửi cho bạn). Có 3 cách cài, chọn 1:

1. **Kéo–thả:** mở VSCode → kéo file `aigg-vscode.vsix` thả vào cửa sổ VSCode → bấm *Install*.
2. **Từ menu Extensions:** mở VSCode → biểu tượng Extensions (Ctrl/Cmd+Shift+X) → bấm nút **…** ở góc trên →
   *Install from VSIX…* → chọn file `aigg-vscode.vsix`.
3. **Một dòng lệnh:** `code --install-extension aigg-vscode.vsix`

Cài xong: mở Command Palette (Ctrl/Cmd+Shift+P) → gõ **“AIGG: Đăng nhập”** để bắt đầu. Biểu tượng
🛡️ AI Governance Gateway xuất hiện ở thanh bên trái.

## Đóng gói file cài đặt (.vsix) — dành cho người quản trị

```bash
cd apps/vscode-extension
npm install            # cài deps (đã kèm sẵn công cụ đóng gói vsce)
npm run package        # tạo aigg-vscode.vsix (tự build trước khi đóng gói)
```

Tùy chọn cài thẳng vào VSCode đang mở (cần đã bật lệnh `code` trong PATH —
VSCode → Command Palette → "Shell Command: Install 'code' command in PATH"):

```bash
npm run install:code   # đóng gói + cài vào VSCode (code --install-extension)
```

Gửi file `aigg-vscode.vsix` cho thành viên non-tech để họ cài theo 3 cách ở trên.

## Phát triển / chạy thử

```bash
npm run build          # biên dịch TypeScript sang dist/
npm run watch          # build lại tự động khi sửa code
# Nhấn F5 trong VSCode để mở Extension Development Host chạy thử
```

## Bảo mật

JWT + internal token lưu trong **VSCode SecretStorage** (không ghi ra file). `.aigg/routing.json`
chỉ tham chiếu biến môi trường `AIGG_TOKEN`, không chứa token; thư mục `.aigg/` tự được thêm vào `.gitignore`.
