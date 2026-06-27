import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { AppLoggerService } from '../../common/logger/app-logger.service';
import {
  buildCycleKey,
  buildTaskKey,
  CYCLE_TTL_SECONDS,
  formatDateOnly,
  QuotaCycle,
} from '../../common/utils/cycle.util';
import { AiTaskEntity, TokenQuotaAddonEntity, UserTokenQuotaEntity } from '../../database/models';
import { RedisService } from '../../redis/redis.service';
import { NotificationService } from '../notification/notification.service';

interface CycleStatus {
  cycle: QuotaCycle | 'TASK';
  used: number;
  limit: number;
  unlimited: boolean;
}

export interface QuotaSnapshot {
  userId: string;
  taskId: string;
  cycles: CycleStatus[];
}

@Injectable()
export class QuotaService {
  constructor(
    private readonly redisService: RedisService,
    private readonly logger: AppLoggerService,
    @InjectModel(UserTokenQuotaEntity) private readonly quotaModel: typeof UserTokenQuotaEntity,
    @InjectModel(TokenQuotaAddonEntity) private readonly addonModel: typeof TokenQuotaAddonEntity,
    @InjectModel(AiTaskEntity) private readonly aiTaskModel: typeof AiTaskEntity,
    private readonly notify: NotificationService,
  ) {
    this.logger.setContext(QuotaService.name);
  }

  /**
   * Kiểm tra hạn ngạch real-time trước khi forward. Ném 403 nếu bất kỳ chu kỳ nào đã chạm trần.
   * Giới hạn hiệu dụng = limit mặc định (DB) + tổng addon còn hiệu lực (cộng dồn).
   */
  async assertWithinQuota(userId: string, taskId: string, at = new Date()): Promise<QuotaSnapshot> {
    const snapshot = await this.buildSnapshot(userId, taskId, at);
    const breached = snapshot.cycles.find(
      (status) => !status.unlimited && status.used >= status.limit,
    );
    if (breached) {
      this.logger.logBusiness(QuotaService.name, 'Chặn request vượt hạn ngạch', {
        userId,
        taskId,
        cycle: breached.cycle,
        used: breached.used,
        limit: breached.limit,
      });
      this.notify.emit('quota.exceeded', {
        userId,
        taskId,
        cycle: breached.cycle,
        used: breached.used,
        limit: breached.limit,
      });
      throw new ForbiddenException(
        `Vượt hạn ngạch token chu kỳ ${breached.cycle} (đã dùng ${breached.used}/${breached.limit}).`,
      );
    }
    return snapshot;
  }

  async buildSnapshot(userId: string, taskId: string, at = new Date()): Promise<QuotaSnapshot> {
    const quota = await this.quotaModel.findOne({ where: { userId } });
    const baseLimits: Record<QuotaCycle, number> = {
      DAILY: quota?.dailyLimit ?? 0,
      WEEKLY: quota?.weeklyLimit ?? 0,
      MONTHLY: quota?.monthlyLimit ?? 0,
    };
    // Ngân sách token theo task: ưu tiên ai_tasks.budget_tokens (đặt khi giao việc cho AI);
    // nếu task chưa khai báo budget thì fallback về hạn mức task mặc định của user.
    const userTaskLimit = quota?.taskLimit ?? 0;
    let taskLimit = userTaskLimit;
    const aiTask = await this.aiTaskModel.findByPk(taskId);
    if (aiTask?.budgetTokens && aiTask.budgetTokens > 0) {
      taskLimit = aiTask.budgetTokens;
    }

    const cycles: CycleStatus[] = [];
    for (const cycle of ['DAILY', 'WEEKLY', 'MONTHLY'] as QuotaCycle[]) {
      const addon = await this.sumActiveAddons(userId, cycle, at);
      const effectiveLimit = baseLimits[cycle] + addon;
      const used = await this.redisService.getUsage(buildCycleKey(userId, cycle, at));
      cycles.push({
        cycle,
        used,
        limit: effectiveLimit,
        unlimited: effectiveLimit <= 0,
      });
    }

    const taskUsed = await this.redisService.getUsage(buildTaskKey(userId, taskId));
    cycles.push({ cycle: 'TASK', used: taskUsed, limit: taskLimit, unlimited: taskLimit <= 0 });

    return { userId, taskId, cycles };
  }

  /**
   * Cộng dồn token đã tiêu thụ vào counter Redis cho tất cả chu kỳ + task sau khi stream xong.
   */
  async recordUsage(userId: string, taskId: string, tokens: number, at = new Date()): Promise<void> {
    if (tokens <= 0) return;
    try {
      for (const cycle of ['DAILY', 'WEEKLY', 'MONTHLY'] as QuotaCycle[]) {
        await this.redisService.incrementUsage(
          buildCycleKey(userId, cycle, at),
          tokens,
          CYCLE_TTL_SECONDS[cycle],
        );
      }
      await this.redisService.incrementUsage(
        buildTaskKey(userId, taskId),
        tokens,
        CYCLE_TTL_SECONDS.MONTHLY,
      );
    } catch (error) {
      this.logger.error('Ghi nhận usage vào Redis thất bại', (error as Error).stack);
    }
  }

  /**
   * Tổng token addon còn hiệu lực cho một chu kỳ: ONCE cộng một lần, còn lại khớp cycle_type.
   */
  private async sumActiveAddons(userId: string, cycle: QuotaCycle, at: Date): Promise<number> {
    const today = formatDateOnly(at);
    const addons = await this.addonModel.findAll({
      where: {
        userId,
        status: 'ACTIVE',
        startDate: { [Op.lte]: today },
        cycleType: { [Op.in]: ['ONCE', cycle] },
      },
    });
    return addons.reduce((total, addon) => total + addon.addonTokens, 0);
  }
}
