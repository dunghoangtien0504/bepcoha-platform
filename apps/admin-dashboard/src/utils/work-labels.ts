import type {
  ProjectMemberRole,
  ProjectPhaseStatus,
  ProjectStatus,
  WorkTaskPriority,
  WorkTaskProgressSource,
  WorkTaskStatus,
} from '@/api/types';

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  draft: 'Nháp',
  active: 'Đang thực hiện',
  inactive: 'Ngừng hoạt động',
  on_hold: 'Tạm dừng',
  on_track: 'Đúng tiến độ',
  delayed: 'Chậm tiến độ',
  completed: 'Hoàn thành',
  cancelled: 'Hủy bỏ',
  archived: 'Lưu trữ',
};

export const PHASE_STATUS_LABELS: Record<ProjectPhaseStatus, string> = {
  pending: 'Chưa bắt đầu',
  in_progress: 'Đang thực hiện',
  on_hold: 'Tạm dừng',
  completed: 'Hoàn thành',
  cancelled: 'Hủy bỏ',
};

export const TASK_STATUS_LABELS: Record<WorkTaskStatus, string> = {
  todo: 'Chưa thực hiện',
  in_progress: 'Đang thực hiện',
  review: 'Chờ duyệt',
  blocked: 'Bị chặn',
  completed: 'Hoàn thành',
  cancelled: 'Hủy bỏ',
};

export const TASK_PRIORITY_LABELS: Record<WorkTaskPriority, string> = {
  low: 'Thấp',
  medium: 'Trung bình',
  high: 'Cao',
  urgent: 'Khẩn cấp',
};

export const TASK_PROGRESS_SOURCE_LABELS: Record<WorkTaskProgressSource, string> = {
  manual: 'Thủ công',
  auto: 'Tự động',
  checklist: 'Theo checklist',
  subtask: 'Theo công việc con',
};

export const MEMBER_ROLE_LABELS: Record<ProjectMemberRole, string> = {
  owner: 'Chủ sở hữu',
  manager: 'Quản lý',
  member: 'Thành viên',
  viewer: 'Người xem',
};

export const PROJECT_STATUS_OPTIONS = Object.entries(PROJECT_STATUS_LABELS).map(
  ([value, label]) => ({ value: value as ProjectStatus, label }),
);
export const PHASE_STATUS_OPTIONS = Object.entries(PHASE_STATUS_LABELS).map(([value, label]) => ({
  value: value as ProjectPhaseStatus,
  label,
}));
export const TASK_STATUS_OPTIONS = Object.entries(TASK_STATUS_LABELS).map(([value, label]) => ({
  value: value as WorkTaskStatus,
  label,
}));
export const TASK_PRIORITY_OPTIONS = Object.entries(TASK_PRIORITY_LABELS).map(
  ([value, label]) => ({ value: value as WorkTaskPriority, label }),
);
export const TASK_PROGRESS_SOURCE_OPTIONS = Object.entries(TASK_PROGRESS_SOURCE_LABELS).map(
  ([value, label]) => ({ value: value as WorkTaskProgressSource, label }),
);
export const MEMBER_ROLE_OPTIONS = Object.entries(MEMBER_ROLE_LABELS).map(([value, label]) => ({
  value: value as ProjectMemberRole,
  label,
}));

/** Lớp màu nền/badge theo trạng thái dự án. */
export function projectStatusClass(status: ProjectStatus): string {
  const map: Record<ProjectStatus, string> = {
    draft: 'bg-slate-100 text-slate-600',
    active: 'bg-blue-100 text-blue-700',
    inactive: 'bg-slate-100 text-slate-500',
    on_hold: 'bg-amber-100 text-amber-700',
    on_track: 'bg-emerald-100 text-emerald-700',
    delayed: 'bg-rose-100 text-rose-700',
    completed: 'bg-green-100 text-green-700',
    cancelled: 'bg-rose-100 text-rose-700',
    archived: 'bg-slate-200 text-slate-600',
  };
  return map[status];
}

export function taskStatusClass(status: WorkTaskStatus): string {
  const map: Record<WorkTaskStatus, string> = {
    todo: 'bg-slate-100 text-slate-600',
    in_progress: 'bg-blue-100 text-blue-700',
    review: 'bg-amber-100 text-amber-700',
    blocked: 'bg-rose-100 text-rose-700',
    completed: 'bg-green-100 text-green-700',
    cancelled: 'bg-slate-200 text-slate-500',
  };
  return map[status];
}

export function taskPriorityClass(priority: WorkTaskPriority): string {
  const map: Record<WorkTaskPriority, string> = {
    low: 'bg-slate-100 text-slate-600',
    medium: 'bg-blue-100 text-blue-700',
    high: 'bg-amber-100 text-amber-700',
    urgent: 'bg-rose-100 text-rose-700',
  };
  return map[priority];
}
