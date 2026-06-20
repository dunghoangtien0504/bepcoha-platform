import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { SystemSettingEntity } from '../../database/models';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UpsertSettingDto } from './dto/upsert-setting.dto';
import { SettingsService, WorkCalendarConfig } from './settings.service';

@UseGuards(JwtAuthGuard)
@Controller('v1/settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  findAll(): Promise<SystemSettingEntity[]> {
    return this.settingsService.findAll();
  }

  @Get('calendar')
  getCalendar(): Promise<WorkCalendarConfig> {
    return this.settingsService.getCalendarConfig();
  }

  @Put()
  upsert(@Body() dto: UpsertSettingDto): Promise<SystemSettingEntity> {
    return this.settingsService.upsert(dto.settingKey, dto.settingValue, dto.description);
  }
}
