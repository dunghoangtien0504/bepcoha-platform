import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

const ICON_TYPES = ['material_symbol', 'svg', 'letter'] as const;

export class CreateMenuDto {
  @IsString()
  @MaxLength(150)
  name!: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  sort?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  requirePermissions?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  routePath?: string;

  @IsOptional()
  @IsIn(ICON_TYPES)
  iconType?: (typeof ICON_TYPES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(255)
  iconValue?: string;
}

export class UpdateMenuDto extends CreateMenuDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
