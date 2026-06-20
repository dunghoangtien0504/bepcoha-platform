import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { RoleEntity } from './role.entity';

export type Gender = 'male' | 'female' | 'both' | 'unknow';

/**
 * users: tài khoản quản trị/đăng nhập Dashboard, gắn 1 vai trò (role) để phân quyền RBAC.
 */
@Table({ tableName: 'users', timestamps: false })
export class UserEntity extends Model<UserEntity> {
  @PrimaryKey
  @Column({ type: DataType.UUID, defaultValue: DataType.UUIDV4 })
  declare id: string;

  @ForeignKey(() => RoleEntity)
  @Column({ field: 'role_id', type: DataType.UUID, allowNull: false })
  declare roleId: string;

  @Column({ field: 'full_name', type: DataType.STRING(150), allowNull: false })
  declare fullName: string;

  @Column({ field: 'display_name', type: DataType.STRING(150), allowNull: false })
  declare displayName: string;

  @Column({ type: DataType.STRING(180), allowNull: false, unique: true })
  declare email: string;

  @Column({ field: 'password_hashed', type: DataType.STRING(255), allowNull: false })
  declare passwordHashed: string;

  @Column({ type: DataType.STRING(30), allowNull: true })
  declare phone: string | null;

  @Column({ type: DataType.ENUM('male', 'female', 'both', 'unknow'), allowNull: true })
  declare gender: Gender | null;

  @Column({ type: DataType.DATEONLY, allowNull: true })
  declare birthday: string | null;

  @Column({ type: DataType.STRING(120), allowNull: true })
  declare title: string | null;

  @Column({ field: 'is_admin', type: DataType.BOOLEAN, allowNull: false, defaultValue: false })
  declare isAdmin: boolean;

  @Column({ field: 'is_active', type: DataType.BOOLEAN, allowNull: false, defaultValue: true })
  declare isActive: boolean;

  /** Báo cáo đến ai (quản lý trực tiếp) — tự tham chiếu users.id. */
  @ForeignKey(() => UserEntity)
  @Column({ field: 'report_to_id', type: DataType.UUID, allowNull: true })
  declare reportToId: string | null;

  @BelongsTo(() => RoleEntity)
  declare role?: RoleEntity;

  @BelongsTo(() => UserEntity, { foreignKey: 'report_to_id', as: 'reportTo' })
  declare reportTo?: UserEntity;
}
