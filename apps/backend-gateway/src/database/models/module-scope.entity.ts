import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { ModuleEntity } from './module.entity';

/**
 * module_scopes: phạm vi con thuộc một module (vd: projects, tasks thuộc module work).
 * code để unique toàn cục nhằm phục vụ liên kết logic theo code từ bảng permissions.
 */
@Table({ tableName: 'module_scopes', timestamps: false })
export class ModuleScopeEntity extends Model<ModuleScopeEntity> {
  @PrimaryKey
  @Column({ type: DataType.UUID, defaultValue: DataType.UUIDV4 })
  declare id: string;

  @ForeignKey(() => ModuleEntity)
  @Column({ field: 'module_id', type: DataType.UUID, allowNull: false })
  declare moduleId: string;

  @Column({ type: DataType.STRING(50), allowNull: false, unique: true })
  declare code: string;

  @Column({ type: DataType.STRING(150), allowNull: false })
  declare name: string;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare description: string | null;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare sort: number;

  @Column({ field: 'is_active', type: DataType.BOOLEAN, allowNull: false, defaultValue: true })
  declare isActive: boolean;

  @BelongsTo(() => ModuleEntity)
  declare module?: ModuleEntity;
}
