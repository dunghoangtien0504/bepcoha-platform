#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { cfg, fetchManifest, invoke, type ToolDef } from './node-red.js';
import { getContext, setActiveTask } from './context.js';

/**
 * Tool built-in luôn sẵn (cần & đủ). Mọi nghiệp vụ khác bơm động từ Node-RED /manifest.
 * - aigg_invoke: escape hatch vạn năng → forward {action, payload} về Node-RED.
 * - aigg_set_active_task: đặt X-Task-ID cho phiên (map công việc đang làm).
 * - aigg_context: xem ngữ cảnh hiện tại (cwd, git branch, active task).
 */
const BUILTIN_TOOLS: ToolDef[] = [
  {
    name: 'aigg_invoke',
    description:
      'Gửi một hành động bất kỳ tới luồng AI Governance Gateway (Node-RED) để xử lý. Dùng khi không có tool chuyên biệt.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', description: 'Tên hành động nghiệp vụ (do Node-RED định nghĩa).' },
        payload: { type: 'object', description: 'Dữ liệu kèm theo hành động.' },
      },
      required: ['action'],
    },
  },
  {
    name: 'aigg_set_active_task',
    description: 'Đặt công việc (task) đang làm để gắn vào mọi lời gọi tiếp theo (X-Task-ID).',
    inputSchema: {
      type: 'object',
      properties: { taskId: { type: 'string', description: 'Mã task (ai_tasks.id hoặc mã nghiệp vụ).' } },
      required: ['taskId'],
    },
  },
  {
    name: 'aigg_context',
    description: 'Xem ngữ cảnh hiện tại: thư mục làm việc, nhánh git, task đang hoạt động.',
    inputSchema: { type: 'object', properties: {} },
  },
];

const server = new Server(
  { name: 'aigg-mcp', version: '0.1.0' },
  { capabilities: { tools: {} } },
);

const asText = (value: unknown): { content: { type: 'text'; text: string }[] } => ({
  content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }],
});

server.setRequestHandler(ListToolsRequestSchema, async () => {
  const dynamic = await fetchManifest();
  // Built-in trước, tool động từ Node-RED sau (bỏ trùng tên với built-in).
  const builtinNames = new Set(BUILTIN_TOOLS.map((t) => t.name));
  const merged = [...BUILTIN_TOOLS, ...dynamic.filter((t) => !builtinNames.has(t.name))];
  return { tools: merged };
});

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const name = req.params.name;
  const args = (req.params.arguments ?? {}) as Record<string, unknown>;
  try {
    if (name === 'aigg_context') return asText(getContext());
    if (name === 'aigg_set_active_task') {
      setActiveTask(String(args.taskId ?? ''));
      return asText(`Đã đặt task đang hoạt động = ${args.taskId}`);
    }
    if (name === 'aigg_invoke') {
      const result = await invoke(String(args.action ?? ''), (args.payload as Record<string, unknown>) ?? {});
      return asText(result);
    }
    // Tool động từ manifest → forward nguyên tên về Node-RED.
    const result = await invoke(name, args);
    return asText(result);
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Lỗi: ${(error as Error).message}` }],
      isError: true,
    };
  }
});

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Log ra stderr (stdout dành riêng cho giao thức MCP).
  console.error(`[aigg-mcp] sẵn sàng · Node-RED: ${cfg.nodeRedBaseUrl} · token: ${cfg.token ? 'có' : 'chưa đặt'}`);
}

main().catch((error) => {
  console.error('[aigg-mcp] khởi động thất bại:', error);
  process.exit(1);
});
