import {
  AutoIncrement,
  Column,
  DataType,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';

export type AddonCycleType = 'ONCE' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
export type AddonStatus = 'ACTIVE' | 'EXPIRED' | 'EXHAUSTED';

/**
 * token_quota_addons: gói token bổ sung (Addon/Overdraft) cộng dồn từ ngày bắt đầu áp dụng.
 */
@Table({
  tableName: 'token_quota_addons',
  timestamps: false,
  indexes: [{ name: 'idx_token_quota_addons_user_id', fields: ['user_id'] }],
})
export class TokenQuotaAddonEntity extends Model<TokenQuotaAddonEntity> {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.INTEGER })
  declare id: number;

  @Column({ field: 'user_id', type: DataType.STRING(50), allowNull: false })
  declare userId: string;

  @Column({ field: 'addon_tokens', type: DataType.INTEGER, allowNull: false })
  declare addonTokens: number;

  @Column({ field: 'cycle_type', type: DataType.STRING(20), allowNull: false })
  declare cycleType: AddonCycleType;

  @Column({ field: 'start_date', type: DataType.DATEONLY, allowNull: false })
  declare startDate: string;

  @Column({ type: DataType.STRING(20), defaultValue: 'ACTIVE' })
  declare status: AddonStatus;
}
