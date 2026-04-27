/** Inline SVG icon set for CrossQL — all inherit currentColor, 16x16 viewBox */

interface P { size?: number; className?: string }

export const Icons = {
  logo: ({ size = 20 }: P) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="2.5" y="2.5" width="8" height="8" rx="1.6" stroke="currentColor" strokeWidth="1.6"/>
      <rect x="13.5" y="2.5" width="8" height="8" rx="1.6" stroke="currentColor" strokeWidth="1.6" opacity=".55"/>
      <rect x="2.5" y="13.5" width="8" height="8" rx="1.6" stroke="currentColor" strokeWidth="1.6" opacity=".55"/>
      <rect x="13.5" y="13.5" width="8" height="8" rx="1.6" stroke="currentColor" strokeWidth="1.6"/>
      <path d="M10.5 6.5 L13.5 6.5 M6.5 10.5 L6.5 13.5 M17.5 10.5 L17.5 13.5 M10.5 17.5 L13.5 17.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  ),
  chev: ({ size = 12, className }: P & { dir?: string }) => (
    <svg width={size} height={size} viewBox="0 0 16 16" className={className} aria-hidden>
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  chevRight: ({ size = 12 }: P) => (
    <svg width={size} height={size} viewBox="0 0 16 16" style={{ transform: 'rotate(-90deg)' }} aria-hidden>
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  db: ({ size = 14 }: P) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <ellipse cx="8" cy="3.5" rx="5" ry="1.8" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M3 3.5v9c0 1 2.2 1.8 5 1.8s5-.8 5-1.8v-9" stroke="currentColor" strokeWidth="1.4" fill="none"/>
      <path d="M3 8c0 1 2.2 1.8 5 1.8s5-.8 5-1.8" stroke="currentColor" strokeWidth="1.4" fill="none"/>
    </svg>
  ),
  table: ({ size = 14 }: P) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="2" y="3" width="12" height="10" rx="1.2" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M2 6.5h12M2 10h12M6 3v10M10 3v10" stroke="currentColor" strokeWidth="1.4"/>
    </svg>
  ),
  column: ({ size = 12 }: P) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="6" y="2.5" width="4" height="11" rx=".8" stroke="currentColor" strokeWidth="1.4"/>
    </svg>
  ),
  key: ({ size = 12 }: P) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="5" cy="8" r="2.6" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M7.6 8h6l-1.5 1.5M11 8v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  ),
  play: ({ size = 12 }: P) => (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" aria-hidden>
      <path d="M3 2.5v7l6-3.5-6-3.5z" fill="currentColor"/>
    </svg>
  ),
  stop: ({ size = 12 }: P) => (
    <svg width={size} height={size} viewBox="0 0 12 12" aria-hidden>
      <rect x="2.5" y="2.5" width="7" height="7" rx="1" fill="currentColor"/>
    </svg>
  ),
  search: ({ size = 14 }: P) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="7" cy="7" r="4.2" stroke="currentColor" strokeWidth="1.4"/>
      <path d="m10.2 10.2 3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  ),
  close: ({ size = 12 }: P) => (
    <svg width={size} height={size} viewBox="0 0 12 12" aria-hidden>
      <path d="m3 3 6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  plus: ({ size = 12 }: P) => (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden>
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  ),
  code: ({ size = 14 }: P) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M6 4 2 8l4 4M10 4l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  python: ({ size = 14 }: P) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="3" y="2.5" width="10" height="6" rx="2.5" stroke="currentColor" strokeWidth="1.4"/>
      <rect x="3" y="7.5" width="10" height="6" rx="2.5" stroke="currentColor" strokeWidth="1.4"/>
      <circle cx="5.5" cy="5" r=".7" fill="currentColor"/>
      <circle cx="10.5" cy="11" r=".7" fill="currentColor"/>
    </svg>
  ),
  moon: ({ size = 14 }: P) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M13 9.5A5.5 5.5 0 0 1 6.5 3a5.5 5.5 0 1 0 6.5 6.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
    </svg>
  ),
  sun: ({ size = 14 }: P) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="2.8" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M8 1.5v1.6M8 12.9v1.6M1.5 8h1.6M12.9 8h1.6M3.5 3.5l1.1 1.1M11.4 11.4l1.1 1.1M3.5 12.5l1.1-1.1M11.4 4.6l1.1-1.1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  ),
  spinner: ({ size = 14 }: P) => (
    <svg width={size} height={size} viewBox="0 0 16 16" className="spin" aria-hidden>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.6" opacity=".2" fill="none"/>
      <path d="M14 8a6 6 0 0 0-6-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none"/>
    </svg>
  ),
  check: ({ size = 14 }: P) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="m3.5 8.5 3 3 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  warn: ({ size = 14 }: P) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M8 2 1.5 13h13L8 2z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
      <path d="M8 6.5v3M8 11.2v.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  ),
  errCircle: ({ size = 14 }: P) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  ),
  download: ({ size = 12 }: P) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M8 2v8m-3-3 3 3 3-3M3 13h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  filter: ({ size = 12 }: P) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M2.5 3h11l-4 5v4l-3 1.5V8l-4-5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
    </svg>
  ),
  sidebar: ({ size = 14 }: P) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="2" y="3" width="12" height="10" rx="1.4" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M6 3v10" stroke="currentColor" strokeWidth="1.4"/>
    </svg>
  ),
  bolt: ({ size = 12 }: P) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M9 1 3 9h4l-1 6 7-9H9l1-5z" fill="currentColor"/>
    </svg>
  ),
  refresh: ({ size = 14 }: P) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M2.5 8a5.5 5.5 0 1 0 1.6-3.9M2.5 3.5V6h2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  more: ({ size = 14 }: P) => (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden>
      <circle cx="3.5" cy="8" r="1.3" fill="currentColor"/>
      <circle cx="8" cy="8" r="1.3" fill="currentColor"/>
      <circle cx="12.5" cy="8" r="1.3" fill="currentColor"/>
    </svg>
  ),
  bookmark: ({ size = 14 }: P) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M3.5 2.5h9a.5.5 0 0 1 .5.5v10.7l-5-3-5 3V3a.5.5 0 0 1 .5-.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
    </svg>
  ),
  clock: ({ size = 14 }: P) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M8 5v3.5l2 1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  settings: ({ size = 14 }: P) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M8 1.5v1M8 13.5v1M1.5 8h1M13.5 8h1M3.4 3.4l.7.7M11.9 11.9l.7.7M3.4 12.6l.7-.7M11.9 4.1l.7-.7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  ),
};
