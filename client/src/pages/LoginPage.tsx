import { useState, type FormEvent } from 'react';
import { api } from '../api/client';
import { Logo } from '../components/CoinArt';
import { DEFAULT_LEAGUE, themeVars } from '../lib/league-theme';
import type { AuthUser } from '../types/game';

type Mode = 'login' | 'register';

export function LoginPage({ onAuth }: { onAuth: (user: AuthUser) => void }) {
  const [mode, setMode] = useState<Mode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;

    setBusy(true);
    setError(null);
    try {
      const user =
        mode === 'login'
          ? await api.login(username.trim(), password)
          : await api.register(username.trim(), password);
      onAuth(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка запроса');
    } finally {
      setBusy(false);
    }
  };

  const switchMode = () => {
    setMode((m) => (m === 'login' ? 'register' : 'login'));
    setError(null);
  };

  return (
    <div className="app screen-main" style={themeVars(DEFAULT_LEAGUE, true)}>
      <form className="auth" onSubmit={submit}>
        <div className="auth-logo">
          <Logo size={104} />
        </div>
        <h1>MELLCOIN</h1>
        <p className="auth-sub">
          {mode === 'login' ? 'Вход в аккаунт' : 'Создание нового аккаунта'}
        </p>

        {error && <div className="form-error">{error}</div>}

        <div className="field">
          <label htmlFor="username">Логин</label>
          <input
            id="username"
            value={username}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="например, mell_player"
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="password">Пароль</label>
          <input
            id="password"
            type="password"
            value={password}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            placeholder="минимум 6 символов"
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <button className="btn-blue" type="submit" disabled={busy || !username || !password}>
          {busy ? 'Секунду…' : mode === 'login' ? 'Войти' : 'Зарегистрироваться'}
        </button>

        <div className="auth-switch">
          {mode === 'login' ? 'Нет аккаунта? ' : 'Уже есть аккаунт? '}
          <button type="button" onClick={switchMode}>
            {mode === 'login' ? 'Создать' : 'Войти'}
          </button>
        </div>
      </form>
    </div>
  );
}
