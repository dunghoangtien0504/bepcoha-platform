import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { createHash } from 'crypto';
import { Op, WhereOptions } from 'sequelize';
import { AppLoggerService } from '../../common/logger/app-logger.service';
import { AiPromptEntity } from '../../database/models';
import { SettingsService } from '../settings/settings.service';

export interface CapturePromptInput {
  requestId?: string | null;
  taskId?: string | null;
  projectId?: string | null;
  requesterId?: string | null;
  conversationId?: string | null;
  model?: string | null;
  promptText: string;
  promptTokens?: number;
  completionTokens?: number;
}

export type PromptQuality = 'good' | 'poor';

/** Prompt + đánh giá chất lượng (tính lúc đọc theo ngưỡng cấu hình). */
export interface AnalyzedPrompt {
  id: number;
  taskId: string | null;
  projectId: string | null;
  requesterId: string | null;
  conversationId: string | null;
  model: string | null;
  contentPreview: string | null;
  contentHash: string | null;
  charCount: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  seqInConversation: number;
  isCached: boolean;
  isKnowledge: boolean;
  createdAt: Date;
  quality: PromptQuality;
  qualityScore: number;
  reasons: string[];
}

export interface PromptFilters {
  projectId?: string;
  taskId?: string;
  requesterId?: string;
  quality?: PromptQuality;
  limit?: number;
}

export interface PromptPerformance {
  total: number;
  good: number;
  poor: number;
  goodPercent: number;
  wastedTokens: number;
  byProject: { key: string; label: string; good: number; poor: number }[];
  byUser: { key: string; label: string; good: number; poor: number }[];
}

@Injectable()
export class PromptService {
  constructor(
    private readonly logger: AppLoggerService,
    private readonly settingsService: SettingsService,
    @InjectModel(AiPromptEntity) private readonly promptModel: typeof AiPromptEntity,
  ) {
    this.logger.setContext(PromptService.name);
  }

  /** Lưu prompt (bản rút gọn + hash) khi capture từ extension/MCP. Bỏ qua nếu không có nội dung. */
  async capture(input: CapturePromptInput): Promise<void> {
    const text = (input.promptText ?? '').trim();
    if (!text) return;
    try {
      const cfg = await this.settingsService.getAnalyticsConfig();
      const hash = createHash('sha256').update(text).digest('hex');
      const seq = input.conversationId
        ? (await this.promptModel.count({ where: { conversationId: input.conversationId } })) + 1
        : 1;
      await this.promptModel.create({
        requestId: input.requestId ?? null,
        taskId: input.taskId ?? null,
        projectId: input.projectId ?? null,
        requesterId: input.requesterId ?? null,
        conversationId: input.conversationId ?? null,
        model: input.model ?? null,
        contentPreview: text.slice(0, cfg.promptPreviewChars),
        contentHash: hash,
        charCount: text.length,
        promptTokens: input.promptTokens ?? 0,
        completionTokens: input.completionTokens ?? 0,
        totalTokens: (input.promptTokens ?? 0) + (input.completionTokens ?? 0),
        seqInConversation: seq,
      } as unknown as AiPromptEntity);
    } catch (error) {
      this.logger.warn(`Capture prompt thất bại: ${(error as Error).message}`);
    }
  }

  /** Đánh giá chất lượng cả tập (tính trên ngữ cảnh: loop, token cao, trùng nội dung). */
  private async analyze(prompts: AiPromptEntity[]): Promise<AnalyzedPrompt[]> {
    const cfg = await this.settingsService.getAnalyticsConfig();
    const maxSeq = cfg.wasteMaxPromptsPerConversation;
    const highToken = cfg.promptHighTokenThreshold;

    // Đếm trùng (conversation + hash) để phát hiện lặp context.
    const dupCount = new Map<string, number>();
    for (const p of prompts) {
      if (!p.conversationId || !p.contentHash) continue;
      const k = `${p.conversationId}|${p.contentHash}`;
      dupCount.set(k, (dupCount.get(k) ?? 0) + 1);
    }

    return prompts.map((p) => {
      const reasons: string[] = [];
      if (p.seqInConversation > maxSeq) reasons.push(`Hội thoại lặp nhiều (prompt #${p.seqInConversation})`);
      if (p.totalTokens > highToken) reasons.push(`Token cao bất thường (${p.totalTokens})`);
      const dupKey = p.conversationId && p.contentHash ? `${p.conversationId}|${p.contentHash}` : '';
      if (dupKey && (dupCount.get(dupKey) ?? 0) > 1) reasons.push('Lặp lại context (trùng nội dung)');
      const quality: PromptQuality = reasons.length > 0 ? 'poor' : 'good';
      const qualityScore = Math.max(0, 100 - reasons.length * 30);
      return {
        id: p.id,
        taskId: p.taskId,
        projectId: p.projectId,
        requesterId: p.requesterId,
        conversationId: p.conversationId,
        model: p.model,
        contentPreview: p.contentPreview,
        contentHash: p.contentHash,
        charCount: p.charCount,
        promptTokens: p.promptTokens,
        completionTokens: p.completionTokens,
        totalTokens: p.totalTokens,
        seqInConversation: p.seqInConversation,
        isCached: p.isCached,
        isKnowledge: p.isKnowledge,
        createdAt: p.createdAt,
        quality,
        qualityScore,
        reasons,
      };
    });
  }

  async list(filters: PromptFilters): Promise<AnalyzedPrompt[]> {
    const where: WhereOptions = {};
    if (filters.projectId) where.projectId = filters.projectId;
    if (filters.taskId) where.taskId = filters.taskId;
    if (filters.requesterId) where.requesterId = filters.requesterId;
    const rows = await this.promptModel.findAll({
      where,
      order: [['id', 'DESC']],
      limit: Math.min(filters.limit ?? 200, 1000),
    });
    let analyzed = await this.analyze(rows);
    if (filters.quality) analyzed = analyzed.filter((p) => p.quality === filters.quality);
    return analyzed;
  }

  /** Số lượng prompt chất lượng/kém theo dự án & người dùng (Prompt Performance). */
  async getPerformance(filters: PromptFilters): Promise<PromptPerformance> {
    const where: WhereOptions = {};
    if (filters.projectId) where.projectId = filters.projectId;
    if (filters.requesterId) where.requesterId = filters.requesterId;
    const rows = await this.promptModel.findAll({ where });
    const analyzed = await this.analyze(rows);

    const byProject = new Map<string, { key: string; label: string; good: number; poor: number }>();
    const byUser = new Map<string, { key: string; label: string; good: number; poor: number }>();
    let good = 0;
    let poor = 0;
    let wastedTokens = 0;
    for (const p of analyzed) {
      if (p.quality === 'good') good += 1;
      else {
        poor += 1;
        wastedTokens += p.totalTokens;
      }
      const pk = p.projectId ?? 'none';
      const pg = byProject.get(pk) ?? { key: pk, label: pk === 'none' ? 'Chưa gắn dự án' : `Dự án ${pk}`, good: 0, poor: 0 };
      pg[p.quality] += 1;
      byProject.set(pk, pg);
      const uk = p.requesterId ?? 'none';
      const ug = byUser.get(uk) ?? { key: uk, label: uk === 'none' ? '—' : uk, good: 0, poor: 0 };
      ug[p.quality] += 1;
      byUser.set(uk, ug);
    }
    const total = analyzed.length;
    return {
      total,
      good,
      poor,
      goodPercent: total ? Number(((good / total) * 100).toFixed(1)) : 0,
      wastedTokens,
      byProject: [...byProject.values()].sort((a, b) => b.poor - a.poor),
      byUser: [...byUser.values()].sort((a, b) => b.poor - a.poor),
    };
  }

  async listCached(): Promise<AnalyzedPrompt[]> {
    const rows = await this.promptModel.findAll({
      where: { [Op.or]: [{ isCached: true }, { isKnowledge: true }] },
      order: [['id', 'DESC']],
    });
    return this.analyze(rows);
  }

  async setFlag(id: number, flag: 'cache' | 'knowledge', value: boolean): Promise<AiPromptEntity> {
    const prompt = await this.promptModel.findByPk(id);
    if (!prompt) throw new NotFoundException('Không tìm thấy prompt');
    if (flag === 'cache') prompt.isCached = value;
    else prompt.isKnowledge = value;
    await prompt.save();
    return prompt;
  }
}
