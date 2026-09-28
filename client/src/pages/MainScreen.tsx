import { useCallback, useRef, useState } from 'react';
import { CoinArt, CoinIcon } from '../components/CoinArt';
import { EmojiIcon } from '../components/Emoji';
import { ChevronRight, Laurel } from '../components/Icons';
import { useGame } from '../hooks/GameProvider';
import { useCoinPress } from '../hooks/useCoinPress';
import { formatNumber, formatOrdinal } from '../lib/format';
import type { Screen } from './GamePage';

interface FloatItem {
  id: number;
  x: number;
  y: number;
  value: number;
}

const FLOAT_LIFETIME_MS = 850;
const MAX_FLOATS = 14;

/**
 * Главный экран. Раскладка повторяет клоны Notcoin: тёмная плашка сверху,
 * баланс, строка лиги, монета по центру оставшегося места, снизу энергия
 * и светлая плашка разделов.
 *
 * Своё, чего в клонах нет: живое зажатие монеты (useCoinPress)
 * и место в общем рейтинге в строке лиги.
 */
export function MainScreen({
  go,
  onOpenAccount,
}: {
  go: (screen: Screen) => void;
  onOpenAccount: () => void;
}) {
  const { state, balance, energy, turboActive, tap, myRank } = useGame();
  const [floats, setFloats] = useState<FloatItem[]>([]);
  const idRef = useRef(0);

  /** Сам тап: начисление, всплывающее "+N", вибрация. Наклон — в useCoinPress. */
  const handlePress = useCallback(
    ({ clientX, clientY }: { clientX: number; clientY: number }) => {
      const gained = tap();
      if (gained <= 0) return;

      const id = idRef.current++;
      setFloats((prev) => [
        ...prev.slice(-(MAX_FLOATS - 1)),
        { id, x: clientX, y: clientY, value: gained },
      ]);
      window.setTimeout(() => setFloats((prev) => prev.filter((f) => f.id !== id)), FLOAT_LIFETIME_MS);

      if (navigator.vibrate) navigator.vibrate(6);
    },
    [tap],
  );

  const { ref: coinRef, handlers: coinHandlers } = useCoinPress({ onPress: handlePress });

  if (!state) return null;

  const energyPercent = Math.min(100, (energy / state.maxEnergy) * 100);
  const notEnoughEnergy = !turboActive && energy < state.coinsPerTap;
  const turboSecondsLeft =
    state.turboUntil != null ? Math.max(0, Math.ceil((state.turboUntil - Date.now()) / 1000)) : 0;

  return (
    <>
      <div className="top-block">
        {/* На месте «Join squad» — сам игрок; тап открывает карточку аккаунта */}
        <button className="player-pill" onClick={onOpenAccount}>
          <span className="name">{state.user.displayName}</span>
          <ChevronRight size={18} />
        </button>

        <div className="balance-row">
          <CoinIcon size={44} />
          <span>{formatNumber(balance)}</span>
        </div>

        <div className="league-row">
          {/* Место в топе — этого в клонах нет, оставляем своё */}
          <span className="rank">
            <Laurel />
            {myRank ? formatOrdinal(myRank) : '—'}
            <Laurel flip />
          </span>
          <span className="sep">•</span>
          <span className="link" onClick={() => go('league')}>
            <EmojiIcon char="🏆" size={24} />
            {state.league.name}
            <ChevronRight size={18} className="chev" />
          </span>
        </div>
      </div>

      <div className="coin-area">
        <div ref={coinRef} className={`coin${notEnoughEnergy ? ' empty' : ''}`} {...coinHandlers}>
          <CoinArt turbo={turboActive} />
          {/* Блик едет за пальцем: координаты приходят из useCoinPress */}
          <span className="coin-press" aria-hidden="true" />
        </div>
      </div>

      {floats.map((f) => (
        <span key={f.id} className="float" style={{ left: f.x, top: f.y }}>
          +{f.value}
        </span>
      ))}

      <div className="main-bottom">
        {turboActive && (
          <div className="turbo-strip">
            ТУРБО ×{state.turboMultiplier} — {turboSecondsLeft} с
          </div>
        )}

        <div className="bottom-row">
          <div className="energy-readout">
            <EmojiIcon char="⚡" size={44} />
            <span>
              <span className="value">{formatNumber(energy)}</span>
              <span className="max">/ {formatNumber(state.maxEnergy)}</span>
            </span>
          </div>

          <nav className="quick-nav">
            <button className="quick-btn" onClick={() => go('frens')}>
              <EmojiIcon char="🧸" size={24} />
              Френы
            </button>
            <i className="quick-divider" />
            <button className="quick-btn" onClick={() => go('earn')}>
              {/* Эмодзи-монетка у Apple серебристая — ставим свою, золотую */}
              <CoinIcon size={24} />
              Задания
            </button>
            <i className="quick-divider" />
            <button className="quick-btn" onClick={() => go('boosts')}>
              <EmojiIcon char="🚀" size={24} />
              Бусты
            </button>
          </nav>
        </div>

        <div className="energy-track">
          <div className="energy-fill" style={{ width: `${energyPercent}%` }} />
        </div>
      </div>
    </>
  );
}
