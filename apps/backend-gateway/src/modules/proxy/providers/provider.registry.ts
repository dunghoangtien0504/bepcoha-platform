import { BadRequestException, Injectable } from '@nestjs/common';
import { AnthropicProvider } from './anthropic.provider';
import { LocalLlmProvider } from './local.provider';
import { OpenAiProvider } from './openai.provider';
import { LlmProvider } from './provider.interface';

@Injectable()
export class ProviderRegistry {
  private readonly providers: LlmProvider[];

  constructor(openAi: OpenAiProvider, anthropic: AnthropicProvider, local: LocalLlmProvider) {
    // Local đứng đầu: model có tiền tố ollama//vllm//local/ được định tuyến nội bộ trước.
    this.providers = [local, openAi, anthropic];
  }

  resolve(model: string): LlmProvider {
    const provider = this.providers.find((candidate) => candidate.supports(model));
    if (!provider) {
      throw new BadRequestException(`Không hỗ trợ model: ${model}`);
    }
    return provider;
  }
}
