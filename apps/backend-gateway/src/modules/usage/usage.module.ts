import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AiRequestAuditLogEntity } from '../../database/models';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { AuthModule } from '../auth/auth.module';
import { PromptModule } from '../prompt/prompt.module';
import { SettingsModule } from '../settings/settings.module';
import { TokenEstimatorService } from './token-estimator.service';
import { UsageController } from './usage.controller';
import { UsageService } from './usage.service';

/**
 * Tầng đo lường/nạp usage gián tiếp (Claude Pro cá nhân, chat IDE, call API như prompt).
 * Tận dụng PricingService (audit) + SettingsService (OT) để ghi vào audit log nguồn ESTIMATED.
 */
@Module({
  imports: [
    SequelizeModule.forFeature([AiRequestAuditLogEntity]),
    AuthModule,
    AuditLogModule,
    SettingsModule,
    PromptModule,
  ],
  controllers: [UsageController],
  providers: [UsageService, TokenEstimatorService],
  exports: [UsageService, TokenEstimatorService],
})
export class UsageModule {}
