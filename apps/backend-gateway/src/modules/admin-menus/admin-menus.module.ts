import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AdminMenuEntity } from '../../database/models';
import { AuthModule } from '../auth/auth.module';
import { AdminMenusController } from './admin-menus.controller';
import { AdminMenusService } from './admin-menus.service';

@Module({
  imports: [SequelizeModule.forFeature([AdminMenuEntity]), AuthModule],
  controllers: [AdminMenusController],
  providers: [AdminMenusService],
})
export class AdminMenusModule {}
