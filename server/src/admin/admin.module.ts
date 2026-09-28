import { Module } from '@nestjs/common';
import { GameModule } from '../game/game.module';
import { UsersModule } from '../users/users.module';
import { AdminController } from './admin.controller';

@Module({
  imports: [UsersModule, GameModule],
  controllers: [AdminController],
})
export class AdminModule {}
