import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, WhereOptions } from 'sequelize';
import { AppLoggerService } from '../../common/logger/app-logger.service';
import {
  formatDateOnly,
  formatMonth,
  getIsoWeek,
  QuotaCycle,
} from '../../common/utils/cycle.util';
import {
  AiRequestAuditLogEntity,
  AiTaskEntity,
  AppUserEntity,
  ProjectEntity,
  TaskCategoryEntity,
  TaskEntity,
} from '../../database/models';
import { SettingsService } from '../settings/settings.service';
import { CurrencyService } from './currency.service';

export interface DateRange {
  from?: string;
  to?: string;
}

export interface RoiSummary {
  totalAiCostUsd: number;
  totalAiCostVnd: number;
  totalTokens: number;
  laborValueSavedUsd: number;
  laborValueSavedVnd: number;
  netRoiUsd: number;
  netRoiVnd: number;
  usdToVnd: number;
  requestCount: number;
}

export interface TrendPoint {
  period: string;
  tokens: number;
  costUsd: number;
}

export interface TaskPerformance {
  taskId: string;
  projectId: number | null;
  title: string;
  status: string;
  baselineHours: number;
  actualHours: number;
  promptCount: number;
  totalTokens: number;
  /** Chi phí AI thực tế (USD) quy đổi từ token. */
  costUsd: number;
  /** Chi phí nếu làm thủ công = baselineHours × đơn giá giờ công TB (USD). */
  humanCostUsd: number;
  /** Giá trị tiết kiệm = (baseline − actual) × rate × OT, không âm. */
  savedValueUsd: number;
}

export interface ProjectPerformance {
  projectId: number | null;
  projectName: string;
  taskCount: number;
  requestCount: number;
  totalTokens: number;
  totalCostUsd: number;
  baselineHours: number;
  savedValueUsd: number;
}

export interface AnomalyAlert {
  taskId: string;
  title: string;
  promptCount: number;
  totalCostVnd: number;
  status: string;
  reasons: string[];
}

/** 2.1 — ROI thực tế (AI vs Human). */
export interface RoiRealReport {
  taskCount: number;
  devRateUsd: number;
  reviewHoursPerTask: number;
  humanCostUsd: number;
  aiTokenCostUsd: number;
  reviewCostUsd: number;
  savedUsd: number;
  savedVnd: number;
  usdToVnd: number;
  formula: string;
}

/** 2.2 — Hiệu suất Model theo loại công việc. */
export interface ModelEfficiencyRow {
  category: string;
  model: string;
  requests: number;
  totalTokens: number;
  totalCostUsd: number;
  avgCostUsd: number;
  avgTokens: number;
  avgDurationMs: number | null;
  bestCost: boolean;
  bestSpeed: boolean;
}

/** 2.3 — Token lãng phí. */
export interface TokenWasteReport {
  totalTokens: number;
  wastedTokens: number;
  wastePercent: number;
  wastedCostUsd: number;
  wastedVnd: number;
  threshold: number;
  offenders: { key: string; label: string; prompts: number; wastedTokens: number }[];
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly currencyService: CurrencyService,
    private readonly settingsService: SettingsService,
    private readonly logger: AppLoggerService,
    @InjectModel(AiRequestAuditLogEntity)
    private readonly auditModel: typeof AiRequestAuditLogEntity,
    @InjectModel(AiTaskEntity) private readonly taskModel: typeof AiTaskEntity,
    @InjectModel(AppUserEntity) private readonly userModel: typeof AppUserEntity,
    @InjectModel(ProjectEntity) private readonly projectModel: typeof ProjectEntity,
    @InjectModel(TaskEntity) private readonly workTaskModel: typeof TaskEntity,
  ) {
    this.logger.setContext(ReportsService.name);
  }

  /** Bản đồ đơn giá giờ công (USD) theo email nhân sự để tính giá trị lao động. */
  private async loadRateByEmail(): Promise<Map<string, number>> {
    const users = await this.userModel.findAll();
    return new Map(users.map((user) => [user.email, Number(user.hourlyRateUsd)]));
  }

  private buildRangeWhere(range: DateRange): WhereOptions<AiRequestAuditLogEntity> {
    const where: Record<symbol, Date> = {};
    if (range.from) where[Op.gte as unknown as symbol] = new Date(range.from);
    if (range.to) where[Op.lte as unknown as symbol] = new Date(range.to);
    return Object.getOwnPropertySymbols(where).length > 0 ? { requestedAt: where } : {};
  }

  /**
   * KPI tài chính tổng thể: chi phí AI, giá trị nhân công tiết kiệm và Net ROI.
   * Labor saved = Σ (baseline - actual) × hourly_rate × ot_multiplier theo từng task.
   */
  async getSummary(range: DateRange): Promise<RoiSummary> {
    const where = this.buildRangeWhere(range);
    const logs = await this.auditModel.findAll({ where, include: [AiTaskEntity] });
    const usdToVnd = await this.currencyService.getUsdToVnd();
    const users = await this.userModel.findAll();
    const rateByEmail = new Map(users.map((user) => [user.email, Number(user.hourlyRateUsd)]));

    let totalAiCostUsd = 0;
    let totalTokens = 0;
    for (const log of logs) {
      totalAiCostUsd += Number(log.costUsd);
      totalTokens += log.promptTokens + log.completionTokens + log.systemOverheadTokens;
    }

    const laborValueSavedUsd = await this.computeLaborSaved(logs, rateByEmail);
    const netRoiUsd = laborValueSavedUsd - totalAiCostUsd;

    return {
      totalAiCostUsd: Number(totalAiCostUsd.toFixed(4)),
      totalAiCostVnd: Math.round(totalAiCostUsd * usdToVnd),
      totalTokens,
      laborValueSavedUsd: Number(laborValueSavedUsd.toFixed(4)),
      laborValueSavedVnd: Math.round(laborValueSavedUsd * usdToVnd),
      netRoiUsd: Number(netRoiUsd.toFixed(4)),
      netRoiVnd: Math.round(netRoiUsd * usdToVnd),
      usdToVnd,
      requestCount: logs.length,
    };
  }

  /**
   * Giá trị nhân công tiết kiệm tính trên các task đã DONE (đã biết kết quả thực tế).
   * T_actual xấp xỉ = khoảng wall-clock từ request đầu tới response cuối của task (giờ).
   */
  private async computeLaborSaved(
    logs: AiRequestAuditLogEntity[],
    rateByEmail: Map<string, number>,
  ): Promise<number> {
    const calendar = await this.settingsService.getCalendarConfig();
    const grouped = new Map<string, AiRequestAuditLogEntity[]>();
    for (const log of logs) {
      const bucket = grouped.get(log.taskId) ?? [];
      bucket.push(log);
      grouped.set(log.taskId, bucket);
    }

    let total = 0;
    for (const [taskId, taskLogs] of grouped) {
      const task = taskLogs[0].task ?? (await this.taskModel.findByPk(taskId));
      if (!task || task.status !== 'DONE') continue;

      const actualHours = this.estimateActualHours(taskLogs);
      const savedHours = Number(task.baselineHours) - actualHours;
      if (savedHours <= 0) continue;

      const avgRate = this.averageRate(taskLogs, rateByEmail);
      const avgOt = this.averageOt(taskLogs, calendar.otMultiplier);
      total += savedHours * avgRate * avgOt;
    }
    return total;
  }

  private estimateActualHours(logs: AiRequestAuditLogEntity[]): number {
    const starts = logs.map((log) => log.requestedAt.getTime());
    const ends = logs.map((log) => (log.completedAt ?? log.requestedAt).getTime());
    const spanMs = Math.max(...ends) - Math.min(...starts);
    return Number((spanMs / 3_600_000).toFixed(2));
  }

  private averageRate(
    logs: AiRequestAuditLogEntity[],
    rateByEmail: Map<string, number>,
  ): number {
    const rates = logs.map((log) => rateByEmail.get(log.requesterId) ?? 0).filter((r) => r > 0);
    if (rates.length === 0) return 0;
    return rates.reduce((sum, value) => sum + value, 0) / rates.length;
  }

  private averageOt(logs: AiRequestAuditLogEntity[], fallback: number): number {
    if (logs.length === 0) return fallback;
    const values = logs.map((log) => Number(log.otMultiplier) || fallback);
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  async getTrends(granularity: QuotaCycle, range: DateRange): Promise<TrendPoint[]> {
    const where = this.buildRangeWhere(range);
    const logs = await this.auditModel.findAll({ where, order: [['requestedAt', 'ASC']] });
    const buckets = new Map<string, TrendPoint>();

    for (const log of logs) {
      const period = this.bucketKey(log.requestedAt, granularity);
      const point = buckets.get(period) ?? { period, tokens: 0, costUsd: 0 };
      point.tokens += log.promptTokens + log.completionTokens + log.systemOverheadTokens;
      point.costUsd = Number((point.costUsd + Number(log.costUsd)).toFixed(6));
      buckets.set(period, point);
    }
    return Array.from(buckets.values()).sort((a, b) => a.period.localeCompare(b.period));
  }

  private bucketKey(date: Date, granularity: QuotaCycle): string {
    if (granularity === 'WEEKLY') return getIsoWeek(date);
    if (granularity === 'MONTHLY') return formatMonth(date);
    return formatDateOnly(date);
  }

  /**
   * Đơn giá giờ công fallback cho task chưa có log AI gắn nhân sự.
   * Ưu tiên setting key `default_hourly_rate_usd` (>0); nếu = 0 thì dùng TB đơn giá toàn hệ thống.
   */
  private defaultRate(rateByEmail: Map<string, number>, configuredDefault: number): number {
    if (configuredDefault > 0) return configuredDefault;
    const rates = Array.from(rateByEmail.values()).filter((r) => r > 0);
    if (rates.length === 0) return 0;
    return rates.reduce((sum, value) => sum + value, 0) / rates.length;
  }

  /**
   * Hiệu suất từng task: liệt kê TOÀN BỘ task (kể cả chưa phát sinh request AI) để so
   * sánh chi phí token vs giá trị giờ công. Task chưa có log → chỉ số AI = 0, vẫn hiển thị
   * baseline & chi phí nhân công ước tính theo đơn giá TB.
   */
  async getTaskPerformance(range: DateRange): Promise<TaskPerformance[]> {
    const where = this.buildRangeWhere(range);
    const logs = await this.auditModel.findAll({ where, include: [AiTaskEntity] });
    const calendar = await this.settingsService.getCalendarConfig();
    const economic = await this.settingsService.getEconomicConfig();
    const rateByEmail = await this.loadRateByEmail();
    const fallbackRate = this.defaultRate(rateByEmail, economic.defaultHourlyRateUsd);

    const grouped = new Map<string, AiRequestAuditLogEntity[]>();
    for (const log of logs) {
      const bucket = grouped.get(log.taskId) ?? [];
      bucket.push(log);
      grouped.set(log.taskId, bucket);
    }

    const tasks = await this.taskModel.findAll();
    const result: TaskPerformance[] = [];
    for (const task of tasks) {
      const taskLogs = grouped.get(task.id) ?? [];
      const hasLogs = taskLogs.length > 0;
      const costUsd = taskLogs.reduce((sum, log) => sum + Number(log.costUsd), 0);
      const totalTokens = taskLogs.reduce(
        (sum, log) => sum + log.promptTokens + log.completionTokens + log.systemOverheadTokens,
        0,
      );
      const baselineHours = Number(task.baselineHours);
      const actualHours = hasLogs ? this.estimateActualHours(taskLogs) : 0;
      const avgRate = hasLogs ? this.averageRate(taskLogs, rateByEmail) || fallbackRate : fallbackRate;
      const avgOt = this.averageOt(taskLogs, calendar.otMultiplier);
      const savedValueUsd = Math.max(0, (baselineHours - actualHours) * avgRate * avgOt);

      result.push({
        taskId: task.id,
        projectId: task.projectId ?? null,
        title: task.title,
        status: task.status,
        baselineHours,
        actualHours,
        promptCount: taskLogs.length,
        totalTokens,
        costUsd: Number(costUsd.toFixed(4)),
        humanCostUsd: Number((baselineHours * avgRate).toFixed(4)),
        savedValueUsd: Number(savedValueUsd.toFixed(4)),
      });
    }
    return result.sort((a, b) => b.costUsd - a.costUsd || b.baselineHours - a.baselineHours);
  }

  /**
   * Hiệu suất AI gộp theo dự án: số task, request, token, chi phí AI và giá trị tiết kiệm.
   * Dùng cho trang "Dự án" (tổng quan) + trang chi tiết một dự án.
   */
  async getProjectPerformance(range: DateRange): Promise<ProjectPerformance[]> {
    const tasks = await this.getTaskPerformance(range);
    const projects = await this.projectModel.findAll();
    const nameById = new Map(projects.map((p) => [p.id, p.name]));

    const grouped = new Map<number | null, ProjectPerformance>();
    for (const task of tasks) {
      const key = task.projectId;
      const row =
        grouped.get(key) ??
        ({
          projectId: key,
          projectName: key !== null ? nameById.get(key) ?? `Dự án #${key}` : 'Chưa gắn dự án',
          taskCount: 0,
          requestCount: 0,
          totalTokens: 0,
          totalCostUsd: 0,
          baselineHours: 0,
          savedValueUsd: 0,
        } as ProjectPerformance);
      row.taskCount += 1;
      row.requestCount += task.promptCount;
      row.totalTokens += task.totalTokens;
      row.totalCostUsd = Number((row.totalCostUsd + task.costUsd).toFixed(4));
      row.baselineHours += task.baselineHours;
      row.savedValueUsd = Number((row.savedValueUsd + task.savedValueUsd).toFixed(4));
      grouped.set(key, row);
    }
    return Array.from(grouped.values()).sort((a, b) => b.totalCostUsd - a.totalCostUsd);
  }

  /**
   * Gắn cờ task bất thường: số prompt vượt ngưỡng hoặc chi phí vượt ngưỡng nhưng vẫn IN_PROGRESS.
   * Ngưỡng lấy từ setting key (anomaly_prompt_threshold / anomaly_cost_threshold_vnd) — đổi được runtime.
   */
  async getAnomalies(range: DateRange): Promise<AnomalyAlert[]> {
    const where = this.buildRangeWhere(range);
    const logs = await this.auditModel.findAll({ where, include: [AiTaskEntity] });
    const usdToVnd = await this.currencyService.getUsdToVnd();
    const economic = await this.settingsService.getEconomicConfig();
    const promptThreshold = economic.anomalyPromptThreshold;
    const costThresholdVnd = economic.anomalyCostThresholdVnd;

    const grouped = new Map<string, AiRequestAuditLogEntity[]>();
    for (const log of logs) {
      const bucket = grouped.get(log.taskId) ?? [];
      bucket.push(log);
      grouped.set(log.taskId, bucket);
    }

    const alerts: AnomalyAlert[] = [];
    for (const [taskId, taskLogs] of grouped) {
      const task = taskLogs[0].task ?? (await this.taskModel.findByPk(taskId));
      if (!task) continue;
      const promptCount = taskLogs.length;
      const totalCostVnd = Math.round(
        taskLogs.reduce((sum, log) => sum + Number(log.costUsd), 0) * usdToVnd,
      );
      const reasons: string[] = [];
      if (promptCount > promptThreshold && task.status === 'IN_PROGRESS') {
        reasons.push(`Số prompt cao bất thường (${promptCount}) khi task chưa merge`);
      }
      if (totalCostVnd > costThresholdVnd && task.status === 'IN_PROGRESS') {
        reasons.push(`Chi phí ${totalCostVnd.toLocaleString('vi-VN')}đ vượt ngưỡng khi chưa merge`);
      }
      if (reasons.length > 0) {
        alerts.push({ taskId, title: task.title, promptCount, totalCostVnd, status: task.status, reasons });
      }
    }
    return alerts;
  }

  /** Map ai_task.id → tên loại công việc (qua tasks.task_category_id). */
  private async categoryByAiTaskId(aiTasks: AiTaskEntity[]): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    const workTaskIds = [...new Set(aiTasks.map((t) => t.taskId).filter((x): x is number => x != null))];
    if (workTaskIds.length === 0) return map;
    const workTasks = await this.workTaskModel.findAll({
      where: { id: workTaskIds },
      include: [{ model: TaskCategoryEntity, as: 'category' }],
    });
    const catByWorkTask = new Map<number, string>();
    for (const wt of workTasks) catByWorkTask.set(wt.id, wt.category?.title ?? 'Chưa phân loại');
    for (const at of aiTasks) {
      if (at.taskId != null) map.set(at.id, catByWorkTask.get(at.taskId) ?? 'Chưa phân loại');
    }
    return map;
  }

  /**
   * 2.1 — ROI thực tế: Tiết kiệm = Σ(giờ ước tính × đơn giá) − (Σ chi phí token + Σ giờ review × đơn giá).
   * Đơn giá & số giờ review lấy từ setting key (default_hourly_rate_usd, roi_review_hours_per_task).
   */
  async getRoiReal(range: DateRange): Promise<RoiRealReport> {
    const where = this.buildRangeWhere(range);
    const logs = await this.auditModel.findAll({ where, include: [AiTaskEntity] });
    const usdToVnd = await this.currencyService.getUsdToVnd();
    const economic = await this.settingsService.getEconomicConfig();
    const analytics = await this.settingsService.getAnalyticsConfig();
    const rateByEmail = await this.loadRateByEmail();
    const fallbackRate = this.defaultRate(rateByEmail, economic.defaultHourlyRateUsd);
    const reviewHours = analytics.devReviewHoursPerTask;

    const grouped = new Map<string, AiRequestAuditLogEntity[]>();
    for (const log of logs) {
      const bucket = grouped.get(log.taskId) ?? [];
      bucket.push(log);
      grouped.set(log.taskId, bucket);
    }

    let humanCostUsd = 0;
    let aiTokenCostUsd = 0;
    let reviewCostUsd = 0;
    let taskCount = 0;
    for (const [taskId, taskLogs] of grouped) {
      const task = taskLogs[0].task ?? (await this.taskModel.findByPk(taskId));
      if (!task) continue;
      const rate = this.averageRate(taskLogs, rateByEmail) || fallbackRate;
      humanCostUsd += (Number(task.baselineHours) || 0) * rate;
      aiTokenCostUsd += taskLogs.reduce((sum, l) => sum + Number(l.costUsd), 0);
      reviewCostUsd += reviewHours * rate;
      taskCount += 1;
    }
    const savedUsd = humanCostUsd - (aiTokenCostUsd + reviewCostUsd);
    return {
      taskCount,
      devRateUsd: Number(fallbackRate.toFixed(2)),
      reviewHoursPerTask: reviewHours,
      humanCostUsd: Number(humanCostUsd.toFixed(2)),
      aiTokenCostUsd: Number(aiTokenCostUsd.toFixed(4)),
      reviewCostUsd: Number(reviewCostUsd.toFixed(2)),
      savedUsd: Number(savedUsd.toFixed(2)),
      savedVnd: Math.round(savedUsd * usdToVnd),
      usdToVnd,
      formula:
        'Tiết kiệm = Σ(giờ ước tính × đơn giá giờ) − (Σ chi phí token + Σ giờ review × đơn giá giờ)',
    };
  }

  /**
   * 2.2 — Ma trận hiệu suất Model theo loại công việc: rẻ nhất (avg cost) & nhanh nhất (avg duration).
   * Duration chỉ tính được với request đo realtime (GATEWAY); ESTIMATED không có → null.
   */
  async getModelEfficiency(range: DateRange): Promise<ModelEfficiencyRow[]> {
    const where = this.buildRangeWhere(range);
    const logs = await this.auditModel.findAll({ where, include: [AiTaskEntity] });
    const aiTasks = logs.map((l) => l.task).filter((t): t is AiTaskEntity => !!t);
    const catMap = await this.categoryByAiTaskId(aiTasks);

    interface Agg {
      category: string;
      model: string;
      requests: number;
      totalTokens: number;
      totalCostUsd: number;
      durMs: number[];
    }
    const agg = new Map<string, Agg>();
    for (const log of logs) {
      const category = (log.task && catMap.get(log.task.id)) || 'Chưa phân loại';
      const model = log.aiModelUsed || '—';
      const key = `${category}||${model}`;
      const row = agg.get(key) ?? { category, model, requests: 0, totalTokens: 0, totalCostUsd: 0, durMs: [] };
      row.requests += 1;
      row.totalTokens += log.promptTokens + log.completionTokens + log.systemOverheadTokens;
      row.totalCostUsd += Number(log.costUsd);
      if (log.completedAt) {
        const d = log.completedAt.getTime() - log.requestedAt.getTime();
        if (d > 1000) row.durMs.push(d);
      }
      agg.set(key, row);
    }

    const rows: ModelEfficiencyRow[] = [...agg.values()].map((r) => ({
      category: r.category,
      model: r.model,
      requests: r.requests,
      totalTokens: r.totalTokens,
      totalCostUsd: Number(r.totalCostUsd.toFixed(4)),
      avgCostUsd: Number((r.totalCostUsd / r.requests).toFixed(6)),
      avgTokens: Math.round(r.totalTokens / r.requests),
      avgDurationMs: r.durMs.length ? Math.round(r.durMs.reduce((a, b) => a + b, 0) / r.durMs.length) : null,
      bestCost: false,
      bestSpeed: false,
    }));

    const byCat = new Map<string, ModelEfficiencyRow[]>();
    for (const r of rows) {
      const list = byCat.get(r.category) ?? [];
      list.push(r);
      byCat.set(r.category, list);
    }
    for (const list of byCat.values()) {
      list.reduce((a, b) => (b.avgCostUsd < a.avgCostUsd ? b : a)).bestCost = true;
      const withDur = list.filter((r) => r.avgDurationMs != null);
      if (withDur.length) {
        withDur.reduce((a, b) =>
          (b.avgDurationMs as number) < (a.avgDurationMs as number) ? b : a,
        ).bestSpeed = true;
      }
    }
    return rows.sort((a, b) => a.category.localeCompare(b.category) || a.avgCostUsd - b.avgCostUsd);
  }

  /**
   * 2.3 — Token lãng phí: trong một hội thoại (conversation_id), các prompt vượt ngưỡng
   * (waste_max_prompts_per_conversation) bị tính là lãng phí (loop/agent kẹt/bổ sung prompt nhiều lần).
   */
  async getTokenWaste(range: DateRange): Promise<TokenWasteReport> {
    const where = this.buildRangeWhere(range);
    const logs = await this.auditModel.findAll({
      where,
      include: [AiTaskEntity],
      order: [['requestedAt', 'ASC']],
    });
    const analytics = await this.settingsService.getAnalyticsConfig();
    const usdToVnd = await this.currencyService.getUsdToVnd();
    const threshold = analytics.wasteMaxPromptsPerConversation;
    const tok = (l: AiRequestAuditLogEntity): number =>
      l.promptTokens + l.completionTokens + l.systemOverheadTokens;

    const groups = new Map<string, { label: string; logs: AiRequestAuditLogEntity[] }>();
    for (const log of logs) {
      const key = log.conversationId ? `conv:${log.conversationId}` : `task:${log.taskId}`;
      const label = log.conversationId
        ? `Hội thoại ${log.conversationId.slice(0, 8)}`
        : log.task?.title ?? `Task ${log.taskId.slice(0, 8)}`;
      const g = groups.get(key) ?? { label, logs: [] };
      g.logs.push(log);
      groups.set(key, g);
    }

    let totalTokens = 0;
    let wastedTokens = 0;
    let wastedCostUsd = 0;
    const offenders: { key: string; label: string; prompts: number; wastedTokens: number }[] = [];
    for (const [key, g] of groups) {
      totalTokens += g.logs.reduce((s, l) => s + tok(l), 0);
      if (g.logs.length > threshold) {
        const extra = g.logs.slice(threshold);
        const w = extra.reduce((s, l) => s + tok(l), 0);
        wastedTokens += w;
        wastedCostUsd += extra.reduce((s, l) => s + Number(l.costUsd), 0);
        offenders.push({ key, label: g.label, prompts: g.logs.length, wastedTokens: w });
      }
    }
    offenders.sort((a, b) => b.wastedTokens - a.wastedTokens);
    return {
      totalTokens,
      wastedTokens,
      wastePercent: totalTokens ? Number(((wastedTokens / totalTokens) * 100).toFixed(1)) : 0,
      wastedCostUsd: Number(wastedCostUsd.toFixed(4)),
      wastedVnd: Math.round(wastedCostUsd * usdToVnd),
      threshold,
      offenders: offenders.slice(0, 10),
    };
  }

  async listLogs(range: DateRange, limit = 100): Promise<AiRequestAuditLogEntity[]> {
    const where = this.buildRangeWhere(range);
    return this.auditModel.findAll({
      where,
      include: [AiTaskEntity],
      order: [['requestedAt', 'DESC']],
      limit: Math.min(limit, 500),
    });
  }
}
