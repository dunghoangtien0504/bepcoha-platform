import {
  AutoIncrement,
  Column,
  CreatedAt,
  DataType,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt,
} from 'sequelize-typescript';

/** Loại thực thể được đính kèm file (mở rộng dần khi có nhu cầu). */
export type AttachmentEntityType = 'projects' | 'tasks';

/**
 * entity_attachments: lưu metadata file đính kèm cho nhiều loại thực thể (projects | tasks).
 * File vật lý lưu theo storage_provider (mặc định local); bảng này chỉ giữ thông tin tra cứu.
 */
@Table({ tableName: 'entity_attachments', timestamps: false })
export class EntityAttachmentEntity extends Model<EntityAttachmentEntity> {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.BIGINT })
  declare id: number;

  @Column({ field: 'entity_type', type: DataType.STRING(50), allowNull: false })
  declare entityType: AttachmentEntityType;

  @Column({ field: 'entity_id', type: DataType.BIGINT, allowNull: false })
  declare entityId: number;

  @Column({ field: 'file_name', type: DataType.STRING(255), allowNull: false })
  declare fileName: string;

  @Column({ field: 'file_extension', type: DataType.STRING(20), allowNull: true })
  declare fileExtension: string | null;

  @Column({ field: 'mime_type', type: DataType.STRING(100), allowNull: true })
  declare mimeType: string | null;

  @Column({ field: 'file_size', type: DataType.BIGINT, allowNull: true })
  declare fileSize: number | null;

  @Column({ field: 'storage_provider', type: DataType.STRING(50), allowNull: true })
  declare storageProvider: string | null;

  @Column({ field: 'storage_path', type: DataType.STRING(1000), allowNull: true })
  declare storagePath: string | null;

  @Column({ field: 'storage_url', type: DataType.STRING(2000), allowNull: true })
  declare storageUrl: string | null;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare description: string | null;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare sort: number;

  @CreatedAt
  @Column({ field: 'created_at', type: DataType.DATE })
  declare createdAt: Date;

  @UpdatedAt
  @Column({ field: 'updated_at', type: DataType.DATE })
  declare updatedAt: Date;

  @Column({ field: 'created_by', type: DataType.UUID, allowNull: true })
  declare createdBy: string | null;

  @Column({ field: 'updated_by', type: DataType.UUID, allowNull: true })
  declare updatedBy: string | null;
}
