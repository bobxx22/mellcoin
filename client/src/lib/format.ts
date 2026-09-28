/** 1234567 -> "1,234,567" — как в Notcoin */
export function formatNumber(value: number): string {
  return Math.floor(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** Компактный вид для тесных мест: 1.2M, 34.5K */
export function formatCompact(value: number): string {
  const n = Math.floor(value);
  if (n >= 1_000_000_000) return `${trim(n / 1_000_000_000)}B`;
  if (n >= 1_000_000) return `${trim(n / 1_000_000)}M`;
  if (n >= 10_000) return `${trim(n / 1000)}K`;
  return formatNumber(n);
}

function trim(v: number): string {
  return v.toFixed(v < 10 ? 2 : 1).replace(/\.?0+$/, '');
}

/** Порядковое место в рейтинге: 108526 -> "108 526-й" */
export function formatOrdinal(rank: number): string {
  return `${formatNumber(rank)}-й`;
}

/** Русское склонение: plural(3, 'игрок', 'игрока', 'игроков') -> "игрока" */
export function plural(n: number, one: string, few: string, many: string): string {
  const mod100 = Math.abs(n) % 100;
  const mod10 = mod100 % 10;
  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}
