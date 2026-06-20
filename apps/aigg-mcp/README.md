# aigg-mcp — Bridge MCP mỏng cho AI Governance Gateway

Cho phép các tool lập trình AI (**Claude Code, Codex, Cursor, Gemini CLI**…) "giao việc" và map
`task_id` thông qua MCP. Bridge **không chứa logic** — nó chỉ:

1. Lấy danh sách tool **động** từ Node-RED (`GET /manifest`).
2. Forward mọi lời gọi tool về Node-RED (`POST /invoke`) kèm **context** (cwd, git branch, active task, token).

Mọi nghiệp vụ (gọi Gateway, quyết định response, trigger noti…) đặt ở **Node-RED** → đổi logic không cần build lại.

## Cài & build

```bash
cd apps/aigg-mcp
npm install
npm run build      # ra dist/index.js
```

## Cấu hình (biến môi trường)

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `AIGG_NODE_RED_URL` | `http://localhost:1880/aigg` | Gốc webhook Node-RED (expose `/manifest`, `/invoke`). |
| `AIGG_TOKEN` | — | Token định danh (internal `storo_live_` hoặc JWT) forward xuống Node-RED. |
| `AIGG_TASK_ID` | — | Task khởi tạo (đổi runtime bằng `aigg_set_active_task`). |
| `AIGG_PROJECT_ID` | — | Dự án mặc định (tùy chọn). |

## Đăng ký vào tool AI

**Claude Code** (`.mcp.json` trong workspace hoặc `claude mcp add`):
```json
{
  "mcpServers": {
    "aigg": {
      "command": "node",
      "args": ["/duong-dan/apps/aigg-mcp/dist/index.js"],
      "env": { "AIGG_NODE_RED_URL": "http://localhost:1880/aigg", "AIGG_TOKEN": "storo_live_..." }
    }
  }
}
```
**Cursor** (`.cursor/mcp.json`) và **Codex / Gemini CLI**: cùng dạng `command` + `args` + `env` (stdio).

## Tool built-in (luôn có)

- `aigg_invoke(action, payload)` — escape hatch vạn năng → forward về Node-RED.
- `aigg_set_active_task(taskId)` — đặt X-Task-ID cho phiên.
- `aigg_context()` — xem cwd / git branch / active task.

Tool khác do Node-RED khai báo qua `/manifest` (chuẩn MCP: `name`, `description`, `inputSchema`).

## Hợp đồng Node-RED

**`GET /manifest`** → `{ "tools": [ { "name": "...", "description": "...", "inputSchema": {...} } ] }`

**`POST /invoke`** ← bridge gửi:
```json
{
  "tool": "ten_tool",
  "arguments": { },
  "context": { "cwd": "...", "gitBranch": "...", "activeTaskId": "...", "projectId": "..." }
}
```
→ Node-RED trả JSON hoặc text (bridge bọc thành nội dung text trả về cho agent).

Xem `node-red-flow.sample.json` để import nhanh một flow mẫu (manifest + invoke).
