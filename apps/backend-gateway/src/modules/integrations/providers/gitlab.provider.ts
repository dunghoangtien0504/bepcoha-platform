import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { IncomingHttpHeaders } from 'http';
import { firstValueFrom } from 'rxjs';
import { AppLoggerService } from '../../../common/logger/app-logger.service';
import { AiTaskStatus } from '../../../database/models/ai-task.entity';
import {
  IntegrationConnectionEntity,
  IntegrationProvider,
} from '../../../database/models/integration-connection.entity';
import { DecryptedConnection, ExternalTask, PmProvider } from './pm-provider.interface';

interface GitlabIssue {
  iid: number;
  title: string;
  state: string;
  labels?: string[];
  time_stats?: { time_estimate?: number };
  web_url?: string;
}

/**
 * Adapter GitLab Issues: dùng Personal Access Token qua header PRIVATE-TOKEN.
 */
@Injectable()
export class GitlabProvider implements PmProvider {
  readonly provider: IntegrationProvider = 'GITLAB';

  constructor(
    private readonly httpService: HttpService,
    private readonly logger: AppLoggerService,
  ) {
    this.logger.setContext(GitlabProvider.name);
  }

  async fetchTasks(connection: DecryptedConnection): Promise<ExternalTask[]> {
    const { entity, token } = connection;
    const projectId = encodeURIComponent(entity.externalProjectKey ?? '');
    const response = await firstValueFrom(
      this.httpService.get<GitlabIssue[]>(
        `${entity.baseUrl}/api/v4/projects/${projectId}/issues`,
        {
          headers: { 'PRIVATE-TOKEN': token },
          params: { per_page: 100, scope: 'all' },
          timeout: 15000,
        },
      ),
    );
    return (response.data ?? []).map((issue) => this.toExternalTask(issue));
  }

  parseWebhook(payload: Record<string, unknown>): ExternalTask | null {
    const attributes = payload.object_attributes as
      | (GitlabIssue & { id?: number })
      | undefined;
    if (!attributes?.iid) return null;
    return this.toExternalTask(attributes);
  }

  verifyWebhook(
    connection: IntegrationConnectionEntity,
    _rawBody: string,
    headers: IncomingHttpHeaders,
  ): boolean {
    if (!connection.webhookSecret) return true;
    const token = headers['x-gitlab-token'] as string | undefined;
    return token === connection.webhookSecret;
  }

  private toExternalTask(issue: GitlabIssue): ExternalTask {
    const estimateSeconds = issue.time_stats?.time_estimate ?? 0;
    return {
      externalId: `GL-${issue.iid}`,
      title: issue.title,
      status: mapGitlabStatus(issue.state, issue.labels ?? []),
      estimateHours: estimateSeconds ? Number((estimateSeconds / 3600).toFixed(2)) : null,
      url: issue.web_url ?? null,
    };
  }
}

const mapGitlabStatus = (state: string, labels: string[]): AiTaskStatus => {
  if (state === 'closed') return 'DONE';
  const normalized = labels.map((label) => label.toLowerCase());
  if (normalized.some((label) => label.includes('progress') || label.includes('doing'))) {
    return 'IN_PROGRESS';
  }
  return 'OPEN';
};
