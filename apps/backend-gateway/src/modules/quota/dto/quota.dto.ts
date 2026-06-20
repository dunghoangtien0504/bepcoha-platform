import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class UpsertQuotaDto {
  @IsString()
  userId!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  dailyLimit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  weeklyLimit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  monthlyLimit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  taskLimit?: number;
}

export class SaveInternalTokenDto {
  @IsString()
  internalToken!: string;
}

export class CreateAddonDto {
  @IsString()
  userId!: string;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  addonTokens!: number;

  @IsIn(['ONCE', 'DAILY', 'WEEKLY', 'MONTHLY'])
  cycleType!: 'ONCE' | 'DAILY' | 'WEEKLY' | 'MONTHLY';

  @IsDateString()
  startDate!: string;
}
