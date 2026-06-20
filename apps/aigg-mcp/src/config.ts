/**
 * Cấu hình bridge qua biến môi trường. Bridge cố ý "mỏng": mọi logic ở Node-RED.
 */
export interface AiggMcpConfig {
  /** Gốc webhook Node-RED, vd http://localhost:1880/aigg (expose /manifest, /invoke). */
  nodeRedBaseUrl: string;
  /** Token định danh (internal storo_live_ hoặc JWB) forward xuống Node-RED dưới dạng context. */
  token: string | null;
  /** Task đang hoạt động khởi tạo (X-Task-ID), có thể đổi runtime qua aigg_set_active_task. */
  initialTaskId: string | null;
  /** Dự án mặc định (tùy chọn), forward kèm context. */
  projectId: string | null;
}

export function loadConfig(): AiggMcpConfig {
  return {
    nodeRedBaseUrl: (process.env.AIGG_NODE_RED_URL ?? 'http://localhost:1880/aigg').replace(/\/+$/, ''),
    token: process.env.AIGG_TOKEN ?? null,
    initialTaskId: process.env.AIGG_TASK_ID ?? null,
    projectId: process.env.AIGG_PROJECT_ID ?? null,
  };
}
