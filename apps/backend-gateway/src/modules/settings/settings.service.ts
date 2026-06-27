import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { AppLoggerService } from '../../common/logger/app-logger.service';
import { SystemSettingEntity } from '../../database/models';

export interface WorkCalendarConfig {
  hoursPerManday: number;
  saturdayHours: number;
  sundayHours: number;
  otMultiplier: number;
  workStartHour: number;
  workEndHour: number;
}

export type CurrencyRateMode = 'API' | 'MANUAL';

/** Cấu hình phân tích nâng cao cho Dashboard (ROI thực tế, token lãng phí). */
export interface AnalyticsConfig {
  /** Số giờ DEV review/nghiệm thu trung bình mỗi task — dùng trong công thức ROI thực tế. */
  devReviewHoursPerTask: number;
  /** Số prompt hợp lý tối đa cho một hội thoại; vượt mức tính là token lãng phí / prompt kém. */
  wasteMaxPromptsPerConversation: number;
  /** Độ dài bản rút gọn prompt lưu lại (ký tự). */
  promptPreviewChars: number;
  /** Ngưỡng token một prompt bị coi là cao bất thường (đánh giá prompt kém). */
  promptHighTokenThreshold: number;
}

/** Cấu hình kinh tế cho công thức ROI & quy đổi tiền tệ — khai báo qua setting key, đổi được runtime. */
export interface EconomicConfig {
  /** Đơn giá giờ công mặc định (USD) khi task chưa có log AI gắn nhân sự. 0 = dùng TB hệ thống. */
  defaultHourlyRateUsd: number;
  /** Ngưỡng số prompt để cảnh báo bất thường. */
  anomalyPromptThreshold: number;
  /** Ngưỡng chi phí (VND) để cảnh báo bất thường. */
  anomalyCostThresholdVnd: number;
  /** Chế độ tỷ giá: MANUAL = dùng usdToVndManual; API = gọi API public (fallback config). */
  currencyRateMode: CurrencyRateMode;
  /** Tỷ giá USD->VND khai báo thủ công (chỉ dùng khi mode = MANUAL). */
  usdToVndManual: number;
}

@Injectable()
export class SettingsService {
  constructor(
    private readonly logger: AppLoggerService,
    @InjectModel(SystemSettingEntity) private readonly settingModel: typeof SystemSettingEntity,
  ) {
    this.logger.setContext(SettingsService.name);
  }

  async findAll(): Promise<SystemSettingEntity[]> {
    return this.settingModel.findAll({ order: [['settingKey', 'ASC']] });
  }

  /** Lấy giá trị thô của một setting key (null nếu chưa có). */
  async getValue(key: string): Promise<string | null> {
    const row = await this.settingModel.findByPk(key);
    return row?.settingValue ?? null;
  }

  async getCalendarConfig(): Promise<WorkCalendarConfig> {
    const rows = await this.settingModel.findAll();
    const map = new Map(rows.map((row) => [row.settingKey, row.settingValue]));
    const num = (key: string, fallback: number): number => {
      const parsed = Number.parseFloat(map.get(key) ?? '');
      return Number.isNaN(parsed) ? fallback : parsed;
    };
    return {
      hoursPerManday: num('hours_per_manday', 8),
      saturdayHours: num('saturday_hours', 4),
      sundayHours: num('sunday_hours', 0),
      otMultiplier: num('ot_multiplier', 1.5),
      workStartHour: num('work_start_hour', 8),
      workEndHour: num('work_end_hour', 17),
    };
  }

  /** Cấu hình phân tích nâng cao (ROI thực tế, token lãng phí) — khai báo qua setting key. */
  async getAnalyticsConfig(): Promise<AnalyticsConfig> {
    const rows = await this.settingModel.findAll();
    const map = new Map(rows.map((row) => [row.settingKey, row.settingValue]));
    const num = (key: string, fallback: number): number => {
      const parsed = Number.parseFloat(map.get(key) ?? '');
      return Number.isNaN(parsed) ? fallback : parsed;
    };
    return {
      devReviewHoursPerTask: num('roi_review_hours_per_task', 0.5),
      wasteMaxPromptsPerConversation: num('waste_max_prompts_per_conversation', 5),
      promptPreviewChars: num('prompt_preview_chars', 2000),
      promptHighTokenThreshold: num('prompt_high_token_threshold', 6000),
    };
  }

  /** Đọc cấu hình kinh tế (đơn giá, ngưỡng cảnh báo, tỷ giá) từ setting key, có fallback an toàn. */
  async getEconomicConfig(): Promise<EconomicConfig> {
    const rows = await this.settingModel.findAll();
    const map = new Map(rows.map((row) => [row.settingKey, row.settingValue]));
    const num = (key: string, fallback: number): number => {
      const parsed = Number.parseFloat(map.get(key) ?? '');
      return Number.isNaN(parsed) ? fallback : parsed;
    };
    const rawMode = (map.get('currency_rate_mode') ?? 'API').trim().toUpperCase();
    const currencyRateMode: CurrencyRateMode = rawMode === 'MANUAL' ? 'MANUAL' : 'API';
    return {
      defaultHourlyRateUsd: num('default_hourly_rate_usd', 0),
      anomalyPromptThreshold: num('anomaly_prompt_threshold', 4),
      anomalyCostThresholdVnd: num('anomaly_cost_threshold_vnd', 200_000),
      currencyRateMode,
      usdToVndManual: num('usd_to_vnd_rate', 25_400),
    };
  }

  /**
   * Suy ra hệ số nhân tăng ca cho một mốc thời gian: ngoài khung hành chính (giờ/cuối tuần)
   * thì áp dụng ot_multiplier, còn lại 1.0. Chủ Nhật và ngoài giờ -> tăng ca.
   */
  async resolveOtMultiplier(at: Date): Promise<number> {
    const config = await this.getCalendarConfig();
    const day = at.getDay(); // 0 = CN, 6 = T7
    const hour = at.getHours();

    if (day === 0 && config.sundayHours === 0) return config.otMultiplier;
    if (day === 6 && config.saturdayHours === 0) return config.otMultiplier;

    const insideOfficeHours = hour >= config.workStartHour && hour < config.workEndHour;
    return insideOfficeHours ? 1.0 : config.otMultiplier;
  }

  async upsert(settingKey: string, settingValue: string, description?: string): Promise<SystemSettingEntity> {
    const [row] = await this.settingModel.upsert({
      settingKey,
      settingValue,
      description: description ?? null,
    } as SystemSettingEntity);
    this.logger.logBusiness(SettingsService.name, 'Cập nhật cấu hình hệ thống', { settingKey });
    return row;
  }
}
