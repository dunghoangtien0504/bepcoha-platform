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
import { UserEntity } from './user.entity';

export type ProjectMemberRole = 'owner' | 'manager' | 'member' | 'viewer';

/**
 * project_members: thành viên tham gia dự án + vai trò trong dự án.
 * Một user tham gia nhiều dự án; một dự án có nhiều thành viên.
 */
@Table({ tableName: 'project_members', timestamps: false })
export class ProjectMemberEntity extends Model<ProjectMemberEntity> {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.INTEGER })
  declare id: number;

  @ForeignKey(() => ProjectEntity)
  @Column({ field: 'project_id', type: DataType.INTEGER, allowNull: false })
  declare projectId: number;

  @ForeignKey(() => UserEntity)
  @Column({ field: 'user_id', type: DataType.UUID, allowNull: false })
  declare userId: string;

  @Column({
    type: DataType.ENUM('owner', 'manager', 'member', 'viewer'),
    allowNull: false,
    defaultValue: 'member',
  })
  declare role: ProjectMemberRole;

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

  @BelongsTo(() => UserEntity, { foreignKey: 'user_id', as: 'user' })
  declare user?: UserEntity;
}
