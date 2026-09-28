import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { io, type Socket } from 'socket.io-client';
import { API_URL, api } from '../api/client';
import type { LeagueInfo, LeaderboardRow, PlayerState, TapAck } from '../types/game';

/** Как часто накопленные тапы уходят на сервер */
const TAP_FLUSH_MS = 250;
/** Как часто локально пересчитывается энергия для плавной полоски */
const ENERGY_TICK_MS = 100;

interface GameContextValue {
  connected: boolean;
  state: PlayerState | null;
  /** Оптимистичные значения — их и показываем в интерфейсе */
  balance: number;
  energy: number;
  leaderboard: LeaderboardRow[];
  /** Своё место в общем рейтинге (null, пока не посчитано) */
  myRank: number | null;
  /** Всего зарегистрировано игроков */
  totalPlayers: number;
  /** Справочник лиг с сервера */
  leagues: LeagueInfo[];
  error: string | null;
  turboActive: boolean;
  /** Возвращает, сколько монет начислено за тап (0 — если не хватило энергии) */
  tap: () => number;
  buyBoost: (type: string) => void;
  useDaily: (type: string) => void;
  clearError: () => void;
  onUnauthorized: () => void;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({
  children,
  onUnauthorized,
}: {
  children: ReactNode;
  onUnauthorized: () => void;
}) {
  const [connected, setConnected] = useState(false);
  const [state, setState] = useState<PlayerState | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [leagues, setLeagues] = useState<LeagueInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [renderTick, forceRender] = useState(0);

  const socketRef = useRef<Socket | null>(null);
  /** Локальные (оптимистичные) значения */
  const localRef = useRef({ balance: 0, energy: 0 });
  /** Тапы, накопленные с момента последней отправки */
  const queuedRef = useRef(0);
  const stateRef = useRef<PlayerState | null>(null);
  const unauthorizedRef = useRef(onUnauthorized);

  unauthorizedRef.current = onUnauthorized;
  stateRef.current = state;

  const applyState = useCallback((next: PlayerState) => {
    setState(next);
    stateRef.current = next;
    const perTap = next.coinsPerTap;
    const turbo = next.turboUntil !== null && next.turboUntil > Date.now();
    const queued = queuedRef.current;
    // Учитываем тапы, которые сервер ещё не видел
    localRef.current.balance =
      next.balance + queued * perTap * (turbo ? next.turboMultiplier : 1);
    localRef.current.energy = Math.max(0, next.energy - (turbo ? 0 : queued * perTap));
  }, []);

  // ── Соединение ──────────────────────────────────────────────────────
  useEffect(() => {
    const socket = io(API_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnectionDelay: 500,
      reconnectionDelayMax: 4000,
    });
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socket.on('state', (next: PlayerState) => applyState(next));

    socket.on('tap:ack', (ack: TapAck) => {
      const current = stateRef.current;
      if (!current) return;
      const perTap = current.coinsPerTap;
      const queued = queuedRef.current;
      const turbo = ack.turbo;
      localRef.current.balance =
        ack.balance + queued * perTap * (turbo ? current.turboMultiplier : 1);
      localRef.current.energy = Math.max(0, ack.energy - (turbo ? 0 : queued * perTap));
      setState({
        ...current,
        balance: ack.balance,
        energy: ack.energy,
        totalEarned: ack.totalEarned,
        league: ack.league,
        nextLeague: ack.nextLeague,
      });
    });

    socket.on('leaderboard', (rows: LeaderboardRow[]) => {
      setLeaderboard(rows);
      const mine = rows.find((r) => r.id === stateRef.current?.user.id);
      if (mine) setMyRank(mine.rank);
    });

    socket.on('action:error', (payload: { message?: string }) => {
      setError(payload?.message ?? 'Действие не выполнено');
    });

    socket.on('unauthorized', () => {
      socket.disconnect();
      unauthorizedRef.current();
    });

    socket.on('connect_error', () => setConnected(false));

    const onVisible = () => {
      if (document.visibilityState === 'visible') socket.emit('sync');
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [applyState]);

  // ── Справочник лиг: статичен, тянем один раз ────────────────────────
  useEffect(() => {
    api
      .gameConfig()
      .then((cfg) => setLeagues(cfg.leagues))
      .catch(() => setLeagues([]));
  }, []);

  // ── Своё место и общее число игроков ────────────────────────────────
  // Лидерборд по сокету приходит всем один и тот же, персонального места
  // в нём нет. Если мы попали в топ — берём место оттуда, иначе спрашиваем
  // сервер отдельно и обновляем нечасто.
  useEffect(() => {
    let cancelled = false;

    const refresh = () => {
      api
        .leaderboard()
        .then((res) => {
          if (cancelled) return;
          setMyRank(res.myRank);
          setTotalPlayers(res.totalPlayers);
        })
        .catch(() => undefined);
    };

    refresh();
    const timer = setInterval(refresh, 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  // ── Отправка накопленных тапов ──────────────────────────────────────
  useEffect(() => {
    const timer = setInterval(() => {
      const count = queuedRef.current;
      if (count <= 0) return;
      queuedRef.current = 0;
      socketRef.current?.emit('tap', { count });
    }, TAP_FLUSH_MS);
    return () => clearInterval(timer);
  }, []);

  // ── Локальное восстановление энергии (сервер всё равно пересчитает) ──
  useEffect(() => {
    const timer = setInterval(() => {
      const current = stateRef.current;
      if (!current) return;
      const local = localRef.current;
      const refilling = local.energy < current.maxEnergy;
      if (refilling) {
        local.energy = Math.min(
          current.maxEnergy,
          local.energy + (current.energyPerSec * ENERGY_TICK_MS) / 1000,
        );
      }
      // Пока идёт турбо (и секунду после) держим перерисовку,
      // иначе таймер турбо застынет на экране
      const turboPending =
        current.turboUntil != null && current.turboUntil + 1000 > Date.now();
      if (refilling || turboPending) forceRender((n) => n + 1);
    }, ENERGY_TICK_MS);
    return () => clearInterval(timer);
  }, []);

  // ── Действия ────────────────────────────────────────────────────────
  const tap = useCallback((): number => {
    const current = stateRef.current;
    if (!current) return 0;

    const turbo = current.turboUntil !== null && current.turboUntil > Date.now();
    const perTap = current.coinsPerTap;
    const local = localRef.current;

    if (!turbo && local.energy < perTap) return 0;

    const gained = perTap * (turbo ? current.turboMultiplier : 1);
    local.balance += gained;
    if (!turbo) local.energy -= perTap;
    queuedRef.current += 1;
    forceRender((n) => n + 1);
    return gained;
  }, []);

  const buyBoost = useCallback((type: string) => {
    socketRef.current?.emit('boost:buy', { type });
  }, []);

  const useDaily = useCallback((type: string) => {
    socketRef.current?.emit('boost:daily', { type });
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const turboActive = state?.turboUntil != null && state.turboUntil > Date.now();

  const value = useMemo<GameContextValue>(
    () => ({
      connected,
      state,
      balance: Math.floor(localRef.current.balance),
      energy: Math.floor(localRef.current.energy),
      leaderboard,
      myRank,
      totalPlayers,
      leagues,
      error,
      turboActive,
      tap,
      buyBoost,
      useDaily,
      clearError,
      onUnauthorized,
    }),
    // localRef меняется в обход React: renderTick — сигнал, что оптимистичные
    // значения обновились и value надо пересобрать
    [
      renderTick,
      connected,
      state,
      leaderboard,
      myRank,
      totalPlayers,
      leagues,
      error,
      turboActive,
      tap,
      buyBoost,
      useDaily,
      clearError,
      onUnauthorized,
    ],
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame должен использоваться внутри GameProvider');
  return ctx;
}
