import {
  Column,
  DataType,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';

export type IconType = 'material_symbol' | 'svg' | 'letter';

/**
 * admin_menus: cấu trúc menu điều hướng Dashboard (dạng cây qua parent_id).
 * require_permissions (FK logic theo permissions.code) dùng lọc menu theo quyền user.
 */
@Table({ tableName: 'admin_menus', timestamps: false })
export class AdminMenuEntity extends Model<AdminMenuEntity> {
  @PrimaryKey
  @Column({ type: DataType.UUID, defaultValue: DataType.UUIDV4 })
  declare id: string;

  @Column({ type: DataType.STRING(150), allowNull: false })
  declare name: string;

  @ForeignKey(() => AdminMenuEntity)
  @Column({ field: 'parent_id', type: DataType.UUID, allowNull: true })
  declare parentId: string | null;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare sort: number;

  @Column({ field: 'require_permissions', type: DataType.STRING(120), allowNull: true })
  declare requirePermissions: string | null;

  @Column({ field: 'route_path', type: DataType.STRING(255), allowNull: true })
  declare routePath: string | null;

  @Column({
    field: 'icon_type',
    type: DataType.ENUM('material_symbol', 'svg', 'letter'),
    allowNull: false,
    defaultValue: 'letter',
  })
  declare iconType: IconType;

  @Column({ field: 'icon_value', type: DataType.STRING(255), allowNull: true })
  declare iconValue: string | null;

  @Column({ field: 'is_active', type: DataType.BOOLEAN, allowNull: false, defaultValue: true })
  declare isActive: boolean;
}
