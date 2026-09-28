import { ART } from '../lib/art';

/**
 * Монета MELLCOIN — исходник coin.jpeg с снятым хромакеем.
 * Обработку делает scripts/prepare_art.py, результат лежит в public/art/.
 *
 * В турбо-режиме монета не перерисовывается, а перекрашивается фильтром:
 * золотой оттенок (~45°) уводится в фиолетовый. Так не нужен второй файл.
 */
export function CoinArt({ turbo = false }: { turbo?: boolean }) {
  return (
    <img
      className={`coin-img${turbo ? ' turbo' : ''}`}
      src={ART.coin}
      alt=""
      draggable={false}
      /* Монета появляется сразу на первом экране — грузим в приоритете */
      fetchPriority="high"
    />
  );
}

/** Мелкая монетка для баланса и цен */
export function CoinIcon({ size = 24 }: { size?: number }) {
  return (
    <img
      className="coin-icon"
      src={ART.coinSmall}
      alt=""
      width={size}
      height={size}
      draggable={false}
    />
  );
}

/** Логотип MELLCOIN — logo.jpeg с убранным белым фоном */
export function Logo({ size = 108 }: { size?: number }) {
  return (
    <img className="logo-img" src={ART.logo} alt="MELLCOIN" width={size} height={size} draggable={false} />
  );
}
