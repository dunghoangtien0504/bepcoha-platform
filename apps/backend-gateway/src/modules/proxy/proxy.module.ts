import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { AuthModule } from '../auth/auth.module';
import { QuotaModule } from '../quota/quota.module';
import { AnthropicProvider } from './providers/anthropic.provider';
import { OpenAiProvider } from './providers/openai.provider';
import { ProviderRegistry } from './providers/provider.registry';
import { ProxyController } from './proxy.controller';
import { ProxyService } from './proxy.service';

@Module({
  imports: [HttpModule, AuthModule, QuotaModule, AuditLogModule],
  controllers: [ProxyController],
  providers: [ProxyService, ProviderRegistry, OpenAiProvider, AnthropicProvider],
})
export class ProxyModule {}
