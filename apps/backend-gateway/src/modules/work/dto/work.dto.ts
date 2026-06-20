import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import type { AttachmentEntityType } from '../../../database/models';
import type {
  ProjectMemberRole,
  ProjectPhaseStatus,
  ProjectStatus,
} from '../../../database/models';
import type {
  TaskPriority,
  TaskProgressSource,
  TaskSourceType,
  TaskStatus,
} from '../../../database/models';

const PROJECT_STATUSES: ProjectStatus[] = [
  'draft',
  'active',
  'inactive',
  'on_hold',
  'on_track',
  'delayed',
  'completed',
  'cancelled',
  'archived',
];
const PHASE_STATUSES: ProjectPhaseStatus[] = [
  'pending',
  'in_progress',
  'on_hold',
  'completed',
  'cancelled',
];
const MEMBER_ROLES: ProjectMemberRole[] = ['owner', 'manager', 'member', 'viewer'];
const TASK_STATUSES: TaskStatus[] = [
  'todo',
  'in_progress',
  'review',
  'blocked',
  'completed',
  'cancelled',
];
const TASK_SOURCES: TaskSourceType[] = ['project', 'direct_assign', 'self_created', 'system'];
const TASK_PRIORITIES: TaskPriority[] = ['low', 'medium', 'high', 'urgent'];
const TASK_PROGRESS_SOURCES: TaskProgressSource[] = ['manual', 'auto', 'checklist', 'subtask'];
const ATTACHMENT_TYPES: AttachmentEntityType[] = ['projects', 'tasks'];

/** Tham số phân trang + sắp xếp + tìm kiếm dùng chung cho list. */
export class ListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  pageSize?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  sort?: string;

  @IsOptional()
  @IsIn(['ASC', 'DESC', 'asc', 'desc'])
  order?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  q?: string;
}

/* ----------------------------- Categories ----------------------------- */

export class CreateProjectCategoryDto {
  @IsString()
  @MaxLength(150)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sort?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateProjectCategoryDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sort?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateTaskCategoryDto {
  @IsString()
  @MaxLength(150)
  title!: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsIn(['material_symbol', 'svg'])
  iconType?: 'material_symbol' | 'svg';

  @IsOptional()
  @IsString()
  iconValue?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  projectId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sort?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateTaskCategoryDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  title?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsIn(['material_symbol', 'svg'])
  iconType?: 'material_symbol' | 'svg';

  @IsOptional()
  @IsString()
  iconValue?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  projectId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sort?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/* ----------------------------- Phases & Members (nested) ----------------------------- */

export class PhaseInputDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  id?: number;

  @IsString()
  @MaxLength(150)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sort?: number;

  @IsOptional()
  @IsIn(PHASE_STATUSES)
  status?: ProjectPhaseStatus;
}

export class MemberInputDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  id?: number;

  @IsUUID()
  userId!: string;

  @IsIn(MEMBER_ROLES)
  role!: ProjectMemberRole;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/* ----------------------------- Projects ----------------------------- */

export class CreateProjectDto {
  @Type(() => Number)
  @IsInt()
  projectCategoryId!: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;

  @IsString()
  @MaxLength(150)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  startDate!: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  progress?: number;

  @IsOptional()
  @IsIn(PROJECT_STATUSES)
  status?: ProjectStatus;

  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PhaseInputDto)
  phases?: PhaseInputDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MemberInputDto)
  members?: MemberInputDto[];
}

export class UpdateProjectDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  projectCategoryId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  progress?: number;

  @IsOptional()
  @IsIn(PROJECT_STATUSES)
  status?: ProjectStatus;

  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PhaseInputDto)
  phases?: PhaseInputDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MemberInputDto)
  members?: MemberInputDto[];
}

/* ----------------------------- Tasks ----------------------------- */

export class CreateTaskDto {
  @Type(() => Number)
  @IsInt()
  taskCategoryId!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  projectId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  projectPhaseId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  parentId?: number;

  @IsOptional()
  @IsIn(TASK_SOURCES)
  sourceType?: TaskSourceType;

  @IsOptional()
  @IsIn(TASK_PRIORITIES)
  priority?: TaskPriority;

  @IsOptional()
  @IsUUID()
  assignedToUserId?: string;

  @IsString()
  @MaxLength(255)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  startDate!: string;

  @IsString()
  dueDate!: string;

  @IsOptional()
  @IsString()
  actualCompletedDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  estimatedHours?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  progressPercent?: number;

  @IsOptional()
  @IsIn(TASK_PROGRESS_SOURCES)
  progressSource?: TaskProgressSource;

  @IsOptional()
  @IsIn(TASK_STATUSES)
  status?: TaskStatus;

  @IsOptional()
  @IsString()
  completedDate?: string;

  @IsOptional()
  @IsString()
  closedDate?: string;

  @IsOptional()
  @IsString()
  cancelledDate?: string;

  @IsOptional()
  @IsString()
  archivedDate?: string;
}

export class UpdateTaskDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  taskCategoryId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  projectId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  projectPhaseId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  parentId?: number;

  @IsOptional()
  @IsIn(TASK_SOURCES)
  sourceType?: TaskSourceType;

  @IsOptional()
  @IsIn(TASK_PRIORITIES)
  priority?: TaskPriority;

  @IsOptional()
  @IsUUID()
  assignedToUserId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  actualCompletedDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  estimatedHours?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  progressPercent?: number;

  @IsOptional()
  @IsIn(TASK_PROGRESS_SOURCES)
  progressSource?: TaskProgressSource;

  @IsOptional()
  @IsIn(TASK_STATUSES)
  status?: TaskStatus;

  @IsOptional()
  @IsString()
  completedDate?: string;

  @IsOptional()
  @IsString()
  closedDate?: string;

  @IsOptional()
  @IsString()
  cancelledDate?: string;

  @IsOptional()
  @IsString()
  archivedDate?: string;
}

/* ----------------------------- Giao việc cho AI ----------------------------- */

/**
 * Dữ liệu giao một task con người cho AI (tạo bản ghi ai_tasks). baselineHours = số giờ công
 * ước tính; endDate = ngày phải hoàn thành (<= end_date dự án); title tùy chọn (mặc định lấy
 * tiêu đề task). assignee_id được gán từ người dùng hiện tại ở phía server.
 */
export class AssignAiDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  baselineHours!: number;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  budgetTokens?: number;

  @IsOptional()
  @IsString()
  moreDesc?: string;
}

/* ----------------------------- Attachments ----------------------------- */

export class CreateAttachmentDto {
  @IsIn(ATTACHMENT_TYPES)
  entityType!: AttachmentEntityType;

  @Type(() => Number)
  @IsInt()
  entityId!: number;

  @IsString()
  @MaxLength(255)
  fileName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  mimeType?: string;

  /** Nội dung file mã hóa base64 (data URL hoặc base64 thuần). */
  @IsString()
  contentBase64!: string;

  @IsOptional()
  @IsString()
  description?: string;
}
