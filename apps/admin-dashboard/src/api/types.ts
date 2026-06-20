export type TaskStatus = 'OPEN' | 'IN_PROGRESS' | 'DONE';
export type AddonCycle = 'ONCE' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
export type IntegrationProvider = 'JIRA' | 'GITLAB' | 'GITHUB';

export interface RoleRef {
  id: string;
  code: string;
  name: string;
}

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  displayName: string;
  isAdmin: boolean;
  role: RoleRef | null;
  permissions: string[];
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

export interface ModuleScope {
  id: string;
  code: string;
  name: string;
  sort: number;
}

export interface AppModule {
  id: string;
  code: string;
  name: string;
  description: string | null;
  sort: number;
  scopes: ModuleScope[];
}

export interface Permission {
  id: string;
  module: string;
  scope: string;
  code: string;
  name: string;
  sort: number;
}

export interface Role {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  permissionCodes: string[];
}

export interface AdminUser {
  id: string;
  roleId: string;
  roleName: string | null;
  fullName: string;
  displayName: string;
  email: string;
  phone: string | null;
  gender: string | null;
  birthday: string | null;
  title: string | null;
  isAdmin: boolean;
  isActive: boolean;
  reportToId: string | null;
  reportToName: string | null;
}

export type IconType = 'material_symbol' | 'svg' | 'letter';

export interface MenuNode {
  id: string;
  name: string;
  parentId: string | null;
  sort: number;
  requirePermissions: string | null;
  routePath: string | null;
  iconType: IconType;
  iconValue: string | null;
  isActive: boolean;
  children: MenuNode[];
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
  costUsd: number;
  humanCostUsd: number;
  savedValueUsd: number;
}

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

export interface TokenWasteReport {
  totalTokens: number;
  wastedTokens: number;
  wastePercent: number;
  wastedCostUsd: number;
  wastedVnd: number;
  threshold: number;
  offenders: { key: string; label: string; prompts: number; wastedTokens: number }[];
}

export type PromptQuality = 'good' | 'poor';

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
  createdAt: string;
  quality: PromptQuality;
  qualityScore: number;
  reasons: string[];
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

export type CaptureMode = 'CHAT' | 'TASK' | 'API';

export interface UsageBreakdownRow {
  source: string;
  requestCount: number;
  totalTokens: number;
  totalCostUsd: number;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  systemOverheadTokens: number;
}

export interface IngestUsagePayload {
  taskId: string;
  requesterId: string;
  model?: string;
  promptText?: string;
  completionText?: string;
  promptTokens?: number;
  completionTokens?: number;
  captureMode: CaptureMode;
  dryRun?: boolean;
  occurredAt?: string;
}

export interface IngestResult {
  requestId: string;
  taskId: string;
  source: 'ESTIMATED';
  captureMode: CaptureMode;
  model: string;
  usage: TokenUsage;
  totalTokens: number;
  costUsd: number;
  otMultiplier: number;
  persisted: boolean;
}

export interface QuotaAllocation {
  userId: string;
  email: string;
  fullName: string;
  displayName: string;
  title: string | null;
  hasQuota: boolean;
  dailyLimit: number;
  weeklyLimit: number;
  monthlyLimit: number;
  taskLimit: number;
  addonTotal: number;
}

export interface AnomalyAlert {
  taskId: string;
  title: string;
  promptCount: number;
  totalCostVnd: number;
  status: string;
  reasons: string[];
}

/** Tham chiếu rút gọn tới một user (RBAC) để hiển thị tên trong bảng/dropdown. */
export interface UserRef {
  id: string;
  fullName: string;
  displayName: string;
}

export interface Project {
  id: number;
  name: string;
  description: string | null;
  ownerId: string | null;
  createdById: string | null;
  owner?: UserRef | null;
  creator?: UserRef | null;
  tasks?: AiTask[];
}

export interface AiTask {
  id: string;
  taskId: number | null;
  projectId: number | null;
  title: string;
  baselineHours: number;
  endDate: string | null;
  status: TaskStatus;
  externalSource: string | null;
  externalRef: string | null;
  externalUrl: string | null;
  assigneeId: string | null;
  budgetTokens: number | null;
  moreDesc: string | null;
  /** Người phụ trách (kèm "báo cáo đến ai" = assignee.reportTo). */
  assignee?: (UserRef & { reportTo?: UserRef | null }) | null;
}

export interface UserQuota {
  id: number;
  userId: string;
  dailyLimit: number;
  weeklyLimit: number;
  monthlyLimit: number;
  taskLimit: number;
}

export interface QuotaCycleStatus {
  cycle: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'TASK';
  used: number;
  limit: number;
  unlimited: boolean;
}

export interface QuotaSnapshot {
  userId: string;
  taskId: string;
  cycles: QuotaCycleStatus[];
}

export interface InternalTokenInfo {
  userId: string;
  email: string;
  fullName: string;
  internalToken: string | null;
  hasToken: boolean;
}

export interface TokenAddon {
  id: number;
  userId: string;
  addonTokens: number;
  cycleType: AddonCycle;
  startDate: string;
  status: string;
}

export interface SystemSetting {
  settingKey: string;
  settingValue: string;
  description: string | null;
}

export interface IntegrationConnection {
  id: number;
  provider: IntegrationProvider;
  name: string;
  baseUrl: string;
  externalProjectKey: string | null;
  authEmail: string | null;
  targetProjectId: number | null;
  defaultBaselineHours: number;
  isActive: boolean;
  hasWebhookSecret: boolean;
  lastSyncedAt: string | null;
}

export interface SyncResult {
  connectionId: number;
  provider: IntegrationProvider;
  fetched: number;
  created: number;
  updated: number;
}

/* ============================ Module Quản lý Dự án & Công việc ============================ */

export type ProjectStatus =
  | 'draft'
  | 'active'
  | 'inactive'
  | 'on_hold'
  | 'on_track'
  | 'delayed'
  | 'completed'
  | 'cancelled'
  | 'archived';

export type ProjectPhaseStatus =
  | 'pending'
  | 'in_progress'
  | 'on_hold'
  | 'completed'
  | 'cancelled';

export type ProjectMemberRole = 'owner' | 'manager' | 'member' | 'viewer';

export type WorkTaskStatus =
  | 'todo'
  | 'in_progress'
  | 'review'
  | 'blocked'
  | 'completed'
  | 'cancelled';

export type WorkTaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type WorkTaskSource = 'project' | 'direct_assign' | 'self_created' | 'system';
export type WorkTaskProgressSource = 'manual' | 'auto' | 'checklist' | 'subtask';
export type AttachmentEntityType = 'projects' | 'tasks';

export interface Paginated<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ProjectCategory {
  id: number;
  title: string;
  description: string | null;
  sort: number;
  isActive: boolean;
}

export interface TaskCategory {
  id: number;
  title: string;
  color: string | null;
  iconType: 'material_symbol' | 'svg' | null;
  iconValue: string | null;
  projectId: number | null;
  sort: number;
  isActive: boolean;
}

export interface ProjectPhase {
  id: number;
  projectId: number;
  title: string;
  description: string | null;
  sort: number;
  status: ProjectPhaseStatus;
}

export interface ProjectMember {
  id: number;
  projectId: number;
  userId: string;
  role: ProjectMemberRole;
  isActive: boolean;
  user?: UserRef | null;
}

export interface EntityAttachment {
  id: number;
  entityType: AttachmentEntityType;
  entityId: number;
  fileName: string;
  fileExtension: string | null;
  mimeType: string | null;
  fileSize: number | null;
  storageProvider: string | null;
  storagePath: string | null;
  storageUrl: string | null;
  description: string | null;
  sort: number;
  /** Chỉ có ở task files: tên công việc gắn file (entityId = task id) để hyperlink. */
  taskName?: string | null;
}

/** Toàn bộ file của một dự án: gắn trực tiếp dự án + gắn theo công việc. */
export interface ProjectAttachments {
  projectFiles: EntityAttachment[];
  taskFiles: EntityAttachment[];
}

export interface WorkProject {
  id: number;
  projectCategoryId: number | null;
  code: string | null;
  title: string | null;
  name: string;
  slug: string | null;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  progress: number;
  status: ProjectStatus;
  ownerId: string | null;
  category?: ProjectCategory | null;
  owner?: UserRef | null;
  phases?: ProjectPhase[];
  members?: ProjectMember[];
  attachments?: EntityAttachment[];
}

export interface WorkTask {
  id: number;
  taskCategoryId: number;
  projectId: number | null;
  projectPhaseId: number | null;
  sourceType: WorkTaskSource;
  priority: WorkTaskPriority;
  assignedBy: string | null;
  assignedToUserId: string | null;
  parentId: number | null;
  title: string;
  slug: string;
  description: string | null;
  startDate: string | null;
  dueDate: string | null;
  actualCompletedDate: string | null;
  estimatedHours: number | null;
  progressPercent: number;
  progressSource: WorkTaskProgressSource;
  status: WorkTaskStatus;
  completedDate: string | null;
  closedDate: string | null;
  cancelledDate: string | null;
  archivedDate: string | null;
  category?: TaskCategory | null;
  project?: { id: number; title: string | null; code: string | null; endDate: string | null } | null;
  phase?: { id: number; title: string } | null;
  parent?: { id: number; title: string } | null;
  assignedTo?: UserRef | null;
  assigner?: UserRef | null;
  attachments?: EntityAttachment[];
}

export interface TaskOverviewReport {
  total: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  overdue: number;
  completed: number;
  completionRate: number;
}

export interface PhaseInput {
  id?: number;
  title: string;
  description?: string | null;
  sort?: number;
  status?: ProjectPhaseStatus;
}

export interface MemberInput {
  id?: number;
  userId: string;
  role: ProjectMemberRole;
  isActive?: boolean;
}

export interface WorkProjectPayload {
  projectCategoryId: number;
  code?: string;
  title: string;
  description?: string;
  startDate: string;
  endDate?: string;
  progress?: number;
  status?: ProjectStatus;
  ownerId?: string;
  phases?: PhaseInput[];
  members?: MemberInput[];
}

export interface WorkTaskPayload {
  taskCategoryId: number;
  projectId?: number;
  projectPhaseId?: number | null;
  parentId?: number;
  sourceType?: WorkTaskSource;
  priority?: WorkTaskPriority;
  assignedToUserId?: string;
  title: string;
  description?: string;
  startDate: string;
  dueDate: string;
  actualCompletedDate?: string;
  estimatedHours?: number;
  progressPercent?: number;
  progressSource?: WorkTaskProgressSource;
  status?: WorkTaskStatus;
  completedDate?: string;
  closedDate?: string;
  cancelledDate?: string;
  archivedDate?: string;
}

/** Payload giao việc cho AI (tạo bản ghi ai_tasks). */
export interface AssignAiPayload {
  baselineHours: number;
  endDate?: string;
  title?: string;
  budgetTokens?: number;
  moreDesc?: string;
}

/** Việc đã giao cho AI gắn với một công việc (tasks). status suy từ ai_request_audit_logs. */
export interface AiAssignment {
  taskId: number;
  aiTaskId: string;
  title: string;
  moreDesc: string | null;
  endDate: string | null;
  baselineHours: number;
  budgetTokens: number | null;
  createdAt: string;
  hasActivity: boolean;
  status: 'in_progress' | 'not_started';
}

/** Payload sửa lại việc đã giao cho AI (cập nhật ai_tasks). */
export interface UpdateAiTaskPayload {
  title?: string;
  baselineHours?: number;
  endDate?: string;
  budgetTokens?: number;
  moreDesc?: string;
}

export interface AttachmentPayload {
  entityType: AttachmentEntityType;
  entityId: number;
  fileName: string;
  mimeType?: string;
  contentBase64: string;
  description?: string;
}

/* ===================== Chính sách quản lý dự án (setting key) ===================== */

/** Một mục trong status_visual_map: màu chữ, nền, icon, nhãn hiển thị. */
export interface StatusVisual {
  icon: string;
  color: string;
  label: string;
  background: string;
}

export interface PolicyProgressThreshold {
  min?: number;
  max?: number;
  color: string;
  label: string;
}

/** Cấu hình `project.managenent.policy` — chỉ khai báo phần FE dùng để render/KPI. */
export interface ProjectManagementPolicy {
  kpi: {
    project_progress: {
      unit: string;
      auto_calc: boolean;
      visual_thresholds: Record<string, PolicyProgressThreshold>;
    };
    phase_progress: { unit: string; auto_calc: boolean; aggregation: string };
    task_progress_avg: { unit: string; auto_calc: boolean; aggregation: string };
  };
  task: {
    status_visual_map: Record<string, StatusVisual>;
    status_progress_map: Record<string, number>;
    auto_update_progress: boolean;
    allow_manual_override: boolean;
  };
  phase: {
    status_visual_map: Record<string, StatusVisual>;
    weighted_field: string;
    fallback_strategy: string;
    calculation_strategy: string;
    allow_manual_override: boolean;
  };
  project: {
    status_visual_map: Record<string, StatusVisual>;
    weighted_field: string;
    fallback_strategy: string;
    calculation_strategy: string;
    allow_manual_override: boolean;
  };
}
