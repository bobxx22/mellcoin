/**
 * Кладёт шрифт Inter локально в client/public/fonts/.
 *
 * Зачем: Notcoin набран Inter. У нас стоял системный стек, поэтому на
 * Windows подставлялся Segoe UI, на Android — Roboto, и набор не совпадал
 * с оригиналом. Тот же Inter используется и на notco.in
 * (koval01/notcoinWeb), только там он лежит одним файлом на вес вместе
 * с греческим и вьетнамским — по ~100 КБ.
 *
 * Здесь берутся сабсеты latin + cyrillic: браузер по unicode-range сам
 * качает только нужный кусок, и на страницу приезжает заметно меньше.
 *
 * Локально, а не ссылкой на Google Fonts: мини-апп должен открываться
 * быстро и без похода на сторонний домен.
 *
 * Запуск: npm run fonts:sync
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'client', 'public', 'fonts');
const OUT_CSS = join(ROOT, 'client', 'src', 'styles', 'fonts.css');

const WEIGHTS = [400, 500, 600, 700, 800];
/*
 * latin-ext намеренно нет: это 83 КБ на вес ради центральноевропейской
 * латиницы, которой в интерфейсе не встречается. Если такой символ всё
 * же попадётся в нике, он отрисуется системным шрифтом.
 */
const KEEP_SUBSETS = ['latin', 'cyrillic', 'cyrillic-ext'];

/** Современный User-Agent — иначе Google отдаёт устаревший ttf вместо woff2 */
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function main() {
  const url = `https://fonts.googleapis.com/css2?family=Inter:wght@${WEIGHTS.join(';')}&display=swap`;
  console.log('· Забираю описание шрифта…');
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`css2: HTTP ${res.status}`);
  const css = await res.text();

  await mkdir(OUT_DIR, { recursive: true });

  // Google отдаёт блоки вида: /* latin */ @font-face { ... }
  const blocks = css.split('/*').filter((b) => b.includes('@font-face'));
  const faces = [];
  let downloaded = 0;

  for (const block of blocks) {
    const subset = block.slice(0, block.indexOf('*/')).trim();
    if (!KEEP_SUBSETS.includes(subset)) continue;

    const weight = block.match(/font-weight:\s*(\d+)/)?.[1];
    const src = block.match(/url\((https:[^)]+\.woff2)\)/)?.[1];
    const range = block.match(/unicode-range:\s*([^;]+);/)?.[1];
    if (!weight || !src || !range) continue;

    const file = `inter-${weight}-${subset}.woff2`;
    const font = await fetch(src, { headers: { 'User-Agent': UA } });
    if (!font.ok) {
      console.warn(`  ! ${file}: HTTP ${font.status}`);
      continue;
    }
    const buf = Buffer.from(await font.arrayBuffer());
    await writeFile(join(OUT_DIR, file), buf);
    downloaded += buf.length;

    faces.push(
      `@font-face {\n` +
        `  font-family: 'Inter';\n` +
        `  font-style: normal;\n` +
        `  font-weight: ${weight};\n` +
        `  font-display: swap;\n` +
        `  src: url('/fonts/${file}') format('woff2');\n` +
        `  unicode-range: ${range.trim()};\n` +
        `}`,
    );
    console.log(`  ${file}  ${Math.round(buf.length / 1024)} КБ`);
  }

  await writeFile(
    OUT_CSS,
    `/* Сгенерировано scripts/sync-fonts.mjs — руками не править.\n` +
      `   Обновить: npm run fonts:sync */\n\n` +
      faces.join('\n\n') +
      '\n',
    'utf8',
  );

  console.log(`· Итого ${faces.length} начертаний, ${Math.round(downloaded / 1024)} КБ`);
  console.log('· Правила записаны в client/src/styles/fonts.css');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
