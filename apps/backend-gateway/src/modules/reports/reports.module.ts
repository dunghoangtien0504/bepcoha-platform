import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import {
  AiRequestAuditLogEntity,
  AiTaskEntity,
  AppUserEntity,
  ProjectEntity,
  TaskCategoryEntity,
  TaskEntity,
} from '../../database/models';
import { AuthModule } from '../auth/auth.module';
import { SettingsModule } from '../settings/settings.module';
import { CurrencyService } from './currency.service';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [
    SequelizeModule.forFeature([
      AiRequestAuditLogEntity,
      AiTaskEntity,
      AppUserEntity,
      ProjectEntity,
      TaskEntity,
      TaskCategoryEntity,
    ]),
    HttpModule,
    AuthModule,
    SettingsModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService, CurrencyService],
  exports: [CurrencyService],
})
export class ReportsModule {}
