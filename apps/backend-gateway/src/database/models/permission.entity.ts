import { Column, DataType, Model, PrimaryKey, Table } from 'sequelize-typescript';

/**
 * permissions: quyền hạt nhân theo cú pháp `module.scope.action` (vd: work.projects.view).
 * module/scope là FK logic theo code tới modules.code / module_scopes.code.
 */
@Table({ tableName: 'permissions', timestamps: false })
export class PermissionEntity extends Model<PermissionEntity> {
  @PrimaryKey
  @Column({ type: DataType.UUID, defaultValue: DataType.UUIDV4 })
  declare id: string;

  @Column({ type: DataType.STRING(50), allowNull: false })
  declare module: string;

  @Column({ type: DataType.STRING(50), allowNull: false })
  declare scope: string;

  @Column({ type: DataType.STRING(120), allowNull: false, unique: true })
  declare code: string;

  @Column({ type: DataType.STRING(150), allowNull: false })
  declare name: string;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare description: string | null;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare sort: number;

  @Column({ field: 'is_active', type: DataType.BOOLEAN, allowNull: false, defaultValue: true })
  declare isActive: boolean;
}
