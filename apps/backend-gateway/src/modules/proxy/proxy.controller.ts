import { Body, Controller, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { AuthenticatedRequest } from '../../common/interfaces/request-context.interface';
import { InternalTokenGuard } from '../auth/internal-token.guard';
import { LlmRequestBody } from './providers/provider.interface';
import { ProxyService } from './proxy.service';

/**
 * Endpoint tương thích OpenAI mà IDE (Continue.dev/Cursor) trỏ tới qua apiBase nội bộ.
 */
@Controller('v1')
export class ProxyController {
  constructor(private readonly proxyService: ProxyService) {}

  @UseGuards(InternalTokenGuard)
  @Post('chat/completions')
  async chatCompletions(
    @Req() request: AuthenticatedRequest,
    @Body() body: LlmRequestBody,
    @Res() response: Response,
  ): Promise<void> {
    await this.proxyService.forwardChatCompletion({
      identity: request.identity,
      taskId: request.taskId,
      projectId: request.projectId,
      conversationId: request.conversationId,
      body,
      clientResponse: response,
    });
  }
}
