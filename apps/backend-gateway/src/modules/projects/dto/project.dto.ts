import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateProjectDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  // Chủ sở hữu dự án (tham chiếu users.id).
  @IsOptional()
  @IsUUID()
  ownerId?: string;
}

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  ownerId?: string;
}

export class CreateTaskDto {
  // Mã đối chiếu ngoài tùy chọn (vd TERO-102). id thật là UUID tự sinh.
  @IsOptional()
  @IsString()
  @MaxLength(100)
  externalRef?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  projectId?: number;

  @IsString()
  @MaxLength(255)
  title!: string;

  // baseline_hours bắt buộc để làm mốc đối chiếu ROI.
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  baselineHours!: number;

  @IsOptional()
  @IsIn(['OPEN', 'IN_PROGRESS', 'DONE'])
  status?: 'OPEN' | 'IN_PROGRESS' | 'DONE';

  // Người phụ trách (tham chiếu users.id).
  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  // Ngân sách token cho task (để trống sẽ fallback hạn mức task của user).
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  budgetTokens?: number;

  // Mô tả thêm/ngữ cảnh đầu vào cho AI.
  @IsOptional()
  @IsString()
  moreDesc?: string;
}

export class UpdateTaskDto {
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  projectId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  baselineHours?: number;

  @IsOptional()
  @IsIn(['OPEN', 'IN_PROGRESS', 'DONE'])
  status?: 'OPEN' | 'IN_PROGRESS' | 'DONE';

  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  budgetTokens?: number;

  @IsOptional()
  @IsString()
  moreDesc?: string;
}
