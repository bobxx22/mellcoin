import { useEffect, useState } from 'react';
import { CoinIcon } from '../components/CoinArt';
import { EmojiIcon } from '../components/Emoji';
import { ChevronLeft, ChevronRight } from '../components/Icons';
import { LeagueTrophy } from '../components/LeagueTrophy';
import { useGame } from '../hooks/GameProvider';
import { formatCompact, formatNumber, plural } from '../lib/format';

const MEDALS = ['🥇', '🥈', '🥉'];

/** Цвет аватарки выводим из имени — стабильно и без хранения в БД */
function avatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return `hsl(${hash % 360} 58% 45%)`;
}

export function LeagueScreen() {
  const { state, leaderboard, leagues, totalPlayers } = useGame();
  const [tab, setTab] = useState<'miners' | 'squads'>('miners');
  const [viewIndex, setViewIndex] = useState(0);

  const myLeagueIndex = state?.league.index ?? 0;

  // Открываем экран сразу на своей лиге
  useEffect(() => setViewIndex(myLeagueIndex), [myLeagueIndex]);

  if (!state || leagues.length === 0) return null;

  const league = leagues[Math.min(viewIndex, leagues.length - 1)];
  const next = leagues[league.index + 1] ?? null;
  const isMine = league.index === myLeagueIndex;

  // Прогресс показываем только для своей лиги — в чужих его считать не от чего
  const progress = next
    ? Math.min(100, ((state.totalEarned - league.minScore) / (next.minScore - league.minScore)) * 100)
    : 100;

  // В списке — только игроки той лиги, которую сейчас смотрим
  const rows = leaderboard.filter((r) => r.league === league.name);

  return (
    <div className="scroll">
      <div className="notcoiners">
        <EmojiIcon char="🧑" size={16} />
        <CoinIcon size={15} />
        {formatNumber(totalPlayers)} {plural(totalPlayers, 'игрок', 'игрока', 'игроков')}
        <span className="stats">·</span>
        <span className="stats">Статистика</span>
      </div>

      <div className="league-stage">
        <button
          className="league-arrow"
          disabled={league.index === 0}
          onClick={() => setViewIndex((i) => Math.max(0, i - 1))}
          aria-label="Предыдущая лига"
        >
          <ChevronLeft size={22} />
        </button>

        <div className="league-center">
          <LeagueTrophy league={league.name} size={168} />
          <div className="league-name">{league.name}</div>

          {isMine ? (
            <>
              <div className="league-progress-label">
                {formatNumber(state.totalEarned)} / {next ? formatCompact(next.minScore) : '∞'}
              </div>
              <div className="league-track">
                <div className="league-fill" style={{ width: `${progress}%` }} />
              </div>
            </>
          ) : (
            <div className="league-progress-label">
              {league.minScore === 0
                ? 'стартовая лига'
                : `от ${formatCompact(league.minScore)} монет за всё время`}
            </div>
          )}
        </div>

        <button
          className="league-arrow"
          disabled={league.index >= leagues.length - 1}
          onClick={() => setViewIndex((i) => Math.min(leagues.length - 1, i + 1))}
          aria-label="Следующая лига"
        >
          <ChevronRight size={22} />
        </button>
      </div>

      <div className="segmented">
        <button className={tab === 'miners' ? 'on' : ''} onClick={() => setTab('miners')}>
          Игроки
        </button>
        <button className={tab === 'squads' ? 'on' : ''} onClick={() => setTab('squads')}>
          Сквады
        </button>
      </div>

      {tab === 'squads' ? (
        <p className="center-note">Сквады появятся вместе с Telegram-интеграцией</p>
      ) : rows.length === 0 ? (
        <p className="center-note">
          В лиге {league.name} пока никого нет
          {isMine ? '' : ' из тех, кто попал в топ-100'}
        </p>
      ) : (
        <div style={{ marginTop: 12 }}>
          {rows.map((row, i) => (
            <div key={row.id} className={`lb-row${row.id === state.user.id ? ' me' : ''}`}>
              <span className="lb-medal">
                {i < 3 ? <EmojiIcon char={MEDALS[i]} size={20} /> : row.rank}
              </span>
              <span
                className="avatar-circle"
                style={{ background: avatarColor(row.id) }}
                aria-hidden="true"
              >
                {row.displayName.slice(0, 2).toUpperCase()}
              </span>
              <span className="lb-name">{row.displayName}</span>
              <span className="lb-amount">
                <CoinIcon size={15} />
                {formatCompact(row.balance)}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="scroll-pad" />
    </div>
  );
}
