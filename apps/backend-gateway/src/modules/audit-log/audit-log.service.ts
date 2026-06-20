import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { AppLoggerService } from '../../common/logger/app-logger.service';
import { TokenUsage } from '../../common/interfaces/request-context.interface';
import {
  AiRequestAuditLogEntity,
  AuditSource,
  AuditTaskStatus,
  CaptureMode,
} from '../../database/models';
import { RedisService } from '../../redis/redis.service';
import { SettingsService } from '../settings/settings.service';
import { PricingService } from './pricing.service';

export interface PendingContext {
  requestId: string;
  taskId: string;
  requesterId: string;
  requestedAt: Date;
  model: string;
}

export interface CompletionContext extends PendingContext {
  completedAt: Date;
  usage: TokenUsage;
  status: AuditTaskStatus;
  /** Mặc định GATEWAY (đo realtime qua proxy). */
  source?: AuditSource;
  /** Mặc định REALTIME (luồng proxy). */
  captureMode?: CaptureMode;
  /** Ngữ cảnh governance (metadata) — không chứa nội dung code. */
  projectId?: string | null;
  conversationId?: string | null;
  messageCount?: number | null;
  requestBytes?: number | null;
}

@Injectable()
export class AuditLogService {
  constructor(
    private readonly redisService: RedisService,
    private readonly pricingService: PricingService,
    private readonly settingsService: SettingsService,
    private readonly logger: AppLoggerService,
    @InjectModel(AiRequestAuditLogEntity)
    private readonly auditModel: typeof AiRequestAuditLogEntity,
  ) {
    this.logger.setContext(AuditLogService.name);
  }

  /**
   * Lưu trạng thái PENDING vào Redis ngay khi nhận request (cứu log nếu server sập giữa chừng).
   */
  async markPending(requestId: string): Promise<void> {
    await this.redisService.setPending(requestId);
  }

  /**
   * Chốt sổ: xác thực request_id còn trong Redis, tính cost + ot_multiplier, INSERT bất đồng bộ.
   * Tuyệt đối không lưu nội dung code (chỉ metadata tài chính).
   */
  async finalize(context: CompletionContext): Promise<void> {
    try {
      const stillPending = await this.redisService.clearPending(context.requestId);
      if (!stillPending) {
        this.logger.logBusiness(AuditLogService.name, 'Request không còn PENDING, có thể đã chốt', {
          requestId: context.requestId,
        });
      }

      const otMultiplier = await this.settingsService.resolveOtMultiplier(context.requestedAt);
      const costUsd = this.pricingService.computeCostUsd(context.model, context.usage);

      await this.auditModel.create({
        requestId: context.requestId,
        taskId: context.taskId,
        requesterId: context.requesterId,
        projectId: context.projectId ?? null,
        conversationId: context.conversationId ?? null,
        messageCount: context.messageCount ?? null,
        requestBytes: context.requestBytes ?? null,
        requestedAt: context.requestedAt,
        completedAt: context.completedAt,
        promptTokens: context.usage.promptTokens,
        completionTokens: context.usage.completionTokens,
        systemOverheadTokens: context.usage.systemOverheadTokens,
        aiModelUsed: context.model,
        costUsd,
        otMultiplier,
        taskStatus: context.status,
        source: context.source ?? 'GATEWAY',
        captureMode: context.captureMode ?? 'REALTIME',
      } as AiRequestAuditLogEntity);

      this.logger.logBusiness(AuditLogService.name, 'Đã ghi audit log', {
        requestId: context.requestId,
        costUsd,
        otMultiplier,
      });
    } catch (error) {
      this.logger.error('Ghi audit log thất bại', (error as Error).stack);
    }
  }
}
