import { Column, DataType, Model, PrimaryKey, Table, UpdatedAt } from 'sequelize-typescript';

/**
 * system_settings: lịch làm việc tiêu chuẩn + hệ số kinh tế dùng quy đổi ROI.
 */
@Table({ tableName: 'system_settings', timestamps: false })
export class SystemSettingEntity extends Model<SystemSettingEntity> {
  @PrimaryKey
  @Column({ field: 'setting_key', type: DataType.STRING(50) })
  declare settingKey: string;

  @Column({ field: 'setting_value', type: DataType.TEXT, allowNull: false })
  declare settingValue: string;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare description: string | null;

  @UpdatedAt
  @Column({ field: 'updated_at', type: DataType.DATE })
  declare updatedAt: Date;
}
