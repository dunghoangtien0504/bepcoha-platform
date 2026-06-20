import { Injectable } from '@nestjs/common';
import { TokenUsage } from '../../common/interfaces/request-context.interface';

export interface EstimateInput {
  promptText?: string;
  completionText?: string;
  /** Ghi đè ước lượng nếu phía gọi đã có số token thực. */
  promptTokens?: number;
  completionTokens?: number;
  systemOverheadTokens?: number;
}

/**
 * Ước lượng token cho các ngữ cảnh KHÔNG đo được realtime (vd: gói Claude Pro cá nhân — đường ống
 * đóng, không có API trả usage). Dùng heuristic xấp xỉ: ~4 ký tự/token, có hệ số cho code/whitespace.
 * Triết lý: không bị giới hạn bởi gói dịch vụ — đo lường được bằng phương pháp gián tiếp.
 */
@Injectable()
export class TokenEstimatorService {
  /** Trung bình ký tự cho mỗi token với văn bản/code hỗn hợp (tham chiếu BPE ~4). */
  private readonly charsPerToken = 4;
  /** Token "khởi tạo" của system prompt/khung hội thoại tính vào system_overhead. */
  private readonly baseOverheadTokens = 8;

  /**
   * Ước lượng số token của một đoạn văn bản. Tính cả khoảng trắng/xuống dòng (đặc trưng của code).
   */
  estimateTextTokens(text: string): number {
    if (!text) return 0;
    const normalizedLength = text.length;
    const whitespaceBonus = (text.match(/\s/g)?.length ?? 0) * 0.25;
    return Math.max(1, Math.ceil(normalizedLength / this.charsPerToken + whitespaceBonus));
  }

  /**
   * Trả về TokenUsage chuẩn hóa: ưu tiên số token được cung cấp, nếu không thì ước lượng từ text.
   */
  estimateUsage(input: EstimateInput): TokenUsage {
    const promptTokens =
      input.promptTokens ?? this.estimateTextTokens(input.promptText ?? '');
    const completionTokens =
      input.completionTokens ?? this.estimateTextTokens(input.completionText ?? '');
    const systemOverheadTokens = input.systemOverheadTokens ?? this.baseOverheadTokens;
    return { promptTokens, completionTokens, systemOverheadTokens };
  }
}
