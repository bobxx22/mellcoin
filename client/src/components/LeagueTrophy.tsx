import { ART } from '../lib/art';

/**
 * Кубок лиги. Исходники bronze/silver/gold пришли готовыми,
 * platinum и diamond перекрашены из серебряного —
 * см. scripts/prepare_art.py.
 */
export function LeagueTrophy({ league, size = 168 }: { league: string; size?: number }) {
  return (
    <img
      className="trophy"
      src={ART.cup(league)}
      alt={league}
      width={size}
      height={size}
      draggable={false}
    />
  );
}

/** Компактный кубок для шапки и строк списка */
export function LeagueBadge({ league, size = 16 }: { league: string; size?: number }) {
  return (
    <img
      className="league-badge"
      src={ART.cup(league)}
      alt=""
      width={size}
      height={size}
      draggable={false}
    />
  );
}
