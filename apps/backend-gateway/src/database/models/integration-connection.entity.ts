import {
  AutoIncrement,
  Column,
  CreatedAt,
  DataType,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { ProjectEntity } from './project.entity';

export type IntegrationProvider = 'JIRA' | 'GITLAB' | 'GITHUB';

/**
 * integration_connections: cấu hình kết nối tới hệ thống quản lý dự án/công việc bên thứ ba.
 * api_token được mã hóa AES-256-GCM trước khi lưu (xem crypto.util).
 */
@Table({ tableName: 'integration_connections', timestamps: false })
export class IntegrationConnectionEntity extends Model<IntegrationConnectionEntity> {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.INTEGER })
  declare id: number;

  @Column({ type: DataType.STRING(20), allowNull: false })
  declare provider: IntegrationProvider;

  @Column({ type: DataType.STRING(100), allowNull: false })
  declare name: string;

  @Column({ field: 'base_url', type: DataType.STRING(255), allowNull: false })
  declare baseUrl: string;

  /** Định danh dự án/repo bên thứ ba (Jira projectKey, GitLab projectId, GitHub owner/repo). */
  @Column({ field: 'external_project_key', type: DataType.STRING(150), allowNull: true })
  declare externalProjectKey: string | null;

  /** Email/username dùng cho Basic Auth (Jira yêu cầu email + token). */
  @Column({ field: 'auth_email', type: DataType.STRING(150), allowNull: true })
  declare authEmail: string | null;

  /** Token truy cập đã được mã hóa. */
  @Column({ field: 'encrypted_token', type: DataType.TEXT, allowNull: false })
  declare encryptedToken: string;

  /** Secret xác thực chữ ký webhook đến từ hệ thống bên thứ ba. */
  @Column({ field: 'webhook_secret', type: DataType.STRING(150), allowNull: true })
  declare webhookSecret: string | null;

  /** Dự án nội bộ mà các task đồng bộ về sẽ được gắn vào. */
  @ForeignKey(() => ProjectEntity)
  @Column({ field: 'target_project_id', type: DataType.INTEGER, allowNull: true })
  declare targetProjectId: number | null;

  /** Số giờ baseline mặc định gán cho task đồng bộ khi nguồn không cung cấp estimate. */
  @Column({ field: 'default_baseline_hours', type: DataType.DECIMAL(5, 2), defaultValue: 8.0 })
  declare defaultBaselineHours: number;

  @Column({ field: 'is_active', type: DataType.BOOLEAN, defaultValue: true })
  declare isActive: boolean;

  @Column({ field: 'last_synced_at', type: DataType.DATE, allowNull: true })
  declare lastSyncedAt: Date | null;

  @CreatedAt
  @Column({ field: 'created_at', type: DataType.DATE })
  declare createdAt: Date;
}
