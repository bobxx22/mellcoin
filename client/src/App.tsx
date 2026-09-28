import { useCallback, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { api } from './api/client';
import { GameProvider } from './hooks/GameProvider';
import { DEFAULT_LEAGUE, themeVars } from './lib/league-theme';
import { AdminPage } from './pages/AdminPage';
import { GamePage } from './pages/GamePage';
import { LoginPage } from './pages/LoginPage';
import type { AuthUser } from './types/game';

export default function App() {
  // undefined — ещё проверяем куку, null — не авторизован
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined);
  const navigate = useNavigate();

  useEffect(() => {
    api
      .me()
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  const handleAuth = useCallback(
    (next: AuthUser) => {
      setUser(next);
      navigate('/', { replace: true });
    },
    [navigate],
  );

  const handleLogout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      setUser(null);
      navigate('/login', { replace: true });
    }
  }, [navigate]);

  const handleUnauthorized = useCallback(() => {
    setUser(null);
    navigate('/login', { replace: true });
  }, [navigate]);

  // Админка живёт вне авторизации — её проверяем до загрузки профиля
  if (window.location.pathname === '/admin') return <AdminPage />;

  if (user === undefined) {
    return (
      <div className="app screen-main" style={themeVars(DEFAULT_LEAGUE, true)}>
        <div className="center-note" style={{ margin: 'auto' }}>
          Загрузка…
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <LoginPage onAuth={handleAuth} />}
      />
      <Route
        path="/"
        element={
          user ? (
            <GameProvider onUnauthorized={handleUnauthorized}>
              <GamePage onLogout={handleLogout} />
            </GameProvider>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="*" element={<Navigate to={user ? '/' : '/login'} replace />} />
    </Routes>
  );
}
