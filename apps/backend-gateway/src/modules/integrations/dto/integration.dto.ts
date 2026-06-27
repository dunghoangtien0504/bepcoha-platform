import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateConnectionDto {
  @IsIn(['JIRA', 'GITLAB', 'GITHUB'])
  provider!: 'JIRA' | 'GITLAB' | 'GITHUB';

  @IsString()
  @MaxLength(100)
  name!: string;

  @IsString()
  @MaxLength(255)
  baseUrl!: string;

  @IsOptional()
  @IsString()
  externalProjectKey?: string;

  @IsOptional()
  @IsString()
  authEmail?: string;

  /** Token gốc dạng plaintext; service sẽ mã hóa trước khi lưu. */
  @IsString()
  token!: string;

  @IsOptional()
  @IsString()
  webhookSecret?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  targetProjectId?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  defaultBaselineHours?: number;
}

export class UpdateConnectionDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  baseUrl?: string;

  @IsOptional()
  @IsString()
  externalProjectKey?: string;

  @IsOptional()
  @IsString()
  authEmail?: string;

  @IsOptional()
  @IsString()
  token?: string;

  @IsOptional()
  @IsString()
  webhookSecret?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  targetProjectId?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  defaultBaselineHours?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
