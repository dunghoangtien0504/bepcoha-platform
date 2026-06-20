import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Nạp một bản ghi usage được ước lượng (ngữ cảnh không đo realtime: Claude Pro cá nhân, chat IDE...).
 * KHÔNG lưu nội dung code: promptText/completionText chỉ dùng để ĐẾM token rồi loại bỏ ngay.
 */
export class IngestUsageDto {
  @IsString()
  taskId!: string;

  /** Email nhân sự thực hiện (để tra hourly_rate khi tính ROI). */
  @IsString()
  requesterId!: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200000)
  promptText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200000)
  completionText?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  promptTokens?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  completionTokens?: number;

  /** Ngữ cảnh thu thập gián tiếp. */
  @IsIn(['CHAT', 'TASK', 'API'])
  captureMode!: 'CHAT' | 'TASK' | 'API';

  /** Mã dự án ngoài (X-Project-ID) — đồng bộ ngữ cảnh governance với luồng proxy. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  projectId?: string;

  /** Mã hội thoại (X-Conversation-ID). */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  conversationId?: string;

  /** true = chỉ trả về ước lượng, KHÔNG ghi audit log. */
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;

  @IsOptional()
  @IsDateString()
  occurredAt?: string;
}
