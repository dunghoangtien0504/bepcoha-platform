import { Injectable } from '@nestjs/common';
import { TokenUsage } from '../../common/interfaces/request-context.interface';

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

@Injectable()
export class PricingService {
  /**
   * Quy đổi token tiêu thụ ra chi phí USD. system_overhead tính theo đơn giá input.
   */
  computeCostUsd(model: string, usage: TokenUsage): number {
    const price = PRICE_TABLE[model] ?? DEFAULT_PRICE;
    const inputTokens = usage.promptTokens + usage.systemOverheadTokens;
    const cost =
      (inputTokens / 1_000_000) * price.inputPerMillion +
      (usage.completionTokens / 1_000_000) * price.outputPerMillion;
    return Number(cost.toFixed(6));
  }

  /** Danh sách model được hỗ trợ (khóa của bảng giá) — để FE đổ vào select, tránh gõ sai tên. */
  listModels(): string[] {
    return Object.keys(PRICE_TABLE);
  }
}
