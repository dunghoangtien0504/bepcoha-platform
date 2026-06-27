import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TokenUsage } from '../../../common/interfaces/request-context.interface';
import { ProviderConfig } from '../../../config/configuration';
import { LlmProvider, LlmRequestBody, UpstreamRequest } from './provider.interface';

interface OpenAiCompatUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
}

/** Tiền tố định tuyến tới LLM chạy nội bộ (Ollama / vLLM / bất kỳ endpoint OpenAI-compatible nào). */
const LOCAL_PREFIXES = ['ollama/', 'vllm/', 'local/'] as const;

/**
 * Nhà cung cấp LLM nội bộ (self-hosted). Ollama và vLLM đều expose API tương thích OpenAI
 * (`/v1/chat/completions`, usage ở chunk cuối khi bật stream_options.include_usage), nên ta tái dùng
 * đúng wire-format của OpenAI và chỉ đổi base URL + bóc tiền tố định tuyến khỏi tên model.
 *
 * Lợi ích: source/prompt KHÔNG rời hạ tầng doanh nghiệp, chi phí API = 0, nhưng vẫn đi qua đầy đủ
 * lớp quota + audit + ROI + Prompt Management của Gateway.
 */
@Injectable()
export class LocalLlmProvider implements LlmProvider {
  readonly name = 'local';

  constructor(private readonly configService: ConfigService) {}

  static isLocalModel(model: string): boolean {
    return LOCAL_PREFIXES.some((prefix) => model.startsWith(prefix));
  }

  /** `ollama/llama3.1` -> `llama3.1` (gửi tên thật cho engine nội bộ). */
  private stripPrefix(model: string): string {
    const prefix = LOCAL_PREFIXES.find((candidate) => model.startsWith(candidate));
    return prefix ? model.slice(prefix.length) : model;
  }

  supports(model: string): boolean {
    return LocalLlmProvider.isLocalModel(model);
  }

  buildUpstreamRequest(body: LlmRequestBody): UpstreamRequest {
    const config = this.configService.getOrThrow<ProviderConfig>('provider');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    // vLLM thường yêu cầu Bearer (chuỗi bất kỳ); Ollama không cần — chỉ gắn header khi có cấu hình.
    if (config.localLlmApiKey) {
      headers.Authorization = `Bearer ${config.localLlmApiKey}`;
    }
    const rawModel = typeof body.model === 'string' ? body.model : '';
    return {
      url: `${config.localLlmBaseUrl}/chat/completions`,
      headers,
      body: {
        ...body,
        model: this.stripPrefix(rawModel),
        stream: true,
        stream_options: { include_usage: true },
      },
    };
  }

  parseUsageChunk(sseDataLine: string): Partial<TokenUsage> | null {
    try {
      const parsed = JSON.parse(sseDataLine) as { usage?: OpenAiCompatUsage };
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
