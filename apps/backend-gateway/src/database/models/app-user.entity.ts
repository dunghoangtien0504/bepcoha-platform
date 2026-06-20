import {
  AutoIncrement,
  Column,
  CreatedAt,
  DataType,
  Model,
  PrimaryKey,
  Table,
  Unique,
} from 'sequelize-typescript';

export type UserRole = 'DEVELOPER' | 'TECH_LEAD' | 'CTO';

/**
 * app_users: định danh nhân sự + Internal Token (storo_live_...) dùng để xác thực Gateway,
 * đồng thời lưu password hash phục vụ đăng nhập Admin Dashboard.
 */
@Table({ tableName: 'app_users', timestamps: false })
export class AppUserEntity extends Model<AppUserEntity> {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.INTEGER })
  declare id: number;

  @Unique
  @Column({ type: DataType.STRING(150), allowNull: false })
  declare email: string;

  @Column({ field: 'full_name', type: DataType.STRING(150), allowNull: false })
  declare fullName: string;

  @Column({ type: DataType.STRING(20), allowNull: false, defaultValue: 'DEVELOPER' })
  declare role: UserRole;

  /** Token nội bộ cấp cho dev (storo_live_...). Index unique để tra cứu O(1) khi auth. */
  @Unique
  @Column({ field: 'internal_token', type: DataType.STRING(80), allowNull: false })
  declare internalToken: string;

  /** Hash mật khẩu đăng nhập dashboard (scrypt). Null với dev chỉ dùng gateway. */
  @Column({ field: 'password_hash', type: DataType.STRING(255), allowNull: true })
  declare passwordHash: string | null;

  /** Đơn giá giờ công của nhân sự (USD) phục vụ tính Labor Value Saved. */
  @Column({ field: 'hourly_rate_usd', type: DataType.DECIMAL(10, 2), defaultValue: 0 })
  declare hourlyRateUsd: number;

  @Column({ field: 'is_active', type: DataType.BOOLEAN, defaultValue: true })
  declare isActive: boolean;

  @CreatedAt
  @Column({ field: 'created_at', type: DataType.DATE })
  declare createdAt: Date;
}
