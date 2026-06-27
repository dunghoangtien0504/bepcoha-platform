import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import {
  AiTaskEntity,
  AppUserEntity,
  TokenQuotaAddonEntity,
  UserEntity,
  UserTokenQuotaEntity,
} from '../../database/models';
import { AuthModule } from '../auth/auth.module';
import { InternalTokenService } from './internal-token.service';
import { QuotaAdminService } from './quota-admin.service';
import { QuotaController } from './quota.controller';
import { QuotaService } from './quota.service';

@Module({
  imports: [
    SequelizeModule.forFeature([
      UserTokenQuotaEntity,
      TokenQuotaAddonEntity,
      UserEntity,
      AppUserEntity,
      AiTaskEntity,
    ]),
    AuthModule,
  ],
  controllers: [QuotaController],
  providers: [QuotaService, QuotaAdminService, InternalTokenService],
  exports: [QuotaService],
})
export class QuotaModule {}
