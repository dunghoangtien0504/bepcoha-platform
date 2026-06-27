import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { AppLoggerService } from '../../common/logger/app-logger.service';
import { AiTaskEntity, ProjectEntity, UserEntity } from '../../database/models';
import {
  CreateProjectDto,
  CreateTaskDto,
  UpdateProjectDto,
  UpdateTaskDto,
} from './dto/project.dto';

/** Chỉ lấy các thuộc tính cần để hiển thị tên người dùng trong dropdown/bảng. */
const USER_REF_ATTRS = ['id', 'fullName', 'displayName'];

@Injectable()
export class ProjectsService {
  constructor(
    private readonly logger: AppLoggerService,
    @InjectModel(ProjectEntity) private readonly projectModel: typeof ProjectEntity,
    @InjectModel(AiTaskEntity) private readonly taskModel: typeof AiTaskEntity,
  ) {
    this.logger.setContext(ProjectsService.name);
  }

  listProjects(): Promise<ProjectEntity[]> {
    return this.projectModel.findAll({
      include: [
        AiTaskEntity,
        { model: UserEntity, as: 'owner', attributes: USER_REF_ATTRS },
        { model: UserEntity, as: 'creator', attributes: USER_REF_ATTRS },
      ],
      order: [['id', 'DESC']],
    });
  }

  createProject(dto: CreateProjectDto, createdById?: string): Promise<ProjectEntity> {
    return this.projectModel.create({
      name: dto.name,
      description: dto.description ?? null,
      ownerId: dto.ownerId ?? null,
      createdById: createdById ?? null,
    } as ProjectEntity);
  }

  async updateProject(id: number, dto: UpdateProjectDto): Promise<ProjectEntity> {
    const project = await this.projectModel.findByPk(id);
    if (!project) throw new NotFoundException('Không tìm thấy dự án');
    await project.update(dto);
    return project;
  }

  async deleteProject(id: number): Promise<void> {
    const removed = await this.projectModel.destroy({ where: { id } });
    if (!removed) throw new NotFoundException('Không tìm thấy dự án');
  }

  listTasks(projectId?: number, assigneeId?: string): Promise<AiTaskEntity[]> {
    const where: Record<string, unknown> = {};
    if (projectId) where.projectId = projectId;
    if (assigneeId) where.assigneeId = assigneeId;
    return this.taskModel.findAll({
      where: Object.keys(where).length ? where : undefined,
      include: [
        {
          model: UserEntity,
          as: 'assignee',
          attributes: USER_REF_ATTRS,
          // Nested: "báo cáo đến ai" = report_to của người phụ trách.
          include: [{ model: UserEntity, as: 'reportTo', attributes: USER_REF_ATTRS }],
        },
      ],
      order: [['id', 'DESC']],
    });
  }

  async createTask(dto: CreateTaskDto): Promise<AiTaskEntity> {
    return this.taskModel.create({
      projectId: dto.projectId ?? null,
      title: dto.title,
      baselineHours: dto.baselineHours,
      status: dto.status ?? 'OPEN',
      assigneeId: dto.assigneeId ?? null,
      budgetTokens: dto.budgetTokens ?? null,
      moreDesc: dto.moreDesc ?? null,
      externalSource: 'MANUAL',
      externalRef: dto.externalRef ?? null,
    } as AiTaskEntity);
  }

  async updateTask(id: string, dto: UpdateTaskDto): Promise<AiTaskEntity> {
    const task = await this.taskModel.findByPk(id);
    if (!task) throw new NotFoundException('Không tìm thấy task');
    const patch: Record<string, unknown> = {};
    if (dto.projectId !== undefined) patch.projectId = dto.projectId;
    if (dto.title !== undefined) patch.title = dto.title;
    if (dto.baselineHours !== undefined) patch.baselineHours = dto.baselineHours;
    if (dto.status !== undefined) patch.status = dto.status;
    if (dto.assigneeId !== undefined) patch.assigneeId = dto.assigneeId;
    if (dto.endDate !== undefined) patch.endDate = dto.endDate ? new Date(dto.endDate) : null;
    if (dto.budgetTokens !== undefined) patch.budgetTokens = dto.budgetTokens;
    if (dto.moreDesc !== undefined) patch.moreDesc = dto.moreDesc;
    await task.update(patch);
    return task;
  }

  async deleteTask(id: string): Promise<void> {
    const removed = await this.taskModel.destroy({ where: { id } });
    if (!removed) throw new NotFoundException('Không tìm thấy task');
  }
}
