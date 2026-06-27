import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { IngestUsageDto } from './dto/ingest-usage.dto';
import { IngestResult, UsageBreakdownRow, UsageService } from './usage.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('v1/usage')
export class UsageController {
  constructor(private readonly usageService: UsageService) {}

  @RequirePermissions('governance.usage.view')
  @Get('breakdown')
  breakdown(): Promise<UsageBreakdownRow[]> {
    return this.usageService.breakdown();
  }

  @RequirePermissions('governance.usage.view')
  @Get('models')
  models(): string[] {
    return this.usageService.listModels();
  }

  @RequirePermissions('governance.usage.ingest')
  @Post('ingest')
  ingest(@Body() dto: IngestUsageDto): Promise<IngestResult> {
    return this.usageService.ingest(dto);
  }
}
