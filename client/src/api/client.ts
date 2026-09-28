import type {
  AdminUserRow,
  AuthUser,
  LeagueInfo,
  LeaderboardRow,
  PlayerState,
} from '../types/game';

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}/api${path}`, {
    ...init,
    credentials: 'include', // куки авторизации
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const message = Array.isArray(data?.message)
      ? data.message.join(', ')
      : (data?.message ?? 'Что-то пошло не так');
    throw new ApiError(message, res.status);
  }
  return data as T;
}

export const api = {
  register: (username: string, password: string) =>
    request<AuthUser>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  login: (username: string, password: string) =>
    request<AuthUser>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  logout: () => request<{ ok: boolean }>('/auth/logout', { method: 'POST' }),

  me: () => request<AuthUser>('/auth/me'),

  state: () => request<PlayerState>('/game/state'),

  leaderboard: () =>
    request<{
      top: LeaderboardRow[];
      myRank: number;
      online: number;
      totalPlayers: number;
    }>('/game/leaderboard'),

  gameConfig: () => request<{ leagues: LeagueInfo[] }>('/game/config'),
};

/**
 * Тестовая админка. Отдельный объект, чтобы не путать с игровым API:
 * эти запросы ходят без авторизации и живут только пока
 * на сервере включён ADMIN_ENABLED.
 */
export const adminApi = {
  users: (q?: string) =>
    request<{ total: number; users: AdminUserRow[] }>(
      `/admin/users${q ? `?q=${encodeURIComponent(q)}` : ''}`,
    ),

  user: (id: string) => request<PlayerState>(`/admin/users/${id}`),

  patch: (id: string, patch: Record<string, number>) =>
    request<PlayerState>(`/admin/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  resetDaily: (id: string) =>
    request<PlayerState>(`/admin/users/${id}/reset-daily`, { method: 'POST' }),

  remove: (id: string) => request<{ ok: boolean }>(`/admin/users/${id}`, { method: 'DELETE' }),
};
