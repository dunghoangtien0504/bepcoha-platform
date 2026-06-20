import {
  AutoIncrement,
  Column,
  CreatedAt,
  DataType,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt,
} from 'sequelize-typescript';
import type { IconType } from './admin-menu.entity';
import { ProjectEntity } from './project.entity';

/**
 * task_categories: danh mục phân loại công việc (Development, Testing, Design...).
 * project_id null = danh mục dùng chung; có project_id = riêng cho một dự án.
 */
@Table({ tableName: 'task_categories', timestamps: false })
export class TaskCategoryEntity extends Model<TaskCategoryEntity> {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.INTEGER })
  declare id: number;

  @Column({ type: DataType.STRING(150), allowNull: false })
  declare title: string;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare color: string | null;

  @Column({ field: 'icon_type', type: DataType.ENUM('material_symbol', 'svg'), allowNull: true })
  declare iconType: IconType | null;

  @Column({ field: 'icon_value', type: DataType.TEXT, allowNull: true })
  declare iconValue: string | null;

  @ForeignKey(() => ProjectEntity)
  @Column({ field: 'project_id', type: DataType.INTEGER, allowNull: true })
  declare projectId: number | null;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare sort: number;

  @Column({ field: 'is_active', type: DataType.BOOLEAN, allowNull: false, defaultValue: true })
  declare isActive: boolean;

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
}
