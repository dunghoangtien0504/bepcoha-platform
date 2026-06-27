import { Injectable } from '@nestjs/common';
import { AppLoggerService } from '../../common/logger/app-logger.service';
import { SettingsService } from '../settings/settings.service';

/** Key cấu hình noti trong system_settings (data-driven: bật/tắt + webhook + sự kiện). */
export const NOTIFY_SETTING_KEY = 'notification.policy';

interface NotifyConfig {
  enabled: boolean;
  /** Webhook Node-RED nhận sự kiện, vd http://localhost:1880/aigg/notify. */
  webhookUrl: string;
  /** Bật/tắt theo từng loại sự kiện; thiếu key coi như bật. */
  events?: Record<string, boolean>;
}

/**
 * Bắn sự kiện nghiệp vụ tới webhook Node-RED để xử lý noti (email/Slack/log…).
 * Fire-and-forget: KHÔNG chặn luồng chính, lỗi chỉ log cảnh báo.
 */
@Injectable()
export class NotificationService {
  private cache: NotifyConfig | null = null;
  private cachedAt = 0;
  private static readonly TTL_MS = 10_000;

  constructor(
    private readonly settingsService: SettingsService,
    private readonly logger: AppLoggerService,
  ) {
    this.logger.setContext(NotificationService.name);
  }

  private async config(): Promise<NotifyConfig | null> {
    if (this.cache && Date.now() - this.cachedAt < NotificationService.TTL_MS) return this.cache;
    const raw = await this.settingsService.getValue(NOTIFY_SETTING_KEY);
    if (!raw) return null;
    try {
      this.cache = JSON.parse(raw) as NotifyConfig;
      this.cachedAt = Date.now();
      return this.cache;
    } catch {
      return null;
    }
  }

  /** Phát sự kiện (không await ở nơi gọi). */
  emit(event: string, payload: Record<string, unknown>): void {
    void this.fire(event, payload);
  }

  private async fire(event: string, payload: Record<string, unknown>): Promise<void> {
    try {
      const cfg = await this.config();
      if (!cfg || !cfg.enabled || !cfg.webhookUrl) return;
      if (cfg.events && cfg.events[event] === false) return;
      await fetch(cfg.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event, payload, at: new Date().toISOString() }),
      });
      this.logger.logBusiness(NotificationService.name, 'Đã gửi sự kiện noti', { event });
    } catch (error) {
      this.logger.warn(`Gửi noti thất bại (${event}): ${(error as Error).message}`);
    }
  }
}
