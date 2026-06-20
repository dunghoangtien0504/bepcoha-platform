import { ConsoleLogger, Injectable, Scope } from '@nestjs/common';

/**
 * Bộ Logger tập trung của hệ thống (5S - SEISO). Mọi module bắt buộc dùng logger này
 * trong block catch thay vì console.log để chuẩn hóa định dạng và sẵn sàng đẩy sang
 * tầng log tập trung (ELK/Datadog) về sau.
 */
@Injectable({ scope: Scope.TRANSIENT })
export class AppLoggerService extends ConsoleLogger {
  logBusiness(context: string, message: string, payload?: Record<string, unknown>): void {
    const suffix = payload ? ` | ${JSON.stringify(payload)}` : '';
    super.log(`${message}${suffix}`, context);
  }
}
