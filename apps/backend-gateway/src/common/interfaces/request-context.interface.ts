import { Request } from 'express';

/**
 * Thông tin định danh người gọi được Guard gắn vào request sau khi xác thực token nội bộ.
 */
export interface AuthIdentity {
  /** Email nhân sự — dùng làm requester_id trong audit log (tra hourly_rate theo email). */
  userId: string;
  email: string;
  internalToken: string;
  /**
   * Khóa chủ thể tính hạn ngạch = users.id (RBAC) liên kết qua email.
   * Null nếu app_user chưa có tài khoản dashboard tương ứng (khi đó fallback dùng email).
   */
  quotaUserId: string | null;
}

export interface AuthenticatedRequest extends Request {
  identity: AuthIdentity;
  taskId: string;
  /** Mã dự án ngoài (X-Project-ID) — tùy chọn, phục vụ governance/báo cáo. */
  projectId: string | null;
  /** Mã hội thoại (X-Conversation-ID) — tùy chọn, gom request cùng phiên. */
  conversationId: string | null;
}

/**
 * Cấu trúc usage chuẩn hóa bóc tách từ gói metadata cuối của LLM stream.
 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  systemOverheadTokens: number;
}
