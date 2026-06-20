import { Injectable } from '@nestjs/common';
import { SettingsService } from './settings.service';

/** Key cấu hình chính sách quản lý dự án trong system_settings. */
export const POLICY_SETTING_KEY = 'project.managenent.policy';

/** Phần policy backend dùng để tính KPI tiến độ (chỉ khai báo field cần thiết). */
interface TaskPolicy {
  auto_update_progress?: boolean;
  status_progress_map?: Record<string, number>;
}
interface PmPolicy {
  task?: TaskPolicy;
}

/** Đầu vào tối thiểu của một task để tính tiến độ KPI. */
export interface TaskProgressInput {
  status: string;
  progressPercent: number | null;
  progressSource: string;
  estimatedHours: number | null;
}

/** Một số trạng thái nghiệp vụ khác vocabulary policy (task.status='completed' ⇄ policy 'done'). */
const TASK_STATUS_ALIAS: Record<string, string> = { completed: 'done' };

/**
 * Tính KPI tiến độ (Task → Phase → Project) theo cấu hình `project.managenent.policy`.
 * Dùng chung cho mọi API trả về tiến độ để số liệu nhất quán giữa danh sách & chi tiết.
 */
@Injectable()
export class PolicyService {
  private cache: PmPolicy | null = null;
  private cachedAt = 0;
  private static readonly TTL_MS = 10_000;

  constructor(private readonly settingsService: SettingsService) {}

  async getPolicy(): Promise<PmPolicy | null> {
    if (this.cache && Date.now() - this.cachedAt < PolicyService.TTL_MS) return this.cache;
    const raw = await this.settingsService.getValue(POLICY_SETTING_KEY);
    if (!raw) return null;
    try {
      this.cache = JSON.parse(raw) as PmPolicy;
      this.cachedAt = Date.now();
      return this.cache;
    } catch {
      return null;
    }
  }

  /** Tiến độ một task: auto theo status_progress_map; manual override (source=manual & %>0) thắng. */
  taskProgress(policy: PmPolicy | null, task: TaskProgressInput): number {
    const stored = Number(task.progressPercent) || 0;
    const t = policy?.task;
    if (t?.auto_update_progress) {
      if (task.progressSource === 'manual' && stored > 0) return stored;
      const map = t.status_progress_map;
      const mapped = map?.[task.status] ?? map?.[TASK_STATUS_ALIAS[task.status]];
      if (typeof mapped === 'number') return mapped;
    }
    return stored;
  }

  /** Tiến độ Phase: trung bình có trọng số theo estimated_hours; fallback trung bình đều. */
  phaseProgress(policy: PmPolicy | null, tasks: TaskProgressInput[]): number {
    if (tasks.length === 0) return 0;
    let weightSum = 0;
    let weighted = 0;
    let plain = 0;
    for (const task of tasks) {
      const prog = this.taskProgress(policy, task);
      const w = Number(task.estimatedHours) || 0;
      weightSum += w;
      weighted += prog * w;
      plain += prog;
    }
    return weightSum > 0 ? Math.round(weighted / weightSum) : Math.round(plain / tasks.length);
  }

  /** Tiến độ Project: trung bình tiến độ các phase (fallback avg_phases). */
  projectProgress(phaseValues: number[]): number {
    if (phaseValues.length === 0) return 0;
    return Math.round(phaseValues.reduce((a, b) => a + b, 0) / phaseValues.length);
  }
}
