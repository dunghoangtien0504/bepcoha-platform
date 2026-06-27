import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { IncomingHttpHeaders } from 'http';
import { firstValueFrom } from 'rxjs';
import { AppLoggerService } from '../../../common/logger/app-logger.service';
import { AiTaskStatus } from '../../../database/models/ai-task.entity';
import {
  IntegrationConnectionEntity,
  IntegrationProvider,
} from '../../../database/models/integration-connection.entity';
import { DecryptedConnection, ExternalTask, PmProvider } from './pm-provider.interface';

interface JiraIssue {
  key: string;
  fields: {
    summary: string;
    status?: { statusCategory?: { key?: string } };
    timeoriginalestimate?: number | null;
  };
}

interface JiraSearchResponse {
  issues?: JiraIssue[];
}

/**
 * Adapter Jira Cloud: dùng REST API v3 (Basic Auth email + API token).
 */
@Injectable()
export class JiraProvider implements PmProvider {
  readonly provider: IntegrationProvider = 'JIRA';

  constructor(
    private readonly httpService: HttpService,
    private readonly logger: AppLoggerService,
  ) {
    this.logger.setContext(JiraProvider.name);
  }

  async fetchTasks(connection: DecryptedConnection): Promise<ExternalTask[]> {
    const { entity, token } = connection;
    const auth = Buffer.from(`${entity.authEmail}:${token}`).toString('base64');
    const jql = entity.externalProjectKey ? `project=${entity.externalProjectKey}` : 'order by created DESC';

    const response = await firstValueFrom(
      this.httpService.get<JiraSearchResponse>(`${entity.baseUrl}/rest/api/3/search`, {
        headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' },
        params: { jql, maxResults: 100, fields: 'summary,status,timeoriginalestimate' },
        timeout: 15000,
      }),
    );

    return (response.data.issues ?? []).map((issue) => this.toExternalTask(issue, entity.baseUrl));
  }

  parseWebhook(payload: Record<string, unknown>): ExternalTask | null {
    const issue = payload.issue as JiraIssue | undefined;
    if (!issue?.key) return null;
    const baseUrl = (payload.baseUrl as string | undefined) ?? '';
    return this.toExternalTask(issue, baseUrl);
  }

  verifyWebhook(
    connection: IntegrationConnectionEntity,
    rawBody: string,
    headers: IncomingHttpHeaders,
  ): boolean {
    if (!connection.webhookSecret) return true; // Jira automation có thể không ký HMAC.
    const signature = headers['x-hub-signature'] as string | undefined;
    if (!signature) return false;
    const expected =
      'sha256=' + createHmac('sha256', connection.webhookSecret).update(rawBody).digest('hex');
    return safeEqual(signature, expected);
  }

  private toExternalTask(issue: JiraIssue, baseUrl: string): ExternalTask {
    const categoryKey = issue.fields.status?.statusCategory?.key ?? 'new';
    const estimateSeconds = issue.fields.timeoriginalestimate ?? null;
    return {
      externalId: issue.key,
      title: issue.fields.summary,
      status: mapJiraStatus(categoryKey),
      estimateHours: estimateSeconds ? Number((estimateSeconds / 3600).toFixed(2)) : null,
      url: baseUrl ? `${baseUrl}/browse/${issue.key}` : null,
    };
  }
}

const mapJiraStatus = (categoryKey: string): AiTaskStatus => {
  if (categoryKey === 'done') return 'DONE';
  if (categoryKey === 'indeterminate') return 'IN_PROGRESS';
  return 'OPEN';
};

const safeEqual = (a: string, b: string): boolean => {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  return bufferA.length === bufferB.length && timingSafeEqual(bufferA, bufferB);
};
