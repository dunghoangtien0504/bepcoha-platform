import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { v4 as uuidv4 } from 'uuid';
import { AppLoggerService } from '../../common/logger/app-logger.service';
import { TokenUsage } from '../../common/interfaces/request-context.interface';
import { AiRequestAuditLogEntity } from '../../database/models';
import { PricingService } from '../audit-log/pricing.service';
import { SettingsService } from '../settings/settings.service';
import { NotificationService } from '../notification/notification.service';
import { PromptService } from '../prompt/prompt.service';
import { IngestUsageDto } from './dto/ingest-usage.dto';
import { TokenEstimatorService } from './token-estimator.service';

export interface IngestResult {
  requestId: string;
  taskId: string;
  source: 'ESTIMATED';
  captureMode: IngestUsageDto['captureMode'];
  model: string;
  usage: TokenUsage;
  totalTokens: number;
  costUsd: number;
  otMultiplier: number;
  persisted: boolean;
}

export interface UsageBreakdownRow {
  source: string;
  requestCount: number;
  totalTokens: number;
  totalCostUsd: number;
}

const DEFAULT_ESTIMATION_MODEL = 'claude-3-5-sonnet';

/**
 * Tầng nạp & ước lượng usage cho các ngữ cảnh không đo realtime. Ghi vào ai_request_audit_logs
 * với source='ESTIMATED' để các báo cáo/biểu đồ ROI hiện có tự động trực quan hóa.
 */
@Injectable()
export class UsageService {
  constructor(
    private readonly estimator: TokenEstimatorService,
    private readonly pricingService: PricingService,
    private readonly settingsService: SettingsService,
    private readonly logger: AppLoggerService,
    @InjectModel(AiRequestAuditLogEntity)
    private readonly auditModel: typeof AiRequestAuditLogEntity,
    private readonly notify: NotificationService,
    private readonly promptService: PromptService,
  ) {
    this.logger.setContext(UsageService.name);
  }

  /**
   * Ước lượng usage từ DTO (đếm token từ text rồi loại bỏ text), tính cost & OT.
   * dryRun=true: chỉ trả về ước lượng. Ngược lại INSERT một bản ghi audit nguồn ESTIMATED.
   */
  async ingest(dto: IngestUsageDto): Promise<IngestResult> {
    const model = dto.model ?? DEFAULT_ESTIMATION_MODEL;
    const occurredAt = dto.occurredAt ? new Date(dto.occurredAt) : new Date();
    const usage = this.estimator.estimateUsage({
      promptText: dto.promptText,
      completionText: dto.completionText,
      promptTokens: dto.promptTokens,
      completionTokens: dto.completionTokens,
    });
    const costUsd = this.pricingService.computeCostUsd(model, usage);
    const otMultiplier = await this.settingsService.resolveOtMultiplier(occurredAt);
    const totalTokens = usage.promptTokens + usage.completionTokens + usage.systemOverheadTokens;
    const requestId = `est_${uuidv4()}`;

    const result: IngestResult = {
      requestId,
      taskId: dto.taskId,
      source: 'ESTIMATED',
      captureMode: dto.captureMode,
      model,
      usage,
      totalTokens,
      costUsd,
      otMultiplier,
      persisted: false,
    };

    if (dto.dryRun) return result;

    try {
      await this.auditModel.create({
        requestId,
        taskId: dto.taskId,
        requesterId: dto.requesterId,
        requestedAt: occurredAt,
        completedAt: occurredAt,
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        systemOverheadTokens: usage.systemOverheadTokens,
        aiModelUsed: model,
        costUsd,
        otMultiplier,
        taskStatus: 'SUCCESS',
        source: 'ESTIMATED',
        captureMode: dto.captureMode,
        projectId: dto.projectId ?? null,
        conversationId: dto.conversationId ?? null,
      } as AiRequestAuditLogEntity);
      result.persisted = true;
      this.logger.logBusiness(UsageService.name, 'Đã nạp usage ước lượng', {
        requestId,
        taskId: dto.taskId,
        totalTokens,
        costUsd,
      });
      this.notify.emit('usage.recorded', {
        taskId: dto.taskId,
        requesterId: dto.requesterId,
        totalTokens,
        costUsd,
        source: 'ESTIMATED',
        captureMode: dto.captureMode,
      });
      // Capture ngữ cảnh đầu vào (prompt) cho Prompt Management — chỉ lưu rút gọn + hash.
      if (dto.promptText) {
        void this.promptService.capture({
          requestId,
          taskId: dto.taskId,
          projectId: dto.projectId,
          requesterId: dto.requesterId,
          conversationId: dto.conversationId,
          model,
          promptText: dto.promptText,
          promptTokens: usage.promptTokens,
          completionTokens: usage.completionTokens,
        });
      }
    } catch (error) {
      this.logger.error('Nạp usage ước lượng thất bại', (error as Error).stack);
    }
    return result;
  }

  /** Danh sách model AI được hỗ trợ — đổ vào select ở FE để chọn đúng tên model. */
  listModels(): string[] {
    return this.pricingService.listModels();
  }

  /**
   * Tổng hợp usage theo nguồn dữ liệu (GATEWAY realtime vs ESTIMATED ước lượng vs IMPORTED).
   */
  async breakdown(): Promise<UsageBreakdownRow[]> {
    const logs = await this.auditModel.findAll();
    const bySource = new Map<string, UsageBreakdownRow>();
    for (const log of logs) {
      const source = log.source ?? 'GATEWAY';
      const row = bySource.get(source) ?? {
        source,
        requestCount: 0,
        totalTokens: 0,
        totalCostUsd: 0,
      };
      row.requestCount += 1;
      row.totalTokens += log.promptTokens + log.completionTokens + log.systemOverheadTokens;
      row.totalCostUsd = Number((row.totalCostUsd + Number(log.costUsd)).toFixed(6));
      bySource.set(source, row);
    }
    return Array.from(bySource.values()).sort((a, b) => b.totalTokens - a.totalTokens);
  }
}
