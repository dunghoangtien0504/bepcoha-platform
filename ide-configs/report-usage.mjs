#!/usr/bin/env node
/**
 * report-usage.mjs — CLI đo lường AI usage cho gói cố định (Claude Pro/Cursor...)
 *
 * Triết lý: với gói trả phí cố định không có API realtime, ta vẫn ĐO ĐƯỢC mức tiêu thụ
 * bằng cách gửi nội dung prompt/đầu vào tới Gateway để ước lượng token + chi phí tham chiếu.
 *
 * Hỗ trợ 2 ngữ cảnh kiểm thử:
 *   1) CHAT — prompt chat trên file code trong IDE (truyền --file path/to/code).
 *   2) API  — coi payload làm prompt (truyền --prompt "..." hoặc nhận từ stdin).
 *
 * Ví dụ:
 *   node report-usage.mjs --task TERO-102 --requester dev@storo.vn --file src/app.ts --mode CHAT
 *   echo '{"q":"hello"}' | node report-usage.mjs --task TERO-102 --requester dev@storo.vn --mode API
 *   node report-usage.mjs --task TERO-102 --requester dev@storo.vn --prompt "Refactor this" --dry-run
 *
 * Cần đăng nhập trước để lấy JWT: truyền --token <JWT>, hoặc đặt AIGG_JWT trong môi trường.
 */
import { readFileSync } from 'node:fs';
import { argv, env, stdin, exit } from 'node:process';

const BASE_URL = env.AIGG_API_BASE_URL ?? 'http://localhost:3900';

const parseArgs = (args) => {
  const out = {};
  for (let i = 0; i < args.length; i += 1) {
    const key = args[i];
    if (!key.startsWith('--')) continue;
    const name = key.slice(2);
    const next = args[i + 1];
    if (next === undefined || next.startsWith('--')) {
      out[name] = true;
    } else {
      out[name] = next;
      i += 1;
    }
  }
  return out;
};

const readStdin = async () => {
  if (stdin.isTTY) return '';
  let data = '';
  for await (const chunk of stdin) data += chunk;
  return data.trim();
};

const main = async () => {
  const args = parseArgs(argv.slice(2));
  const token = args.token ?? env.AIGG_JWT;
  if (!token) {
    console.error('Thiếu JWT. Truyền --token <JWT> hoặc đặt biến môi trường AIGG_JWT.');
    exit(1);
  }
  const taskId = args.task;
  const requesterId = args.requester;
  if (!taskId || !requesterId) {
    console.error('Thiếu --task hoặc --requester.');
    exit(1);
  }

  const captureMode = (args.mode ?? 'CHAT').toUpperCase();
  let promptText = args.prompt;
  if (!promptText && args.file) {
    promptText = readFileSync(args.file, 'utf8');
  }
  if (!promptText) {
    promptText = await readStdin();
  }
  if (!promptText) {
    console.error('Không có nội dung prompt. Dùng --prompt, --file hoặc stdin.');
    exit(1);
  }

  const payload = {
    taskId,
    requesterId,
    captureMode,
    promptText,
    completionText: args.completion ?? undefined,
    model: args.model ?? undefined,
    dryRun: Boolean(args['dry-run']),
  };

  try {
    const res = await fetch(`${BASE_URL}/v1/usage/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error(`Gateway trả về ${res.status}: ${await res.text()}`);
      exit(1);
    }
    const result = await res.json();
    console.log('— Kết quả đo lường AI Usage —');
    console.log(`  Task:        ${result.taskId}`);
    console.log(`  Mô hình:     ${result.model} (${result.source}/${result.captureMode})`);
    console.log(`  Tokens:      ${result.totalTokens} (prompt ${result.usage.promptTokens} + completion ${result.usage.completionTokens} + overhead ${result.usage.systemOverheadTokens})`);
    console.log(`  Chi phí:     $${result.costUsd} (OT x${result.otMultiplier})`);
    console.log(`  Ghi nhật ký: ${result.persisted ? 'có' : 'không (dry-run)'}`);
  } catch (error) {
    console.error('Gọi Gateway thất bại:', error instanceof Error ? error.message : error);
    exit(1);
  }
};

void main();
