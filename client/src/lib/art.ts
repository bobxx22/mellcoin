/** Пути к игровой графике. Файлы готовит scripts/prepare_art.py */

const BASE = import.meta.env.BASE_URL;

export const ART = {
  coin: `${BASE}art/coin.png`,
  coinSmall: `${BASE}art/coin-small.png`,
  logo: `${BASE}art/logo.png`,
  cup: (league: string) => `${BASE}art/cup-${league.toLowerCase()}.png`,
};
