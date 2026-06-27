import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AiPromptEntity } from '../../database/models';
import { AuthModule } from '../auth/auth.module';
import { SettingsModule } from '../settings/settings.module';
import { PromptController } from './prompt.controller';
import { PromptService } from './prompt.service';

/**
 * Prompt Management: capture ngữ cảnh đầu vào (prompt) + đánh giá chất lượng + cache/knowledge.
 */
@Module({
  imports: [SequelizeModule.forFeature([AiPromptEntity]), AuthModule, SettingsModule],
  controllers: [PromptController],
  providers: [PromptService],
  exports: [PromptService],
})
export class PromptModule {}
