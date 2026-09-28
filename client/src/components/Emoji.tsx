import { Children, cloneElement, isValidElement, type ReactNode } from 'react';
import { EMOJI_IMAGES } from '../lib/emoji-map.generated';

/**
 * Декоратор эмодзи.
 *
 * Оборачиваете текст — все эмодзи внутри заменяются на картинки в стиле
 * iPhone (набор Apple из iamcal/emoji-data), а не рисуются системным шрифтом.
 *
 *   <Emoji>🚀</Emoji>
 *   <Emoji size={18}>Осталось ⚡ 1500</Emoji>
 *   <Emoji size={22}><b>Турбо 🚀 активен</b></Emoji>
 *
 * Работает рекурсивно: вложенные элементы обходятся, подменяются только
 * текстовые узлы. Картинки лежат локально в client/public/emoji/ —
 * обновляются командой `npm run emoji:sync`.
 */

const EMOJI_RE =
  /\p{RI}\p{RI}|\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic}|[\u{1F3FB}-\u{1F3FF}]|[\u{E0020}-\u{E007F}])*|[0-9#*]️⃣/gu;

export interface EmojiProps {
  children: ReactNode;
  /** Размер картинки в px. По умолчанию наследует размер текста (1em) */
  size?: number;
  className?: string;
}

/** Ищет имя файла для символа: сначала как есть, потом без FE0F */
function imageFor(char: string): string | undefined {
  return EMOJI_IMAGES[char] ?? EMOJI_IMAGES[char.replace(/️/g, '')];
}

function renderText(text: string, size?: number, keyPrefix = ''): ReactNode[] {
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let i = 0;

  for (const match of text.matchAll(EMOJI_RE)) {
    const char = match[0];
    const start = match.index ?? 0;
    const image = imageFor(char);

    // Нет картинки — оставляем символ как есть, чтобы текст не потерялся
    if (!image) continue;

    if (start > lastIndex) parts.push(text.slice(lastIndex, start));

    parts.push(
      <img
        key={`${keyPrefix}e${i++}`}
        className="emoji"
        src={`${import.meta.env.BASE_URL}emoji/${image}`}
        alt={char}
        draggable={false}
        style={size ? { width: size, height: size } : undefined}
      />,
    );

    lastIndex = start + char.length;
  }

  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts.length > 0 ? parts : [text];
}

function walk(node: ReactNode, size: number | undefined, keyPrefix: string): ReactNode {
  if (typeof node === 'string') return renderText(node, size, keyPrefix);
  if (typeof node === 'number') return node;

  if (Array.isArray(node)) {
    return Children.map(node, (child, i) => walk(child, size, `${keyPrefix}${i}-`));
  }

  if (isValidElement<{ children?: ReactNode }>(node) && node.props.children != null) {
    return cloneElement(node, undefined, walk(node.props.children, size, `${keyPrefix}c-`));
  }

  return node;
}

export function Emoji({ children, size, className }: EmojiProps) {
  const content = walk(children, size, '');
  return <span className={className ? `emoji-wrap ${className}` : 'emoji-wrap'}>{content}</span>;
}

/**
 * Одиночный эмодзи без обёртки-span — когда нужен именно значок,
 * например в круглой иконке буста.
 */
export function EmojiIcon({
  char,
  size = 24,
  className,
}: {
  char: string;
  size?: number;
  className?: string;
}) {
  const image = imageFor(char);
  if (!image) return <span className={className}>{char}</span>;

  return (
    <img
      className={className ? `emoji ${className}` : 'emoji'}
      src={`${import.meta.env.BASE_URL}emoji/${image}`}
      alt={char}
      draggable={false}
      style={{ width: size, height: size }}
    />
  );
}
