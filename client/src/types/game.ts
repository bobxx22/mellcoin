export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
}

export interface Boost {
  title: string;
  description: string;
  level: number;
  maxLevel: number;
  value: number;
  nextValue: number | null;
  cost: number | null;
  unit: string;
}

export interface LeagueInfo {
  index: number;
  name: string;
  minScore: number;
}

export interface PlayerState {
  user: AuthUser;
  balance: number;
  totalEarned: number;
  taps: number;
  energy: number;
  maxEnergy: number;
  coinsPerTap: number;
  energyPerSec: number;
  boosts: Record<string, Boost>;
  daily: Record<string, { left: number; limit: number }>;
  turboUntil: number | null;
  turboMultiplier: number;
  league: LeagueInfo;
  nextLeague: LeagueInfo | null;
  serverTime: number;
}

export interface TapAck {
  applied: number;
  gained: number;
  balance: number;
  energy: number;
  maxEnergy: number;
  turbo: boolean;
  league: LeagueInfo;
  nextLeague: LeagueInfo | null;
  totalEarned: number;
}

export interface LeaderboardRow {
  rank: number;
  id: string;
  displayName: string;
  balance: number;
  league: string;
}

export const BOOST_TYPES = {
  MULTITAP: 'multitap',
  ENERGY_LIMIT: 'energy_limit',
  RECHARGE: 'recharge',
} as const;

export const DAILY_TYPES = {
  FULL_ENERGY: 'full_energy',
  TURBO: 'turbo',
} as const;

export interface AdminUserRow {
  id: string;
  username: string;
  displayName: string;
  balance: number;
  totalEarned: number;
  createdAt: string;
}
