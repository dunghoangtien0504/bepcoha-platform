import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import {
  ModuleEntity,
  ModuleScopeEntity,
  PermissionEntity,
  RoleEntity,
  RolePermissionEntity,
} from '../../database/models';
import { AuthModule } from '../auth/auth.module';
import { RbacController } from './rbac.controller';
import { RbacService } from './rbac.service';

@Module({
  imports: [
    SequelizeModule.forFeature([
      ModuleEntity,
      ModuleScopeEntity,
      PermissionEntity,
      RoleEntity,
      RolePermissionEntity,
    ]),
    AuthModule,
  ],
  controllers: [RbacController],
  providers: [RbacService],
})
export class RbacModule {}
