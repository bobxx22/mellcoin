import { Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  MessageBody,
  ConnectedSocket,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { parse as parseCookie } from 'cookie';
import { Server, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service';
import { BoostType, DailyBoostType, GAME } from '../config/game.config';
import { GameService } from './game.service';

interface SocketData {
  userId: string;
  username: string;
}

type GameSocket = Socket<any, any, any, SocketData>;

// CORS для socket.io задаётся в GameIoAdapter (main.ts) — из конфига
@WebSocketGateway()
export class GameGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy
{
  private readonly logger = new Logger(GameGateway.name);
  private leaderboardTimer?: NodeJS.Timeout;

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly game: GameService,
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  afterInit(): void {
    this.leaderboardTimer = setInterval(() => {
      void this.broadcastLeaderboard();
    }, GAME.LEADERBOARD_INTERVAL_MS);

    // Правки из админки должны сразу долетать до открытых вкладок игрока
    this.game.onPlayerPatched = (userId, state) => this.emitState(userId, state);
  }

  onModuleDestroy(): void {
    if (this.leaderboardTimer) clearInterval(this.leaderboardTimer);
  }

  // ── Подключение ─────────────────────────────────────────────────────

  async handleConnection(socket: GameSocket): Promise<void> {
    try {
      const cookieName = this.config.get<string>('COOKIE_NAME', 'mell_token');
      const raw = socket.handshake.headers.cookie ?? '';
      const token = parseCookie(raw)[cookieName];
      if (!token) throw new Error('нет куки авторизации');

      const payload = this.auth.verify(token);
      const player = await this.game.load(payload.sub);
      if (!player) throw new Error('игрок не найден');

      socket.data.userId = player.id;
      socket.data.username = player.username;
      await socket.join(this.room(player.id));
      this.game.attach(player.id);

      socket.emit('state', this.game.state(player));
      socket.emit('leaderboard', this.game.getLeaderboard());
    } catch (err) {
      socket.emit('unauthorized', { message: (err as Error).message });
      socket.disconnect(true);
    }
  }

  async handleDisconnect(socket: GameSocket): Promise<void> {
    const userId = socket.data?.userId;
    if (userId) await this.game.detach(userId);
  }

  // ── События ─────────────────────────────────────────────────────────

  /**
   * Пачка тапов. Клиент копит тапы локально (оптимистичный UI)
   * и шлёт их раз в ~250 мс — это резко снижает трафик и нагрузку.
   */
  @SubscribeMessage('tap')
  async onTap(
    @ConnectedSocket() socket: GameSocket,
    @MessageBody() body: { count?: number },
  ): Promise<void> {
    const player = await this.playerOf(socket);
    if (!player) return;

    const result = this.game.tap(player, Number(body?.count) || 0);
    const state = this.game.state(player);

    // Лёгкий ack — только то, что меняется на каждом тапе
    socket.emit('tap:ack', {
      applied: result.applied,
      gained: result.gained,
      balance: state.balance,
      energy: state.energy,
      maxEnergy: state.maxEnergy,
      turbo: result.turbo,
      league: state.league,
      nextLeague: state.nextLeague,
      totalEarned: state.totalEarned,
    });

    // Другие вкладки того же игрока получают полное состояние
    socket.to(this.room(player.id)).emit('state', state);
  }

  @SubscribeMessage('boost:buy')
  async onBuyBoost(
    @ConnectedSocket() socket: GameSocket,
    @MessageBody() body: { type?: string },
  ): Promise<void> {
    const player = await this.playerOf(socket);
    if (!player) return;

    const type = body?.type as BoostType;
    if (!Object.values(BoostType).includes(type)) {
      socket.emit('action:error', { message: 'Неизвестный буст' });
      return;
    }

    const result = this.game.buyBoost(player, type);
    if (!result.ok) {
      socket.emit('action:error', { message: result.error });
      return;
    }

    socket.emit('action:ok', { type, level: result.level, cost: result.cost });
    this.emitState(player.id, this.game.state(player));
  }

  @SubscribeMessage('boost:daily')
  async onDailyBoost(
    @ConnectedSocket() socket: GameSocket,
    @MessageBody() body: { type?: string },
  ): Promise<void> {
    const player = await this.playerOf(socket);
    if (!player) return;

    const type = body?.type as DailyBoostType;
    if (!Object.values(DailyBoostType).includes(type)) {
      socket.emit('action:error', { message: 'Неизвестный бустер' });
      return;
    }

    const result = this.game.useDaily(player, type);
    if (!result.ok) {
      socket.emit('action:error', { message: result.error });
      return;
    }

    socket.emit('action:ok', { type });
    this.emitState(player.id, this.game.state(player));
  }

  /** Явный запрос состояния — например, после возврата на вкладку */
  @SubscribeMessage('sync')
  async onSync(@ConnectedSocket() socket: GameSocket): Promise<void> {
    const player = await this.playerOf(socket);
    if (!player) return;
    socket.emit('state', this.game.state(player));
    socket.emit('leaderboard', this.game.getLeaderboard());
  }

  // ── Вспомогательное ─────────────────────────────────────────────────

  private room(userId: string): string {
    return `user:${userId}`;
  }

  private emitState(userId: string, state: unknown): void {
    this.server.to(this.room(userId)).emit('state', state);
  }

  private async playerOf(socket: GameSocket) {
    const userId = socket.data?.userId;
    if (!userId) {
      socket.emit('unauthorized', { message: 'Не авторизован' });
      socket.disconnect(true);
      return null;
    }
    const player = await this.game.load(userId);
    if (!player) {
      socket.disconnect(true);
      return null;
    }
    return player;
  }

  private async broadcastLeaderboard(): Promise<void> {
    const rows = await this.game.refreshLeaderboard();
    this.server.emit('leaderboard', rows);
  }
}
