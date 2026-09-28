import { useState } from 'react';
import { CoinIcon } from '../components/CoinArt';
import { EmojiIcon } from '../components/Emoji';
import { ChevronRight } from '../components/Icons';
import { Sheet } from '../components/Sheet';
import { useGame } from '../hooks/GameProvider';
import { formatCompact, formatNumber } from '../lib/format';
import { BOOST_TYPES, DAILY_TYPES } from '../types/game';

const ICON: Record<string, string> = {
  [BOOST_TYPES.MULTITAP]: '👆',
  [BOOST_TYPES.ENERGY_LIMIT]: '🔋',
  [BOOST_TYPES.RECHARGE]: '⚡',
};

/** Порядок как в макете: сначала мультитап, потом скорость, потом лимит */
const ORDER = [BOOST_TYPES.MULTITAP, BOOST_TYPES.RECHARGE, BOOST_TYPES.ENERGY_LIMIT];

type Modal = { kind: 'boost'; type: string } | { kind: 'daily'; type: string } | null;

export function BoostsScreen() {
  const { state, balance, buyBoost, useDaily, turboActive } = useGame();
  const [modal, setModal] = useState<Modal>(null);

  if (!state) return null;

  const fullEnergy = state.daily[DAILY_TYPES.FULL_ENERGY];
  const turbo = state.daily[DAILY_TYPES.TURBO];

  const close = () => setModal(null);

  return (
    <>
      <div className="scroll">
        <p className="balance-label">Ваш баланс</p>
        <div className="balance-row" style={{ marginTop: 6 }}>
          <CoinIcon size={34} />
          <span style={{ fontSize: 36 }}>{formatNumber(balance)}</span>
        </div>
        <span className="link-blue">Как работают бусты</span>

        <h2 className="section-title">Бесплатно каждый день</h2>
        <div className="duo">
          <button
            className="duo-card"
            disabled={turbo.left <= 0 || turboActive}
            onClick={() => setModal({ kind: 'daily', type: DAILY_TYPES.TURBO })}
          >
            <span>
              <span className="duo-title">Турбо</span>
              <span className="duo-sub">
                {turbo.left}/{turbo.limit} доступно
              </span>
            </span>
            <EmojiIcon char="🚀" size={30} />
          </button>

          <button
            className="duo-card"
            disabled={fullEnergy.left <= 0}
            onClick={() => setModal({ kind: 'daily', type: DAILY_TYPES.FULL_ENERGY })}
          >
            <span>
              <span className="duo-title">Полная энергия</span>
              <span className="duo-sub">
                {fullEnergy.left}/{fullEnergy.limit} доступно
              </span>
            </span>
            <EmojiIcon char="⚡" size={30} />
          </button>
        </div>

        <h2 className="section-title">Бусты</h2>
        <div className="group">
          {/* Автотапалка пока не реализована — показываем выключенной */}
          <div className="row done">
            <span className="row-icon">
              <EmojiIcon char="🤖" size={30} />
            </span>
            <span className="row-body">
              <span className="row-title">
                Авто-тапалка <span className="tag">выкл</span>
              </span>
              <span className="row-sub">Тапает, пока вы спите</span>
            </span>
            <span className="row-right">
              <span className="price cant">
                <CoinIcon size={15} />
                20,000
              </span>
            </span>
          </div>

          {ORDER.map((type) => {
            const boost = state.boosts[type];
            if (!boost) return null;
            const maxed = boost.cost === null;
            const affordable = !maxed && balance >= (boost.cost ?? 0);

            return (
              <button
                key={type}
                className="row"
                disabled={maxed}
                onClick={() => setModal({ kind: 'boost', type })}
              >
                <span className="row-icon">
                  <EmojiIcon char={ICON[type] ?? '⭐'} size={30} />
                </span>
                <span className="row-body">
                  <span className="row-title">{boost.title}</span>
                  <span className="row-sub">
                    {maxed ? (
                      <b>Максимум</b>
                    ) : (
                      <>
                        <CoinIcon size={14} />
                        <b>{formatCompact(boost.cost ?? 0)}</b>
                        <span className="lvl">• {boost.level} ур.</span>
                      </>
                    )}
                  </span>
                </span>
                <span className="row-right">
                  {!maxed && !affordable && <span className="tag">не хватает</span>}
                  <ChevronRight />
                </span>
              </button>
            );
          })}
        </div>

        <div className="scroll-pad" />
      </div>

      {/* ── Модалка покупки уровневого буста ── */}
      <Sheet open={modal?.kind === 'boost'} onClose={close}>
        {modal?.kind === 'boost' &&
          (() => {
            const boost = state.boosts[modal.type];
            const cost = boost.cost ?? 0;
            const affordable = balance >= cost;
            return (
              <>
                <div className="sheet-art">
                  <EmojiIcon char={ICON[modal.type] ?? '⭐'} size={72} />
                </div>
                <h2>{boost.title}</h2>
                <p>
                  {boost.description}. Сейчас {boost.value} {boost.unit}, станет {boost.nextValue}.
                </p>
                <div className="sheet-price">
                  <CoinIcon size={22} />
                  {formatNumber(cost)}
                  <span style={{ color: 'var(--muted)', fontWeight: 500 }}>
                    • {boost.level + 1} ур.
                  </span>
                </div>
                <button
                  className="btn-blue"
                  disabled={!affordable}
                  onClick={() => {
                    buyBoost(modal.type);
                    close();
                  }}
                >
                  {affordable ? 'Купить' : 'Недостаточно монет'}
                </button>
              </>
            );
          })()}
      </Sheet>

      {/* ── Модалка дневного бустера ── */}
      <Sheet open={modal?.kind === 'daily'} onClose={close}>
        {modal?.kind === 'daily' &&
          (() => {
            const isTurbo = modal.type === DAILY_TYPES.TURBO;
            const info = state.daily[modal.type];
            return (
              <>
                <div className="sheet-art">
                  <EmojiIcon char={isTurbo ? '🚀' : '⚡'} size={72} />
                </div>
                <h2>{isTurbo ? `Турбо ×${state.turboMultiplier}` : 'Полная энергия'}</h2>
                <p>
                  {isTurbo
                    ? 'Двадцать секунд тапов без затрат энергии и с множителем. Держитесь за ракету!'
                    : 'Мгновенно восполняет весь запас энергии. Можно тапать дальше.'}
                </p>
                <div className="sheet-price">
                  <CoinIcon size={22} />
                  Бесплатно
                  <span style={{ color: 'var(--muted)', fontWeight: 500 }}>
                    • осталось {info.left}
                  </span>
                </div>
                <button
                  className="btn-blue"
                  disabled={info.left <= 0}
                  onClick={() => {
                    useDaily(modal.type);
                    close();
                  }}
                >
                  Получить
                </button>
              </>
            );
          })()}
      </Sheet>
    </>
  );
}
