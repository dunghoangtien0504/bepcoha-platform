import {
  AutoIncrement,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  ForeignKey,
  HasMany,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt,
} from 'sequelize-typescript';
import { AiTaskEntity } from './ai-task.entity';
import { ProjectCategoryEntity } from './project-category.entity';
import { ProjectMemberEntity } from './project-member.entity';
import { ProjectPhaseEntity } from './project-phase.entity';
import { UserEntity } from './user.entity';

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

/**
 * projects: thực thể trung tâm module Quản lý Dự án.
 * Giữ các cột cũ (name/owner_id/created_by_id) cho hệ ROI, bổ sung cột theo work.model.md.
 */
@Table({ tableName: 'projects', timestamps: false })
export class ProjectEntity extends Model<ProjectEntity> {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.INTEGER })
  declare id: number;

  @ForeignKey(() => ProjectCategoryEntity)
  @Column({ field: 'project_category_id', type: DataType.INTEGER, allowNull: true })
  declare projectCategoryId: number | null;

  /** Mã dự án (auto random nếu để trống). */
  @Column({ type: DataType.STRING(50), allowNull: true })
  declare code: string | null;

  /** Tên dự án (giữ cột cũ name, bắt buộc, để không phá vỡ báo cáo ROI). */
  @Column({ type: DataType.STRING(150), allowNull: false })
  declare name: string;

  /** Tiêu đề dự án theo spec mới (mirror name). */
  @Column({ type: DataType.STRING(150), allowNull: true })
  declare title: string | null;

  /** Slug tạo tự động từ title. */
  @Column({ type: DataType.STRING(180), allowNull: true })
  declare slug: string | null;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare description: string | null;

  @Column({ field: 'start_date', type: DataType.DATE, allowNull: true })
  declare startDate: Date | null;

  @Column({ field: 'end_date', type: DataType.DATE, allowNull: true })
  declare endDate: Date | null;

  /** Ngày hoàn thành thực tế của dự án. */
  @Column({ field: 'actual_completed_date', type: DataType.DATE, allowNull: true })
  declare actualCompletedDate: Date | null;

  @Column({ type: DataType.DECIMAL(5, 2), allowNull: false, defaultValue: 0 })
  declare progress: number;

  @Column({
    type: DataType.ENUM(
      'draft',
      'active',
      'inactive',
      'on_hold',
      'on_track',
      'delayed',
      'completed',
      'cancelled',
      'archived',
    ),
    allowNull: false,
    defaultValue: 'draft',
  })
  declare status: ProjectStatus;

  /** Chủ sở hữu dự án (cột cũ owner_id) — tham chiếu users.id. */
  @ForeignKey(() => UserEntity)
  @Column({ field: 'owner_id', type: DataType.UUID, allowNull: true })
  declare ownerId: string | null;

  /** Người tạo (cột cũ created_by_id) — giữ cho ROI; cột audit mới là created_by. */
  @ForeignKey(() => UserEntity)
  @Column({ field: 'created_by_id', type: DataType.UUID, allowNull: true })
  declare createdById: string | null;

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

  @HasMany(() => AiTaskEntity)
  declare tasks?: AiTaskEntity[];

  @HasMany(() => ProjectPhaseEntity)
  declare phases?: ProjectPhaseEntity[];

  @HasMany(() => ProjectMemberEntity)
  declare members?: ProjectMemberEntity[];

  @BelongsTo(() => ProjectCategoryEntity, { foreignKey: 'project_category_id', as: 'category' })
  declare category?: ProjectCategoryEntity;

  @BelongsTo(() => UserEntity, { foreignKey: 'owner_id', as: 'owner' })
  declare owner?: UserEntity;

  @BelongsTo(() => UserEntity, { foreignKey: 'created_by_id', as: 'creator' })
  declare creator?: UserEntity;
}
