import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../common/auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { JwtPayload } from '../auth/auth.service';
import { BOOSTS, BoostType, DailyBoostType, GAME, LEAGUES } from '../config/game.config';
import { UsersService } from '../users/users.service';
import { GameService } from './game.service';
import { PlayerStateDto } from './player-state';

@Controller('game')
export class GameController {
  constructor(
    private readonly game: GameService,
    private readonly users: UsersService,
  ) {}

  /** Статичный справочник — лиги и таблица стоимости бустов */
  @Get('config')
  config() {
    return {
      leagues: LEAGUES,
      turbo: {
        durationMs: GAME.TURBO_DURATION_MS,
        multiplier: GAME.TURBO_MULTIPLIER,
      },
      dailyLimits: GAME.DAILY_LIMITS,
      boosts: Object.values(BoostType).map((type) => {
        const cfg = BOOSTS[type];
        return {
          type,
          title: cfg.title,
          description: cfg.description,
          maxLevel: cfg.maxLevel,
          unit: cfg.unit,
          levels: Array.from({ length: cfg.maxLevel }, (_, i) => ({
            level: i + 1,
            value: cfg.value(i + 1),
            costToNext: i + 1 < cfg.maxLevel ? cfg.cost(i + 1) : null,
          })),
        };
      }),
    };
  }

  @Get('state')
  @UseGuards(AuthGuard)
  async state(@CurrentUser() user: JwtPayload): Promise<PlayerStateDto> {
    const state = await this.game.stateById(user.sub);
    if (!state) throw new NotFoundException('Игрок не найден');
    return state;
  }

  @Get('leaderboard')
  @UseGuards(AuthGuard)
  async leaderboard(@CurrentUser() user: JwtPayload) {
    const top = this.game.getLeaderboard();
    return {
      top: top.length ? top : await this.game.refreshLeaderboard(),
      myRank: await this.game.rankOf(user.sub),
      online: this.game.onlineCount,
      totalPlayers: await this.users.count(),
    };
  }

  /** REST-запасной путь для тапов — удобно для curl/тестов без сокета */
  @Post('tap')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  async tap(
    @CurrentUser() user: JwtPayload,
    @Body() body: { count?: number },
  ): Promise<PlayerStateDto> {
    const player = await this.game.load(user.sub);
    if (!player) throw new NotFoundException('Игрок не найден');
    this.game.tap(player, Number(body?.count) || 1);
    return this.game.state(player);
  }

  @Post('boost/buy')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  async buyBoost(
    @CurrentUser() user: JwtPayload,
    @Body() body: { type?: string },
  ): Promise<PlayerStateDto> {
    const player = await this.game.load(user.sub);
    if (!player) throw new NotFoundException('Игрок не найден');

    const type = body?.type as BoostType;
    if (!Object.values(BoostType).includes(type)) {
      throw new BadRequestException('Неизвестный буст');
    }

    const result = this.game.buyBoost(player, type);
    if (!result.ok) throw new BadRequestException(result.error);
    return this.game.state(player);
  }

  @Post('boost/daily')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  async dailyBoost(
    @CurrentUser() user: JwtPayload,
    @Body() body: { type?: string },
  ): Promise<PlayerStateDto> {
    const player = await this.game.load(user.sub);
    if (!player) throw new NotFoundException('Игрок не найден');

    const type = body?.type as DailyBoostType;
    if (!Object.values(DailyBoostType).includes(type)) {
      throw new BadRequestException('Неизвестный бустер');
    }

    const result = this.game.useDaily(player, type);
    if (!result.ok) throw new BadRequestException(result.error);
    return this.game.state(player);
  }
}
