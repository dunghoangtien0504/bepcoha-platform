import {
  AutoIncrement,
  Column,
  CreatedAt,
  DataType,
  Default,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt,
} from 'sequelize-typescript';

/**
 * ai_prompts: ngữ cảnh ĐẦU VÀO (prompt) captured qua VSCode extension / MCP.
 * Bảo mật: KHÔNG lưu full source — chỉ bản RÚT GỌN (content_preview) + HASH (content_hash) của
 * toàn bộ prompt để gom/đối chiếu/cache. Chất lượng (good/poor) tính lúc đọc theo ngưỡng cấu hình.
 */
@Table({ tableName: 'ai_prompts', timestamps: true })
export class AiPromptEntity extends Model<AiPromptEntity> {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  /** request_id của bản ghi audit tương ứng (nếu có). */
  @Column({ field: 'request_id', type: DataType.STRING(50), allowNull: true })
  declare requestId: string | null;

  /** ai_tasks.id (UUID). */
  @Column({ field: 'task_id', type: DataType.STRING(36), allowNull: true })
  declare taskId: string | null;

  @Column({ field: 'project_id', type: DataType.STRING(100), allowNull: true })
  declare projectId: string | null;

  @Column({ field: 'requester_id', type: DataType.STRING(100), allowNull: true })
  declare requesterId: string | null;

  @Column({ field: 'conversation_id', type: DataType.STRING(100), allowNull: true })
  declare conversationId: string | null;

  @Column({ field: 'ai_model_used', type: DataType.STRING(50), allowNull: true })
  declare model: string | null;

  /** Bản rút gọn nội dung prompt (cắt theo cấu hình). */
  @Column({ field: 'content_preview', type: DataType.TEXT, allowNull: true })
  declare contentPreview: string | null;

  /** SHA-256 của toàn bộ prompt — để phát hiện lặp/đối chiếu mà không lưu full text. */
  @Column({ field: 'content_hash', type: DataType.STRING(64), allowNull: true })
  declare contentHash: string | null;

  @Column({ field: 'char_count', type: DataType.INTEGER, defaultValue: 0 })
  declare charCount: number;

  @Column({ field: 'prompt_tokens', type: DataType.INTEGER, defaultValue: 0 })
  declare promptTokens: number;

  @Column({ field: 'completion_tokens', type: DataType.INTEGER, defaultValue: 0 })
  declare completionTokens: number;

  @Column({ field: 'total_tokens', type: DataType.INTEGER, defaultValue: 0 })
  declare totalTokens: number;

  /** Thứ tự prompt trong hội thoại (1,2,3…) — phục vụ phát hiện loop/redundant. */
  @Column({ field: 'seq_in_conversation', type: DataType.INTEGER, defaultValue: 1 })
  declare seqInConversation: number;

  /** Đã đưa vào cache để reuse. */
  @Default(false)
  @Column({ field: 'is_cached', type: DataType.BOOLEAN })
  declare isCached: boolean;

  /** Đã đưa vào kho tri thức (knowledge). */
  @Default(false)
  @Column({ field: 'is_knowledge', type: DataType.BOOLEAN })
  declare isKnowledge: boolean;

  @CreatedAt
  @Column({ field: 'created_at', type: DataType.DATE })
  declare createdAt: Date;

  @UpdatedAt
  @Column({ field: 'updated_at', type: DataType.DATE })
  declare updatedAt: Date;
}
