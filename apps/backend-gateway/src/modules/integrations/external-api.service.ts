import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { AiRequestAuditLogEntity, AiTaskEntity } from '../../database/models';
import { CurrencyService } from '../reports/currency.service';

export interface TaskUsageReport {
  taskId: string;
  title: string;
  status: string;
  baselineHours: number;
  externalSource: string | null;
  externalUrl: string | null;
  requestCount: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
  costVnd: number;
}

/**
 * API outbound machine-to-machine: cho phép hệ thống quản lý dự án bên thứ ba
 * kéo ngược chỉ số tiêu thụ AI / ROI của một task để hiển thị ngay trên ticket.
 */
@Injectable()
export class ExternalApiService {
  constructor(
    private readonly currencyService: CurrencyService,
    @InjectModel(AiTaskEntity) private readonly taskModel: typeof AiTaskEntity,
    @InjectModel(AiRequestAuditLogEntity)
    private readonly auditModel: typeof AiRequestAuditLogEntity,
  ) {}

  async getTaskUsage(taskId: string): Promise<TaskUsageReport> {
    const task = await this.taskModel.findByPk(taskId);
    if (!task) throw new NotFoundException(`Không tìm thấy task ${taskId}`);

    const logs = await this.auditModel.findAll({ where: { taskId } });
    const usdToVnd = await this.currencyService.getUsdToVnd();

    let promptTokens = 0;
    let completionTokens = 0;
    let costUsd = 0;
    for (const log of logs) {
      promptTokens += log.promptTokens + log.systemOverheadTokens;
      completionTokens += log.completionTokens;
      costUsd += Number(log.costUsd);
    }

    return {
      taskId: task.id,
      title: task.title,
      status: task.status,
      baselineHours: Number(task.baselineHours),
      externalSource: task.externalSource,
      externalUrl: task.externalUrl,
      requestCount: logs.length,
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      costUsd: Number(costUsd.toFixed(6)),
      costVnd: Math.round(costUsd * usdToVnd),
    };
  }
}
