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

/**
 * role_permissions: bảng nối Role <-> Permission (theo permission_code).
 */
@Table({
  tableName: 'role_permissions',
  timestamps: false,
  indexes: [{ name: 'uq_role_permission', unique: true, fields: ['role_id', 'permission_code'] }],
})
export class RolePermissionEntity extends Model<RolePermissionEntity> {
  @PrimaryKey
  @Column({ type: DataType.UUID, defaultValue: DataType.UUIDV4 })
  declare id: string;

  @ForeignKey(() => RoleEntity)
  @Column({ field: 'role_id', type: DataType.UUID, allowNull: false })
  declare roleId: string;

  @Column({ field: 'permission_code', type: DataType.STRING(120), allowNull: false })
  declare permissionCode: string;

  @BelongsTo(() => RoleEntity)
  declare role?: RoleEntity;
}
