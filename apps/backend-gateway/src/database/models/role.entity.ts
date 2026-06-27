import {
  Column,
  DataType,
  HasMany,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { RolePermissionEntity } from './role-permission.entity';

/**
 * roles: vai trò gom nhóm quyền. code tự sinh nếu không nhập (xử lý ở tầng service).
 */
@Table({ tableName: 'roles', timestamps: false })
export class RoleEntity extends Model<RoleEntity> {
  @PrimaryKey
  @Column({ type: DataType.UUID, defaultValue: DataType.UUIDV4 })
  declare id: string;

  @Column({ type: DataType.STRING(80), allowNull: false, unique: true })
  declare code: string;

  @Column({ type: DataType.STRING(150), allowNull: false })
  declare name: string;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare description: string | null;

  @Column({ field: 'is_active', type: DataType.BOOLEAN, allowNull: false, defaultValue: true })
  declare isActive: boolean;

  @HasMany(() => RolePermissionEntity)
  declare rolePermissions?: RolePermissionEntity[];
}
