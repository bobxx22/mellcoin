import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { BoostType, DailyBoostType, GAME, LEAGUES, maxEnergyFor } from '../config/game.config';
import { UsersService } from '../users/users.service';
import {
  BoostResult,
  PlayerRuntime,
  PlayerStateDto,
  TapResult,
  applyTaps,
  buyBoost,
  fromEntity,
  regenEnergy,
  serialize,
  useDailyBoost,
} from './player-state';

export interface LeaderboardRow {
  rank: number;
  id: string;
  displayName: string;
  balance: number;
  league: string;
}

/**
 * Держит состояние активных игроков в памяти и пишет его в PostgreSQL пачками.
 * Тап не идёт в БД — только меняет число в RAM. Раз в FLUSH_INTERVAL_MS
 * все "грязные" игроки сохраняются одной транзакцией.
 */
@Injectable()
export class GameService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GameService.name);
  private readonly players = new Map<string, PlayerRuntime>();
  private readonly connections = new Map<string, number>();
  private readonly loading = new Map<string, Promise<PlayerRuntime | null>>();

  private flushTimer?: NodeJS.Timeout;
  private leaderboardCache: LeaderboardRow[] = [];

  constructor(private readonly users: UsersService) {}

  onModuleInit(): void {
    this.flushTimer = setInterval(() => {
      void this.flush();
    }, GAME.FLUSH_INTERVAL_MS);
    void this.refreshLeaderboard();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.flushTimer) clearInterval(this.flushTimer);
    await this.flush();
  }

  // ── Жизненный цикл игрока в памяти ──────────────────────────────────

  /** Загружает игрока из БД (или отдаёт из памяти). Гонки по одному id схлопываются. */
  async load(userId: string): Promise<PlayerRuntime | null> {
    const cached = this.players.get(userId);
    if (cached) {
      cached.lastSeen = Date.now();
      return cached;
    }

    const inFlight = this.loading.get(userId);
    if (inFlight) return inFlight;

    const promise = (async () => {
      const user = await this.users.findById(userId);
      if (!user) return null;
      // За время await игрок мог появиться в памяти — не затираем его
      const existing = this.players.get(userId);
      if (existing) return existing;
      const player = fromEntity(user);
      this.players.set(userId, player);
      return player;
    })();

    this.loading.set(userId, promise);
    try {
      return await promise;
    } finally {
      this.loading.delete(userId);
    }
  }

  attach(userId: string): void {
    this.connections.set(userId, (this.connections.get(userId) ?? 0) + 1);
  }

  async detach(userId: string): Promise<void> {
    const left = (this.connections.get(userId) ?? 1) - 1;
    if (left > 0) {
      this.connections.set(userId, left);
      return;
    }
    this.connections.delete(userId);

    // Последний сокет игрока закрылся — сразу сохраняем и выгружаем
    const player = this.players.get(userId);
    if (!player) return;
    if (player.dirty) {
      await this.users.flushPlayers([player]);
      player.dirty = false;
    }
    this.players.delete(userId);
  }

  // ── Игровые действия ────────────────────────────────────────────────

  tap(player: PlayerRuntime, count: number): TapResult {
    return applyTaps(player, count);
  }

  buyBoost(player: PlayerRuntime, type: BoostType): BoostResult {
    return buyBoost(player, type);
  }

  useDaily(player: PlayerRuntime, type: DailyBoostType): BoostResult {
    return useDailyBoost(player, type);
  }

  state(player: PlayerRuntime): PlayerStateDto {
    return serialize(player);
  }

  /** Состояние по userId — для REST, когда сокет ещё не поднят */
  async stateById(userId: string): Promise<PlayerStateDto | null> {
    const player = await this.load(userId);
    return player ? serialize(player) : null;
  }

  // ── Админка (тестовая) ──────────────────────────────────────────────

  /**
   * Правит игрока «сверху». Идёт через состояние в памяти, а не напрямую
   * в БД: если игрок сейчас онлайн, прямой UPDATE был бы затёрт ближайшим
   * флашем из RAM. Поэтому подгружаем игрока, меняем runtime и сразу пишем.
   */
  async applyAdminPatch(
    userId: string,
    patch: Partial<
      Pick<
        PlayerRuntime,
        | 'balance'
        | 'totalEarned'
        | 'taps'
        | 'energy'
        | 'multitapLevel'
        | 'energyLimitLevel'
        | 'rechargeLevel'
        | 'fullEnergyUsed'
        | 'turboUsed'
      >
    >,
  ): Promise<PlayerStateDto | null> {
    const player = await this.load(userId);
    if (!player) return null;

    const now = Date.now();
    regenEnergy(player, now);

    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined || value === null) continue;
      (player as unknown as Record<string, number>)[key] = Number(value);
    }

    // Энергия не должна превышать текущий лимит
    player.energy = Math.max(0, Math.min(player.energy, maxEnergyFor(player.energyLimitLevel)));
    player.energyUpdatedAt = now;
    player.dirty = true;

    await this.users.flushPlayers([player]);
    player.dirty = false;

    // Разослать новое состояние во все открытые вкладки игрока
    this.onPlayerPatched?.(userId, serialize(player, now));

    return serialize(player, now);
  }

  /** Сбрасывает дневные лимиты бустеров, не дожидаясь смены суток */
  async resetDaily(userId: string): Promise<PlayerStateDto | null> {
    return this.applyAdminPatch(userId, { fullEnergyUsed: 0, turboUsed: 0 });
  }

  /** Выгружает игрока из памяти — например, перед удалением из БД */
  evict(userId: string): void {
    this.players.delete(userId);
    this.connections.delete(userId);
  }

  /** Ставится гейтвеем: нужен, чтобы разослать правки админа в сокеты */
  onPlayerPatched?: (userId: string, state: PlayerStateDto) => void;

  // ── Сохранение ──────────────────────────────────────────────────────

  async flush(): Promise<number> {
    const dirty = [...this.players.values()].filter((p) => p.dirty);
    if (dirty.length > 0) {
      try {
        await this.users.flushPlayers(dirty);
        for (const p of dirty) p.dirty = false;
      } catch (err) {
        this.logger.error(`Не удалось сохранить ${dirty.length} игроков`, err as Error);
        return 0;
      }
    }
    this.evictIdle();
    return dirty.length;
  }

  /** Выгружает из памяти тех, кто давно отключился */
  private evictIdle(): void {
    const now = Date.now();
    for (const [id, player] of this.players) {
      if (this.connections.has(id)) continue;
      if (player.dirty) continue;
      if (now - player.lastSeen > GAME.IDLE_EVICT_MS) this.players.delete(id);
    }
  }

  // ── Таблица лидеров ─────────────────────────────────────────────────

  /**
   * Пересчитывает топ из БД и накладывает свежие балансы игроков,
   * которые прямо сейчас в памяти (их данные новее, чем в базе).
   */
  async refreshLeaderboard(): Promise<LeaderboardRow[]> {
    try {
      const rows = await this.users.leaderboard(GAME.LEADERBOARD_SIZE);
      const merged = rows.map((r) => {
        const live = this.players.get(r.id);
        return {
          id: r.id,
          displayName: r.displayName,
          balance: live ? live.balance : r.balance,
          totalEarned: live ? live.totalEarned : r.totalEarned,
        };
      });
      merged.sort((a, b) => b.balance - a.balance);

      this.leaderboardCache = merged.map((r, i) => ({
        rank: i + 1,
        id: r.id,
        displayName: r.displayName,
        balance: r.balance,
        league: leagueName(r.totalEarned),
      }));
    } catch (err) {
      this.logger.error('Не удалось обновить таблицу лидеров', err as Error);
    }
    return this.leaderboardCache;
  }

  getLeaderboard(): LeaderboardRow[] {
    return this.leaderboardCache;
  }

  async rankOf(userId: string): Promise<number> {
    const cached = this.leaderboardCache.find((r) => r.id === userId);
    if (cached) return cached.rank;
    return this.users.rankOf(userId);
  }

  get onlineCount(): number {
    return this.connections.size;
  }
}

function leagueName(totalEarned: number): string {
  let name = LEAGUES[0].name;
  for (const l of LEAGUES) {
    if (totalEarned >= l.minScore) name = l.name;
    else break;
  }
  return name;
}
