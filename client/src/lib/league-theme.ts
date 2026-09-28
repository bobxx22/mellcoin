/**
 * Оформление под текущую лигу.
 *
 * Фон собран по той же схеме, что в клонах Notcoin — три слоя:
 *   1. база          linear-gradient(to top, baseBottom, baseTop)  — весь экран
 *   2. чёрный верх   linear-gradient(#000, #000 40%, transparent)  — верхняя половина
 *   3. свечение      radial-gradient(circle, glow, transparent 60%) — по центру экрана
 *
 * Золото — точные значения из клона. Остальные лиги построены по тем же
 * соотношениям светлот: панель чуть светлее базы, разделитель ещё светлее,
 * заливка энергии уходит почти в белый.
 *
 * Раскладка слоёв — в global.css (.app).
 */

export interface LeagueTheme {
  /** Верх базового градиента (светлее) */
  baseTop: string;
  /** Низ базового градиента (насыщеннее) */
  baseBottom: string;
  /** Центральное свечение, с альфой */
  glow: string;
  /** Плашка нижних кнопок */
  panel: string;
  /** Разделители внутри плашки */
  divider: string;
  /** Фон полоски энергии */
  track: string;
  /** Заливка полоски энергии: от -> к */
  fillFrom: string;
  fillTo: string;
}

export const LEAGUE_THEMES: Record<string, LeagueTheme> = {
  Bronze: {
    baseTop: '#e0742a',
    baseBottom: '#b5551c',
    glow: 'rgb(255 160 90 / 75%)',
    panel: '#e8894a',
    divider: '#f0a068',
    track: '#d9702a',
    fillFrom: '#e89a5a',
    fillTo: '#ffe6cf',
  },
  Silver: {
    baseTop: '#b9c8d4',
    baseBottom: '#8e9fad',
    glow: 'rgb(225 238 248 / 75%)',
    panel: '#c3d1dc',
    divider: '#d8e4ec',
    track: '#a8b8c5',
    fillFrom: '#c6d5e0',
    fillTo: '#ffffff',
  },
  // Точные цвета из клона
  Gold: {
    baseTop: '#ffc630',
    baseBottom: '#fba007',
    glow: 'rgb(250 214 92 / 80%)',
    panel: '#fad258',
    divider: '#fddb6d',
    track: '#f9c035',
    fillFrom: '#f3c45a',
    fillTo: '#fffad0',
  },
  Platinum: {
    baseTop: '#cbd6e8',
    baseBottom: '#a3b3cc',
    glow: 'rgb(210 228 255 / 78%)',
    panel: '#d3dcec',
    divider: '#e4ebf7',
    track: '#b8c6da',
    fillFrom: '#d5dfef',
    fillTo: '#ffffff',
  },
  Diamond: {
    baseTop: '#45e6d6',
    baseBottom: '#1eb8aa',
    glow: 'rgb(90 240 220 / 78%)',
    panel: '#5fe3d5',
    divider: '#86eee3',
    track: '#2ecabb',
    fillFrom: '#62e5d8',
    fillTo: '#e8fffb',
  },
};

export const DEFAULT_LEAGUE = 'Bronze';

export function themeFor(league: string): LeagueTheme {
  return LEAGUE_THEMES[league] ?? LEAGUE_THEMES[DEFAULT_LEAGUE];
}

/**
 * CSS-переменные для контейнера приложения.
 *
 * `main` — главный экран. Там свечение крупное и по центру, как в клоне.
 * На разделах оно поднято выше и слабее: под ним лежит контент, а не монета.
 */
export function themeVars(league: string, main: boolean): React.CSSProperties {
  const t = themeFor(league);
  return {
    '--base-top': t.baseTop,
    '--base-bottom': t.baseBottom,
    '--glow': t.glow,
    '--panel': t.panel,
    '--divider': t.divider,
    '--track': t.track,
    '--fill-from': t.fillFrom,
    '--fill-to': t.fillTo,

    '--glow-y': main ? '50%' : '26%',
    '--glow-stop': main ? '60%' : '46%',
  } as React.CSSProperties;
}
