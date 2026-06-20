import { TokenUsage } from '../../../common/interfaces/request-context.interface';

export type LlmRequestBody = Record<string, unknown>;

export interface UpstreamRequest {
  url: string;
  headers: Record<string, string>;
  body: LlmRequestBody;
}

/**
 * Hợp đồng chung cho mọi nhà cung cấp LLM. Mỗi provider tự chịu trách nhiệm:
 *  - Dựng request chuyển tiếp (nạp Master Key, chuẩn hóa body bật usage).
 *  - Bóc tách usage từ một dòng dữ liệu SSE.
 */
export interface LlmProvider {
  readonly name: string;
  supports(model: string): boolean;
  buildUpstreamRequest(body: LlmRequestBody): UpstreamRequest;
  parseUsageChunk(sseDataLine: string): Partial<TokenUsage> | null;
}
