import { User } from '../database/entities/user.entity';
import {
  BOOSTS,
  BoostType,
  DailyBoostType,
  GAME,
  coinsPerTapFor,
  energyPerSecFor,
  getLeague,
  getNextLeague,
  maxEnergyFor,
} from '../config/game.config';

/** Состояние игрока в оперативной памяти — источник правды во время сессии */
export interface PlayerRuntime {
  id: string;
  username: string;
  displayName: string;

  balance: number;
  totalEarned: number;
  taps: number;

  energy: number;
  energyUpdatedAt: number;

  multitapLevel: number;
  energyLimitLevel: number;
  rechargeLevel: number;

  fullEnergyUsed: number;
  turboUsed: number;
  dailyResetDate: string;
  turboUntil: number;

  // служебные поля, в БД не пишутся
  dirty: boolean;
  lastSeen: number;
  tapTokens: number;
  tapTokensAt: number;
}

export function utcDate(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

export function fromEntity(user: User, now = Date.now()): PlayerRuntime {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    balance: user.balance,
    totalEarned: user.totalEarned,
    taps: user.taps,
    energy: user.energy,
    energyUpdatedAt: new Date(user.energyUpdatedAt).getTime(),
    multitapLevel: user.multitapLevel,
    energyLimitLevel: user.energyLimitLevel,
    rechargeLevel: user.rechargeLevel,
    fullEnergyUsed: user.fullEnergyUsed,
    turboUsed: user.turboUsed,
    dailyResetDate: user.dailyResetDate,
    turboUntil: user.turboUntil ? new Date(user.turboUntil).getTime() : 0,
    dirty: false,
    lastSeen: now,
    tapTokens: GAME.MAX_TAPS_PER_BATCH,
    tapTokensAt: now,
  };
}

/** Ленивое восстановление энергии: считаем только при обращении к игроку */
export function regenEnergy(p: PlayerRuntime, now = Date.now()): void {
  const elapsedSec = (now - p.energyUpdatedAt) / 1000;
  if (elapsedSec <= 0) return;
  const max = maxEnergyFor(p.energyLimitLevel);
  if (p.energy < max) {
    p.energy = Math.min(max, p.energy + elapsedSec * energyPerSecFor(p.rechargeLevel));
  } else {
    p.energy = max;
  }
  p.energyUpdatedAt = now;
}

/** Сброс дневных лимитов при смене UTC-суток */
export function resetDailyIfNeeded(p: PlayerRuntime, now = Date.now()): void {
  const today = utcDate(now);
  if (p.dailyResetDate !== today) {
    p.dailyResetDate = today;
    p.fullEnergyUsed = 0;
    p.turboUsed = 0;
    p.dirty = true;
  }
}

export function isTurboActive(p: PlayerRuntime, now = Date.now()): boolean {
  return p.turboUntil > now;
}

/** Мягкий лимит частоты тапов (token bucket) — не античит, а защита от мусорных пакетов */
function takeTapTokens(p: PlayerRuntime, requested: number, now: number): number {
  const elapsedSec = (now - p.tapTokensAt) / 1000;
  p.tapTokens = Math.min(
    GAME.MAX_TAPS_PER_BATCH,
    p.tapTokens + elapsedSec * GAME.MAX_TAPS_PER_SECOND,
  );
  p.tapTokensAt = now;
  const allowed = Math.min(requested, Math.floor(p.tapTokens));
  p.tapTokens -= allowed;
  return allowed;
}

export interface TapResult {
  applied: number;
  gained: number;
  turbo: boolean;
}

/** Применяет пачку тапов. Энергия — главный ограничитель. */
export function applyTaps(p: PlayerRuntime, requested: number, now = Date.now()): TapResult {
  resetDailyIfNeeded(p, now);
  regenEnergy(p, now);

  const count = takeTapTokens(
    p,
    Math.max(0, Math.min(Math.floor(requested), GAME.MAX_TAPS_PER_BATCH)),
    now,
  );
  if (count <= 0) return { applied: 0, gained: 0, turbo: isTurboActive(p, now) };

  const turbo = isTurboActive(p, now);
  const perTap = coinsPerTapFor(p.multitapLevel);

  // В турбо энергия не тратится, а монеты идут с множителем
  const applied = turbo ? count : Math.min(count, Math.floor(p.energy / perTap));
  if (applied <= 0) return { applied: 0, gained: 0, turbo };

  const gained = applied * perTap * (turbo ? GAME.TURBO_MULTIPLIER : 1);

  if (!turbo) p.energy -= applied * perTap;
  p.balance += gained;
  p.totalEarned += gained;
  p.taps += applied;
  p.dirty = true;

  return { applied, gained, turbo };
}

export interface BoostResult {
  ok: boolean;
  error?: string;
  cost?: number;
  level?: number;
}

type LevelKey = 'multitapLevel' | 'energyLimitLevel' | 'rechargeLevel';

const LEVEL_KEY: Record<BoostType, LevelKey> = {
  [BoostType.MULTITAP]: 'multitapLevel',
  [BoostType.ENERGY_LIMIT]: 'energyLimitLevel',
  [BoostType.RECHARGE]: 'rechargeLevel',
};

export function buyBoost(p: PlayerRuntime, type: BoostType, now = Date.now()): BoostResult {
  const cfg = BOOSTS[type];
  if (!cfg) return { ok: false, error: 'Неизвестный буст' };

  const levelKey = LEVEL_KEY[type];
  const level = p[levelKey];
  if (level >= cfg.maxLevel) return { ok: false, error: 'Максимальный уровень' };

  const cost = cfg.cost(level);
  if (p.balance < cost) return { ok: false, error: 'Недостаточно монет' };

  regenEnergy(p, now);
  p.balance -= cost;
  p[levelKey] = level + 1;

  // При апгрейде лимита энергии сразу доливаем разницу — так приятнее играть
  if (type === BoostType.ENERGY_LIMIT) {
    p.energy += cfg.value(level + 1) - cfg.value(level);
  }

  p.dirty = true;
  return { ok: true, cost, level: level + 1 };
}

export function useDailyBoost(
  p: PlayerRuntime,
  type: DailyBoostType,
  now = Date.now(),
): BoostResult {
  resetDailyIfNeeded(p, now);
  const limit = GAME.DAILY_LIMITS[type];

  if (type === DailyBoostType.FULL_ENERGY) {
    if (p.fullEnergyUsed >= limit) return { ok: false, error: 'Лимит на сегодня исчерпан' };
    p.fullEnergyUsed += 1;
    p.energy = maxEnergyFor(p.energyLimitLevel);
    p.energyUpdatedAt = now;
    p.dirty = true;
    return { ok: true };
  }

  if (type === DailyBoostType.TURBO) {
    if (p.turboUsed >= limit) return { ok: false, error: 'Лимит на сегодня исчерпан' };
    if (isTurboActive(p, now)) return { ok: false, error: 'Турбо уже активно' };
    p.turboUsed += 1;
    p.turboUntil = now + GAME.TURBO_DURATION_MS;
    p.dirty = true;
    return { ok: true };
  }

  return { ok: false, error: 'Неизвестный бустер' };
}

// ── Сериализация для клиента ──────────────────────────────────────────

export interface BoostDto {
  title: string;
  description: string;
  level: number;
  maxLevel: number;
  value: number;
  nextValue: number | null;
  cost: number | null;
  unit: string;
}

export interface PlayerStateDto {
  user: { id: string; username: string; displayName: string };
  balance: number;
  totalEarned: number;
  taps: number;
  energy: number;
  maxEnergy: number;
  coinsPerTap: number;
  energyPerSec: number;
  boosts: Record<string, BoostDto>;
  daily: Record<string, { left: number; limit: number }>;
  turboUntil: number | null;
  turboMultiplier: number;
  league: { index: number; name: string; minScore: number };
  nextLeague: { index: number; name: string; minScore: number } | null;
  serverTime: number;
}

export function serialize(p: PlayerRuntime, now = Date.now()): PlayerStateDto {
  resetDailyIfNeeded(p, now);
  regenEnergy(p, now);

  const boosts: Record<string, BoostDto> = {};
  for (const type of Object.values(BoostType)) {
    const cfg = BOOSTS[type];
    const level = p[LEVEL_KEY[type]];
    const maxed = level >= cfg.maxLevel;
    boosts[type] = {
      title: cfg.title,
      description: cfg.description,
      level,
      maxLevel: cfg.maxLevel,
      value: cfg.value(level),
      nextValue: maxed ? null : cfg.value(level + 1),
      cost: maxed ? null : cfg.cost(level),
      unit: cfg.unit,
    };
  }

  return {
    user: { id: p.id, username: p.username, displayName: p.displayName },
    balance: p.balance,
    totalEarned: p.totalEarned,
    taps: p.taps,
    energy: Math.floor(p.energy),
    maxEnergy: maxEnergyFor(p.energyLimitLevel),
    coinsPerTap: coinsPerTapFor(p.multitapLevel),
    energyPerSec: energyPerSecFor(p.rechargeLevel),
    boosts,
    daily: {
      [DailyBoostType.FULL_ENERGY]: {
        left: Math.max(0, GAME.DAILY_LIMITS[DailyBoostType.FULL_ENERGY] - p.fullEnergyUsed),
        limit: GAME.DAILY_LIMITS[DailyBoostType.FULL_ENERGY],
      },
      [DailyBoostType.TURBO]: {
        left: Math.max(0, GAME.DAILY_LIMITS[DailyBoostType.TURBO] - p.turboUsed),
        limit: GAME.DAILY_LIMITS[DailyBoostType.TURBO],
      },
    },
    turboUntil: isTurboActive(p, now) ? p.turboUntil : null,
    turboMultiplier: GAME.TURBO_MULTIPLIER,
    league: getLeague(p.totalEarned),
    nextLeague: getNextLeague(p.totalEarned),
    serverTime: now,
  };
}
