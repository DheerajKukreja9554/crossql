// icons.jsx — tiny inline SVG icon set for CrossQL
// All icons inherit currentColor, 16x16 viewBox unless noted.

const I = {
  logo: (s = 20) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="2.5" y="2.5" width="8" height="8" rx="1.6" stroke="currentColor" strokeWidth="1.6"/>
      <rect x="13.5" y="2.5" width="8" height="8" rx="1.6" stroke="currentColor" strokeWidth="1.6" opacity=".55"/>
      <rect x="2.5" y="13.5" width="8" height="8" rx="1.6" stroke="currentColor" strokeWidth="1.6" opacity=".55"/>
      <rect x="13.5" y="13.5" width="8" height="8" rx="1.6" stroke="currentColor" strokeWidth="1.6"/>
      <path d="M10.5 6.5 L13.5 6.5 M6.5 10.5 L6.5 13.5 M17.5 10.5 L17.5 13.5 M10.5 17.5 L13.5 17.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  ),
  chev: (dir = 'down') => {
    const rot = { down: 0, up: 180, left: 90, right: -90 }[dir];
    return (
      <svg width="12" height="12" viewBox="0 0 16 16" style={{ transform: `rotate(${rot}deg)` }} aria-hidden>
        <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    );
  },
  db: (s = 14) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none" aria-hidden>
      <ellipse cx="8" cy="3.5" rx="5" ry="1.8" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M3 3.5v9c0 1 2.2 1.8 5 1.8s5-.8 5-1.8v-9" stroke="currentColor" strokeWidth="1.4" fill="none"/>
      <path d="M3 8c0 1 2.2 1.8 5 1.8s5-.8 5-1.8" stroke="currentColor" strokeWidth="1.4" fill="none"/>
    </svg>
  ),
  table: (s = 14) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="2" y="3" width="12" height="10" rx="1.2" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M2 6.5h12M2 10h12M6 3v10M10 3v10" stroke="currentColor" strokeWidth="1.4"/>
    </svg>
  ),
  column: (s = 12) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="6" y="2.5" width="4" height="11" rx=".8" stroke="currentColor" strokeWidth="1.4"/>
    </svg>
  ),
  key: (s = 12) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="5" cy="8" r="2.6" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M7.6 8h6l-1.5 1.5M11 8v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  ),
  play: (s = 12) => (
    <svg width={s} height={s} viewBox="0 0 12 12" fill="none" aria-hidden>
      <path d="M3 2.5v7l6-3.5-6-3.5z" fill="currentColor"/>
    </svg>
  ),
  stop: (s = 12) => (
    <svg width={s} height={s} viewBox="0 0 12 12" aria-hidden>
      <rect x="2.5" y="2.5" width="7" height="7" rx="1" fill="currentColor"/>
    </svg>
  ),
  search: (s = 14) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="7" cy="7" r="4.2" stroke="currentColor" strokeWidth="1.4"/>
      <path d="m10.2 10.2 3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  ),
  close: (s = 12) => (
    <svg width={s} height={s} viewBox="0 0 12 12" aria-hidden>
      <path d="m3 3 6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  filter: (s = 12) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M2.5 3h11l-4 5v4l-3 1.5V8l-4-5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
    </svg>
  ),
  sortAsc: (s = 12) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M4 11l3-3 3 3M7 8v5M11 4h3M11 8h2M11 12h1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  ),
  spinner: (s = 14) => (
    <svg width={s} height={s} viewBox="0 0 16 16" className="spin" aria-hidden>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.6" opacity=".2" fill="none"/>
      <path d="M14 8a6 6 0 0 0-6-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none"/>
    </svg>
  ),
  check: (s = 14) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="m3.5 8.5 3 3 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  warn: (s = 14) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M8 2 1.5 13h13L8 2z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
      <path d="M8 6.5v3M8 11.2v.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  ),
  err: (s = 14) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  ),
  info: (s = 14) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M8 7v4M8 5v.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  ),
  plus: (s = 12) => (
    <svg width={s} height={s} viewBox="0 0 16 16" aria-hidden>
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  ),
  code: (s = 14) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M6 4 2 8l4 4M10 4l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  python: (s = 14) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="3" y="2.5" width="10" height="6" rx="2.5" stroke="currentColor" strokeWidth="1.4"/>
      <rect x="3" y="7.5" width="10" height="6" rx="2.5" stroke="currentColor" strokeWidth="1.4"/>
      <circle cx="5.5" cy="5" r=".7" fill="currentColor"/>
      <circle cx="10.5" cy="11" r=".7" fill="currentColor"/>
    </svg>
  ),
  cmd: (s = 12) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M5 3a2 2 0 1 1 0 4h6a2 2 0 1 1 0 4M5 11a2 2 0 1 1-2 2v-8a2 2 0 1 1 2 2h6v4H5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
    </svg>
  ),
  moon: (s = 14) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M13 9.5A5.5 5.5 0 0 1 6.5 3a5.5 5.5 0 1 0 6.5 6.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
    </svg>
  ),
  sun: (s = 14) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="2.8" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M8 1.5v1.6M8 12.9v1.6M1.5 8h1.6M12.9 8h1.6M3.5 3.5l1.1 1.1M11.4 11.4l1.1 1.1M3.5 12.5l1.1-1.1M11.4 4.6l1.1-1.1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  ),
  settings: (s = 14) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M8 1.5v1.8M8 12.7v1.8M1.5 8h1.8M12.7 8h1.8M3.2 3.2 4.5 4.5M11.5 11.5l1.3 1.3M3.2 12.8 4.5 11.5M11.5 4.5l1.3-1.3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  ),
  history: (s = 14) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M2.5 8a5.5 5.5 0 1 0 1.6-3.9M2.5 3.5V6h2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M8 5v3l2 1.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  ),
  download: (s = 12) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M8 2v8m-3-3 3 3 3-3M3 13h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  copy: (s = 12) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="5" y="2.5" width="8" height="9" rx="1" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M10.5 11.5v1.2c0 .5-.4.8-.8.8H3.8c-.5 0-.8-.3-.8-.8V5.3c0-.5.3-.8.8-.8H5" stroke="currentColor" strokeWidth="1.4"/>
    </svg>
  ),
  more: (s = 14) => (
    <svg width={s} height={s} viewBox="0 0 16 16" aria-hidden>
      <circle cx="3.5" cy="8" r="1.3" fill="currentColor"/>
      <circle cx="8" cy="8" r="1.3" fill="currentColor"/>
      <circle cx="12.5" cy="8" r="1.3" fill="currentColor"/>
    </svg>
  ),
  sidebar: (s = 14) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="2" y="3" width="12" height="10" rx="1.4" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M6 3v10" stroke="currentColor" strokeWidth="1.4"/>
    </svg>
  ),
  bolt: (s = 12) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M9 1 3 9h4l-1 6 7-9H9l1-5z" fill="currentColor"/>
    </svg>
  ),
  link: (s = 12) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M7 9a2.5 2.5 0 0 0 3.5 0l2-2a2.5 2.5 0 0 0-3.5-3.5L8 4.5M9 7a2.5 2.5 0 0 0-3.5 0l-2 2a2.5 2.5 0 0 0 3.5 3.5L8 11.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  ),
  sparkle: (s = 12) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M8 2l1.2 3.5L12.5 7 9.2 8.2 8 11.5 6.8 8.2 3.5 7l3.3-1.5L8 2z" fill="currentColor"/>
      <circle cx="13" cy="12" r="1" fill="currentColor"/>
    </svg>
  ),
};

window.I = I;
