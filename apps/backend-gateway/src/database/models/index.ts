import { AdminMenuEntity } from './admin-menu.entity';
import { AiPromptEntity } from './ai-prompt.entity';
import { AiRequestAuditLogEntity } from './ai-request-audit-log.entity';
import { AiTaskEntity } from './ai-task.entity';
import { AppUserEntity } from './app-user.entity';
import { IntegrationConnectionEntity } from './integration-connection.entity';
import { EntityAttachmentEntity } from './entity-attachment.entity';
import { ModuleEntity } from './module.entity';
import { ModuleScopeEntity } from './module-scope.entity';
import { PermissionEntity } from './permission.entity';
import { ProjectEntity } from './project.entity';
import { ProjectCategoryEntity } from './project-category.entity';
import { ProjectMemberEntity } from './project-member.entity';
import { ProjectPhaseEntity } from './project-phase.entity';
import { RoleEntity } from './role.entity';
import { RolePermissionEntity } from './role-permission.entity';
import { SystemSettingEntity } from './system-setting.entity';
import { TaskEntity } from './task.entity';
import { TaskCategoryEntity } from './task-category.entity';
import { TokenQuotaAddonEntity } from './token-quota-addon.entity';
import { UserEntity } from './user.entity';
import { UserTokenQuotaEntity } from './user-token-quota.entity';

export const ALL_MODELS = [
  SystemSettingEntity,
  ProjectEntity,
  AiTaskEntity,
  UserTokenQuotaEntity,
  TokenQuotaAddonEntity,
  AiRequestAuditLogEntity,
  AppUserEntity,
  IntegrationConnectionEntity,
  ModuleEntity,
  ModuleScopeEntity,
  PermissionEntity,
  RoleEntity,
  RolePermissionEntity,
  UserEntity,
  AdminMenuEntity,
  ProjectCategoryEntity,
  ProjectPhaseEntity,
  ProjectMemberEntity,
  TaskCategoryEntity,
  TaskEntity,
  EntityAttachmentEntity,
  AiPromptEntity,
];

export {
  AdminMenuEntity,
  AiPromptEntity,
  AiRequestAuditLogEntity,
  AiTaskEntity,
  AppUserEntity,
  EntityAttachmentEntity,
  IntegrationConnectionEntity,
  ModuleEntity,
  ModuleScopeEntity,
  PermissionEntity,
  ProjectEntity,
  ProjectCategoryEntity,
  ProjectMemberEntity,
  ProjectPhaseEntity,
  RoleEntity,
  RolePermissionEntity,
  SystemSettingEntity,
  TaskEntity,
  TaskCategoryEntity,
  TokenQuotaAddonEntity,
  UserEntity,
  UserTokenQuotaEntity,
};

export type { IconType } from './admin-menu.entity';
export type { AuditTaskStatus, AuditSource, CaptureMode } from './ai-request-audit-log.entity';
export type { AiTaskStatus } from './ai-task.entity';
export type { UserRole } from './app-user.entity';
export type { AttachmentEntityType } from './entity-attachment.entity';
export type { IntegrationProvider } from './integration-connection.entity';
export type { ProjectStatus } from './project.entity';
export type { ProjectMemberRole } from './project-member.entity';
export type { ProjectPhaseStatus } from './project-phase.entity';
export type {
  TaskStatus,
  TaskSourceType,
  TaskPriority,
  TaskProgressSource,
} from './task.entity';
export type { AddonCycleType, AddonStatus } from './token-quota-addon.entity';
export type { Gender } from './user.entity';
