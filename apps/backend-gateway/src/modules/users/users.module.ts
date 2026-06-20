import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { RoleEntity, UserEntity } from '../../database/models';
import { AuthModule } from '../auth/auth.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [SequelizeModule.forFeature([UserEntity, RoleEntity]), AuthModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
