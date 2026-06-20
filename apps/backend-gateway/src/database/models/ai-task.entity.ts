import {
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  Default,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt,
} from 'sequelize-typescript';
import { ProjectEntity } from './project.entity';
import { TaskEntity } from './task.entity';
import { UserEntity } from './user.entity';

export type AiTaskStatus = 'OPEN' | 'IN_PROGRESS' | 'DONE';

/**
 * ai_tasks: tác vụ AI cần xử lý + định biên thời gian (baseline_hours = số giờ công ước tính
 * của task con người) làm mốc tính ROI. id là UUID tự sinh, dùng làm X-Task-ID khi gọi AI.
 * Mã nghiệp vụ ngoài (ví dụ TERO-102) lưu ở external_source/external_url.
 */
@Table({ tableName: 'ai_tasks', timestamps: true })
export class AiTaskEntity extends Model<AiTaskEntity> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.UUID })
  declare id: string;

  /** Task con người (bảng tasks) được giao cho AI thực hiện. */
  @ForeignKey(() => TaskEntity)
  @Column({ field: 'task_id', type: DataType.INTEGER, allowNull: true })
  declare taskId: number | null;

  @ForeignKey(() => ProjectEntity)
  @Column({ field: 'project_id', type: DataType.INTEGER, allowNull: true })
  declare projectId: number | null;

  @Column({ type: DataType.STRING(255), allowNull: false })
  declare title: string;

  /** Số giờ công ước tính (đồng bộ từ task con người) — mốc baseline tính ROI. */
  @Column({ field: 'baseline_hours', type: DataType.DECIMAL(5, 2), allowNull: false })
  declare baselineHours: number;

  /** Ngày phải hoàn thành (<= end_date của dự án), đồng bộ/chỉnh từ lúc giao việc cho AI. */
  @Column({ field: 'end_date', type: DataType.DATE, allowNull: true })
  declare endDate: Date | null;

  @Column({
    type: DataType.ENUM('OPEN', 'IN_PROGRESS', 'DONE'),
    allowNull: false,
    defaultValue: 'OPEN',
  })
  declare status: AiTaskStatus;

  /** Nguồn gốc tác vụ: MANUAL | JIRA | GITLAB | GITHUB (phục vụ tích hợp 3rd-party). */
  @Column({ field: 'external_source', type: DataType.STRING(20), allowNull: true })
  declare externalSource: string | null;

  /** Mã issue/task bên ngoài (vd TERO-102) — khóa đối chiếu khi đồng bộ tích hợp. */
  @Column({ field: 'external_ref', type: DataType.STRING(100), allowNull: true })
  declare externalRef: string | null;

  @Column({ field: 'external_url', type: DataType.STRING(500), allowNull: true })
  declare externalUrl: string | null;

  /** Người phụ trách tác vụ — tham chiếu users.id. "Báo cáo đến ai" suy ra từ report_to của người này. */
  @ForeignKey(() => UserEntity)
  @Column({ field: 'assignee_id', type: DataType.UUID, allowNull: true })
  declare assigneeId: string | null;

  /** Ngân sách token dành cho tác vụ AI này (giới hạn chi phí token đầu vào/đầu ra). */
  @Column({ field: 'budget_tokens', type: DataType.INTEGER, allowNull: true })
  declare budgetTokens: number | null;

  /** Mô tả thêm/ngữ cảnh đầu vào để AI hiểu rõ task (file cần đọc, ràng buộc, định dạng output...). */
  @Column({ field: 'more_desc', type: DataType.TEXT, allowNull: true })
  declare moreDesc: string | null;

  @BelongsTo(() => ProjectEntity)
  declare project?: ProjectEntity;

  @BelongsTo(() => TaskEntity, { foreignKey: 'task_id', as: 'task' })
  declare task?: TaskEntity;

  @BelongsTo(() => UserEntity, { foreignKey: 'assignee_id', as: 'assignee' })
  declare assignee?: UserEntity;

  @CreatedAt
  @Column({ field: 'created_at', type: DataType.DATE })
  declare createdAt: Date;

  @UpdatedAt
  @Column({ field: 'updated_at', type: DataType.DATE })
  declare updatedAt: Date;
}
