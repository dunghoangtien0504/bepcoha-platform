/**
 * Client gọi REST API của AI Governance Gateway. Dùng global fetch (VSCode chạy Node >= 18).
 * Không lưu nội dung code; chỉ trao đổi metadata governance (task/project/usage).
 */

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

export interface WorkTask {
  id: number;
  title: string;
  estimatedHours: number | null;
  dueDate: string | null;
  projectId: number | null;
  project?: { id: number; title: string | null; code: string | null } | null;
}

export interface AiTask {
  id: string;
  title: string;
  baselineHours: number;
  projectId: number | null;
  budgetTokens: number | null;
  endDate: string | null;
  status: string;
}

export interface QuotaCycle {
  cycle: string;
  used: number;
  limit: number;
  unlimited: boolean;
}

export interface QuotaSnapshot {
  userId: string;
  taskId: string;
  cycles: QuotaCycle[];
}

export interface AssignAiPayload {
  baselineHours: number;
  endDate?: string;
  title?: string;
  budgetTokens?: number;
  moreDesc?: string;
}

export interface CreateAiTaskPayload {
  title: string;
  baselineHours: number;
  budgetTokens?: number;
  moreDesc?: string;
  projectId?: number;
}

export interface IngestUsagePayload {
  taskId: string;
  requesterId: string;
  model?: string;
  promptTokens?: number;
  completionTokens?: number;
  captureMode: 'CHAT' | 'TASK' | 'API';
  projectId?: string;
  conversationId?: string;
}

export class AiggApi {
  constructor(private readonly baseUrl: string) {}

  private async request<T>(
    method: string,
    path: string,
    opts: { jwt?: string; body?: unknown } = {},
  ): Promise<T> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (opts.jwt) headers.Authorization = `Bearer ${opts.jwt}`;
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl.replace(/\/$/, '')}${path}`, {
        method,
        headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      });
    } catch (err) {
      throw new Error(`Không kết nối được Gateway (${this.baseUrl}): ${(err as Error).message}`);
    }
    const text = await res.text();
    const data = text ? JSON.parse(text) : undefined;
    if (!res.ok) {
      const msg = (data && (data.message || data.error)) || `HTTP ${res.status}`;
      throw new Error(Array.isArray(msg) ? msg.join(', ') : String(msg));
    }
    return data as T;
  }

  login(email: string, password: string): Promise<LoginResponse> {
    return this.request<LoginResponse>('POST', '/v1/auth/login', { body: { email, password } });
  }

  getInternalToken(jwt: string): Promise<{ internalToken: string | null; hasToken: boolean }> {
    return this.request('GET', '/v1/quotas/me/internal-token', { jwt });
  }

  listWorkTasks(jwt: string, assignedToUserId: string): Promise<{ rows: WorkTask[] }> {
    const q = encodeURIComponent(assignedToUserId);
    return this.request('GET', `/v1/work/tasks?assignedToUserId=${q}&pageSize=100`, { jwt });
  }

  assignAi(jwt: string, workTaskId: number, payload: AssignAiPayload): Promise<AiTask> {
    return this.request('POST', `/v1/work/tasks/${workTaskId}/assign-ai`, { jwt, body: payload });
  }

  listAiTasks(jwt: string, assigneeId: string): Promise<AiTask[]> {
    return this.request('GET', `/v1/tasks?assigneeId=${encodeURIComponent(assigneeId)}`, { jwt });
  }

  createAiTask(jwt: string, payload: CreateAiTaskPayload): Promise<AiTask> {
    return this.request('POST', '/v1/tasks', { jwt, body: payload });
  }

  getQuota(jwt: string, taskId: string): Promise<QuotaSnapshot> {
    return this.request('GET', `/v1/quotas/me?taskId=${encodeURIComponent(taskId)}`, { jwt });
  }

  ingestUsage(jwt: string, payload: IngestUsagePayload): Promise<{ persisted: boolean; totalTokens: number; costUsd: number }> {
    return this.request('POST', '/v1/usage/ingest', { jwt, body: payload });
  }
}
