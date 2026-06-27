import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AppLoggerService } from '../../common/logger/app-logger.service';
import { AppConfig } from '../../config/configuration';
import { SettingsService } from '../settings/settings.service';

interface ExchangeApiResponse {
  rates?: { VND?: number };
}

@Injectable()
export class CurrencyService {
  private cachedRate: number | null = null;
  private cachedAt = 0;
  private readonly ttlMs = 60 * 60 * 1000;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly logger: AppLoggerService,
    private readonly settingsService: SettingsService,
  ) {
    this.logger.setContext(CurrencyService.name);
  }

  /**
   * Lấy tỷ giá USD->VND theo setting key:
   * - mode = MANUAL & usd_to_vnd_rate > 0  → dùng tỷ giá khai báo (không cache, đổi tức thì).
   * - mode = API → gọi API public (cache 1 giờ); lỗi mạng thì fallback cấu hình tĩnh.
   */
  async getUsdToVnd(): Promise<number> {
    const fallback = this.configService.getOrThrow<AppConfig>('app').usdToVndFallback;

    const economic = await this.settingsService.getEconomicConfig();
    if (economic.currencyRateMode === 'MANUAL' && economic.usdToVndManual > 0) {
      return economic.usdToVndManual;
    }

    if (this.cachedRate && Date.now() - this.cachedAt < this.ttlMs) {
      return this.cachedRate;
    }
    try {
      const response = await firstValueFrom(
        this.httpService.get<ExchangeApiResponse>(
          'https://open.er-api.com/v6/latest/USD',
          { timeout: 4000 },
        ),
      );
      const rate = response.data.rates?.VND;
      if (rate && rate > 0) {
        this.cachedRate = rate;
        this.cachedAt = Date.now();
        return rate;
      }
      return fallback;
    } catch (error) {
      this.logger.warn(`Không lấy được tỷ giá realtime, dùng fallback ${fallback}`);
      return fallback;
    }
  }
}
