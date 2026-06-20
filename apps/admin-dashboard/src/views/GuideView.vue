<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';

type Method = 'apikey' | 'pro' | 'mcp';

const router = useRouter();
const method = ref<Method>('apikey');

interface Step {
  title: string;
  body: string;
  code?: string;
}

// 1.1 — Đo lường REALTIME qua API key nhà cung cấp (luồng GATEWAY/proxy).
const apiKeySteps: ReadonlyArray<Step> = [
  {
    title: 'Khai báo API key nhà cung cấp cho Gateway',
    body: 'Đặt khóa của OpenAI hoặc Anthropic vào biến môi trường để Gateway có thể gọi LLM thật và đọc usage chính xác trả về trong luồng SSE.',
    code: '# apps/backend-gateway/.env\nOPENAI_API_KEY=sk-...\nANTHROPIC_API_KEY=sk-ant-...',
  },
  {
    title: 'Lấy internal token của nhân viên',
    body: 'Mỗi nhân viên có một token nội bộ dạng storo_live_... dùng để xác thực với Gateway (không phải API key thật của nhà cung cấp). Token demo có sẵn sau khi seed dữ liệu.',
    code: 'storo_live_demo_dev_token_0001',
  },
  {
    title: 'Cấu hình IDE (Continue.dev / Cursor) trỏ về Gateway',
    body: 'Đổi apiBase sang Gateway và đặt header X-Task-ID cho mỗi phiên làm việc. Gateway đóng vai reverse proxy: nhận prompt, kiểm tra hạn ngạch, chuyển tiếp tới nhà cung cấp rồi đo usage.',
    code: '{\n  "models": [{\n    "title": "AIGG Proxy",\n    "provider": "openai",\n    "model": "claude-3-5-sonnet",\n    "apiBase": "http://localhost:3900/v1",\n    "apiKey": "storo_live_demo_dev_token_0001",\n    "requestOptions": { "headers": { "X-Task-ID": "TERO-102" } }\n  }]\n}',
  },
  {
    title: 'Làm việc bình thường trong IDE',
    body: 'Mỗi lần chat/hoàn thiện code, request đi qua POST /v1/chat/completions. Gateway kiểm tra hạn ngạch token theo thời gian thực, stream phản hồi (SSE), rồi đọc usage THẬT từ nhà cung cấp và ghi nhật ký kiểm toán bất đồng bộ với source = GATEWAY.',
  },
  {
    title: 'Xem hiệu quả & chi phí',
    body: 'Mở Bảng điều khiển và trang Quản lý Công việc để xem chi phí AI (USD/VND), giờ baseline so với giờ thực tế, và giá trị nhân công tiết kiệm theo từng task/dự án.',
  },
];

// 1.2 — Đo lường ESTIMATED từ gói cá nhân (Claude Pro): không có API realtime.
const proSteps: ReadonlyArray<Step> = [
  {
    title: 'Tạo dự án & công việc kèm giờ baseline',
    body: 'Vào Quản lý Công việc → tạo dự án và các task. Trường baseline_hours (giờ ước tính nếu làm thủ công) là cơ sở để tính giá trị tiết kiệm khi có AI hỗ trợ.',
  },
  {
    title: 'Sau mỗi phiên làm việc với Claude Pro, ghi nhận usage',
    body: 'Gói cá nhân không có API đo realtime, nên ta ước lượng token từ nội dung prompt/đầu vào (~4 ký tự/token) cùng đơn giá tham chiếu. Dùng trang “Đo lường AI Usage” — chọn chế độ CHAT (chat trên file code) hoặc API (payload làm prompt), dán nội dung và bấm Đo lường.',
  },
  {
    title: 'Hoặc ghi nhận tự động bằng CLI / git hook',
    body: 'Dùng script report-usage.mjs để gửi nội dung tới Gateway từ terminal. Bản ghi có source = ESTIMATED, captureMode = CHAT/API. Cần JWT đăng nhập (--token hoặc biến môi trường AIGG_JWT).',
    code: 'node ide-configs/report-usage.mjs \\\n  --task AIGG-UI --requester dev@storo.vn \\\n  --file src/views/GuideView.vue --mode CHAT \\\n  --model claude-3-5-sonnet',
  },
  {
    title: 'Hệ thống ước tính token + chi phí tham chiếu',
    body: 'Gateway tính promptTokens + completionTokens + overhead, nhân đơn giá mô hình (vd claude-3-5-sonnet: $3/1M input, $15/1M output) và áp hệ số OT nếu ngoài giờ hành chính, rồi lưu vào nhật ký kiểm toán.',
  },
  {
    title: 'Theo dõi ROI theo nguồn ESTIMATED',
    body: 'Trang Đo lường AI Usage hiển thị thống kê theo nguồn dữ liệu; Bảng điều khiển và Quản lý Công việc tổng hợp chi phí AI so với giá trị giờ công tiết kiệm.',
  },
];

// VSCode Extension — cách nhanh cho luồng 1.1 (gói API key, đo realtime qua Gateway).
const apiKeyExtSteps: ReadonlyArray<Step> = [
  {
    title: 'Cài extension & chọn gói API key',
    body: 'Cài extension “AI Governance Gateway” (apps/vscode-extension → nhấn F5 để chạy thử, hoặc đóng gói .vsix rồi Install). Vào Settings đặt aigg.baseUrl và aigg.serviceTier = api_key.',
    code: '// .vscode/settings.json\n{\n  "aigg.baseUrl": "http://localhost:3900",\n  "aigg.serviceTier": "api_key"\n}',
  },
  {
    title: 'Đăng nhập ngay trong VSCode',
    body: 'Mở Command Palette → “AIGG: Đăng nhập”, nhập email + mật khẩu tài khoản Gateway. Extension tự lấy internal token (storo_live_...) của bạn và lưu an toàn trong SecretStorage.',
  },
  {
    title: 'Giao việc cho AI — không gõ tay mã task',
    body: 'Lệnh “AIGG: Giao việc cho AI” → chọn từ Công việc của tôi (tự tạo ai_task), AI task đã có, hoặc tạo task mới. Task hoạt động hiển thị trên status bar; X-Task-ID được gắn tự động, tránh sai sót.',
  },
  {
    title: 'Extension tự cấu hình định tuyến qua Gateway',
    body: 'Sau khi giao việc, extension ghi .aigg/routing.json + mẫu Continue.dev (apiBase trỏ Gateway, kèm header X-Task-ID, X-Project-ID, X-Conversation-ID). Đặt biến môi trường AIGG_TOKEN = internal token để client gọi qua Gateway; hoặc dùng “AIGG: Copy headers/cURL”.',
    code: 'export AIGG_TOKEN=storo_live_...   # token nội bộ của bạn',
  },
  {
    title: 'Làm việc bình thường — đo realtime + áp hạn ngạch',
    body: 'Request đi qua POST /v1/chat/completions như mục trên: source = GATEWAY, đo usage thật, áp hạn ngạch theo thời gian thực. Ngân sách token của task ưu tiên budget_tokens (đặt khi giao việc), thiếu thì fallback hạn mức task của user.',
  },
];

// VSCode Extension — cách nhanh cho luồng 1.2 (gói Claude Pro, báo cáo ESTIMATED).
const proExtSteps: ReadonlyArray<Step> = [
  {
    title: 'Chọn gói Claude Pro trong extension',
    body: 'Vào Settings đặt aigg.serviceTier = claude_pro và aigg.estimationModel (vd claude-3-5-sonnet). Đăng nhập bằng “AIGG: Đăng nhập”.',
    code: '// .vscode/settings.json\n{\n  "aigg.serviceTier": "claude_pro",\n  "aigg.estimationModel": "claude-3-5-sonnet"\n}',
  },
  {
    title: 'Giao việc cho AI để gắn ngữ cảnh task',
    body: 'Lệnh “AIGG: Giao việc cho AI” để chọn/tạo task hoạt động. Vì gói Pro không có API đo realtime, Gateway không proxy — extension chỉ gắn task để quy chi phí.',
  },
  {
    title: 'Sau phiên làm việc, báo cáo usage ước tính',
    body: 'Lệnh “AIGG: Báo cáo usage”, nhập số token prompt/completion ước tính. Extension gửi POST /v1/usage/ingest gắn đúng task hoạt động (kèm X-Project-ID, X-Conversation-ID), lưu source = ESTIMATED.',
  },
  {
    title: 'Theo dõi ROI như nguồn ESTIMATED',
    body: 'Bản ghi xuất hiện ở trang Đo lường AI Usage và được tổng hợp tại Bảng điều khiển / Quản lý Công việc — cùng cách với khi báo cáo qua trang web hoặc CLI.',
  },
];

/* ===== Tab 1.3 — Cấu hình MCP kết nối tool lập trình AI ===== */

// Chuẩn bị 1 lần (dành cho người quản trị / IT cài máy giúp).
const mcpPrep: ReadonlyArray<Step> = [
  {
    title: 'Bước 1 — Cài đặt MCP (làm 1 lần)',
    body: 'Mở Terminal, vào thư mục dự án và chạy 2 lệnh sau để cài & build bộ kết nối (aigg-mcp). Sau khi xong sẽ có file dist/index.js.',
    code: 'cd apps/aigg-mcp\nnpm install\nnpm run build',
  },
  {
    title: 'Bước 2 — Lấy "mã đăng nhập" (token)',
    body: 'Cần token để công cụ AI biết bạn là ai. Cách dễ nhất: mở VSCode extension “AIGG: Đăng nhập” (hoặc đăng nhập web), rồi sao chép token. Token này điền vào ô AIGG_TOKEN ở các cấu hình bên dưới.',
  },
  {
    title: 'Bước 3 — Đảm bảo Node-RED đang chạy',
    body: 'Bộ kết nối gửi yêu cầu qua Node-RED (đã cài sẵn). Mở http://localhost:1880/mdw để chắc chắn nó đang chạy. Không cần làm gì thêm.',
  },
];

// Cấu hình cho từng tool. Thay /ĐƯỜNG-DẪN bằng đường dẫn thật tới dự án.
interface McpToolGuide {
  tool: string;
  icon: string;
  where: string;
  code: string;
  note?: string;
}
const mcpTools: ReadonlyArray<McpToolGuide> = [
  {
    tool: 'Claude Code',
    icon: 'terminal',
    where: 'Tạo file .mcp.json ở thư mục gốc dự án (hoặc chạy lệnh nhanh bên dưới).',
    code:
      '// .mcp.json\n{\n  "mcpServers": {\n    "aigg": {\n      "command": "node",\n      "args": ["/ĐƯỜNG-DẪN/apps/aigg-mcp/dist/index.js"],\n      "env": {\n        "AIGG_NODE_RED_URL": "http://localhost:1880/aigg",\n        "AIGG_TOKEN": "DÁN_TOKEN_VÀO_ĐÂY"\n      }\n    }\n  }\n}',
    note: 'Cách nhanh (không cần tạo file): chạy  claude mcp add aigg --env AIGG_NODE_RED_URL=http://localhost:1880/aigg --env AIGG_TOKEN=... -- node /ĐƯỜNG-DẪN/apps/aigg-mcp/dist/index.js',
  },
  {
    tool: 'Cursor',
    icon: 'edit_note',
    where: 'Tạo file .cursor/mcp.json trong dự án (hoặc Settings → MCP → Add). Nội dung giống Claude Code.',
    code:
      '// .cursor/mcp.json\n{\n  "mcpServers": {\n    "aigg": {\n      "command": "node",\n      "args": ["/ĐƯỜNG-DẪN/apps/aigg-mcp/dist/index.js"],\n      "env": {\n        "AIGG_NODE_RED_URL": "http://localhost:1880/aigg",\n        "AIGG_TOKEN": "DÁN_TOKEN_VÀO_ĐÂY"\n      }\n    }\n  }\n}',
  },
  {
    tool: 'OpenAI Codex (CLI)',
    icon: 'code',
    where: 'Mở file ~/.codex/config.toml và thêm đoạn sau (định dạng TOML).',
    code:
      '# ~/.codex/config.toml\n[mcp_servers.aigg]\ncommand = "node"\nargs = ["/ĐƯỜNG-DẪN/apps/aigg-mcp/dist/index.js"]\nenv = { AIGG_NODE_RED_URL = "http://localhost:1880/aigg", AIGG_TOKEN = "DÁN_TOKEN_VÀO_ĐÂY" }',
  },
  {
    tool: 'Google Antigravity',
    icon: 'rocket_launch',
    where: 'Vào Settings → MCP / Plugins → Add MCP server, dán cấu hình kiểu “command + args + env” (giống mẫu JSON dưới).',
    code:
      '{\n  "mcpServers": {\n    "aigg": {\n      "command": "node",\n      "args": ["/ĐƯỜNG-DẪN/apps/aigg-mcp/dist/index.js"],\n      "env": {\n        "AIGG_NODE_RED_URL": "http://localhost:1880/aigg",\n        "AIGG_TOKEN": "DÁN_TOKEN_VÀO_ĐÂY"\n      }\n    }\n  }\n}',
    note: 'Antigravity (IDE agentic của Google) dùng chuẩn MCP — chỉ cần khai báo lệnh chạy node + đường dẫn + biến môi trường như trên.',
  },
  {
    tool: 'Công cụ khác hỗ trợ MCP',
    icon: 'extension',
    where: 'Bất kỳ tool nào hỗ trợ “MCP server (stdio)” đều khai báo 3 thứ: command = node, args = đường dẫn dist/index.js, env = AIGG_NODE_RED_URL + AIGG_TOKEN.',
    code:
      'command: node\nargs:    /ĐƯỜNG-DẪN/apps/aigg-mcp/dist/index.js\nenv:     AIGG_NODE_RED_URL=http://localhost:1880/aigg\n         AIGG_TOKEN=DÁN_TOKEN_VÀO_ĐÂY\n         (tùy chọn) AIGG_PROJECT_ID=2',
  },
];

// Sau khi cấu hình xong thì dùng thế nào.
const mcpUsage: ReadonlyArray<Step> = [
  {
    title: 'Khởi động lại công cụ AI',
    body: 'Tắt/mở lại tool (Claude Code, Cursor…) để nó nạp cấu hình mới. Khi thấy nhóm công cụ “aigg” là đã kết nối.',
  },
  {
    title: 'Nói chuyện tự nhiên — không cần nhớ lệnh',
    body: 'Gõ yêu cầu bằng tiếng Việt: “liệt kê công việc của tôi”, “giao việc này cho AI”, “xem hạn ngạch token”, “báo cáo usage”. AI sẽ tự gọi đúng công cụ và gắn task giúp bạn.',
  },
  {
    title: 'Mẹo: đặt tên nhánh git theo mã task',
    body: 'Đặt nhánh dạng AIGG-123-ten-viec (123 là mã công việc). Khi đó AI tự biết bạn đang làm task nào (gọi aigg_active_task) — khỏi chọn tay.',
    code: 'git checkout -b AIGG-123-toi-uu-dashboard',
  },
];
</script>

<template>
  <div class="space-y-6 p-6">
    <header>
      <h1 class="text-2xl font-bold text-slate-900">Hướng dẫn đo lường AI Usage</h1>
      <p class="text-sm text-slate-500">
        Hai cách đo mức tiêu thụ token &amp; hiệu quả khi lập trình với AI — tùy theo bạn dùng
        <strong>API key nhà cung cấp</strong> (đo realtime) hay <strong>gói cá nhân</strong> như Claude Pro (ước lượng).
      </p>
    </header>

    <div class="flex gap-2">
      <button
        class="flex-1 rounded-lg border px-4 py-3 text-left text-sm font-medium transition"
        :class="method === 'apikey' ? 'border-brand bg-brand/10 text-brand' : 'border-slate-200 text-slate-600 hover:bg-slate-50'"
        @click="method = 'apikey'"
      >
        <span class="material-symbols-rounded mr-1 align-middle text-[20px]">vpn_key</span>
        1.1 — Qua API key nhà cung cấp (REALTIME / GATEWAY)
      </button>
      <button
        class="flex-1 rounded-lg border px-4 py-3 text-left text-sm font-medium transition"
        :class="method === 'pro' ? 'border-brand bg-brand/10 text-brand' : 'border-slate-200 text-slate-600 hover:bg-slate-50'"
        @click="method = 'pro'"
      >
        <span class="material-symbols-rounded mr-1 align-middle text-[20px]">workspace_premium</span>
        1.2 — Từ gói cá nhân, vd Claude Pro (ESTIMATED)
      </button>
      <button
        class="flex-1 rounded-lg border px-4 py-3 text-left text-sm font-medium transition"
        :class="method === 'mcp' ? 'border-brand bg-brand/10 text-brand' : 'border-slate-200 text-slate-600 hover:bg-slate-50'"
        @click="method = 'mcp'"
      >
        <span class="material-symbols-rounded mr-1 align-middle text-[20px]">hub</span>
        1.3 — Kết nối MCP với Claude Code, Codex, Cursor, Antigravity…
      </button>
    </div>

    <!-- 1.1 -->
    <section v-if="method === 'apikey'" class="card">
      <div class="mb-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-700">
        Gateway đóng vai reverse proxy giữa IDE và nhà cung cấp LLM. Vì gọi API thật nên đọc được
        usage <strong>chính xác</strong> — không cần ước lượng. Không lưu nội dung code, chỉ lưu số liệu đo lường.
      </div>
      <ol class="space-y-4">
        <li v-for="(step, i) in apiKeySteps" :key="i" class="flex gap-3">
          <span class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">
            {{ i + 1 }}
          </span>
          <div class="flex-1">
            <p class="font-semibold text-slate-800">{{ step.title }}</p>
            <p class="mt-1 text-sm text-slate-600">{{ step.body }}</p>
            <pre v-if="step.code" class="mt-2 overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs leading-relaxed text-slate-100"><code>{{ step.code }}</code></pre>
          </div>
        </li>
      </ol>
      <div class="mt-6 rounded-lg border border-blue-200 bg-blue-50/50 p-4">
        <p class="flex items-center gap-2 font-semibold text-blue-800">
          <span class="material-symbols-rounded text-[20px]">extension</span>
          Cách nhanh: VSCode Extension “AI Governance Gateway”
        </p>
        <p class="mt-1 text-sm text-slate-600">
          Thay vì cấu hình tay, dùng extension để đăng nhập, giao việc cho AI và tự sinh cấu hình
          định tuyến qua Gateway (kèm header governance) ngay trong VSCode.
        </p>
        <ol class="mt-3 space-y-3">
          <li v-for="(step, i) in apiKeyExtSteps" :key="i" class="flex gap-3">
            <span class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
              {{ i + 1 }}
            </span>
            <div class="flex-1">
              <p class="text-sm font-semibold text-slate-800">{{ step.title }}</p>
              <p class="mt-1 text-sm text-slate-600">{{ step.body }}</p>
              <pre v-if="step.code" class="mt-2 overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs leading-relaxed text-slate-100"><code>{{ step.code }}</code></pre>
            </div>
          </li>
        </ol>
      </div>

      <button class="btn-primary mt-5" @click="router.push({ name: 'usage' })">
        Tới trang Đo lường AI Usage
      </button>
    </section>

    <!-- 1.2 -->
    <section v-else-if="method === 'pro'" class="card">
      <div class="mb-4 rounded-lg bg-violet-50 p-3 text-sm text-violet-700">
        Gói cố định (Claude Pro) không có API đo realtime. Ta vẫn ĐO ĐƯỢC bằng cách ước lượng token
        từ nội dung &amp; đơn giá tham chiếu, lưu nhật ký với nguồn <strong>ESTIMATED</strong>.
      </div>
      <ol class="space-y-4">
        <li v-for="(step, i) in proSteps" :key="i" class="flex gap-3">
          <span class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-violet-600 text-sm font-bold text-white">
            {{ i + 1 }}
          </span>
          <div class="flex-1">
            <p class="font-semibold text-slate-800">{{ step.title }}</p>
            <p class="mt-1 text-sm text-slate-600">{{ step.body }}</p>
            <pre v-if="step.code" class="mt-2 overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs leading-relaxed text-slate-100"><code>{{ step.code }}</code></pre>
          </div>
        </li>
      </ol>

      <div class="mt-6 rounded-lg border border-violet-200 bg-violet-50/50 p-4">
        <p class="flex items-center gap-2 font-semibold text-violet-800">
          <span class="material-symbols-rounded text-[20px]">extension</span>
          Cách nhanh: VSCode Extension “AI Governance Gateway”
        </p>
        <p class="mt-1 text-sm text-slate-600">
          Với gói Claude Pro, extension không proxy mà giúp gắn task & báo cáo usage ước tính ngay
          trong VSCode — khỏi chuyển sang trang web hay gõ lệnh CLI.
        </p>
        <ol class="mt-3 space-y-3">
          <li v-for="(step, i) in proExtSteps" :key="i" class="flex gap-3">
            <span class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white">
              {{ i + 1 }}
            </span>
            <div class="flex-1">
              <p class="text-sm font-semibold text-slate-800">{{ step.title }}</p>
              <p class="mt-1 text-sm text-slate-600">{{ step.body }}</p>
              <pre v-if="step.code" class="mt-2 overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs leading-relaxed text-slate-100"><code>{{ step.code }}</code></pre>
            </div>
          </li>
        </ol>
      </div>

      <div class="mt-5 rounded-lg border border-violet-200 bg-violet-50/50 p-4">
        <p class="flex items-center gap-2 font-semibold text-violet-800">
          <span class="material-symbols-rounded text-[20px]">lightbulb</span>
          Ví dụ thực tế: dogfooding chính dự án này
        </p>
        <p class="mt-1 text-sm text-slate-600">
          Dự án <strong>“AI Governance Gateway”</strong> được dùng làm ví dụ đo lường: các task
          AIGG-BE, AIGG-METER, AIGG-INT, AIGG-UI đã có sẵn cùng vài phiên làm việc bằng Claude Pro
          (nguồn ESTIMATED). Mở Quản lý Công việc để xem chi phí token so với giờ công tiết kiệm.
        </p>
        <button class="btn-primary mt-3" @click="router.push({ name: 'work-tasks' })">
          Xem dự án mẫu trong Quản lý Công việc
        </button>
      </div>
    </section>

    <!-- 1.3 — MCP -->
    <section v-else class="card">
      <div class="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
        Kết nối công cụ lập trình AI (Claude Code, Codex, Cursor, Google Antigravity…) với hệ thống qua
        <strong>MCP</strong>. Sau khi cấu hình, bạn chỉ cần “nói chuyện” với AI — nó tự gắn công việc (task),
        đo usage và áp hạn ngạch. Làm theo 3 bước chuẩn bị, rồi dán cấu hình cho đúng công cụ bạn dùng.
      </div>

      <!-- Chuẩn bị -->
      <h2 class="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">Chuẩn bị (làm 1 lần)</h2>
      <ol class="space-y-4">
        <li v-for="(step, i) in mcpPrep" :key="i" class="flex gap-3">
          <span class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">{{ i + 1 }}</span>
          <div class="flex-1">
            <p class="font-semibold text-slate-800">{{ step.title }}</p>
            <p class="mt-1 text-sm text-slate-600">{{ step.body }}</p>
            <pre v-if="step.code" class="mt-2 overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs leading-relaxed text-slate-100"><code>{{ step.code }}</code></pre>
          </div>
        </li>
      </ol>

      <!-- Cấu hình theo tool -->
      <h2 class="mb-3 mt-6 text-sm font-bold uppercase tracking-wide text-slate-500">Cấu hình cho từng công cụ</h2>
      <div class="space-y-4">
        <div v-for="t in mcpTools" :key="t.tool" class="rounded-xl border border-slate-200 p-4">
          <p class="flex items-center gap-2 font-semibold text-slate-800">
            <span class="material-symbols-rounded text-[20px] text-emerald-600">{{ t.icon }}</span>{{ t.tool }}
          </p>
          <p class="mt-1 text-sm text-slate-600">{{ t.where }}</p>
          <pre class="mt-2 overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs leading-relaxed text-slate-100"><code>{{ t.code }}</code></pre>
          <p v-if="t.note" class="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">{{ t.note }}</p>
        </div>
      </div>
      <p class="mt-2 text-xs text-slate-400">
        Thay <code>/ĐƯỜNG-DẪN</code> bằng đường dẫn thật tới dự án, và <code>DÁN_TOKEN_VÀO_ĐÂY</code> bằng token đăng nhập của bạn.
      </p>

      <!-- Cách dùng -->
      <h2 class="mb-3 mt-6 text-sm font-bold uppercase tracking-wide text-slate-500">Sau khi cấu hình — cách dùng</h2>
      <ol class="space-y-4">
        <li v-for="(step, i) in mcpUsage" :key="i" class="flex gap-3">
          <span class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">{{ i + 1 }}</span>
          <div class="flex-1">
            <p class="font-semibold text-slate-800">{{ step.title }}</p>
            <p class="mt-1 text-sm text-slate-600">{{ step.body }}</p>
            <pre v-if="step.code" class="mt-2 overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs leading-relaxed text-slate-100"><code>{{ step.code }}</code></pre>
          </div>
        </li>
      </ol>

      <div class="mt-5 rounded-lg border border-emerald-200 bg-emerald-50/50 p-4 text-sm text-slate-600">
        <p class="flex items-center gap-2 font-semibold text-emerald-800">
          <span class="material-symbols-rounded text-[20px]">lightbulb</span>Công cụ AI sẽ thấy các lệnh
        </p>
        <p class="mt-1">
          <strong>aigg_active_task</strong> (task từ git branch), <strong>aigg_my_tasks</strong>,
          <strong>aigg_assign_to_ai</strong>, <strong>aigg_ai_assignment</strong>,
          <strong>aigg_report_usage</strong>, <strong>aigg_quota</strong>. Bạn không cần nhớ — chỉ cần nói yêu cầu bằng lời.
        </p>
      </div>
    </section>
  </div>
</template>
