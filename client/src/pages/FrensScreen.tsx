import { CoinIcon } from '../components/CoinArt';
import { EmojiIcon } from '../components/Emoji';
import { ChevronRight } from '../components/Icons';
import { useGame } from '../hooks/GameProvider';

/**
 * Экран друзей. Рефералки в базе пока нет — она завязана на Telegram
 * (инвайт-ссылка бота, initData). Поэтому здесь свёрстан макет
 * и честно показано пустое состояние вместо выдуманных данных.
 */
export function FrensScreen() {
  const { state } = useGame();
  if (!state) return null;

  return (
    <>
      <div className="scroll">
        <h1 className="page-title">0 френов</h1>

        <div className="notcoiners" style={{ background: 'rgb(28 28 30 / 90%)' }}>
          <CoinIcon size={15} />
          +5K
          <span className="stats">|</span>
          <EmojiIcon char="📣" size={15} />
          Топ-300 лидеров
          <ChevronRight size={13} className="chev" />
        </div>

        <h2 className="section-title accent">Приглашай друзей и получай бонусы</h2>
        <div className="group">
          <div className="row">
            <span className="row-icon">
              <CoinIcon size={30} />
            </span>
            <span className="row-body">
              <span className="row-title">Пригласить друга</span>
              <span className="row-sub">
                <CoinIcon size={14} />
                <b>2,500</b> вам и другу
              </span>
            </span>
          </div>
          <div className="row">
            <span className="row-icon">
              <EmojiIcon char="⭐" size={30} />
            </span>
            <span className="row-body">
              <span className="row-title">Друг с Telegram Premium</span>
              <span className="row-sub">
                <CoinIcon size={14} />
                <b>50,000</b> вам и другу
              </span>
            </span>
          </div>
        </div>

        <h2 className="section-title">Список френов</h2>
        <p className="center-note">
          Пока пусто. Приглашения работают через Telegram — появятся,
          когда подключим Mini App.
        </p>

        <div className="scroll-pad" />
      </div>

      <div className="sticky-bottom">
        <button className="btn-orange" disabled style={{ opacity: 0.5 }}>
          Пригласить друга
        </button>
      </div>
    </>
  );
}
