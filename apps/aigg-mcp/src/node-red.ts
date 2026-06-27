import { loadConfig } from './config.js';
import { getContext } from './context.js';

export const cfg = loadConfig();

/** Định nghĩa tool (theo chuẩn MCP) do Node-RED khai báo qua /manifest. */
export interface ToolDef {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

function authHeaders(): Record<string, string> {
  return cfg.token ? { Authorization: `Bearer ${cfg.token}` } : {};
}

/**
 * Lấy danh sách tool động từ Node-RED. Lỗi/không có → trả [] để bridge vẫn chạy với built-in.
 * Chấp nhận cả { tools: [...] } lẫn [...] trực tiếp.
 */
export async function fetchManifest(): Promise<ToolDef[]> {
  try {
    const res = await fetch(`${cfg.nodeRedBaseUrl}/manifest`, { headers: authHeaders() });
    if (!res.ok) return [];
    const data: unknown = await res.json();
    const list = Array.isArray(data) ? data : ((data as { tools?: unknown }).tools ?? []);
    return Array.isArray(list) ? (list as ToolDef[]) : [];
  } catch {
    return [];
  }
}

/**
 * Forward một lời gọi tool xuống Node-RED kèm context. Node-RED xử lý nghiệp vụ và trả kết quả.
 */
export async function invoke(tool: string, args: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(`${cfg.nodeRedBaseUrl}/invoke`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ tool, arguments: args, context: getContext() }),
  });
  const raw = await res.text();
  let data: unknown;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = raw;
  }
  if (!res.ok) {
    const msg = typeof data === 'string' ? data : JSON.stringify(data);
    throw new Error(`Node-RED ${res.status}: ${msg || 'lỗi không xác định'}`);
  }
  return data;
}
