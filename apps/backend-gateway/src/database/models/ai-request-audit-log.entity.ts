import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { AiTaskEntity } from './ai-task.entity';

export type AuditTaskStatus = 'SUCCESS' | 'FAILED';

/** Nguồn dữ liệu đo lường. */
export type AuditSource = 'GATEWAY' | 'ESTIMATED' | 'IMPORTED';

/** Ngữ cảnh thu thập: REALTIME (qua proxy) hoặc các kiểu nạp gián tiếp. */
export type CaptureMode = 'REALTIME' | 'CHAT' | 'TASK' | 'API';

/**
 * ai_request_audit_logs: lưu vết tài chính/thời gian/tài nguyên của từng request.
 * Tuyệt đối KHÔNG lưu nội dung code (request_body / response_payload) để bảo mật.
 */
@Table({
  tableName: 'ai_request_audit_logs',
  timestamps: false,
  indexes: [
    { name: 'idx_audit_task_id', fields: ['task_id'] },
    { name: 'idx_audit_requester_id', fields: ['requester_id'] },
  ],
})
export class AiRequestAuditLogEntity extends Model<AiRequestAuditLogEntity> {
  @PrimaryKey
  @Column({ field: 'request_id', type: DataType.STRING(50) })
  declare requestId: string;

  @ForeignKey(() => AiTaskEntity)
  @Column({ field: 'task_id', type: DataType.UUID, allowNull: false })
  declare taskId: string;

  @Column({ field: 'requester_id', type: DataType.STRING(50), allowNull: false })
  declare requesterId: string;

  /** Mã dự án ngoài (X-Project-ID) — ngữ cảnh governance từ IDE/extension. */
  @Column({ field: 'project_id', type: DataType.STRING(100), allowNull: true })
  declare projectId: string | null;

  /** Mã hội thoại (X-Conversation-ID) — gom nhiều request cùng một phiên làm việc. */
  @Column({ field: 'conversation_id', type: DataType.STRING(100), allowNull: true })
  declare conversationId: string | null;

  /** Số message trong payload (metadata, không lưu nội dung). */
  @Column({ field: 'message_count', type: DataType.INTEGER, allowNull: true })
  declare messageCount: number | null;

  /** Kích thước payload request (bytes) — phục vụ đo lường, không lưu nội dung. */
  @Column({ field: 'request_bytes', type: DataType.INTEGER, allowNull: true })
  declare requestBytes: number | null;

  @Column({ field: 'requested_at', type: DataType.DATE, allowNull: false })
  declare requestedAt: Date;

  @Column({ field: 'completed_at', type: DataType.DATE, allowNull: true })
  declare completedAt: Date | null;

  @Column({ field: 'prompt_tokens', type: DataType.INTEGER, defaultValue: 0 })
  declare promptTokens: number;

  @Column({ field: 'completion_tokens', type: DataType.INTEGER, defaultValue: 0 })
  declare completionTokens: number;

  @Column({ field: 'system_overhead_tokens', type: DataType.INTEGER, defaultValue: 0 })
  declare systemOverheadTokens: number;

  @Column({ field: 'ai_model_used', type: DataType.STRING(50), allowNull: false })
  declare aiModelUsed: string;

  @Column({ field: 'cost_usd', type: DataType.DECIMAL(10, 6), allowNull: false })
  declare costUsd: number;

  /** Hệ số tăng ca áp dụng tại thời điểm request (1.0 trong giờ, 1.5 ngoài giờ...). */
  @Column({ field: 'ot_multiplier', type: DataType.DECIMAL(4, 2), defaultValue: 1.0 })
  declare otMultiplier: number;

  @Column({ field: 'task_status', type: DataType.STRING(20), allowNull: false })
  declare taskStatus: AuditTaskStatus;

  /** GATEWAY = đo realtime qua proxy; ESTIMATED = ước lượng (Claude Pro cá nhân...). */
  @Column({ type: DataType.STRING(20), allowNull: false, defaultValue: 'GATEWAY' })
  declare source: AuditSource;

  @Column({ field: 'capture_mode', type: DataType.STRING(20), allowNull: true })
  declare captureMode: CaptureMode | null;

  @BelongsTo(() => AiTaskEntity)
  declare task?: AiTaskEntity;
}
