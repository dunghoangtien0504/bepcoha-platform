import { http } from './http';
import type {
  AdminUser,
  AiAssignment,
  AiTask,
  AnomalyAlert,
  AssignAiPayload,
  AppModule,
  UpdateAiTaskPayload,
  AttachmentPayload,
  AuthUser,
  EntityAttachment,
  IngestResult,
  IngestUsagePayload,
  IntegrationConnection,
  InternalTokenInfo,
  LoginResponse,
  MenuNode,
  Paginated,
  Permission,
  PhaseInput,
  Project,
  ProjectAttachments,
  ProjectCategory,
  AnalyzedPrompt,
  ModelEfficiencyRow,
  ProjectPerformance,
  PromptPerformance,
  RoiRealReport,
  TokenWasteReport,
  ProjectPhase,
  QuotaAllocation,
  QuotaSnapshot,
  Role,
  RoiSummary,
  SyncResult,
  SystemSetting,
  TaskCategory,
  TaskOverviewReport,
  TaskPerformance,
  TokenAddon,
  TrendPoint,
  UsageBreakdownRow,
  UserQuota,
  WorkProject,
  WorkProjectPayload,
  WorkTask,
  WorkTaskPayload,
} from './types';

export const authApi = {
  login: (email: string, password: string) =>
    http.post<LoginResponse>('/v1/auth/login', { email, password }).then((r) => r.data),
  me: () => http.get<AuthUser>('/v1/auth/me').then((r) => r.data),
};

export const menusApi = {
  my: () => http.get<MenuNode[]>('/v1/admin/menus/my').then((r) => r.data),
  tree: () => http.get<MenuNode[]>('/v1/admin/menus').then((r) => r.data),
  create: (payload: Partial<MenuNode>) =>
    http.post<MenuNode>('/v1/admin/menus', payload).then((r) => r.data),
  update: (id: string, payload: Partial<MenuNode>) =>
    http.put<MenuNode>(`/v1/admin/menus/${id}`, payload).then((r) => r.data),
  remove: (id: string) => http.delete(`/v1/admin/menus/${id}`).then((r) => r.data),
};

export const rbacApi = {
  modules: () => http.get<AppModule[]>('/v1/admin/modules').then((r) => r.data),
  permissions: () => http.get<Permission[]>('/v1/admin/permissions').then((r) => r.data),
  roles: () => http.get<Role[]>('/v1/admin/roles').then((r) => r.data),
  createRole: (payload: { name: string; code?: string; description?: string; permissionCodes?: string[] }) =>
    http.post<Role>('/v1/admin/roles', payload).then((r) => r.data),
  updateRole: (id: string, payload: { name?: string; description?: string; isActive?: boolean }) =>
    http.put<Role>(`/v1/admin/roles/${id}`, payload).then((r) => r.data),
  setRolePermissions: (id: string, permissionCodes: string[]) =>
    http.put<Role>(`/v1/admin/roles/${id}/permissions`, { permissionCodes }).then((r) => r.data),
  removeRole: (id: string) => http.delete(`/v1/admin/roles/${id}`).then((r) => r.data),
};

export const usersApi = {
  list: () => http.get<AdminUser[]>('/v1/admin/users').then((r) => r.data),
  create: (payload: Record<string, unknown>) =>
    http.post<AdminUser>('/v1/admin/users', payload).then((r) => r.data),
  update: (id: string, payload: Record<string, unknown>) =>
    http.put<AdminUser>(`/v1/admin/users/${id}`, payload).then((r) => r.data),
  remove: (id: string) => http.delete(`/v1/admin/users/${id}`).then((r) => r.data),
};

export const reportsApi = {
  summary: () => http.get<RoiSummary>('/v1/reports/summary').then((r) => r.data),
  trends: (granularity: 'DAILY' | 'WEEKLY' | 'MONTHLY') =>
    http.get<TrendPoint[]>('/v1/reports/trends', { params: { granularity } }).then((r) => r.data),
  taskPerformance: () =>
    http.get<TaskPerformance[]>('/v1/reports/task-performance').then((r) => r.data),
  projectPerformance: () =>
    http.get<ProjectPerformance[]>('/v1/reports/project-performance').then((r) => r.data),
  anomalies: () => http.get<AnomalyAlert[]>('/v1/reports/anomalies').then((r) => r.data),
  roiReal: () => http.get<RoiRealReport>('/v1/reports/roi-real').then((r) => r.data),
  modelEfficiency: () =>
    http.get<ModelEfficiencyRow[]>('/v1/reports/model-efficiency').then((r) => r.data),
  tokenWaste: () => http.get<TokenWasteReport>('/v1/reports/token-waste').then((r) => r.data),
};

export const usageApi = {
  breakdown: () => http.get<UsageBreakdownRow[]>('/v1/usage/breakdown').then((r) => r.data),
  ingest: (payload: IngestUsagePayload) =>
    http.post<IngestResult>('/v1/usage/ingest', payload).then((r) => r.data),
  models: () => http.get<string[]>('/v1/usage/models').then((r) => r.data),
};

export const projectsApi = {
  list: () => http.get<Project[]>('/v1/projects').then((r) => r.data),
  create: (payload: { name: string; description?: string; ownerId?: string }) =>
    http.post<Project>('/v1/projects', payload).then((r) => r.data),
  update: (id: number, payload: { name?: string; description?: string; ownerId?: string }) =>
    http.put<Project>(`/v1/projects/${id}`, payload).then((r) => r.data),
  remove: (id: number) => http.delete(`/v1/projects/${id}`).then((r) => r.data),
  listTasks: () => http.get<AiTask[]>('/v1/tasks').then((r) => r.data),
  createTask: (payload: {
    id: string;
    title: string;
    baselineHours: number;
    projectId?: number;
    status?: string;
    assigneeId?: string;
  }) => http.post<AiTask>('/v1/tasks', payload).then((r) => r.data),
  updateTask: (
    id: string,
    payload: {
      title?: string;
      baselineHours?: number;
      projectId?: number;
      status?: string;
      assigneeId?: string;
    },
  ) => http.put<AiTask>(`/v1/tasks/${id}`, payload).then((r) => r.data),
  removeTask: (id: string) => http.delete(`/v1/tasks/${id}`).then((r) => r.data),
};

/** Tham số list dùng chung: phân trang, sắp xếp, tìm kiếm + filter tùy ý. */
export type WorkListParams = Record<string, string | number | undefined>;

export const workApi = {
  // --- Danh mục ---
  projectCategories: () =>
    http.get<ProjectCategory[]>('/v1/work/project-categories').then((r) => r.data),
  createProjectCategory: (payload: Partial<ProjectCategory>) =>
    http.post<ProjectCategory>('/v1/work/project-categories', payload).then((r) => r.data),
  updateProjectCategory: (id: number, payload: Partial<ProjectCategory>) =>
    http.put<ProjectCategory>(`/v1/work/project-categories/${id}`, payload).then((r) => r.data),
  removeProjectCategory: (id: number) =>
    http.delete(`/v1/work/project-categories/${id}`).then((r) => r.data),
  taskCategories: (projectId?: number) =>
    http
      .get<TaskCategory[]>('/v1/work/task-categories', {
        params: projectId ? { projectId } : undefined,
      })
      .then((r) => r.data),
  createTaskCategory: (payload: Partial<TaskCategory>) =>
    http.post<TaskCategory>('/v1/work/task-categories', payload).then((r) => r.data),
  updateTaskCategory: (id: number, payload: Partial<TaskCategory>) =>
    http.put<TaskCategory>(`/v1/work/task-categories/${id}`, payload).then((r) => r.data),
  removeTaskCategory: (id: number) =>
    http.delete(`/v1/work/task-categories/${id}`).then((r) => r.data),

  // --- Dự án ---
  projects: (params?: WorkListParams) =>
    http.get<Paginated<WorkProject>>('/v1/work/projects', { params }).then((r) => r.data),
  project: (id: number) => http.get<WorkProject>(`/v1/work/projects/${id}`).then((r) => r.data),
  createProject: (payload: WorkProjectPayload) =>
    http.post<WorkProject>('/v1/work/projects', payload).then((r) => r.data),
  updateProject: (id: number, payload: Partial<WorkProjectPayload>) =>
    http.put<WorkProject>(`/v1/work/projects/${id}`, payload).then((r) => r.data),
  removeProject: (id: number) => http.delete(`/v1/work/projects/${id}`).then((r) => r.data),
  // Phase CRUD (giai đoạn) cho timeline/kanban ở trang chi tiết dự án.
  createPhase: (projectId: number, payload: PhaseInput) =>
    http.post<ProjectPhase>(`/v1/work/projects/${projectId}/phases`, payload).then((r) => r.data),
  updatePhase: (projectId: number, phaseId: number, payload: PhaseInput) =>
    http.put<ProjectPhase>(`/v1/work/projects/${projectId}/phases/${phaseId}`, payload).then((r) => r.data),
  removePhase: (projectId: number, phaseId: number) =>
    http.delete(`/v1/work/projects/${projectId}/phases/${phaseId}`).then((r) => r.data),

  // --- Công việc ---
  tasks: (params?: WorkListParams) =>
    http.get<Paginated<WorkTask>>('/v1/work/tasks', { params }).then((r) => r.data),
  task: (id: number) => http.get<WorkTask>(`/v1/work/tasks/${id}`).then((r) => r.data),
  createTask: (payload: WorkTaskPayload) =>
    http.post<WorkTask>('/v1/work/tasks', payload).then((r) => r.data),
  updateTask: (id: number, payload: Partial<WorkTaskPayload>) =>
    http.put<WorkTask>(`/v1/work/tasks/${id}`, payload).then((r) => r.data),
  removeTask: (id: number) => http.delete(`/v1/work/tasks/${id}`).then((r) => r.data),
  taskOverview: (params?: WorkListParams) =>
    http.get<TaskOverviewReport>('/v1/work/tasks/overview', { params }).then((r) => r.data),
  // Giao việc cho AI: tạo bản ghi ai_tasks gắn với task con người này.
  assignAi: (taskId: number, payload: AssignAiPayload) =>
    http.post<AiTask>(`/v1/work/tasks/${taskId}/assign-ai`, payload).then((r) => r.data),
  // Việc đã giao cho AI: toàn bộ (cột danh sách) hoặc theo 1 công việc (drawer).
  aiAssignments: () =>
    http.get<AiAssignment[]>('/v1/work/tasks/ai-assignments').then((r) => r.data),
  aiAssignment: (taskId: number) =>
    http.get<AiAssignment | null>(`/v1/work/tasks/${taskId}/ai-assignment`).then((r) => r.data),
  // Sửa lại việc đã giao cho AI (cập nhật ai_tasks).
  updateAiTask: (aiTaskId: string, payload: UpdateAiTaskPayload) =>
    http.put<AiTask>(`/v1/tasks/${aiTaskId}`, payload).then((r) => r.data),

  // --- Đính kèm (entity_attachments) ---
  attachments: (entityType: string, entityId: number) =>
    http
      .get<EntityAttachment[]>('/v1/work/attachments', { params: { entityType, entityId } })
      .then((r) => r.data),
  // Toàn bộ file của dự án (Project Files + Task Attachments) trong 1 lần gọi.
  projectAttachments: (projectId: number) =>
    http.get<ProjectAttachments>(`/v1/work/attachments/project/${projectId}`).then((r) => r.data),
  createAttachment: (payload: AttachmentPayload) =>
    http.post<EntityAttachment>('/v1/work/attachments', payload).then((r) => r.data),
  removeAttachment: (id: number) =>
    http.delete(`/v1/work/attachments/${id}`).then((r) => r.data),
  attachmentDownloadUrl: (id: number) => `/v1/work/attachments/${id}/download`,
};

export const quotaApi = {
  list: () => http.get<UserQuota[]>('/v1/quotas').then((r) => r.data),
  allocations: () => http.get<QuotaAllocation[]>('/v1/quotas/allocations').then((r) => r.data),
  upsert: (payload: Partial<UserQuota> & { userId: string }) =>
    http.put<UserQuota>('/v1/quotas', payload).then((r) => r.data),
  listAddons: () => http.get<TokenAddon[]>('/v1/quotas/addons').then((r) => r.data),
  createAddon: (payload: {
    userId: string;
    addonTokens: number;
    cycleType: string;
    startDate: string;
  }) => http.post<TokenAddon>('/v1/quotas/addons', payload).then((r) => r.data),
  revokeAddon: (id: number) => http.delete(`/v1/quotas/addons/${id}`).then((r) => r.data),
  // Internal token (1 token / nhân viên). generate = sinh ứng viên (chưa lưu).
  generateInternalToken: () =>
    http.get<{ internalToken: string }>('/v1/quotas/internal-token/generate').then((r) => r.data),
  getInternalToken: (userId: string) =>
    http.get<InternalTokenInfo>(`/v1/quotas/internal-token/${userId}`).then((r) => r.data),
  saveInternalToken: (userId: string, internalToken: string) =>
    http
      .put<InternalTokenInfo>(`/v1/quotas/internal-token/${userId}`, { internalToken })
      .then((r) => r.data),
  // Self-service: token & hạn ngạch của chính người đang đăng nhập.
  myInternalToken: () =>
    http.get<InternalTokenInfo>('/v1/quotas/me/internal-token').then((r) => r.data),
  saveMyInternalToken: (internalToken: string) =>
    http
      .put<InternalTokenInfo>('/v1/quotas/me/internal-token', { internalToken })
      .then((r) => r.data),
  myQuota: () => http.get<QuotaSnapshot>('/v1/quotas/me').then((r) => r.data),
};

export const promptApi = {
  performance: (params?: WorkListParams) =>
    http.get<PromptPerformance>('/v1/prompts/performance', { params }).then((r) => r.data),
  list: (params?: WorkListParams) =>
    http.get<AnalyzedPrompt[]>('/v1/prompts', { params }).then((r) => r.data),
  cached: () => http.get<AnalyzedPrompt[]>('/v1/prompts/cached').then((r) => r.data),
  setCache: (id: number, value: boolean) =>
    http.put<AnalyzedPrompt>(`/v1/prompts/${id}/cache`, { value }).then((r) => r.data),
  setKnowledge: (id: number, value: boolean) =>
    http.put<AnalyzedPrompt>(`/v1/prompts/${id}/knowledge`, { value }).then((r) => r.data),
};

export const settingsApi = {
  list: () => http.get<SystemSetting[]>('/v1/settings').then((r) => r.data),
  upsert: (payload: SystemSetting) =>
    http.put<SystemSetting>('/v1/settings', payload).then((r) => r.data),
  /** Lấy giá trị một setting key (tìm trong danh sách). Trả về null nếu không có. */
  get: (key: string) =>
    http
      .get<SystemSetting[]>('/v1/settings')
      .then((r) => r.data.find((s) => s.settingKey === key) ?? null),
};

export const integrationsApi = {
  list: () =>
    http.get<IntegrationConnection[]>('/v1/integrations/connections').then((r) => r.data),
  create: (payload: Record<string, unknown>) =>
    http.post<IntegrationConnection>('/v1/integrations/connections', payload).then((r) => r.data),
  remove: (id: number) =>
    http.delete(`/v1/integrations/connections/${id}`).then((r) => r.data),
  sync: (id: number) =>
    http.post<SyncResult>(`/v1/integrations/connections/${id}/sync`).then((r) => r.data),
};
