import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { LoggerModule } from './common/logger/logger.module';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './redis/redis.module';
import { AppController } from './app.controller';
import { AuthModule } from './modules/auth/auth.module';
import { ProxyModule } from './modules/proxy/proxy.module';
import { QuotaModule } from './modules/quota/quota.module';
import { AuditLogModule } from './modules/audit-log/audit-log.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { SettingsModule } from './modules/settings/settings.module';
import { ReportsModule } from './modules/reports/reports.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { UsersModule } from './modules/users/users.module';
import { AdminMenusModule } from './modules/admin-menus/admin-menus.module';
import { UsageModule } from './modules/usage/usage.module';
import { WorkModule } from './modules/work/work.module';
import { NotificationModule } from './modules/notification/notification.module';
import { PromptModule } from './modules/prompt/prompt.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      // Backend chạy từ apps/backend-gateway nên cần trỏ tới .env ở gốc monorepo.
      envFilePath: ['../../.env', '.env'],
    }),
    LoggerModule,
    RedisModule,
    DatabaseModule,
    AuthModule,
    SettingsModule,
    QuotaModule,
    AuditLogModule,
    ProxyModule,
    ProjectsModule,
    ReportsModule,
    IntegrationsModule,
    RbacModule,
    UsersModule,
    AdminMenusModule,
    UsageModule,
    WorkModule,
    NotificationModule,
    PromptModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
