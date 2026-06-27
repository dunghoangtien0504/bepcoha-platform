/**
 * Cấu hình chính sách quản lý dự án (KPI, tiến độ, màu trạng thái, quy tắc bình luận)
 * dùng làm setting_value mặc định cho key `project.managenent.policy`.
 * Có thể chỉnh runtime tại màn hình Cấu hình hệ thống; FE đọc và render theo cấu hình này.
 */
export const PROJECT_MANAGEMENT_POLICY = {
  kpi: {
    custom: { auto_calc: false },
    phase_progress: {
      unit: '%',
      source: 'tasks.progress_percent',
      auto_calc: true,
      aggregation: 'avg',
    },
    project_progress: {
      unit: '%',
      source: 'tasks.progress_percent',
      auto_calc: true,
      visual_thresholds: {
        risk: { max: 79, min: 0, color: '#dc2626', label: 'Rủi ro' },
        success: { min: 100, color: '#16a34a', label: 'Đạt mục tiêu' },
        warning: { max: 99, min: 80, color: '#ea580c', label: 'Gần đạt' },
      },
    },
    task_progress_avg: {
      unit: '%',
      source: 'tasks.progress_percent',
      auto_calc: true,
      aggregation: 'avg',
    },
  },
  task: {
    comment: {
      actions: {
        self_comment: ['reply', 'edit', 'delete', 'copy_link'],
        other_comment: ['reply', 'mention', 'copy_link'],
        deleted_comment: ['copy_link'],
      },
      input_states: {
        sent: { label: 'Đã gửi' },
        edited: { label: 'Đã chỉnh sửa' },
        failed: { label: 'Gửi thất bại', allow_retry: true },
        typing: { label: 'Đang nhập', show_indicator: true },
        deleted: { label: 'Đã xoá', show_placeholder: true },
        sending: { label: 'Đang gửi', show_spinner: true },
      },
      nested_rules: {
        condition: {
          allow_reply: true,
          allow_self_reply: true,
          allow_deleted_comment_reply: false,
        },
        max_depth: 3,
        collapse_behavior: {
          enabled: true,
          default_state: 'collapsed',
          trigger_label: 'View {{count}} replies',
          collapse_after: 5,
        },
      },
      input_features: {
        emoji: true,
        markdown: false,
        attachments: true,
        paste_image: true,
        mention_user: true,
      },
    },
    status_visual_map: {
      done: { icon: '✅', color: '#16a34a', label: 'Hoàn thành', background: '#dcfce7' },
      todo: { icon: '📋', color: '#64748b', label: 'Chờ làm', background: '#f8fafc' },
      draft: { icon: '📝', color: '#94a3b8', label: 'Nháp', background: '#f1f5f9' },
      closed: { icon: '🔒', color: '#475569', label: 'Đã đóng', background: '#e2e8f0' },
      review: { icon: '🧐', color: '#7c3aed', label: 'Đang xem xét', background: '#ede9fe' },
      archived: { icon: '🗄️', color: '#334155', label: 'Lưu trữ', background: '#cbd5e1' },
      cancelled: { icon: '❌', color: '#991b1b', label: 'Đã huỷ', background: '#fee2e2' },
      in_progress: { icon: '⏳', color: '#2563eb', label: 'Đang thực hiện', background: '#dbeafe' },
    },
    status_progress_map: {
      done: 100,
      todo: 5,
      draft: 0,
      closed: 100,
      review: 80,
      archived: 100,
      cancelled: 0,
      in_progress: 50,
    },
    auto_update_progress: true,
    allow_manual_override: true,
  },
  phase: {
    status_visual_map: {
      pending: { icon: '⏳', color: '#64748b', label: 'Chờ thực hiện', background: '#f8fafc' },
      in_progress: { icon: '🚀', color: '#2563eb', label: 'Đang thực hiện', background: '#dbeafe' },
      on_hold: { icon: '⏸️', color: '#ea580c', label: 'Tạm dừng', background: '#ffedd5' },
      completed: { icon: '✅', color: '#16a34a', label: 'Hoàn thành', background: '#dcfce7' },
      cancelled: { icon: '❌', color: '#991b1b', label: 'Đã huỷ', background: '#fee2e2' },
    },
    weighted_field: 'estimated_hours',
    fallback_strategy: 'avg_tasks',
    calculation_strategy: 'weighted_tasks',
    allow_manual_override: true,
  },
  project: {
    status_visual_map: {
      draft: { icon: '📝', color: '#94a3b8', label: 'Nháp', background: '#f1f5f9' },
      active: { icon: '🚀', color: '#2563eb', label: 'Đang hoạt động', background: '#dbeafe' },
      inactive: { icon: '💤', color: '#64748b', label: 'Ngưng hoạt động', background: '#f8fafc' },
      on_hold: { icon: '⏸️', color: '#ea580c', label: 'Tạm dừng', background: '#ffedd5' },
      on_track: { icon: '🎯', color: '#16a34a', label: 'Đúng tiến độ', background: '#dcfce7' },
      delayed: { icon: '⚠️', color: '#dc2626', label: 'Trễ tiến độ', background: '#fee2e2' },
      completed: { icon: '🏆', color: '#15803d', label: 'Hoàn thành', background: '#dcfce7' },
      cancelled: { icon: '❌', color: '#991b1b', label: 'Đã huỷ', background: '#fee2e2' },
      archived: { icon: '🗄️', color: '#334155', label: 'Lưu trữ', background: '#cbd5e1' },
    },
    weighted_field: 'weight',
    fallback_strategy: 'avg_phases',
    calculation_strategy: 'weighted_phases',
    allow_manual_override: true,
  },
} as const;
