import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TokenUsage } from '../../../common/interfaces/request-context.interface';
import { ProviderConfig } from '../../../config/configuration';
import { LlmProvider, LlmRequestBody, UpstreamRequest } from './provider.interface';

interface AnthropicUsage {
  input_tokens?: number;
  output_tokens?: number;
}

/**
 * Anthropic dùng wire-format riêng (/v1/messages, header x-api-key + anthropic-version).
 * Usage được nhả qua các event message_start (input) và message_delta (output) trong stream.
 */
@Injectable()
export class AnthropicProvider implements LlmProvider {
  readonly name = 'anthropic';

  constructor(private readonly configService: ConfigService) {}

  supports(model: string): boolean {
    return model.startsWith('claude-');
  }

  buildUpstreamRequest(body: LlmRequestBody): UpstreamRequest {
    const config = this.configService.getOrThrow<ProviderConfig>('provider');
    return {
      url: `${config.anthropicBaseUrl}/messages`,
      headers: {
        'x-api-key': config.anthropicApiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: { ...body, stream: true },
    };
  }

  parseUsageChunk(sseDataLine: string): Partial<TokenUsage> | null {
    try {
      const parsed = JSON.parse(sseDataLine) as {
        type?: string;
        message?: { usage?: AnthropicUsage };
        usage?: AnthropicUsage;
      };
      const usage = parsed.message?.usage ?? parsed.usage;
      if (!usage) return null;
      const result: Partial<TokenUsage> = {};
      if (usage.input_tokens !== undefined) result.promptTokens = usage.input_tokens;
      if (usage.output_tokens !== undefined) result.completionTokens = usage.output_tokens;
      return Object.keys(result).length > 0 ? result : null;
    } catch {
      return null;
    }
  }
}
