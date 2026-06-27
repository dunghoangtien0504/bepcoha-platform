import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SequelizeModule } from '@nestjs/sequelize';
import { AppConfig, DatabaseConfig } from '../config/configuration';
import { ALL_MODELS } from './models';
import { SchemaPatchService } from './schema-patch.service';
import { DatabaseSeeder } from './seeders/database.seeder';
import { RbacSeeder } from './seeders/rbac.seeder';

@Module({
  imports: [
    SequelizeModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const db = configService.getOrThrow<DatabaseConfig>('database');
        const app = configService.getOrThrow<AppConfig>('app');
        return {
          dialect: 'mysql',
          host: db.host,
          port: db.port,
          username: db.username,
          password: db.password,
          database: db.database,
          models: ALL_MODELS,
          autoLoadModels: true,
          synchronize: app.dbSync,
          logging: false,
          define: { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' },
        };
      },
    }),
    SequelizeModule.forFeature(ALL_MODELS),
  ],
  // Thứ tự khởi tạo OnModuleInit: vá schema -> seed RBAC (roles/users) -> seed workspace (cần users).
  providers: [SchemaPatchService, RbacSeeder, DatabaseSeeder],
  exports: [SequelizeModule],
})
export class DatabaseModule {}
