import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import {
  AiRequestAuditLogEntity,
  AiTaskEntity,
  IntegrationConnectionEntity,
} from '../../database/models';
import { AuthModule } from '../auth/auth.module';
import { ReportsModule } from '../reports/reports.module';
import { ExternalApiService } from './external-api.service';
import { IntegrationApiKeyGuard } from './integration-api-key.guard';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { GithubProvider } from './providers/github.provider';
import { GitlabProvider } from './providers/gitlab.provider';
import { JiraProvider } from './providers/jira.provider';
import { PmProviderRegistry } from './providers/pm-provider.registry';

@Module({
  imports: [
    SequelizeModule.forFeature([
      IntegrationConnectionEntity,
      AiTaskEntity,
      AiRequestAuditLogEntity,
    ]),
    HttpModule,
    AuthModule,
    ReportsModule,
  ],
  controllers: [IntegrationsController],
  providers: [
    IntegrationsService,
    ExternalApiService,
    IntegrationApiKeyGuard,
    PmProviderRegistry,
    JiraProvider,
    GitlabProvider,
    GithubProvider,
  ],
})
export class IntegrationsModule {}
