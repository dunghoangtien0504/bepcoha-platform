import { Body, Controller, Get, Param, ParseIntPipe, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  AnalyzedPrompt,
  PromptPerformance,
  PromptQuality,
  PromptService,
} from './prompt.service';

@UseGuards(JwtAuthGuard)
@Controller('v1/prompts')
export class PromptController {
  constructor(private readonly promptService: PromptService) {}

  @Get('performance')
  performance(
    @Query('projectId') projectId?: string,
    @Query('requesterId') requesterId?: string,
  ): Promise<PromptPerformance> {
    return this.promptService.getPerformance({ projectId, requesterId });
  }

  @Get('cached')
  cached(): Promise<AnalyzedPrompt[]> {
    return this.promptService.listCached();
  }

  @Get()
  list(
    @Query('quality') quality?: PromptQuality,
    @Query('projectId') projectId?: string,
    @Query('taskId') taskId?: string,
    @Query('requesterId') requesterId?: string,
    @Query('limit') limit?: string,
  ): Promise<AnalyzedPrompt[]> {
    return this.promptService.list({
      quality,
      projectId,
      taskId,
      requesterId,
      limit: limit ? Number.parseInt(limit, 10) : undefined,
    });
  }

  @Put(':id/cache')
  setCache(@Param('id', ParseIntPipe) id: number, @Body() body: { value?: boolean }): Promise<unknown> {
    return this.promptService.setFlag(id, 'cache', body.value !== false);
  }

  @Put(':id/knowledge')
  setKnowledge(@Param('id', ParseIntPipe) id: number, @Body() body: { value?: boolean }): Promise<unknown> {
    return this.promptService.setFlag(id, 'knowledge', body.value !== false);
  }
}
