import { Injectable } from '@nestjs/common';
import { TokenUsage } from '../../common/interfaces/request-context.interface';
import { LocalLlmProvider } from '../proxy/providers/local.provider';

interface ModelPrice {
  /** USD cho mỗi 1.000.000 token input. */
  inputPerMillion: number;
  /** USD cho mỗi 1.000.000 token output. */
  outputPerMillion: number;
}

/**
 * Bảng giá tham chiếu của các hãng (USD / 1M tokens). Có thể chuyển sang DB/Redis về sau.
 */
const PRICE_TABLE: Record<string, ModelPrice> = {
  'gpt-4o': { inputPerMillion: 2.5, outputPerMillion: 10 },
  'gpt-4o-mini': { inputPerMillion: 0.15, outputPerMillion: 0.6 },
  'claude-3-5-sonnet': { inputPerMillion: 3, outputPerMillion: 15 },
  'claude-3-5-haiku': { inputPerMillion: 0.8, outputPerMillion: 4 },
  'claude-3-opus': { inputPerMillion: 15, outputPerMillion: 75 },
};

const DEFAULT_PRICE: ModelPrice = { inputPerMillion: 3, outputPerMillion: 15 };

/** Model nội bộ (Ollama/vLLM) chạy trên hạ tầng doanh nghiệp → chi phí API = 0. */
const LOCAL_PRICE: ModelPrice = { inputPerMillion: 0, outputPerMillion: 0 };

/** Vài model nội bộ gợi ý sẵn cho select ở FE (vẫn có thể gõ tên khác cùng tiền tố). */
const LOCAL_MODEL_SUGGESTIONS = ['ollama/llama3.1', 'ollama/qwen2.5-coder', 'vllm/mistral'];

@Injectable()
export class PricingService {
  /**
   * Quy đổi token tiêu thụ ra chi phí USD. system_overhead tính theo đơn giá input.
   * Model nội bộ (self-hosted) có chi phí API bằng 0 — vẫn đếm token để đo ROI/quota.
   */
  computeCostUsd(model: string, usage: TokenUsage): number {
    const price = LocalLlmProvider.isLocalModel(model)
      ? LOCAL_PRICE
      : (PRICE_TABLE[model] ?? DEFAULT_PRICE);
    const inputTokens = usage.promptTokens + usage.systemOverheadTokens;
    const cost =
      (inputTokens / 1_000_000) * price.inputPerMillion +
      (usage.completionTokens / 1_000_000) * price.outputPerMillion;
    return Number(cost.toFixed(6));
  }

  /** Danh sách model được hỗ trợ — để FE đổ vào select, tránh gõ sai tên. */
  listModels(): string[] {
    return [...Object.keys(PRICE_TABLE), ...LOCAL_MODEL_SUGGESTIONS];
  }
}
