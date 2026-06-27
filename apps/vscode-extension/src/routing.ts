import * as vscode from 'vscode';
import type { ActiveTask } from './session';

/**
 * Header governance gửi kèm mỗi request AI qua Gateway. X-Task-ID bắt buộc; X-Project-ID &
 * X-Conversation-ID giúp Gateway gom ngữ cảnh để báo cáo theo User · Project · Task.
 */
export function buildHeaders(task: ActiveTask): Record<string, string> {
  const headers: Record<string, string> = { 'X-Task-ID': task.aiTaskId };
  if (task.projectRef) headers['X-Project-ID'] = task.projectRef;
  headers['X-Conversation-ID'] = task.conversationId;
  return headers;
}

/** cURL mẫu (kèm token thật) để dev dán vào client/script gọi Gateway. */
export function buildCurl(baseUrl: string, token: string, task: ActiveTask, model: string): string {
  const base = baseUrl.replace(/\/$/, '');
  const headerLines = Object.entries(buildHeaders(task))
    .map(([k, v]) => `  -H '${k}: ${v}' \\`)
    .join('\n');
  return [
    `curl -N ${base}/v1/chat/completions \\`,
    `  -H 'Authorization: Bearer ${token}' \\`,
    headerLines,
    `  -H 'Content-Type: application/json' \\`,
    `  -d '{"model":"${model}","stream":true,"messages":[{"role":"user","content":"Xin chào"}]}'`,
  ].join('\n');
}

/**
 * Ghi cấu hình định tuyến vào workspace để client AI (Continue.dev, script…) trỏ qua Gateway.
 * KHÔNG ghi token bí mật ra file — tham chiếu biến môi trường AIGG_TOKEN. Thêm .aigg/ vào .gitignore.
 */
export async function writeRoutingArtifacts(
  folder: vscode.WorkspaceFolder,
  baseUrl: string,
  task: ActiveTask,
  model: string,
): Promise<vscode.Uri> {
  const base = baseUrl.replace(/\/$/, '');
  const dir = vscode.Uri.joinPath(folder.uri, '.aigg');
  await vscode.workspace.fs.createDirectory(dir);

  const routing = {
    note: 'Tự sinh bởi AI Governance Gateway extension. Token lấy từ biến môi trường AIGG_TOKEN.',
    apiBase: `${base}/v1`,
    chatEndpoint: `${base}/v1/chat/completions`,
    authorization: 'Bearer ${AIGG_TOKEN}',
    headers: buildHeaders(task),
    activeTaskTitle: task.title,
    updatedAt: new Date().toISOString(),
  };
  const routingUri = vscode.Uri.joinPath(dir, 'routing.json');
  await vscode.workspace.fs.writeFile(
    routingUri,
    Buffer.from(JSON.stringify(routing, null, 2), 'utf8'),
  );

  // Cấu hình mẫu cho Continue.dev (model OpenAI-compatible trỏ về Gateway).
  const continueExample = {
    models: [
      {
        title: `AIGG · ${task.title}`,
        provider: 'openai',
        model,
        apiBase: `${base}/v1`,
        apiKey: '${AIGG_TOKEN}',
        requestOptions: { headers: buildHeaders(task) },
      },
    ],
  };
  await vscode.workspace.fs.writeFile(
    vscode.Uri.joinPath(dir, 'continue.config.example.json'),
    Buffer.from(JSON.stringify(continueExample, null, 2), 'utf8'),
  );

  await ensureGitignore(folder);
  return routingUri;
}

/** Đảm bảo .aigg/ được bỏ qua git (tránh lộ cấu hình/route). */
async function ensureGitignore(folder: vscode.WorkspaceFolder): Promise<void> {
  const uri = vscode.Uri.joinPath(folder.uri, '.gitignore');
  let content = '';
  try {
    content = Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf8');
  } catch {
    /* chưa có .gitignore */
  }
  if (!content.split(/\r?\n/).some((line) => line.trim() === '.aigg/')) {
    const next = content && !content.endsWith('\n') ? `${content}\n.aigg/\n` : `${content}.aigg/\n`;
    await vscode.workspace.fs.writeFile(uri, Buffer.from(next, 'utf8'));
  }
}
