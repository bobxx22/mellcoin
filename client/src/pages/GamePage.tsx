import { useState } from 'react';
import { CoinIcon } from '../components/CoinArt';
import { ArrowLeft } from '../components/Icons';
import { LeagueTrophy } from '../components/LeagueTrophy';
import { Sheet } from '../components/Sheet';
import { Toast } from '../components/Toast';
import { useGame } from '../hooks/GameProvider';
import { formatCompact, formatNumber, formatOrdinal } from '../lib/format';
import { DEFAULT_LEAGUE, themeVars } from '../lib/league-theme';
import { BoostsScreen } from './BoostsScreen';
import { EarnScreen } from './EarnScreen';
import { FrensScreen } from './FrensScreen';
import { LeagueScreen } from './LeagueScreen';
import { MainScreen } from './MainScreen';

export type Screen = 'main' | 'boosts' | 'earn' | 'frens' | 'league';

const TITLES: Record<Exclude<Screen, 'main'>, string> = {
  boosts: 'Бусты',
  earn: 'Задания',
  frens: 'Френы',
  league: 'Лиги',
};

export function GamePage({ onLogout }: { onLogout: () => void }) {
  const [screen, setScreen] = useState<Screen>('main');
  const [accountOpen, setAccountOpen] = useState(false);
  const { state, balance, connected, error, clearError, myRank } = useGame();

  if (!state) {
    return (
      <div className="app screen-main" style={themeVars(DEFAULT_LEAGUE, true)}>
        <div className="center-note" style={{ margin: 'auto' }}>
          {connected ? 'Загружаем игру…' : 'Подключаемся к серверу…'}
        </div>
      </div>
    );
  }

  return (
    // Главная — цветной фон лиги; разделы — чёрный с тёплым низом.
    // Оттенок в обоих случаях берётся от лиги.
    <div
      className={`app ${screen === 'main' ? 'screen-main' : 'screen-sub'}`}
      style={themeVars(state.league.name, screen === 'main')}
    >
      {screen !== 'main' && (
        <header className="subhead">
          <button className="icon-btn" onClick={() => setScreen('main')} aria-label="Назад">
            <ArrowLeft />
          </button>
          <span className="subhead-title">{TITLES[screen]}</span>
        </header>
      )}

      {screen === 'main' && (
        <MainScreen go={setScreen} onOpenAccount={() => setAccountOpen(true)} />
      )}
      {screen === 'boosts' && <BoostsScreen />}
      {screen === 'earn' && <EarnScreen />}
      {screen === 'frens' && <FrensScreen />}
      {screen === 'league' && <LeagueScreen />}

      {/* Аккаунт и выход — по нажатию на карточку игрока сверху */}
      <Sheet open={accountOpen} onClose={() => setAccountOpen(false)}>
        <div className="sheet-art">
          <LeagueTrophy league={state.league.name} size={96} />
        </div>
        <h2>{state.user.displayName}</h2>
        <p>
          Лига {state.league.name}
          {myRank ? ` · ${formatOrdinal(myRank)} в общем рейтинге` : ''}
        </p>

        <div className="sheet-price">
          <CoinIcon size={22} />
          {formatNumber(balance)}
        </div>

        <p style={{ marginBottom: 18 }}>
          Заработано за всё время: {formatCompact(state.totalEarned)} · тапов:{' '}
          {formatCompact(state.taps)} · {state.coinsPerTap} монет за тап ·{' '}
          {state.energyPerSec} энергии/сек
        </p>

        <button
          className="btn-blue"
          style={{ background: 'rgb(255 69 58 / 16%)', color: 'var(--red)' }}
          onClick={onLogout}
        >
          Выйти из аккаунта
        </button>
      </Sheet>

      {error && <Toast message={error} onHide={clearError} />}
    </div>
  );
}
