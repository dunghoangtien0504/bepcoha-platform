import {
  AutoIncrement,
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { UserEntity } from './user.entity';

/**
 * user_token_quotas: hạn ngạch token mặc định theo chu kỳ của từng User. 0 = không giới hạn.
 * user_id tham chiếu tới bảng RBAC `users` (định danh nhân sự chuẩn), KHÔNG còn dùng app_users.
 */
@Table({
  tableName: 'user_token_quotas',
  timestamps: false,
  indexes: [{ name: 'idx_user_token_quotas_user_id', fields: ['user_id'] }],
})
export class UserTokenQuotaEntity extends Model<UserTokenQuotaEntity> {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.INTEGER })
  declare id: number;

  @ForeignKey(() => UserEntity)
  @Column({ field: 'user_id', type: DataType.UUID, allowNull: false })
  declare userId: string;

  @Column({ field: 'daily_limit', type: DataType.INTEGER, defaultValue: 0 })
  declare dailyLimit: number;

  @Column({ field: 'weekly_limit', type: DataType.INTEGER, defaultValue: 0 })
  declare weeklyLimit: number;

  @Column({ field: 'monthly_limit', type: DataType.INTEGER, defaultValue: 0 })
  declare monthlyLimit: number;

  @Column({ field: 'task_limit', type: DataType.INTEGER, defaultValue: 0 })
  declare taskLimit: number;

  @BelongsTo(() => UserEntity)
  declare user?: UserEntity;
}
