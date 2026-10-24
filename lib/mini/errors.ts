// Lỗi trả cho Mini App theo hợp đồng: { error: mã máy snake_case, message: câu tiếng Việt hiện cho khách }.
export class MiniError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public extra: Record<string, unknown> = {},
  ) {
    super(message)
  }
}

export const noSession = () => new MiniError(401, 'no_session', 'Chị đăng ký số điện thoại trước giúp Cô nhé.')
export const badRequest = (message = 'Thông tin gửi lên chưa đúng, chị thử lại giúp Cô nhé.') => new MiniError(400, 'bad_request', message)
export const rateLimited = () => new MiniError(429, 'rate_limited', 'Chị thao tác hơi nhanh, chờ một lát rồi thử lại giúp Cô nhé.')
