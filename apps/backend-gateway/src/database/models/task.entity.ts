import {
  AutoIncrement,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt,
} from 'sequelize-typescript';
import { ProjectEntity } from './project.entity';
import { ProjectPhaseEntity } from './project-phase.entity';
import { TaskCategoryEntity } from './task-category.entity';
import { UserEntity } from './user.entity';

export type TaskStatus =
  | 'todo'
  | 'in_progress'
  | 'review'
  | 'blocked'
  | 'completed'
  | 'cancelled';

export type TaskSourceType = 'project' | 'direct_assign' | 'self_created' | 'system';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

/** Nguồn cập nhật tiến độ: thủ công | tự động | theo checklist | theo công việc con. */
export type TaskProgressSource = 'manual' | 'auto' | 'checklist' | 'subtask';

/**
 * tasks: đơn vị công việc của module Quản lý Công việc (khác ai_tasks dùng cho đo lường ROI).
 * Có thể thuộc một phase của dự án, hoặc là task độc lập (project_id/project_phase_id null).
 */
@Table({ tableName: 'tasks', timestamps: false })
export class TaskEntity extends Model<TaskEntity> {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.INTEGER })
  declare id: number;

  @ForeignKey(() => TaskCategoryEntity)
  @Column({ field: 'task_category_id', type: DataType.INTEGER, allowNull: false })
  declare taskCategoryId: number;

  @ForeignKey(() => ProjectEntity)
  @Column({ field: 'project_id', type: DataType.INTEGER, allowNull: true })
  declare projectId: number | null;

  @ForeignKey(() => ProjectPhaseEntity)
  @Column({ field: 'project_phase_id', type: DataType.INTEGER, allowNull: true })
  declare projectPhaseId: number | null;

  /** Công việc cha (tự tham chiếu tasks.id) — phục vụ phân rã công việc con. */
  @ForeignKey(() => TaskEntity)
  @Column({ field: 'parent_id', type: DataType.INTEGER, allowNull: true })
  declare parentId: number | null;

  @Column({
    field: 'source_type',
    type: DataType.ENUM('project', 'direct_assign', 'self_created', 'system'),
    allowNull: false,
    defaultValue: 'project',
  })
  declare sourceType: TaskSourceType;

  @Column({
    type: DataType.ENUM('low', 'medium', 'high', 'urgent'),
    allowNull: false,
    defaultValue: 'medium',
  })
  declare priority: TaskPriority;

  @ForeignKey(() => UserEntity)
  @Column({ field: 'assigned_by', type: DataType.UUID, allowNull: true })
  declare assignedBy: string | null;

  @ForeignKey(() => UserEntity)
  @Column({ field: 'assigned_to_user_id', type: DataType.UUID, allowNull: true })
  declare assignedToUserId: string | null;

  @Column({ type: DataType.STRING(255), allowNull: false })
  declare title: string;

  @Column({ type: DataType.STRING(280), allowNull: false })
  declare slug: string;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare description: string | null;

  @Column({ field: 'start_date', type: DataType.DATE, allowNull: true })
  declare startDate: Date | null;

  @Column({ field: 'due_date', type: DataType.DATE, allowNull: true })
  declare dueDate: Date | null;

  @Column({ field: 'actual_completed_date', type: DataType.DATE, allowNull: true })
  declare actualCompletedDate: Date | null;

  /** Số giờ công ước tính để hoàn thành task — mốc baseline khi giao việc cho AI. */
  @Column({ field: 'estimated_hours', type: DataType.DECIMAL(6, 2), allowNull: true })
  declare estimatedHours: number | null;

  /** Tiến độ hoàn thành (0–100). */
  @Column({ field: 'progress_percent', type: DataType.DECIMAL(5, 2), allowNull: false, defaultValue: 0 })
  declare progressPercent: number;

  /** Nguồn cập nhật tiến độ. */
  @Column({
    field: 'progress_source',
    type: DataType.ENUM('manual', 'auto', 'checklist', 'subtask'),
    allowNull: false,
    defaultValue: 'manual',
  })
  declare progressSource: TaskProgressSource;

  @Column({
    type: DataType.ENUM('todo', 'in_progress', 'review', 'blocked', 'completed', 'cancelled'),
    allowNull: false,
    defaultValue: 'todo',
  })
  declare status: TaskStatus;

  /** Ngày hoàn thành. */
  @Column({ field: 'completed_date', type: DataType.DATE, allowNull: true })
  declare completedDate: Date | null;

  /** Ngày đóng. */
  @Column({ field: 'closed_date', type: DataType.DATE, allowNull: true })
  declare closedDate: Date | null;

  /** Ngày hủy. */
  @Column({ field: 'cancelled_date', type: DataType.DATE, allowNull: true })
  declare cancelledDate: Date | null;

  /** Ngày lưu trữ. */
  @Column({ field: 'archived_date', type: DataType.DATE, allowNull: true })
  declare archivedDate: Date | null;

  @CreatedAt
  @Column({ field: 'created_at', type: DataType.DATE })
  declare createdAt: Date;

  @UpdatedAt
  @Column({ field: 'updated_at', type: DataType.DATE })
  declare updatedAt: Date;

  @Column({ field: 'created_by', type: DataType.UUID, allowNull: true })
  declare createdBy: string | null;

  @Column({ field: 'updated_by', type: DataType.UUID, allowNull: true })
  declare updatedBy: string | null;

  @BelongsTo(() => TaskCategoryEntity, { foreignKey: 'task_category_id', as: 'category' })
  declare category?: TaskCategoryEntity;

  @BelongsTo(() => ProjectEntity, { foreignKey: 'project_id', as: 'project' })
  declare project?: ProjectEntity;

  @BelongsTo(() => ProjectPhaseEntity, { foreignKey: 'project_phase_id', as: 'phase' })
  declare phase?: ProjectPhaseEntity;

  @BelongsTo(() => UserEntity, { foreignKey: 'assigned_to_user_id', as: 'assignedTo' })
  declare assignedTo?: UserEntity;

  @BelongsTo(() => UserEntity, { foreignKey: 'assigned_by', as: 'assigner' })
  declare assigner?: UserEntity;

  @BelongsTo(() => TaskEntity, { foreignKey: 'parent_id', as: 'parent' })
  declare parent?: TaskEntity;
}
