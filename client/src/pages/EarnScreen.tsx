import { EmojiIcon } from '../components/Emoji';
import { Check, ChevronRight } from '../components/Icons';
import { useGame } from '../hooks/GameProvider';
import { formatCompact } from '../lib/format';
import type { PlayerState } from '../types/game';
import { BOOST_TYPES } from '../types/game';

interface Task {
  icon: string;
  title: string;
  goal: string;
  done: boolean;
}

/**
 * Задания считаются из состояния игрока, без отдельной таблицы в БД.
 * Это честный минимум: прогресс настоящий, а не нарисованный.
 * Полноценные задания с наградами появятся вместе с Telegram-интеграцией.
 */
function buildTasks(state: PlayerState): Task[] {
  const multitap = state.boosts[BOOST_TYPES.MULTITAP];
  const energyLimit = state.boosts[BOOST_TYPES.ENERGY_LIMIT];

  return [
    {
      icon: '🐥',
      title: 'Заработать 1,000 монет',
      goal: `${formatCompact(Math.min(state.totalEarned, 1000))} / 1K`,
      done: state.totalEarned >= 1000,
    },
    {
      icon: '👆',
      title: 'Прокачать Multitap до 5 уровня',
      goal: `${multitap?.level ?? 1} / 5 ур.`,
      done: (multitap?.level ?? 1) >= 5,
    },
    {
      icon: '🔋',
      title: 'Поднять лимит энергии до 3 уровня',
      goal: `${energyLimit?.level ?? 1} / 3 ур.`,
      done: (energyLimit?.level ?? 1) >= 3,
    },
    {
      icon: '🏆',
      title: 'Дойти до серебряной лиги',
      goal: `${formatCompact(Math.min(state.totalEarned, 200_000))} / 200K`,
      done: state.league.index >= 1,
    },
    {
      icon: '🚀',
      title: 'Сделать 10,000 тапов',
      goal: `${formatCompact(Math.min(state.taps, 10_000))} / 10K`,
      done: state.taps >= 10_000,
    },
  ];
}

export function EarnScreen() {
  const { state } = useGame();
  if (!state) return null;

  const tasks = buildTasks(state);
  const doneCount = tasks.filter((t) => t.done).length;

  return (
    <div className="scroll">
      <h1 className="page-title">Больше монет</h1>
      <span className="link-blue">Полное руководство</span>

      <h2 className="section-title">Бонус за друзей</h2>
      <div className="group">
        <div className="row done">
          <span className="row-icon">
            <EmojiIcon char="🧸" size={30} />
          </span>
          <span className="row-body">
            <span className="row-title">Приглашай друзей</span>
            <span className="row-sub">
              до <b>100K</b> за каждого
            </span>
          </span>
          <span className="row-right">
            <ChevronRight />
          </span>
        </div>
      </div>

      <h2 className="section-title">
        Задания <span style={{ color: 'var(--muted)', fontWeight: 500 }}>{doneCount}/{tasks.length}</span>
      </h2>
      <div className="group">
        {tasks.map((task) => (
          <div key={task.title} className={`row${task.done ? ' done' : ''}`}>
            <span className="row-icon">
              <EmojiIcon char={task.icon} size={30} />
            </span>
            <span className="row-body">
              <span className="row-title">{task.title}</span>
              <span className="row-sub">{task.done ? 'Выполнено' : task.goal}</span>
            </span>
            <span className="row-right">
              {task.done ? <Check size={18} /> : <span className="tag">в процессе</span>}
            </span>
          </div>
        ))}
      </div>

      <p className="center-note">
        Награды за задания и партнёрские офферы появятся вместе с Telegram-интеграцией
      </p>

      <div className="scroll-pad" />
    </div>
  );
}
