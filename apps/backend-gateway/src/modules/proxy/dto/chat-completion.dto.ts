import { IsArray, IsOptional, IsString } from 'class-validator';

export class ChatMessageDto {
  @IsString()
  role!: string;

  @IsString()
  content!: string;
}

/**
 * DTO chỉ ràng buộc các trường tối thiểu cần cho điều phối; phần còn lại được forward nguyên trạng.
 */
export class ChatCompletionDto {
  @IsString()
  model!: string;

  @IsArray()
  messages!: ChatMessageDto[];

  @IsOptional()
  stream?: boolean;
}
