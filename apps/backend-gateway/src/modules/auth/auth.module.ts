import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { SequelizeModule } from '@nestjs/sequelize';
import { JwtConfig } from '../../config/configuration';
import {
  AppUserEntity,
  RolePermissionEntity,
  UserEntity,
} from '../../database/models';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { InternalTokenGuard } from './internal-token.guard';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PermissionsGuard } from './permissions.guard';

@Module({
  imports: [
    SequelizeModule.forFeature([AppUserEntity, UserEntity, RolePermissionEntity]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const jwt = configService.getOrThrow<JwtConfig>('jwt');
        return { secret: jwt.secret, signOptions: { expiresIn: jwt.expiresIn } };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, InternalTokenGuard, JwtAuthGuard, PermissionsGuard],
  exports: [AuthService, InternalTokenGuard, JwtAuthGuard, PermissionsGuard, JwtModule],
})
export class AuthModule {}
