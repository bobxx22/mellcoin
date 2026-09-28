import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { User } from './database/entities/user.entity';
import { GameModule } from './game/game.module';
import { UsersModule } from './users/users.module';
import { HealthController } from './common/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env'] }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        host: config.get<string>('DB_HOST', 'localhost'),
        port: Number(config.get<string>('DB_PORT', '5433')),
        username: config.get<string>('DB_USER', 'mellcoin'),
        password: config.get<string>('DB_PASSWORD', 'mellcoin'),
        database: config.get<string>('DB_NAME', 'mellcoin'),
        entities: [User],
        // Автосоздание схемы. Отдельный флаг, а не производная от NODE_ENV:
        // в контейнере NODE_ENV=production, но схему поднять всё равно надо.
        // Перед реальным продом — выключить и перейти на миграции TypeORM.
        synchronize:
          config.get<string>('DB_SYNCHRONIZE', 'true').toLowerCase() !== 'false',
        logging: false,
      }),
    }),
    UsersModule,
    AuthModule,
    GameModule,
    // Тестовая админка без авторизации. Подключается только по флагу,
    // чтобы её нельзя было случайно вынести на боевой сервер.
    ...adminModuleIfEnabled(),
  ],
  controllers: [HealthController],
})
export class AppModule {}

function adminModuleIfEnabled(): Array<typeof AdminModule | DynamicModule> {
  return process.env.ADMIN_ENABLED === 'true' ? [AdminModule] : [];
}
