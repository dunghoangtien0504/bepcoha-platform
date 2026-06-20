import { BadRequestException, Injectable } from '@nestjs/common';
import { IntegrationProvider } from '../../../database/models/integration-connection.entity';
import { GithubProvider } from './github.provider';
import { GitlabProvider } from './gitlab.provider';
import { JiraProvider } from './jira.provider';
import { PmProvider } from './pm-provider.interface';

@Injectable()
export class PmProviderRegistry {
  private readonly registry: Map<IntegrationProvider, PmProvider>;

  constructor(jira: JiraProvider, gitlab: GitlabProvider, github: GithubProvider) {
    this.registry = new Map<IntegrationProvider, PmProvider>([
      ['JIRA', jira],
      ['GITLAB', gitlab],
      ['GITHUB', github],
    ]);
  }

  get(provider: IntegrationProvider): PmProvider {
    const found = this.registry.get(provider);
    if (!found) {
      throw new BadRequestException(`Provider tích hợp không hỗ trợ: ${provider}`);
    }
    return found;
  }
}
