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
import { ProjectEntity } from './project.entity';

export type ProjectPhaseStatus =
  | 'pending'
  | 'in_progress'
  | 'on_hold'
  | 'completed'
  | 'cancelled';

/**
 * project_phases: các giai đoạn của dự án (Khởi động, Phân tích, Thiết kế...).
 * Mỗi project phải có tối thiểu một phase.
 */
@Table({ tableName: 'project_phases', timestamps: false })
export class ProjectPhaseEntity extends Model<ProjectPhaseEntity> {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.INTEGER })
  declare id: number;

  @ForeignKey(() => ProjectEntity)
  @Column({ field: 'project_id', type: DataType.INTEGER, allowNull: false })
  declare projectId: number;

  @Column({ type: DataType.STRING(150), allowNull: false })
  declare title: string;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare description: string | null;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare sort: number;

  @Column({
    type: DataType.ENUM('pending', 'in_progress', 'on_hold', 'completed', 'cancelled'),
    allowNull: false,
    defaultValue: 'pending',
  })
  declare status: ProjectPhaseStatus;

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
