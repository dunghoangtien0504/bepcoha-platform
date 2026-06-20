import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { AppLoggerService } from '../../common/logger/app-logger.service';
import { ProjectCategoryEntity, TaskCategoryEntity } from '../../database/models';
import {
  CreateProjectCategoryDto,
  CreateTaskCategoryDto,
  UpdateProjectCategoryDto,
  UpdateTaskCategoryDto,
} from './dto/work.dto';

/**
 * Quản lý danh mục dự án (project_categories) và danh mục công việc (task_categories).
 * Gộp trong một service vì cùng bản chất CRUD danh mục, giảm trùng lặp.
 */
@Injectable()
export class CategoriesService {
  constructor(
    private readonly logger: AppLoggerService,
    @InjectModel(ProjectCategoryEntity)
    private readonly projectCategoryModel: typeof ProjectCategoryEntity,
    @InjectModel(TaskCategoryEntity)
    private readonly taskCategoryModel: typeof TaskCategoryEntity,
  ) {
    this.logger.setContext(CategoriesService.name);
  }

  /* ----------------------------- Project categories ----------------------------- */

  listProjectCategories(): Promise<ProjectCategoryEntity[]> {
    return this.projectCategoryModel.findAll({
      order: [
        ['sort', 'ASC'],
        ['id', 'ASC'],
      ],
    });
  }

  createProjectCategory(
    dto: CreateProjectCategoryDto,
    actorId: string | null,
  ): Promise<ProjectCategoryEntity> {
    return this.projectCategoryModel.create({
      title: dto.title,
      description: dto.description ?? null,
      sort: dto.sort ?? 0,
      isActive: dto.isActive ?? true,
      createdBy: actorId,
      updatedBy: actorId,
    } as ProjectCategoryEntity);
  }

  async updateProjectCategory(
    id: number,
    dto: UpdateProjectCategoryDto,
    actorId: string | null,
  ): Promise<ProjectCategoryEntity> {
    const category = await this.projectCategoryModel.findByPk(id);
    if (!category) throw new NotFoundException('Không tìm thấy danh mục dự án');
    await category.update({ ...dto, updatedBy: actorId });
    return category;
  }

  async deleteProjectCategory(id: number): Promise<void> {
    const removed = await this.projectCategoryModel.destroy({ where: { id } });
    if (!removed) throw new NotFoundException('Không tìm thấy danh mục dự án');
  }

  /* ----------------------------- Task categories ----------------------------- */

  listTaskCategories(projectId?: number): Promise<TaskCategoryEntity[]> {
    return this.taskCategoryModel.findAll({
      where: projectId ? { projectId } : undefined,
      order: [
        ['sort', 'ASC'],
        ['id', 'ASC'],
      ],
    });
  }

  createTaskCategory(
    dto: CreateTaskCategoryDto,
    actorId: string | null,
  ): Promise<TaskCategoryEntity> {
    return this.taskCategoryModel.create({
      title: dto.title,
      color: dto.color ?? null,
      iconType: dto.iconType ?? null,
      iconValue: dto.iconValue ?? null,
      projectId: dto.projectId ?? null,
      sort: dto.sort ?? 0,
      isActive: dto.isActive ?? true,
      createdBy: actorId,
      updatedBy: actorId,
    } as TaskCategoryEntity);
  }

  async updateTaskCategory(
    id: number,
    dto: UpdateTaskCategoryDto,
    actorId: string | null,
  ): Promise<TaskCategoryEntity> {
    const category = await this.taskCategoryModel.findByPk(id);
    if (!category) throw new NotFoundException('Không tìm thấy danh mục công việc');
    await category.update({ ...dto, updatedBy: actorId });
    return category;
  }

  async deleteTaskCategory(id: number): Promise<void> {
    const removed = await this.taskCategoryModel.destroy({ where: { id } });
    if (!removed) throw new NotFoundException('Không tìm thấy danh mục công việc');
  }
}
