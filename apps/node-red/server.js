/**
 * Node-RED nhúng dạng Express app (chủ động customize) cho AI Governance Gateway.
 *
 * - Editor (admin) tại route /mdw, đăng nhập bằng EMAIL/MẬT KHẨU của hệ thống AIGG,
 *   CHỈ user có isAdmin=true mới vào được (xác thực qua POST /v1/auth/login của Gateway).
 * - Endpoint flow (webhook cho aigg-mcp) ở gốc /  → vd /aigg/manifest, /aigg/invoke.
 * - Không cần DB: flows + credentials lưu file trong ./data.
 */
const http = require('http');
const path = require('path');
const fs = require('fs');
const express = require('express');
const RED = require('node-red');

const PORT = Number(process.env.NODE_RED_PORT || 1880);
const ADMIN_ROOT = process.env.NODE_RED_ADMIN_ROOT || '/mdw';
const GATEWAY_URL = (process.env.AIGG_GATEWAY_URL || 'http://localhost:3900').replace(/\/+$/, '');
const USER_DIR = path.join(__dirname, 'data');

// Tạo userDir + nạp flows mẫu (manifest/invoke) lần đầu để aigg-mcp chạy được ngay.
fs.mkdirSync(USER_DIR, { recursive: true });
const flowFile = path.join(USER_DIR, 'flows.json');
if (!fs.existsSync(flowFile)) {
  const sample = path.join(__dirname, '..', 'aigg-mcp', 'node-red-flow.sample.json');
  try {
    if (fs.existsSync(sample)) fs.copyFileSync(sample, flowFile);
  } catch (err) {
    console.error('[aigg-node-red] không nạp được flows mẫu:', err.message);
  }
}

const settings = {
  uiPort: PORT,
  httpAdminRoot: ADMIN_ROOT,
  httpNodeRoot: '/',
  userDir: USER_DIR,
  flowFile: 'flows.json',
  credentialSecret: process.env.NODE_RED_CREDENTIAL_SECRET || 'aigg-mdw-secret-change-me',
  functionGlobalContext: {
    gatewayUrl: GATEWAY_URL,
    fetch: (...args) => fetch(...args),
    // Mẫu trích task id từ git branch (vd "AIGG-123-..." / "feature/123-x" → 123).
    branchTaskRegex: process.env.AIGG_BRANCH_REGEX || '(?:^|[/_-])(?:AIGG-)?(\\d+)',
  },
  logging: { console: { level: 'info', metrics: false, audit: false } },
  editorTheme: {
    page: { title: 'AIGG Middleware' },
    header: { title: 'AIGG Middleware' },
  },
  // Đăng nhập editor bằng tài khoản admin của hệ thống AIGG.
  adminAuth: {
    type: 'credentials',
    users: (username) => Promise.resolve(username ? { username, permissions: '*' } : null),
    authenticate: async (username, password) => {
      try {
        const res = await fetch(`${GATEWAY_URL}/v1/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: username, password }),
        });
        if (!res.ok) return null;
        const data = await res.json();
        // Chỉ cho phép user quản trị (isAdmin) đăng nhập vào Node-RED.
        if (!data || !data.user || data.user.isAdmin !== true) return null;
        return { username: data.user.email, permissions: '*' };
      } catch (err) {
        console.error('[aigg-node-red] auth lỗi:', err.message);
        return null;
      }
    },
  },
};

const app = express();
const server = http.createServer(app);

RED.init(server, settings);
app.use(settings.httpAdminRoot, RED.httpAdmin); // editor + admin API tại /mdw
app.use(settings.httpNodeRoot, RED.httpNode); // các endpoint do flow tạo (/aigg/...)

server.listen(PORT, () => {
  console.log(
    `[aigg-node-red] editor: http://localhost:${PORT}${ADMIN_ROOT} | flows: http://localhost:${PORT}/aigg/* | gateway: ${GATEWAY_URL}`,
  );
});

RED.start();
