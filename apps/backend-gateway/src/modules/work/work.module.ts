import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import {
  AiRequestAuditLogEntity,
  AiTaskEntity,
  EntityAttachmentEntity,
  ProjectCategoryEntity,
  ProjectEntity,
  ProjectMemberEntity,
  ProjectPhaseEntity,
  TaskCategoryEntity,
  TaskEntity,
} from '../../database/models';
import { AuthModule } from '../auth/auth.module';
import { AttachmentsController } from './attachments.controller';
import { SettingsModule } from '../settings/settings.module';
import { AttachmentsService } from './attachments.service';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { WorkProjectsController } from './work-projects.controller';
import { WorkProjectsService } from './work-projects.service';
import { WorkTasksController } from './work-tasks.controller';
import { WorkTasksService } from './work-tasks.service';

/**
 * Module Quản lý Dự án & Công việc (mới, additive). Tách biệt với luồng ROI cũ
 * (ai_tasks / ProjectsModule) — dùng bảng tasks (PK int) và các bảng phụ trợ.
 */
@Module({
  imports: [
    SequelizeModule.forFeature([
      ProjectEntity,
      ProjectCategoryEntity,
      ProjectPhaseEntity,
      ProjectMemberEntity,
      TaskEntity,
      TaskCategoryEntity,
      EntityAttachmentEntity,
      AiTaskEntity,
      AiRequestAuditLogEntity,
    ]),
    AuthModule,
    SettingsModule,
  ],
  controllers: [
    CategoriesController,
    WorkProjectsController,
    WorkTasksController,
    AttachmentsController,
  ],
  providers: [CategoriesService, WorkProjectsService, WorkTasksService, AttachmentsService],
  exports: [CategoriesService, WorkProjectsService, WorkTasksService, AttachmentsService],
})
export class WorkModule {}
