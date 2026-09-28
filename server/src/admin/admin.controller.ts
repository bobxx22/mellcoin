import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { GameService } from '../game/game.service';
import { UsersService } from '../users/users.service';
import { AdminPatchDto } from './dto/admin.dto';

/**
 * Тестовая админка. БЕЗ АВТОРИЗАЦИИ — так и было задумано, чтобы быстро
 * править данные игроков во время разработки.
 *
 * Модуль подключается только при ADMIN_ENABLED=true (см. app.module.ts).
 * В docker-compose и .env он включён; на реальном сервере переменную
 * ставить нельзя — иначе любой сможет выдать себе миллиард монет.
 */
@Controller('admin')
export class AdminController {
  constructor(
    private readonly users: UsersService,
    private readonly game: GameService,
  ) {}

  /** Список игроков с поиском по логину */
  @Get('users')
  async list(@Query('q') q?: string) {
    const rows = await this.users.searchForAdmin(q?.trim() || undefined, 100);
    return { total: await this.users.count(), users: rows };
  }

  /** Полное состояние одного игрока — то же, что видит сам игрок */
  @Get('users/:id')
  async one(@Param('id', ParseUUIDPipe) id: string) {
    const state = await this.game.stateById(id);
    if (!state) throw new NotFoundException('Игрок не найден');
    return state;
  }

  /** Правка полей. Пустые поля игнорируются — меняется только присланное. */
  @Patch('users/:id')
  async patch(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AdminPatchDto) {
    const patch = Object.fromEntries(
      Object.entries(dto).filter(([, v]) => v !== undefined && v !== null),
    );
    if (Object.keys(patch).length === 0) throw new BadRequestException('Нечего менять');

    const state = await this.game.applyAdminPatch(id, patch);
    if (!state) throw new NotFoundException('Игрок не найден');
    return state;
  }

  /** Сбросить дневные лимиты бустеров, не дожидаясь смены UTC-суток */
  @Post('users/:id/reset-daily')
  @HttpCode(200)
  async resetDaily(@Param('id', ParseUUIDPipe) id: string) {
    const state = await this.game.resetDaily(id);
    if (!state) throw new NotFoundException('Игрок не найден');
    return state;
  }

  @Delete('users/:id')
  @HttpCode(200)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    // Сначала выгружаем из памяти, иначе фоновый флаш воскресит запись
    this.game.evict(id);
    const removed = await this.users.remove(id);
    if (!removed) throw new NotFoundException('Игрок не найден');
    return { ok: true };
  }
}
