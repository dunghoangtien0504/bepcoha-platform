import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { SystemSettingEntity } from '../../database/models';
import { AuthModule } from '../auth/auth.module';
import { PolicyService } from './policy.service';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

@Module({
  imports: [SequelizeModule.forFeature([SystemSettingEntity]), AuthModule],
  controllers: [SettingsController],
  providers: [SettingsService, PolicyService],
  exports: [SettingsService, PolicyService],
})
export class SettingsModule {}
