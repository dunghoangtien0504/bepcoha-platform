/**
 * PM2 process file cho AI Governance Gateway.
 * - Backend API: cổng 3900 (chạy bản build dist).
 * - Admin Dashboard: cổng 5180 (Vite dev server).
 * Tránh dùng cổng 3000 và các cổng đang bận của máy.
 */
const path = require('path');

const ROOT = __dirname;

module.exports = {
  apps: [
    {
      name: 'aigg-backend',
      cwd: path.join(ROOT, 'apps/backend-gateway'),
      script: 'dist/main.js',
      interpreter: 'node',
      env: {
        NODE_ENV: 'development',
        BACKEND_PORT: '3900',
      },
      max_restarts: 5,
      out_file: path.join(ROOT, 'logs/backend-out.log'),
      error_file: path.join(ROOT, 'logs/backend-err.log'),
      merge_logs: true,
    },
    {
      name: 'aigg-dashboard',
      cwd: path.join(ROOT, 'apps/admin-dashboard'),
      script: path.join(ROOT, 'node_modules/vite/bin/vite.js'),
      interpreter: 'node',
      args: '--port 5180 --host 127.0.0.1',
      max_restarts: 5,
      out_file: path.join(ROOT, 'logs/dashboard-out.log'),
      error_file: path.join(ROOT, 'logs/dashboard-err.log'),
      merge_logs: true,
    },
  ],
};
