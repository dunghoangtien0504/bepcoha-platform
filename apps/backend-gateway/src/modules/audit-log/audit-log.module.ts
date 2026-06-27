import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AiRequestAuditLogEntity } from '../../database/models';
import { SettingsModule } from '../settings/settings.module';
import { AuditLogService } from './audit-log.service';
import { PricingService } from './pricing.service';

@Module({
  imports: [SequelizeModule.forFeature([AiRequestAuditLogEntity]), SettingsModule],
  providers: [AuditLogService, PricingService],
  exports: [AuditLogService, PricingService],
})
export class AuditLogModule {}
