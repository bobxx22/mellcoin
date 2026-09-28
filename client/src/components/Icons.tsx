/** Иконки интерфейса. Тонкие SVG в стиле iOS — не эмодзи. */

type IconProps = { size?: number; className?: string };

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

export const ChevronRight = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className} aria-hidden="true">
    <path d="M9 5l7 7-7 7" />
  </svg>
);

export const ChevronLeft = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className} aria-hidden="true">
    <path d="M15 5l-7 7 7 7" />
  </svg>
);

export const ArrowLeft = ({ size = 22, className }: IconProps) => (
  <svg {...base(size)} className={className} aria-hidden="true">
    <path d="M19 12H5M11 5l-7 7 7 7" />
  </svg>
);

export const Close = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className} aria-hidden="true">
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);

export const Check = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className} aria-hidden="true">
    <path d="M20 6L9 17l-5-5" />
  </svg>
);

export const Lock = ({ size = 13, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
    <rect x="4" y="10" width="16" height="11" rx="3" fill="#34c759" />
    <path
      d="M8 10V7a4 4 0 0 1 8 0v3"
      fill="none"
      stroke="#34c759"
      strokeWidth="2.4"
      strokeLinecap="round"
    />
  </svg>
);

/** Лавровая ветвь по бокам от места в рейтинге — как в Notcoin */
export const Laurel = ({ size = 16, flip = false }: IconProps & { flip?: boolean }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    className="laurel"
    style={flip ? { transform: 'scaleX(-1)' } : undefined}
    fill="currentColor"
    aria-hidden="true"
  >
    {/* Стебель */}
    <path
      d="M17 3.4c-4.6 3.4-6.6 8.6-5.7 17.2"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
    />
    {/* Листья — каплевидные, повёрнуты вдоль стебля */}
    <ellipse cx="13.6" cy="7.2" rx="2.5" ry="1.35" transform="rotate(-32 13.6 7.2)" />
    <ellipse cx="12.3" cy="11.4" rx="2.6" ry="1.35" transform="rotate(-20 12.3 11.4)" />
    <ellipse cx="11.7" cy="15.7" rx="2.4" ry="1.3" transform="rotate(-8 11.7 15.7)" />
    <ellipse cx="17.9" cy="6.3" rx="2.1" ry="1.15" transform="rotate(34 17.9 6.3)" />
    <ellipse cx="17.2" cy="10.7" rx="2.2" ry="1.15" transform="rotate(24 17.2 10.7)" />
    <ellipse cx="16.4" cy="15" rx="2" ry="1.1" transform="rotate(14 16.4 15)" />
  </svg>
);
