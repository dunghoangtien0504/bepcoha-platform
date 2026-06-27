import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { QuotaCycle } from '../../common/utils/cycle.util';
import { AiRequestAuditLogEntity } from '../../database/models';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  AnomalyAlert,
  ModelEfficiencyRow,
  ProjectPerformance,
  ReportsService,
  RoiRealReport,
  RoiSummary,
  TaskPerformance,
  TokenWasteReport,
  TrendPoint,
} from './reports.service';

@UseGuards(JwtAuthGuard)
@Controller('v1/reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('summary')
  summary(@Query('from') from?: string, @Query('to') to?: string): Promise<RoiSummary> {
    return this.reportsService.getSummary({ from, to });
  }

  @Get('trends')
  trends(
    @Query('granularity') granularity: QuotaCycle = 'DAILY',
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<TrendPoint[]> {
    return this.reportsService.getTrends(granularity, { from, to });
  }

  @Get('task-performance')
  taskPerformance(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<TaskPerformance[]> {
    return this.reportsService.getTaskPerformance({ from, to });
  }

  @Get('project-performance')
  projectPerformance(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<ProjectPerformance[]> {
    return this.reportsService.getProjectPerformance({ from, to });
  }

  @Get('anomalies')
  anomalies(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<AnomalyAlert[]> {
    // Ngưỡng cảnh báo lấy từ setting key (anomaly_*); không nhận qua query nữa.
    return this.reportsService.getAnomalies({ from, to });
  }

  @Get('roi-real')
  roiReal(@Query('from') from?: string, @Query('to') to?: string): Promise<RoiRealReport> {
    return this.reportsService.getRoiReal({ from, to });
  }

  @Get('model-efficiency')
  modelEfficiency(@Query('from') from?: string, @Query('to') to?: string): Promise<ModelEfficiencyRow[]> {
    return this.reportsService.getModelEfficiency({ from, to });
  }

  @Get('token-waste')
  tokenWaste(@Query('from') from?: string, @Query('to') to?: string): Promise<TokenWasteReport> {
    return this.reportsService.getTokenWaste({ from, to });
  }

  @Get('logs')
  logs(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
  ): Promise<AiRequestAuditLogEntity[]> {
    return this.reportsService.listLogs(
      { from, to },
      limit ? Number.parseInt(limit, 10) : undefined,
    );
  }
}
