import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { AppLoggerService } from '../common/logger/app-logger.service';
import { RedisConfig } from '../config/configuration';

/**
 * Tầng kết nối Redis (ioredis) phục vụ: lưu trạng thái PENDING chống mất log khi rớt
 * mạng, và đếm token tích lũy theo chu kỳ (counter) để check quota dưới 2ms.
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client!: Redis;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: AppLoggerService,
  ) {
    this.logger.setContext(RedisService.name);
  }

  onModuleInit(): void {
    const config = this.configService.getOrThrow<RedisConfig>('redis');
    this.client = new Redis({
      host: config.host,
      port: config.port,
      username: config.username,
      password: config.password,
      lazyConnect: false,
      maxRetriesPerRequest: 2,
    });

    this.client.on('error', (error: Error) => {
      this.logger.error('Lỗi kết nối Redis', error.stack);
    });
    this.client.on('connect', () => {
      this.logger.logBusiness(RedisService.name, 'Đã kết nối Redis thành công');
    });
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.client?.quit();
    } catch (error) {
      this.logger.error('Lỗi khi đóng kết nối Redis', (error as Error).stack);
    }
  }

  getClient(): Redis {
    return this.client;
  }

  async setPending(requestId: string, ttlSeconds = 600): Promise<void> {
    await this.client.set(`request:${requestId}`, 'PENDING', 'EX', ttlSeconds);
  }

  async clearPending(requestId: string): Promise<boolean> {
    const removed = await this.client.del(`request:${requestId}`);
    return removed > 0;
  }

  /**
   * Cộng dồn token tiêu thụ vào counter của một key chu kỳ, set TTL ở lần ghi đầu tiên.
   */
  async incrementUsage(key: string, tokens: number, ttlSeconds: number): Promise<number> {
    const total = await this.client.incrby(key, tokens);
    if (total === tokens) {
      await this.client.expire(key, ttlSeconds);
    }
    return total;
  }

  async getUsage(key: string): Promise<number> {
    const value = await this.client.get(key);
    return value ? Number.parseInt(value, 10) : 0;
  }
}
