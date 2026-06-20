import {
  Column,
  DataType,
  HasMany,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { ModuleScopeEntity } from './module-scope.entity';

/**
 * modules: nhóm chức năng cấp cao nhất (vd: work, governance, admin).
 */
@Table({ tableName: 'modules', timestamps: false })
export class ModuleEntity extends Model<ModuleEntity> {
  @PrimaryKey
  @Column({ type: DataType.UUID, defaultValue: DataType.UUIDV4 })
  declare id: string;

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

  @HasMany(() => ModuleScopeEntity)
  declare scopes?: ModuleScopeEntity[];
}
