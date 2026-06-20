import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/sequelize';
import { Op, Sequelize, type Transaction, type WhereOptions } from 'sequelize';
import { AppLoggerService } from '../../common/logger/app-logger.service';
import {
  EntityAttachmentEntity,
  ProjectCategoryEntity,
  ProjectEntity,
  ProjectMemberEntity,
  ProjectPhaseEntity,
  TaskEntity,
  UserEntity,
} from '../../database/models';
import { PolicyService, TaskProgressInput } from '../settings/policy.service';
import { CreateProjectDto, ListQueryDto, PhaseInputDto, UpdateProjectDto } from './dto/work.dto';
import { generateProjectCode, slugify } from './work.util';

/** Thuộc tính tối thiểu để hiển thị tên người dùng. */
const USER_REF_ATTRS = ['id', 'fullName', 'displayName'];
/** Cột được phép sắp xếp (chặn SQL injection qua tham số sort). */
const SORTABLE_COLUMNS = new Set([
  'id',
  'title',
  'code',
  'startDate',
  'endDate',
  'progress',
  'status',
  'createdAt',
]);
const DEFAULT_PAGE_SIZE = 20;

export interface PaginatedResult<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
}

@Injectable()
export class WorkProjectsService {
  constructor(
    private readonly logger: AppLoggerService,
    @InjectConnection() private readonly sequelize: Sequelize,
    @InjectModel(ProjectEntity) private readonly projectModel: typeof ProjectEntity,
    @InjectModel(ProjectPhaseEntity) private readonly phaseModel: typeof ProjectPhaseEntity,
    @InjectModel(ProjectMemberEntity) private readonly memberModel: typeof ProjectMemberEntity,
    @InjectModel(TaskEntity) private readonly taskModel: typeof TaskEntity,
    @InjectModel(EntityAttachmentEntity)
    private readonly attachmentModel: typeof EntityAttachmentEntity,
    private readonly policyService: PolicyService,
  ) {
    this.logger.setContext(WorkProjectsService.name);
  }

  /**
   * Tính & gắn tiến độ KPI (theo policy) cho từng dự án: Phase = trung bình trọng số task theo
   * estimated_hours, Project = trung bình các phase (fallback avg tất cả task khi chưa có phase).
   * Ghi đè giá trị cột progress trả về (không lưu DB) để danh sách & chi tiết hiển thị nhất quán.
   */
  private async attachComputedProgress(projects: ProjectEntity[]): Promise<void> {
    if (projects.length === 0) return;
    const ids = projects.map((p) => p.id);
    const [policy, tasks, phases] = await Promise.all([
      this.policyService.getPolicy(),
      this.taskModel.findAll({
        where: { projectId: ids },
        attributes: ['projectId', 'projectPhaseId', 'status', 'estimatedHours', 'progressPercent', 'progressSource'],
      }),
      this.phaseModel.findAll({ where: { projectId: ids }, attributes: ['id', 'projectId'] }),
    ]);
    const toInput = (t: TaskEntity): TaskProgressInput => ({
      status: t.status,
      progressPercent: t.progressPercent,
      progressSource: t.progressSource,
      estimatedHours: t.estimatedHours,
    });
    for (const project of projects) {
      const projTasks = tasks.filter((t) => t.projectId === project.id);
      const projPhases = phases.filter((ph) => ph.projectId === project.id);
      let progress: number;
      if (projPhases.length > 0) {
        const values = projPhases.map((ph) =>
          this.policyService.phaseProgress(
            policy,
            projTasks.filter((t) => t.projectPhaseId === ph.id).map(toInput),
          ),
        );
        progress = this.policyService.projectProgress(values);
      } else {
        progress = this.policyService.phaseProgress(policy, projTasks.map(toInput));
      }
      project.setDataValue('progress', progress);
    }
  }

  async listProjects(
    query: ListQueryDto,
    filters: { status?: string; categoryId?: number; fromDate?: string; toDate?: string },
  ): Promise<PaginatedResult<ProjectEntity>> {
    const page = query.page && query.page > 0 ? query.page : 1;
    const pageSize = query.pageSize && query.pageSize > 0 ? query.pageSize : DEFAULT_PAGE_SIZE;
    const sortColumn = query.sort && SORTABLE_COLUMNS.has(query.sort) ? query.sort : 'id';
    const sortOrder = (query.order ?? 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Giao khoảng thời gian với [startDate, endDate] của dự án (null coi như mở).
    const dateAnd: WhereOptions[] = [];
    if (filters.fromDate) {
      dateAnd.push({ [Op.or]: [{ endDate: { [Op.gte]: new Date(filters.fromDate) } }, { endDate: null }] });
    }
    if (filters.toDate) {
      dateAnd.push({ [Op.or]: [{ startDate: { [Op.lte]: new Date(filters.toDate) } }, { startDate: null }] });
    }
    const where: WhereOptions = {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.categoryId ? { projectCategoryId: filters.categoryId } : {}),
      ...(query.q
        ? {
            [Op.or]: [
              { title: { [Op.like]: `%${query.q}%` } },
              { code: { [Op.like]: `%${query.q}%` } },
            ],
          }
        : {}),
      ...(dateAnd.length ? { [Op.and]: dateAnd } : {}),
    };

    const { rows, count } = await this.projectModel.findAndCountAll({
      where,
      include: [
        { model: ProjectCategoryEntity, as: 'category' },
        { model: UserEntity, as: 'owner', attributes: USER_REF_ATTRS },
      ],
      order: [[sortColumn, sortOrder]],
      offset: (page - 1) * pageSize,
      limit: pageSize,
      distinct: true,
    });
    await this.attachComputedProgress(rows);
    return { rows, total: count, page, pageSize };
  }

  async getProject(id: number): Promise<ProjectEntity & { attachments?: EntityAttachmentEntity[] }> {
    const project = await this.projectModel.findByPk(id, {
      include: [
        { model: ProjectCategoryEntity, as: 'category' },
        { model: UserEntity, as: 'owner', attributes: USER_REF_ATTRS },
        { model: ProjectPhaseEntity, as: 'phases' },
        {
          model: ProjectMemberEntity,
          as: 'members',
          include: [{ model: UserEntity, as: 'user', attributes: USER_REF_ATTRS }],
        },
      ],
    });
    if (!project) throw new NotFoundException('Không tìm thấy dự án');
    await this.attachComputedProgress([project]);
    const attachments = await this.attachmentModel.findAll({
      where: { entityType: 'projects', entityId: id },
      order: [['sort', 'ASC']],
    });
    const result = project as ProjectEntity & { attachments?: EntityAttachmentEntity[] };
    result.attachments = attachments;
    return result;
  }

  async createProject(dto: CreateProjectDto, actorId: string | null): Promise<ProjectEntity> {
    return this.sequelize.transaction(async (tx) => {
      const title = dto.title;
      const created = await this.projectModel.create(
        {
          projectCategoryId: dto.projectCategoryId,
          code: dto.code && dto.code.trim() ? dto.code.trim() : generateProjectCode(),
          name: title,
          title,
          slug: slugify(title),
          description: dto.description ?? null,
          startDate: dto.startDate ? new Date(dto.startDate) : null,
          endDate: dto.endDate ? new Date(dto.endDate) : null,
          progress: dto.progress ?? 0,
          status: dto.status ?? 'draft',
          ownerId: dto.ownerId ?? null,
          createdById: actorId,
          createdBy: actorId,
          updatedBy: actorId,
        } as unknown as ProjectEntity,
        { transaction: tx },
      );
      await this.syncPhases(created.id, dto.phases, actorId, tx);
      await this.syncMembers(created.id, dto.members, actorId, tx);
      return created;
    });
  }

  async updateProject(
    id: number,
    dto: UpdateProjectDto,
    actorId: string | null,
  ): Promise<ProjectEntity> {
    return this.sequelize.transaction(async (tx) => {
      const project = await this.projectModel.findByPk(id, { transaction: tx });
      if (!project) throw new NotFoundException('Không tìm thấy dự án');

      const patch: Record<string, unknown> = { updatedBy: actorId };
      if (dto.projectCategoryId !== undefined) patch.projectCategoryId = dto.projectCategoryId;
      if (dto.code !== undefined) patch.code = dto.code;
      if (dto.title !== undefined) {
        patch.title = dto.title;
        patch.name = dto.title;
        patch.slug = slugify(dto.title);
      }
      if (dto.description !== undefined) patch.description = dto.description;
      if (dto.startDate !== undefined) patch.startDate = dto.startDate ? new Date(dto.startDate) : null;
      if (dto.endDate !== undefined) patch.endDate = dto.endDate ? new Date(dto.endDate) : null;
      if (dto.progress !== undefined) patch.progress = dto.progress;
      if (dto.status !== undefined) patch.status = dto.status;
      if (dto.ownerId !== undefined) patch.ownerId = dto.ownerId;
      await project.update(patch, { transaction: tx });

      if (dto.phases) await this.syncPhases(id, dto.phases, actorId, tx);
      if (dto.members) await this.syncMembers(id, dto.members, actorId, tx);
      return project;
    });
  }

  /** Tạo một giai đoạn mới cho dự án (sort = cuối danh sách hiện có). */
  async createPhase(
    projectId: number,
    dto: PhaseInputDto,
    actorId: string | null,
  ): Promise<ProjectPhaseEntity> {
    const project = await this.projectModel.findByPk(projectId);
    if (!project) throw new NotFoundException('Không tìm thấy dự án');
    const max = (await this.phaseModel.max('sort', { where: { projectId } })) as number | null;
    return this.phaseModel.create({
      projectId,
      title: dto.title,
      description: dto.description ?? null,
      sort: dto.sort ?? (typeof max === 'number' ? max + 1 : 0),
      status: dto.status ?? 'pending',
      createdBy: actorId,
      updatedBy: actorId,
    } as ProjectPhaseEntity);
  }

  async updatePhase(
    projectId: number,
    phaseId: number,
    dto: PhaseInputDto,
    actorId: string | null,
  ): Promise<ProjectPhaseEntity> {
    const phase = await this.phaseModel.findOne({ where: { id: phaseId, projectId } });
    if (!phase) throw new NotFoundException('Không tìm thấy giai đoạn');
    const patch: Record<string, unknown> = { updatedBy: actorId };
    if (dto.title !== undefined) patch.title = dto.title;
    if (dto.description !== undefined) patch.description = dto.description ?? null;
    if (dto.sort !== undefined) patch.sort = dto.sort;
    if (dto.status !== undefined) patch.status = dto.status;
    await phase.update(patch);
    return phase;
  }

  /** Xóa giai đoạn: gỡ liên kết task (project_phase_id = null) rồi xóa phase. */
  async deletePhase(projectId: number, phaseId: number): Promise<void> {
    const phase = await this.phaseModel.findOne({ where: { id: phaseId, projectId } });
    if (!phase) throw new NotFoundException('Không tìm thấy giai đoạn');
    await this.taskModel.update({ projectPhaseId: null }, { where: { projectPhaseId: phaseId } });
    await phase.destroy();
  }

  async deleteProject(id: number): Promise<void> {
    await this.sequelize.transaction(async (tx) => {
      const removed = await this.projectModel.destroy({ where: { id }, transaction: tx });
      if (!removed) throw new NotFoundException('Không tìm thấy dự án');
      await this.phaseModel.destroy({ where: { projectId: id }, transaction: tx });
      await this.memberModel.destroy({ where: { projectId: id }, transaction: tx });
      await this.attachmentModel.destroy({
        where: { entityType: 'projects', entityId: id },
        transaction: tx,
      });
    });
  }

  /** Đồng bộ danh sách phase: thêm mới, cập nhật theo id, xóa phase không còn trong payload. */
  private async syncPhases(
    projectId: number,
    phases: CreateProjectDto['phases'],
    actorId: string | null,
    tx: Transaction,
  ): Promise<void> {
    if (!phases) return;
    const keepIds: number[] = [];
    for (let index = 0; index < phases.length; index += 1) {
      const phase = phases[index];
      if (phase.id) {
        await this.phaseModel.update(
          {
            title: phase.title,
            description: phase.description ?? null,
            sort: phase.sort ?? index,
            status: phase.status ?? 'pending',
            updatedBy: actorId,
          },
          { where: { id: phase.id, projectId }, transaction: tx },
        );
        keepIds.push(phase.id);
      } else {
        const created = await this.phaseModel.create(
          {
            projectId,
            title: phase.title,
            description: phase.description ?? null,
            sort: phase.sort ?? index,
            status: phase.status ?? 'pending',
            createdBy: actorId,
            updatedBy: actorId,
          } as ProjectPhaseEntity,
          { transaction: tx },
        );
        keepIds.push(created.id);
      }
    }
    const destroyWhere: WhereOptions =
      keepIds.length > 0 ? { projectId, id: { [Op.notIn]: keepIds } } : { projectId };
    await this.phaseModel.destroy({ where: destroyWhere, transaction: tx });
  }

  /** Đồng bộ danh sách thành viên dự án tương tự syncPhases. */
  private async syncMembers(
    projectId: number,
    members: CreateProjectDto['members'],
    actorId: string | null,
    tx: Transaction,
  ): Promise<void> {
    if (!members) return;
    const keepIds: number[] = [];
    for (const member of members) {
      if (member.id) {
        await this.memberModel.update(
          {
            userId: member.userId,
            role: member.role,
            isActive: member.isActive ?? true,
            updatedBy: actorId,
          },
          { where: { id: member.id, projectId }, transaction: tx },
        );
        keepIds.push(member.id);
      } else {
        const created = await this.memberModel.create(
          {
            projectId,
            userId: member.userId,
            role: member.role,
            isActive: member.isActive ?? true,
            createdBy: actorId,
            updatedBy: actorId,
          } as ProjectMemberEntity,
          { transaction: tx },
        );
        keepIds.push(created.id);
      }
    }
    const destroyWhere: WhereOptions =
      keepIds.length > 0 ? { projectId, id: { [Op.notIn]: keepIds } } : { projectId };
    await this.memberModel.destroy({ where: destroyWhere, transaction: tx });
  }
}
