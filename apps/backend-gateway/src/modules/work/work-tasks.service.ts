import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, type WhereOptions } from 'sequelize';
import { AppLoggerService } from '../../common/logger/app-logger.service';
import {
  AiRequestAuditLogEntity,
  AiTaskEntity,
  EntityAttachmentEntity,
  ProjectEntity,
  ProjectPhaseEntity,
  TaskCategoryEntity,
  TaskEntity,
  UserEntity,
} from '../../database/models';
import type { TaskStatus } from '../../database/models';
import { AssignAiDto, CreateTaskDto, ListQueryDto, UpdateTaskDto } from './dto/work.dto';
import type { PaginatedResult } from './work-projects.service';
import { NotificationService } from '../notification/notification.service';
import { slugify } from './work.util';

const USER_REF_ATTRS = ['id', 'fullName', 'displayName'];
const SORTABLE_COLUMNS = new Set([
  'id',
  'title',
  'priority',
  'status',
  'startDate',
  'dueDate',
  'createdAt',
]);
const DEFAULT_PAGE_SIZE = 20;

export interface TaskOverviewReport {
  total: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  overdue: number;
  completed: number;
  completionRate: number;
}

export interface TaskListFilters {
  status?: string;
  priority?: string;
  projectId?: number;
  projectPhaseId?: number;
  taskCategoryId?: number;
  assignedToUserId?: string;
  /** Lọc theo khoảng thời gian (giao với [startDate, dueDate] của công việc). */
  fromDate?: string;
  toDate?: string;
}

/** Thông tin việc đã giao cho AI (ai_tasks) gắn với một công việc (tasks). */
export interface AiAssignmentInfo {
  taskId: number;
  aiTaskId: string;
  title: string;
  moreDesc: string | null;
  endDate: Date | null;
  baselineHours: number;
  budgetTokens: number | null;
  createdAt: Date;
  /** Có log gọi AI (ai_request_audit_logs theo task_id) -> đang thực hiện, ngược lại chưa bắt đầu. */
  hasActivity: boolean;
  status: 'in_progress' | 'not_started';
}

@Injectable()
export class WorkTasksService {
  constructor(
    private readonly logger: AppLoggerService,
    @InjectModel(TaskEntity) private readonly taskModel: typeof TaskEntity,
    @InjectModel(EntityAttachmentEntity)
    private readonly attachmentModel: typeof EntityAttachmentEntity,
    @InjectModel(AiTaskEntity) private readonly aiTaskModel: typeof AiTaskEntity,
    @InjectModel(AiRequestAuditLogEntity)
    private readonly auditModel: typeof AiRequestAuditLogEntity,
    private readonly notify: NotificationService,
  ) {
    this.logger.setContext(WorkTasksService.name);
  }

  private buildWhere(query: ListQueryDto, filters: TaskListFilters): WhereOptions {
    // Giao khoảng thời gian: dueDate >= from (kết thúc sau đầu kỳ) & startDate <= to (bắt đầu trước cuối kỳ).
    // Null ngày coi như mở (không loại trừ).
    const dateAnd: WhereOptions[] = [];
    if (filters.fromDate) {
      dateAnd.push({ [Op.or]: [{ dueDate: { [Op.gte]: new Date(filters.fromDate) } }, { dueDate: null }] });
    }
    if (filters.toDate) {
      dateAnd.push({ [Op.or]: [{ startDate: { [Op.lte]: new Date(filters.toDate) } }, { startDate: null }] });
    }
    return {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.priority ? { priority: filters.priority } : {}),
      ...(filters.projectId ? { projectId: filters.projectId } : {}),
      ...(filters.projectPhaseId ? { projectPhaseId: filters.projectPhaseId } : {}),
      ...(filters.taskCategoryId ? { taskCategoryId: filters.taskCategoryId } : {}),
      ...(filters.assignedToUserId ? { assignedToUserId: filters.assignedToUserId } : {}),
      ...(query.q ? { title: { [Op.like]: `%${query.q}%` } } : {}),
      ...(dateAnd.length ? { [Op.and]: dateAnd } : {}),
    };
  }

  async listTasks(
    query: ListQueryDto,
    filters: TaskListFilters,
  ): Promise<PaginatedResult<TaskEntity>> {
    const page = query.page && query.page > 0 ? query.page : 1;
    const pageSize = query.pageSize && query.pageSize > 0 ? query.pageSize : DEFAULT_PAGE_SIZE;
    const sortColumn = query.sort && SORTABLE_COLUMNS.has(query.sort) ? query.sort : 'id';
    const sortOrder = (query.order ?? 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const { rows, count } = await this.taskModel.findAndCountAll({
      where: this.buildWhere(query, filters),
      include: [
        { model: TaskCategoryEntity, as: 'category' },
        { model: ProjectEntity, as: 'project', attributes: ['id', 'title', 'code'] },
        { model: ProjectPhaseEntity, as: 'phase', attributes: ['id', 'title'] },
        { model: UserEntity, as: 'assignedTo', attributes: USER_REF_ATTRS },
      ],
      order: [[sortColumn, sortOrder]],
      offset: (page - 1) * pageSize,
      limit: pageSize,
      distinct: true,
    });
    return { rows, total: count, page, pageSize };
  }

  async getTask(id: number): Promise<TaskEntity & { attachments?: EntityAttachmentEntity[] }> {
    const task = await this.taskModel.findByPk(id, {
      include: [
        { model: TaskCategoryEntity, as: 'category' },
        { model: ProjectEntity, as: 'project', attributes: ['id', 'title', 'code', 'endDate'] },
        { model: ProjectPhaseEntity, as: 'phase', attributes: ['id', 'title'] },
        { model: UserEntity, as: 'assignedTo', attributes: USER_REF_ATTRS },
        { model: UserEntity, as: 'assigner', attributes: USER_REF_ATTRS },
        { model: TaskEntity, as: 'parent', attributes: ['id', 'title'] },
      ],
    });
    if (!task) throw new NotFoundException('Không tìm thấy công việc');
    const attachments = await this.attachmentModel.findAll({
      where: { entityType: 'tasks', entityId: id },
      order: [['sort', 'ASC']],
    });
    const plain = task as TaskEntity & { attachments?: EntityAttachmentEntity[] };
    plain.attachments = attachments;
    return plain;
  }

  createTask(dto: CreateTaskDto, actorId: string | null): Promise<TaskEntity> {
    return this.taskModel.create({
      taskCategoryId: dto.taskCategoryId,
      projectId: dto.projectId ?? null,
      projectPhaseId: dto.projectPhaseId ?? null,
      parentId: dto.parentId ?? null,
      sourceType: dto.sourceType ?? (dto.projectId ? 'project' : 'self_created'),
      priority: dto.priority ?? 'medium',
      assignedBy: actorId,
      assignedToUserId: dto.assignedToUserId ?? null,
      title: dto.title,
      slug: slugify(dto.title),
      description: dto.description ?? null,
      startDate: dto.startDate ? new Date(dto.startDate) : null,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      actualCompletedDate: dto.actualCompletedDate ? new Date(dto.actualCompletedDate) : null,
      estimatedHours: dto.estimatedHours ?? null,
      progressPercent: dto.progressPercent ?? 0,
      progressSource: dto.progressSource ?? 'manual',
      status: dto.status ?? 'todo',
      completedDate: dto.completedDate ? new Date(dto.completedDate) : null,
      closedDate: dto.closedDate ? new Date(dto.closedDate) : null,
      cancelledDate: dto.cancelledDate ? new Date(dto.cancelledDate) : null,
      archivedDate: dto.archivedDate ? new Date(dto.archivedDate) : null,
      createdBy: actorId,
      updatedBy: actorId,
    } as unknown as TaskEntity);
  }

  async updateTask(id: number, dto: UpdateTaskDto, actorId: string | null): Promise<TaskEntity> {
    const task = await this.taskModel.findByPk(id);
    if (!task) throw new NotFoundException('Không tìm thấy công việc');
    const patch: Record<string, unknown> = { updatedBy: actorId };
    if (dto.taskCategoryId !== undefined) patch.taskCategoryId = dto.taskCategoryId;
    if (dto.projectId !== undefined) patch.projectId = dto.projectId;
    if (dto.projectPhaseId !== undefined) patch.projectPhaseId = dto.projectPhaseId;
    if (dto.parentId !== undefined) patch.parentId = dto.parentId;
    if (dto.sourceType !== undefined) patch.sourceType = dto.sourceType;
    if (dto.priority !== undefined) patch.priority = dto.priority;
    if (dto.assignedToUserId !== undefined) patch.assignedToUserId = dto.assignedToUserId;
    if (dto.title !== undefined) {
      patch.title = dto.title;
      patch.slug = slugify(dto.title);
    }
    if (dto.description !== undefined) patch.description = dto.description;
    if (dto.startDate !== undefined) patch.startDate = dto.startDate ? new Date(dto.startDate) : null;
    if (dto.dueDate !== undefined) patch.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    if (dto.actualCompletedDate !== undefined) {
      patch.actualCompletedDate = dto.actualCompletedDate
        ? new Date(dto.actualCompletedDate)
        : null;
    }
    if (dto.estimatedHours !== undefined) patch.estimatedHours = dto.estimatedHours;
    if (dto.progressPercent !== undefined) patch.progressPercent = dto.progressPercent;
    if (dto.progressSource !== undefined) patch.progressSource = dto.progressSource;
    if (dto.status !== undefined) patch.status = dto.status;
    if (dto.completedDate !== undefined) {
      patch.completedDate = dto.completedDate ? new Date(dto.completedDate) : null;
    }
    if (dto.closedDate !== undefined) {
      patch.closedDate = dto.closedDate ? new Date(dto.closedDate) : null;
    }
    if (dto.cancelledDate !== undefined) {
      patch.cancelledDate = dto.cancelledDate ? new Date(dto.cancelledDate) : null;
    }
    if (dto.archivedDate !== undefined) {
      patch.archivedDate = dto.archivedDate ? new Date(dto.archivedDate) : null;
    }
    await task.update(patch);
    return task;
  }

  /**
   * Giao một task con người (bảng tasks) cho AI: tạo bản ghi ai_tasks (id UUID tự sinh) với
   * baseline_hours = số giờ công ước tính và end_date = ngày phải hoàn thành. assignee_id lấy
   * từ người dùng hiện tại (actorId). Trả về ai_task vừa tạo (id dùng làm X-Task-ID khi gọi AI).
   */
  async assignToAi(taskId: number, dto: AssignAiDto, actorId: string | null): Promise<AiTaskEntity> {
    const task = await this.taskModel.findByPk(taskId);
    if (!task) throw new NotFoundException('Không tìm thấy công việc');
    const endDate = dto.endDate ? new Date(dto.endDate) : task.dueDate;
    const aiTask = await this.aiTaskModel.create({
      taskId: task.id,
      projectId: task.projectId,
      title: dto.title ?? task.title,
      baselineHours: dto.baselineHours,
      endDate,
      status: 'OPEN',
      externalSource: 'MANUAL',
      assigneeId: actorId,
      budgetTokens: dto.budgetTokens ?? null,
      moreDesc: dto.moreDesc ?? null,
    } as unknown as AiTaskEntity);
    this.logger.logBusiness(WorkTasksService.name, 'Giao việc cho AI', {
      taskId: task.id,
      aiTaskId: aiTask.id,
      assigneeId: actorId,
    });
    this.notify.emit('task.assigned_ai', {
      taskId: task.id,
      aiTaskId: aiTask.id,
      title: aiTask.title,
      baselineHours: dto.baselineHours,
      budgetTokens: aiTask.budgetTokens,
      assigneeId: actorId,
    });
    return aiTask;
  }

  async deleteTask(id: number): Promise<void> {
    const removed = await this.taskModel.destroy({ where: { id } });
    if (!removed) throw new NotFoundException('Không tìm thấy công việc');
    await this.attachmentModel.destroy({ where: { entityType: 'tasks', entityId: id } });
  }

  private toAssignment(aiTask: AiTaskEntity, hasActivity: boolean): AiAssignmentInfo {
    return {
      taskId: aiTask.taskId as number,
      aiTaskId: aiTask.id,
      title: aiTask.title,
      moreDesc: aiTask.moreDesc,
      endDate: aiTask.endDate,
      baselineHours: Number(aiTask.baselineHours),
      budgetTokens: aiTask.budgetTokens,
      createdAt: aiTask.createdAt,
      hasActivity,
      status: hasActivity ? 'in_progress' : 'not_started',
    };
  }

  /** Việc đã giao cho AI của một công việc (lấy bản giao mới nhất). Null nếu chưa giao. */
  async getAiAssignment(workTaskId: number): Promise<AiAssignmentInfo | null> {
    const aiTask = await this.aiTaskModel.findOne({
      where: { taskId: workTaskId },
      order: [['createdAt', 'DESC']],
    });
    if (!aiTask) return null;
    const activity = await this.auditModel.count({ where: { taskId: aiTask.id } });
    return this.toAssignment(aiTask, activity > 0);
  }

  /** Toàn bộ việc đã giao cho AI (cho cột "AI nhận việc" ở danh sách công việc). */
  async listAiAssignments(): Promise<AiAssignmentInfo[]> {
    const aiTasks = await this.aiTaskModel.findAll({
      where: { taskId: { [Op.ne]: null } },
      order: [['createdAt', 'DESC']],
    });
    if (aiTasks.length === 0) return [];
    const ids = aiTasks.map((a) => a.id);
    const active = await this.auditModel.findAll({
      attributes: ['taskId'],
      where: { taskId: { [Op.in]: ids } },
      group: ['taskId'],
    });
    const activeSet = new Set(active.map((a) => a.taskId));
    // Mỗi work task lấy bản giao mới nhất (đã sort DESC nên giữ bản gặp đầu tiên).
    const seen = new Set<number>();
    const out: AiAssignmentInfo[] = [];
    for (const aiTask of aiTasks) {
      const wtId = aiTask.taskId as number;
      if (seen.has(wtId)) continue;
      seen.add(wtId);
      out.push(this.toAssignment(aiTask, activeSet.has(aiTask.id)));
    }
    return out;
  }

  /** Báo cáo tổng quan công việc: tổng số, phân bố theo trạng thái/độ ưu tiên, quá hạn. */
  async getOverview(filters: TaskListFilters): Promise<TaskOverviewReport> {
    // Tôn trọng toàn bộ filter (kể cả khoảng ngày, danh mục) để khớp với danh sách/xuất XLS.
    const where = this.buildWhere({} as ListQueryDto, filters);

    const tasks = await this.taskModel.findAll({
      where,
      attributes: ['status', 'priority', 'dueDate'],
    });
    const byStatus: Record<string, number> = {};
    const byPriority: Record<string, number> = {};
    let overdue = 0;
    let completed = 0;
    const now = Date.now();
    for (const task of tasks) {
      byStatus[task.status] = (byStatus[task.status] ?? 0) + 1;
      byPriority[task.priority] = (byPriority[task.priority] ?? 0) + 1;
      const isClosed: TaskStatus[] = ['completed', 'cancelled'];
      if (task.status === 'completed') completed += 1;
      if (task.dueDate && task.dueDate.getTime() < now && !isClosed.includes(task.status)) {
        overdue += 1;
      }
    }
    const total = tasks.length;
    return {
      total,
      byStatus,
      byPriority,
      overdue,
      completed,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  }
}
