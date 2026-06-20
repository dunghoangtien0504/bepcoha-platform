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

interface GithubIssue {
  number: number;
  title: string;
  state: string;
  labels?: Array<{ name: string }>;
  html_url?: string;
  pull_request?: unknown;
}

/**
 * Adapter GitHub Issues: dùng token Bearer (PAT/GitHub App). externalProjectKey = "owner/repo".
 */
@Injectable()
export class GithubProvider implements PmProvider {
  readonly provider: IntegrationProvider = 'GITHUB';

  constructor(
    private readonly httpService: HttpService,
    private readonly logger: AppLoggerService,
  ) {
    this.logger.setContext(GithubProvider.name);
  }

  async fetchTasks(connection: DecryptedConnection): Promise<ExternalTask[]> {
    const { entity, token } = connection;
    const response = await firstValueFrom(
      this.httpService.get<GithubIssue[]>(
        `${entity.baseUrl}/repos/${entity.externalProjectKey}/issues`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
          params: { state: 'all', per_page: 100 },
          timeout: 15000,
        },
      ),
    );
    // Loại bỏ pull request (GitHub trả PR lẫn trong danh sách issues).
    return (response.data ?? [])
      .filter((issue) => !issue.pull_request)
      .map((issue) => this.toExternalTask(issue));
  }

  parseWebhook(payload: Record<string, unknown>): ExternalTask | null {
    const issue = payload.issue as GithubIssue | undefined;
    if (!issue?.number) return null;
    return this.toExternalTask(issue);
  }

  verifyWebhook(
    connection: IntegrationConnectionEntity,
    rawBody: string,
    headers: IncomingHttpHeaders,
  ): boolean {
    if (!connection.webhookSecret) return true;
    const signature = headers['x-hub-signature-256'] as string | undefined;
    if (!signature) return false;
    const expected =
      'sha256=' + createHmac('sha256', connection.webhookSecret).update(rawBody).digest('hex');
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  private toExternalTask(issue: GithubIssue): ExternalTask {
    const labels = (issue.labels ?? []).map((label) => label.name.toLowerCase());
    return {
      externalId: `GH-${issue.number}`,
      title: issue.title,
      status: mapGithubStatus(issue.state, labels),
      estimateHours: null,
      url: issue.html_url ?? null,
    };
  }
}

const mapGithubStatus = (state: string, labels: string[]): AiTaskStatus => {
  if (state === 'closed') return 'DONE';
  if (labels.some((label) => label.includes('progress') || label.includes('doing'))) {
    return 'IN_PROGRESS';
  }
  return 'OPEN';
};
