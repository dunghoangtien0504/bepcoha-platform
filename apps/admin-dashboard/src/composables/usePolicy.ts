import { ref, type CSSProperties } from 'vue';
import { settingsApi } from '@/api/endpoints';
import type { ProjectManagementPolicy, StatusVisual, WorkTask } from '@/api/types';

/** Key cấu hình chính sách quản lý dự án trong bảng system_settings. */
export const POLICY_SETTING_KEY = 'project.managenent.policy';

/**
 * Một số trạng thái nghiệp vụ hiện tại khác với vocabulary trong policy
 * (vd task.status='completed' ⇄ policy 'done'). Map alias để tra cứu màu/tiến độ.
 */
const TASK_STATUS_ALIAS: Record<string, string> = {
  completed: 'done',
};

// Singleton cấp module: chỉ tải policy 1 lần, chia sẻ cho mọi view.
const policy = ref<ProjectManagementPolicy | null>(null);
let loadPromise: Promise<void> | null = null;

async function ensureLoaded(): Promise<void> {
  if (policy.value) return;
  if (!loadPromise) {
    loadPromise = settingsApi
      .get(POLICY_SETTING_KEY)
      .then((setting) => {
        if (setting?.settingValue) {
          policy.value = JSON.parse(setting.settingValue) as ProjectManagementPolicy;
        }
      })
      .catch(() => {
        /* giữ null -> dùng fallback */
      });
  }
  await loadPromise;
}

/** Tra StatusVisual theo map, hỗ trợ alias; trả null nếu không khai báo. */
function lookup(
  map: Record<string, StatusVisual> | undefined,
  status: string,
  alias?: Record<string, string>,
): StatusVisual | null {
  if (!map) return null;
  return map[status] ?? (alias?.[status] ? map[alias[status]] ?? null : null);
}

/** Style badge (inline) từ StatusVisual: chữ + nền màu hex theo policy. */
function badgeStyle(visual: StatusVisual | null): CSSProperties {
  if (!visual) return {};
  return { color: visual.color, backgroundColor: visual.background };
}

export function usePolicy() {
  const taskVisual = (status: string): StatusVisual | null =>
    lookup(policy.value?.task.status_visual_map, status, TASK_STATUS_ALIAS);
  const phaseVisual = (status: string): StatusVisual | null =>
    lookup(policy.value?.phase.status_visual_map, status);
  const projectVisual = (status: string): StatusVisual | null =>
    lookup(policy.value?.project.status_visual_map, status);

  /**
   * Tiến độ một task theo policy: mặc định auto theo status_progress_map (auto_update_progress).
   * Manual override chỉ thắng khi user chủ động đặt giá trị (nguồn = manual & % > 0).
   */
  const taskProgress = (task: Pick<WorkTask, 'status' | 'progressPercent' | 'progressSource'>): number => {
    const p = policy.value?.task;
    const stored = Number(task.progressPercent) || 0;
    if (p?.auto_update_progress) {
      if (task.progressSource === 'manual' && stored > 0) return stored;
      const mapped = p.status_progress_map[task.status] ?? p.status_progress_map[TASK_STATUS_ALIAS[task.status]];
      if (typeof mapped === 'number') return mapped;
    }
    return stored;
  };

  /** Tiến độ Phase: trung bình có trọng số theo estimated_hours (fallback avg đều). */
  const phaseProgress = (tasks: WorkTask[]): number => {
    if (tasks.length === 0) return 0;
    let weightSum = 0;
    let weighted = 0;
    let plainSum = 0;
    for (const t of tasks) {
      const prog = taskProgress(t);
      const w = Number(t.estimatedHours) || 0;
      weightSum += w;
      weighted += prog * w;
      plainSum += prog;
    }
    if (weightSum > 0) return Math.round(weighted / weightSum);
    return Math.round(plainSum / tasks.length);
  };

  /** Tiến độ Project: trung bình tiến độ các phase (fallback avg_phases). */
  const projectProgress = (phaseValues: number[]): number => {
    if (phaseValues.length === 0) return 0;
    return Math.round(phaseValues.reduce((a, b) => a + b, 0) / phaseValues.length);
  };

  /** Ngưỡng hiển thị (màu + nhãn) cho tiến độ project theo visual_thresholds. */
  const projectThreshold = (progress: number): { color: string; label: string } | null => {
    const thresholds = policy.value?.kpi.project_progress.visual_thresholds;
    if (!thresholds) return null;
    for (const t of Object.values(thresholds)) {
      const okMin = t.min === undefined || progress >= t.min;
      const okMax = t.max === undefined || progress <= t.max;
      if (okMin && okMax) return { color: t.color, label: t.label };
    }
    return null;
  };

  return {
    policy,
    ensureLoaded,
    taskVisual,
    phaseVisual,
    projectVisual,
    badgeStyle,
    taskProgress,
    phaseProgress,
    projectProgress,
    projectThreshold,
  };
}
