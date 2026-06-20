import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { AppLoggerService } from './common/logger/app-logger.service';
import { AppConfig } from './config/configuration';

async function bootstrap(): Promise<void> {
  // rawBody: true để verify chữ ký HMAC webhook từ hệ thống bên thứ ba.
  const app = await NestFactory.create(AppModule, { rawBody: true, bufferLogs: true });

  const logger = await app.resolve(AppLoggerService);
  logger.setContext('Bootstrap');
  app.useLogger(logger);

  app.enableCors({ origin: true, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }),
  );
  app.useGlobalFilters(new AllExceptionsFilter(await app.resolve(AppLoggerService)));

  const config = app.get(ConfigService).getOrThrow<AppConfig>('app');
  await app.listen(config.port);
  logger.log(`AI Governance Gateway đang chạy tại cổng ${config.port}`);
}

void bootstrap();
