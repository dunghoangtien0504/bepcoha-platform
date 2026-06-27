import { IncomingHttpHeaders } from 'http';
import {
  AiTaskStatus,
} from '../../../database/models/ai-task.entity';
import {
  IntegrationConnectionEntity,
  IntegrationProvider,
} from '../../../database/models/integration-connection.entity';

/**
 * Tác vụ đã chuẩn hóa từ hệ thống bên thứ ba về định dạng nội bộ (ai_tasks).
 */
export interface ExternalTask {
  externalId: string;
  title: string;
  status: AiTaskStatus;
  estimateHours: number | null;
  url: string | null;
}

export interface DecryptedConnection {
  entity: IntegrationConnectionEntity;
  token: string;
}

/**
 * Hợp đồng cho mỗi nhà cung cấp PM/Task (Jira, GitLab, GitHub).
 */
export interface PmProvider {
  readonly provider: IntegrationProvider;

  /** Kéo danh sách issue/task từ hệ thống bên thứ ba về. */
  fetchTasks(connection: DecryptedConnection): Promise<ExternalTask[]>;

  /** Bóc tách 1 sự kiện webhook thành ExternalTask (null nếu sự kiện không liên quan). */
  parseWebhook(payload: Record<string, unknown>): ExternalTask | null;

  /** Xác thực chữ ký/secret của webhook đến. */
  verifyWebhook(
    connection: IntegrationConnectionEntity,
    rawBody: string,
    headers: IncomingHttpHeaders,
  ): boolean;
}
