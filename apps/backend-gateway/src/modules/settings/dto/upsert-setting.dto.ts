import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpsertSettingDto {
  @IsString()
  @MaxLength(50)
  settingKey!: string;

  @IsString()
  @MaxLength(255)
  settingValue!: string;

  @IsOptional()
  @IsString()
  description?: string;
}
