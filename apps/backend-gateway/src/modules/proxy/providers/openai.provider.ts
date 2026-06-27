import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TokenUsage } from '../../../common/interfaces/request-context.interface';
import { ProviderConfig } from '../../../config/configuration';
import { LlmProvider, LlmRequestBody, UpstreamRequest } from './provider.interface';

interface OpenAiUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
}

@Injectable()
export class OpenAiProvider implements LlmProvider {
  readonly name = 'openai';

  constructor(private readonly configService: ConfigService) {}

  supports(model: string): boolean {
    return model.startsWith('gpt-') || model.startsWith('o1') || model.startsWith('text-');
  }

  buildUpstreamRequest(body: LlmRequestBody): UpstreamRequest {
    const config = this.configService.getOrThrow<ProviderConfig>('provider');
    return {
      url: `${config.openAiBaseUrl}/chat/completions`,
      headers: {
        Authorization: `Bearer ${config.openAiApiKey}`,
        'Content-Type': 'application/json',
      },
      // Bật include_usage để hãng trả gói usage ở chunk cuối của stream.
      body: { ...body, stream: true, stream_options: { include_usage: true } },
    };
  }

  parseUsageChunk(sseDataLine: string): Partial<TokenUsage> | null {
    try {
      const parsed = JSON.parse(sseDataLine) as { usage?: OpenAiUsage };
      if (!parsed.usage) return null;
      return {
        promptTokens: parsed.usage.prompt_tokens ?? 0,
        completionTokens: parsed.usage.completion_tokens ?? 0,
      };
    } catch {
      return null;
    }
  }
}
