/**
 * Icons, traced from the canvas.
 *
 * Inline rather than a library: there are eleven of them, they are all 24x24
 * strokes on `currentColor`, and an icon package would ship hundreds more plus a
 * runtime to pick between them.
 */
type P = { size?: number; className?: string };

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none' as const,
  stroke: 'currentColor',
  'aria-hidden': true,
});

export const MenuIcon = ({ size = 18 }: P) => (
  <svg {...base(size)} strokeWidth={1.7} strokeLinecap="round">
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);

export const PlusIcon = ({ size = 18 }: P) => (
  <svg {...base(size)} strokeWidth={1.9} strokeLinecap="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const MicIcon = ({ size = 19 }: P) => (
  <svg {...base(size)} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3z" />
    <path d="M19 11a7 7 0 0 1-14 0" />
    <path d="M12 18v3" />
  </svg>
);

export const SendIcon = ({ size = 18 }: P) => (
  <svg {...base(size)} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 4 11 13" />
    <path d="M20 4l-6.5 16-2.5-7-7-2.5z" />
  </svg>
);

export const ChevronIcon = ({ size = 15 }: P) => (
  <svg {...base(size)} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" stroke="#C4C4C8">
    <path d="m9 5 7 7-7 7" />
  </svg>
);

export const UndoIcon = ({ size = 13 }: P) => (
  <svg {...base(size)} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 14 4 9l5-5" />
    <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
  </svg>
);

export const CheckIcon = ({ size = 12 }: P) => (
  <svg {...base(size)} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
    <path d="m5 12.5 4.5 4.5L19 7" />
  </svg>
);

export const EyeOffIcon = ({ size = 15 }: P) => (
  <svg {...base(size)} strokeWidth={1.7} strokeLinecap="round">
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
    <path d="M4 4l16 16" />
  </svg>
);

/* ---- tab bar ---- */

export const HomeIcon = ({ size = 21 }: P) => (
  <svg {...base(size)} strokeWidth={1.7} strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="9" rx="1.6" />
    <rect x="14" y="3" width="7" height="5" rx="1.6" />
    <rect x="14" y="12" width="7" height="9" rx="1.6" />
    <rect x="3" y="16" width="7" height="5" rx="1.6" />
  </svg>
);

export const TodayIcon = ({ size = 21 }: P) => (
  <svg {...base(size)} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="m8.4 12.2 2.4 2.4 4.6-5.2" />
  </svg>
);

export const QuadrantIcon = ({ size = 21 }: P) => (
  <svg {...base(size)} strokeWidth={1.7} strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2.5" />
    <path d="M12 3v18M3 12h18" />
  </svg>
);

export const MoneyIcon = ({ size = 21 }: P) => (
  <svg {...base(size)} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 17.5 8.5 11l4 3L20 5.5" />
    <path d="M14.5 5.5H20v5.5" />
  </svg>
);

export const MoreIcon = ({ size = 21 }: P) => (
  <svg {...base(size)} strokeWidth={1.9} strokeLinecap="round">
    <circle cx="5" cy="12" r="1.4" fill="currentColor" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" />
    <circle cx="19" cy="12" r="1.4" fill="currentColor" />
  </svg>
);
