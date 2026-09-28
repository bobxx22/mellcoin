/**
 * Игровая конфигурация MELLCOIN.
 * Все числа собраны здесь, чтобы баланс игры правился в одном месте.
 */

export enum BoostType {
  MULTITAP = 'multitap',
  ENERGY_LIMIT = 'energy_limit',
  RECHARGE = 'recharge',
}

export enum DailyBoostType {
  FULL_ENERGY = 'full_energy',
  TURBO = 'turbo',
}

export const GAME = {
  /** Стартовые значения нового игрока */
  START_BALANCE: 0,

  /** Кап тапов в секунду. Не античит, а защита от мусорных пакетов. */
  MAX_TAPS_PER_SECOND: 20,
  /** Максимум тапов в одном ws-пакете */
  MAX_TAPS_PER_BATCH: 60,

  /** Как часто in-memory состояние сбрасывается в PostgreSQL (мс) */
  FLUSH_INTERVAL_MS: 3000,
  /** Как часто пересчитывается и рассылается таблица лидеров (мс) */
  LEADERBOARD_INTERVAL_MS: 10_000,
  LEADERBOARD_SIZE: 100,
  /** Через сколько мс простоя игрок выгружается из памяти */
  IDLE_EVICT_MS: 60_000,

  TURBO_DURATION_MS: 20_000,
  TURBO_MULTIPLIER: 5,

  DAILY_LIMITS: {
    [DailyBoostType.FULL_ENERGY]: 6,
    [DailyBoostType.TURBO]: 3,
  } as Record<DailyBoostType, number>,
} as const;

/** Уровневые бусты: формулы стоимости и эффекта */
export const BOOSTS = {
  [BoostType.MULTITAP]: {
    title: 'Multitap',
    description: 'Больше монет за один тап',
    maxLevel: 20,
    /** Монет за тап на данном уровне */
    value: (level: number) => level,
    /** Цена апгрейда с level на level+1 */
    cost: (level: number) => 1000 * Math.pow(2, level - 1),
    unit: 'монет/тап',
  },
  [BoostType.ENERGY_LIMIT]: {
    title: 'Energy Limit',
    description: 'Увеличивает запас энергии',
    maxLevel: 20,
    value: (level: number) => 1000 + 500 * (level - 1),
    cost: (level: number) => 1000 * Math.pow(2, level - 1),
    unit: 'энергии',
  },
  [BoostType.RECHARGE]: {
    title: 'Recharge Speed',
    description: 'Энергия восстанавливается быстрее',
    maxLevel: 5,
    value: (level: number) => 2 + level,
    cost: (level: number) => 5000 * Math.pow(4, level - 1),
    unit: 'энергии/сек',
  },
} as const;

export interface League {
  index: number;
  name: string;
  minScore: number;
}

/**
 * Лиги считаются по totalEarned (заработано за всё время), как в Notcoin.
 * Пороги — вход в лигу.
 */
export const LEAGUES: League[] = [
  { index: 0, name: 'Bronze', minScore: 0 },
  { index: 1, name: 'Silver', minScore: 200_000 },
  { index: 2, name: 'Gold', minScore: 1_000_000 },
  { index: 3, name: 'Platinum', minScore: 5_000_000 },
  { index: 4, name: 'Diamond', minScore: 10_000_000 },
];

export function getLeague(totalEarned: number): League {
  let current = LEAGUES[0];
  for (const league of LEAGUES) {
    if (totalEarned >= league.minScore) current = league;
    else break;
  }
  return current;
}

export function getNextLeague(totalEarned: number): League | null {
  const current = getLeague(totalEarned);
  return LEAGUES[current.index + 1] ?? null;
}

export const maxEnergyFor = (energyLimitLevel: number) =>
  BOOSTS[BoostType.ENERGY_LIMIT].value(energyLimitLevel);

export const coinsPerTapFor = (multitapLevel: number) =>
  BOOSTS[BoostType.MULTITAP].value(multitapLevel);

export const energyPerSecFor = (rechargeLevel: number) =>
  BOOSTS[BoostType.RECHARGE].value(rechargeLevel);
