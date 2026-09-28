import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '../api/client';
import { formatNumber } from '../lib/format';
import type { AdminUserRow, PlayerState } from '../types/game';

/**
 * Тестовая админка. Открывается по /admin, авторизации нет.
 * Живёт, только пока на сервере стоит ADMIN_ENABLED=true.
 *
 * Дизайн намеренно минимальный — это инструмент для отладки,
 * а не часть игры.
 */

/** Поля, которые можно править. Порядок = порядок в форме. */
const FIELDS = [
  { key: 'balance', label: 'Баланс' },
  { key: 'totalEarned', label: 'Заработано всего' },
  { key: 'taps', label: 'Тапов' },
  { key: 'energy', label: 'Энергия' },
  { key: 'multitapLevel', label: 'Multitap, ур.' },
  { key: 'energyLimitLevel', label: 'Energy Limit, ур.' },
  { key: 'rechargeLevel', label: 'Recharge, ур.' },
  { key: 'fullEnergyUsed', label: 'Полн. энергия исп.' },
  { key: 'turboUsed', label: 'Турбо исп.' },
] as const;

type FormValues = Record<string, string>;

function formFromState(state: PlayerState): FormValues {
  return {
    balance: String(state.balance),
    totalEarned: String(state.totalEarned),
    taps: String(state.taps),
    energy: String(state.energy),
    multitapLevel: String(state.boosts.multitap?.level ?? 1),
    energyLimitLevel: String(state.boosts.energy_limit?.level ?? 1),
    rechargeLevel: String(state.boosts.recharge?.level ?? 1),
    fullEnergyUsed: String(state.daily.full_energy.limit - state.daily.full_energy.left),
    turboUsed: String(state.daily.turbo.limit - state.daily.turbo.left),
  };
}

export function AdminPage() {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [state, setState] = useState<PlayerState | null>(null);
  const [form, setForm] = useState<FormValues>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);

  const loadUsers = useCallback(async (q: string) => {
    try {
      const res = await adminApi.users(q || undefined);
      setUsers(res.users);
      setTotal(res.total);
      setAvailable(true);
    } catch (err) {
      // 404 означает, что модуль админки не подключён на сервере
      setAvailable(false);
      setMsg({ kind: 'err', text: (err as Error).message });
    }
  }, []);

  useEffect(() => {
    void loadUsers('');
  }, [loadUsers]);

  const select = async (id: string) => {
    setSelectedId(id);
    setMsg(null);
    try {
      const s = await adminApi.user(id);
      setState(s);
      setForm(formFromState(s));
    } catch (err) {
      setMsg({ kind: 'err', text: (err as Error).message });
    }
  };

  const apply = async () => {
    if (!selectedId) return;
    setBusy(true);
    setMsg(null);
    try {
      // Шлём только числа — пустые поля пропускаем
      const patch: Record<string, number> = {};
      for (const { key } of FIELDS) {
        const raw = form[key];
        if (raw === '' || raw === undefined) continue;
        const num = Number(raw);
        if (Number.isFinite(num)) patch[key] = Math.floor(num);
      }
      const next = await adminApi.patch(selectedId, patch);
      setState(next);
      setForm(formFromState(next));
      setMsg({ kind: 'ok', text: 'Сохранено. Открытые вкладки игрока обновятся сразу.' });
      void loadUsers(query);
    } catch (err) {
      setMsg({ kind: 'err', text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const resetDaily = async () => {
    if (!selectedId) return;
    setBusy(true);
    try {
      const next = await adminApi.resetDaily(selectedId);
      setState(next);
      setForm(formFromState(next));
      setMsg({ kind: 'ok', text: 'Дневные лимиты сброшены' });
    } catch (err) {
      setMsg({ kind: 'err', text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!selectedId || !state) return;
    if (!confirm(`Удалить игрока ${state.user.displayName}? Это необратимо.`)) return;
    setBusy(true);
    try {
      await adminApi.remove(selectedId);
      setSelectedId(null);
      setState(null);
      setMsg({ kind: 'ok', text: 'Игрок удалён' });
      void loadUsers(query);
    } catch (err) {
      setMsg({ kind: 'err', text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  if (available === false) {
    return (
      <div className="admin">
        <h1>Админка недоступна</h1>
        <div className="warn">
          Модуль не подключён. Поставьте <b>ADMIN_ENABLED=true</b> в server/.env
          (или в docker-compose.yml у сервиса server) и перезапустите сервер.
        </div>
      </div>
    );
  }

  return (
    <div className="admin">
      <h1>MELLCOIN — тестовая админка</h1>
      <div className="warn">
        Без авторизации. Только для разработки — на боевом сервере
        ADMIN_ENABLED должен быть выключен.
      </div>

      <form
        className="admin-bar"
        onSubmit={(e) => {
          e.preventDefault();
          void loadUsers(query);
        }}
      >
        <input
          value={query}
          placeholder="поиск по логину"
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="submit">Найти</button>
        <button
          type="button"
          onClick={() => {
            setQuery('');
            void loadUsers('');
          }}
        >
          Сброс
        </button>
      </form>

      <div className="admin-layout">
        <div className="admin-list">
          {users.length === 0 && <div style={{ padding: 12, color: '#8e8e93' }}>Пусто</div>}
          {users.map((u) => (
            <button
              key={u.id}
              className={`admin-user${u.id === selectedId ? ' on' : ''}`}
              onClick={() => void select(u.id)}
            >
              {u.displayName}
              <small>
                {formatNumber(u.balance)} монет · всего {formatNumber(u.totalEarned)}
              </small>
            </button>
          ))}
          <div style={{ padding: '8px 11px', color: '#636368' }}>
            показано {users.length} из {total}
          </div>
        </div>

        <div className="admin-panel">
          {!state ? (
            <div style={{ color: '#8e8e93' }}>Выберите игрока слева</div>
          ) : (
            <>
              <div style={{ marginBottom: 4 }}>
                <b>{state.user.displayName}</b>{' '}
                <span style={{ color: '#636368' }}>{state.user.id}</span>
              </div>

              <div className="admin-grid">
                {FIELDS.map(({ key, label }) => (
                  <div className="admin-field" key={key}>
                    <label htmlFor={`f-${key}`}>{label}</label>
                    <input
                      id={`f-${key}`}
                      type="number"
                      value={form[key] ?? ''}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>

              <div className="admin-actions">
                <button className="primary" disabled={busy} onClick={() => void apply()}>
                  {busy ? '…' : 'Сохранить'}
                </button>
                <button disabled={busy} onClick={() => void resetDaily()}>
                  Сбросить дневные лимиты
                </button>
                <button disabled={busy} onClick={() => void select(state.user.id)}>
                  Перечитать
                </button>
                <button
                  disabled={busy}
                  onClick={() =>
                    setForm((f) => ({ ...f, balance: '1000000', totalEarned: '1000000' }))
                  }
                >
                  +1M в поля
                </button>
                <button className="danger" disabled={busy} onClick={() => void remove()}>
                  Удалить игрока
                </button>
              </div>

              {msg && <div className={`admin-msg ${msg.kind}`}>{msg.text}</div>}

              <div className="admin-readonly">
                Лига: <b>{state.league.name}</b>
                {state.nextLeague ? ` (следующая ${state.nextLeague.name} от ${formatNumber(state.nextLeague.minScore)})` : ' — максимальная'}
                <br />
                Энергия: <b>{formatNumber(state.energy)}</b> / {formatNumber(state.maxEnergy)} ·
                восстановление {state.energyPerSec}/сек
                <br />
                За тап: <b>{state.coinsPerTap}</b> монет · турбо ×{state.turboMultiplier}
                <br />
                Дневные: полная энергия {state.daily.full_energy.left}/
                {state.daily.full_energy.limit}, турбо {state.daily.turbo.left}/
                {state.daily.turbo.limit}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
