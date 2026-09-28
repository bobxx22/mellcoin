/**
 * Скачивает эмодзи в стиле iPhone (Apple) из репозитория iamcal/emoji-data
 * и раскладывает их в client/public/emoji/.
 *
 * Зачем не рендерить эмодзи символом: системный шрифт на Windows/Android
 * нарисует их в стиле Segoe/Noto, а не так, как на iPhone. Плюс часть новых
 * эмодзи (🪙, например) на старых системах просто не существует и рисуется
 * квадратом — что мы и видели.
 *
 * Как работает:
 *   1. Тянет emoji.json — официальный индекс репозитория. В нём для каждого
 *      эмодзи лежит точное имя файла картинки (угадывать по кодпоинтам нельзя:
 *      у ❤️ файл 2764-fe0f.png, а у ⚡ — 26a1.png, без fe0f).
 *   2. Сканирует client/src на предмет символов эмодзи в коде.
 *   3. Скачивает найденные PNG в client/public/emoji/.
 *   4. Генерирует client/src/lib/emoji-map.generated.ts — карту символ -> файл.
 *
 * Запуск:  npm run emoji:sync
 */

import { mkdir, readFile, readdir, writeFile, access } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = join(ROOT, 'client', 'src');
const OUT_IMAGES = join(ROOT, 'client', 'public', 'emoji');
const OUT_MAP = join(ROOT, 'client', 'src', 'lib', 'emoji-map.generated.ts');

const REPO = 'https://cdn.jsdelivr.net/gh/iamcal/emoji-data@master';
const INDEX_URL = `${REPO}/emoji.json`;
/**
 * 160px, а не 64: молния в интерфейсе занимает 44 CSS-пикселя, и на
 * экранах с плотностью 2x-3x это уже 88-132 реальных точек — 64px мылится.
 */
const IMAGE_DIR = 'img-apple-160';

/**
 * Ищем последовательности эмодзи целиком, вместе с модификаторами:
 * вариационный селектор FE0F, тон кожи, ZWJ-склейки (👨‍💻), кейкапы (1️⃣).
 */
const EMOJI_RE =
  /\p{RI}\p{RI}|\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic}|[\u{1F3FB}-\u{1F3FF}]|[\u{E0020}-\u{E007F}])*|[0-9#*]️⃣/gu;

const toKey = (str) => [...str].map((c) => c.codePointAt(0).toString(16)).join('-');

async function collectSourceFiles(dir) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await collectSourceFiles(full)));
    else if (/\.(tsx?|css)$/.test(entry.name)) found.push(full);
  }
  return found;
}

async function main() {
  console.log('· Скачиваю индекс emoji.json…');
  const res = await fetch(INDEX_URL);
  if (!res.ok) throw new Error(`emoji.json: HTTP ${res.status}`);
  const index = await res.json();

  // Ключ — последовательность кодпоинтов, значение — имя файла картинки.
  // Помимо основного unified кладём и все варианты (skin variations).
  const byCodepoints = new Map();
  for (const item of index) {
    if (item.image) byCodepoints.set(item.unified.toLowerCase(), item.image);
    for (const variant of Object.values(item.skin_variations ?? {})) {
      if (variant.image) byCodepoints.set(variant.unified.toLowerCase(), variant.image);
    }
  }
  console.log(`  в индексе ${byCodepoints.size} вариантов`);

  console.log('· Ищу эмодзи в client/src…');
  const files = await collectSourceFiles(SRC_DIR);
  const used = new Map(); // символ -> имя файла
  const missing = new Set();

  for (const file of files) {
    const text = await readFile(file, 'utf8');
    for (const [match] of text.matchAll(EMOJI_RE)) {
      if (used.has(match)) continue;

      const key = toKey(match);
      // Часть эмодзи в индексе лежит без FE0F, часть — с ним. Пробуем оба.
      const image =
        byCodepoints.get(key) ??
        byCodepoints.get(key.replace(/-?fe0f/g, '')) ??
        byCodepoints.get(`${key}-fe0f`);

      if (image) used.set(match, image);
      else missing.add(`${match} (${key}) в ${relative(ROOT, file)}`);
    }
  }

  console.log(`  найдено ${used.size} уникальных эмодзи`);
  for (const m of missing) console.warn(`  ! нет в индексе: ${m}`);

  await mkdir(OUT_IMAGES, { recursive: true });

  let downloaded = 0;
  let cached = 0;
  for (const image of new Set(used.values())) {
    const target = join(OUT_IMAGES, image);
    try {
      await access(target);
      cached += 1;
      continue;
    } catch {
      /* файла нет — качаем */
    }
    const img = await fetch(`${REPO}/${IMAGE_DIR}/${image}`);
    if (!img.ok) {
      console.warn(`  ! ${image}: HTTP ${img.status}`);
      continue;
    }
    await writeFile(target, Buffer.from(await img.arrayBuffer()));
    downloaded += 1;
  }
  console.log(`· Картинки: скачано ${downloaded}, уже было ${cached}`);

  const entries = [...used.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const body = entries.map(([char, image]) => `  '${char}': '${image}',`).join('\n');

  await writeFile(
    OUT_MAP,
    `/* Сгенерировано scripts/sync-emoji.mjs — руками не править.\n` +
      `   Обновить: npm run emoji:sync */\n\n` +
      `export const EMOJI_IMAGES: Record<string, string> = {\n${body}\n};\n`,
    'utf8',
  );
  console.log(`· Карта записана: ${relative(ROOT, OUT_MAP)} (${entries.length} записей)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
