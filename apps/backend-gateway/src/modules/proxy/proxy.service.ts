import { HttpService } from '@nestjs/axios';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { Response } from 'express';
import { firstValueFrom } from 'rxjs';
import { Readable } from 'stream';
import { v4 as uuidv4 } from 'uuid';
import { AppLoggerService } from '../../common/logger/app-logger.service';
import { AuthIdentity, TokenUsage } from '../../common/interfaces/request-context.interface';
import { AuditLogService } from '../audit-log/audit-log.service';
import { QuotaService } from '../quota/quota.service';
import { LlmRequestBody } from './providers/provider.interface';
import { ProviderRegistry } from './providers/provider.registry';

interface ForwardParams {
  identity: AuthIdentity;
  taskId: string;
  projectId: string | null;
  conversationId: string | null;
  body: LlmRequestBody;
  clientResponse: Response;
}

/** Ngữ cảnh governance đi kèm để ghi audit (không chứa nội dung code). */
interface RequestContext {
  taskId: string;
  projectId: string | null;
  conversationId: string | null;
  messageCount: number | null;
  requestBytes: number | null;
}

@Injectable()
export class ProxyService {
  constructor(
    private readonly httpService: HttpService,
    private readonly providerRegistry: ProviderRegistry,
    private readonly quotaService: QuotaService,
    private readonly auditLogService: AuditLogService,
    private readonly logger: AppLoggerService,
  ) {
    this.logger.setContext(ProxyService.name);
  }

  /**
   * Luồng chính: xác thực hạn ngạch -> đánh dấu PENDING -> forward stream -> pipe ngược về client
   * -> bóc tách usage -> ghi usage Redis + audit log async. Không bao giờ lưu nội dung code.
   */
  async forwardChatCompletion(params: ForwardParams): Promise<void> {
    const { identity, taskId, projectId, conversationId, body, clientResponse } = params;
    const model = String(body.model ?? '');
    const requestId = uuidv4();
    const requestedAt = new Date();
    // Chủ thể hạn ngạch = users.id (RBAC); fallback email nếu chưa liên kết tài khoản dashboard.
    const quotaSubject = identity.quotaUserId ?? identity.userId;

    // Metric đầu vào (metadata, KHÔNG lưu nội dung): số message + kích thước payload.
    const context: RequestContext = {
      taskId,
      projectId,
      conversationId,
      messageCount: Array.isArray(body.messages) ? body.messages.length : null,
      requestBytes: Buffer.byteLength(JSON.stringify(body ?? {}), 'utf8'),
    };

    // [Tầng phòng thủ] chặn trước nếu đã chạm trần hạn ngạch.
    await this.quotaService.assertWithinQuota(quotaSubject, taskId, requestedAt);

    const provider = this.providerRegistry.resolve(model);
    const upstream = provider.buildUpstreamRequest(body);

    await this.auditLogService.markPending(requestId);

    clientResponse.setHeader('Content-Type', 'text/event-stream');
    clientResponse.setHeader('Cache-Control', 'no-cache');
    clientResponse.setHeader('Connection', 'keep-alive');
    clientResponse.setHeader('X-AIGG-Request-Id', requestId);

    const usage: TokenUsage = { promptTokens: 0, completionTokens: 0, systemOverheadTokens: 0 };

    try {
      const upstreamResponse = await firstValueFrom(
        this.httpService.post<Readable>(upstream.url, upstream.body, {
          headers: upstream.headers,
          responseType: 'stream',
          timeout: 0,
        }),
      );

      await this.pipeStream(upstreamResponse.data, clientResponse, (line) => {
        const parsed = provider.parseUsageChunk(line);
        if (parsed?.promptTokens !== undefined) usage.promptTokens = parsed.promptTokens;
        if (parsed?.completionTokens !== undefined) usage.completionTokens = parsed.completionTokens;
      });

      await this.settle(requestId, context, identity, requestedAt, model, usage, 'SUCCESS');
    } catch (error) {
      this.logger.error(
        `Forward request thất bại (requestId=${requestId})`,
        (error as Error).stack,
      );
      await this.settle(requestId, context, identity, requestedAt, model, usage, 'FAILED');
      if (!clientResponse.headersSent) {
        throw new InternalServerErrorException('Lỗi khi chuyển tiếp tới AI Provider');
      }
      clientResponse.end();
    }
  }

  /**
   * Đọc từng dòng SSE, pipe ngay về client (Dev không phải chờ), đồng thời quét usage.
   */
  private pipeStream(
    upstream: Readable,
    clientResponse: Response,
    onLine: (dataLine: string) => void,
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let buffer = '';
      upstream.on('data', (chunk: Buffer) => {
        const text = chunk.toString('utf8');
        clientResponse.write(text);
        buffer += text;
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data:')) {
            const payload = trimmed.slice('data:'.length).trim();
            if (payload && payload !== '[DONE]') onLine(payload);
          }
        }
      });
      upstream.on('end', () => {
        clientResponse.end();
        resolve();
      });
      upstream.on('error', (error: Error) => reject(error));
    });
  }

  private async settle(
    requestId: string,
    context: RequestContext,
    identity: AuthIdentity,
    requestedAt: Date,
    model: string,
    usage: TokenUsage,
    status: 'SUCCESS' | 'FAILED',
  ): Promise<void> {
    const totalTokens = usage.promptTokens + usage.completionTokens + usage.systemOverheadTokens;
    const quotaSubject = identity.quotaUserId ?? identity.userId;
    await this.quotaService.recordUsage(quotaSubject, context.taskId, totalTokens, requestedAt);
    await this.auditLogService.finalize({
      requestId,
      taskId: context.taskId,
      projectId: context.projectId,
      conversationId: context.conversationId,
      messageCount: context.messageCount,
      requestBytes: context.requestBytes,
      requesterId: identity.userId,
      requestedAt,
      completedAt: new Date(),
      model,
      usage,
      status,
    });
  }
}
