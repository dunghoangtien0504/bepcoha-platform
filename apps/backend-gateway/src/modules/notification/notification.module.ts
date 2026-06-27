import { Global, Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { NotificationService } from './notification.service';

/**
 * @Global: NotificationService dùng được ở mọi module (quota, work, usage…) mà không cần import lại.
 */
@Global()
@Module({
  imports: [SettingsModule],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
