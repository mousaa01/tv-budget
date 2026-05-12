/**
 * Decorative background illustrations scattered across the app.
 * Flat, friendly SVG icons themed around TV watching and budgeting.
 * Fixed-position, pointer-events: none, low opacity so they never compete with content.
 */

/** Classic CRT-style TV with antenna */
function TV() {
  return (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Antenna left */}
      <line x1="38" y1="18" x2="22" y2="4" stroke="#f97316" strokeWidth="4" strokeLinecap="round" />
      {/* Antenna right */}
      <line x1="62" y1="18" x2="78" y2="4" stroke="#f97316" strokeWidth="4" strokeLinecap="round" />
      {/* Body */}
      <rect x="8" y="18" width="84" height="58" rx="10" fill="#f97316" />
      {/* Screen */}
      <rect x="16" y="25" width="62" height="40" rx="6" fill="#fed7aa" />
      {/* Play triangle on screen */}
      <polygon points="38,38 38,52 58,45" fill="#f97316" />
      {/* Feet */}
      <rect x="28" y="76" width="14" height="8" rx="3" fill="#c2410c" />
      <rect x="58" y="76" width="14" height="8" rx="3" fill="#c2410c" />
    </svg>
  );
}

/** TV remote control */
function Remote() {
  return (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Body */}
      <rect x="30" y="5" width="40" height="90" rx="16" fill="#8b5cf6" />
      {/* Power button */}
      <circle cx="50" cy="26" r="9" fill="#a78bfa" />
      <circle cx="50" cy="26" r="5" fill="#7c3aed" />
      {/* D-pad */}
      <rect x="43" y="44" width="14" height="6" rx="3" fill="#ddd6fe" />
      <rect x="43" y="50" width="14" height="6" rx="3" fill="#ddd6fe" />
      <rect x="43" y="44" width="6" height="12" rx="3" fill="#ddd6fe" />
      <rect x="51" y="44" width="6" height="12" rx="3" fill="#ddd6fe" />
      {/* Small buttons */}
      <circle cx="42" cy="72" r="5" fill="#c4b5fd" />
      <circle cx="58" cy="72" r="5" fill="#c4b5fd" />
      <circle cx="42" cy="84" r="5" fill="#c4b5fd" />
      <circle cx="58" cy="84" r="5" fill="#c4b5fd" />
    </svg>
  );
}

/** Popcorn bucket */
function Popcorn() {
  return (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Bucket */}
      <path d="M22 42 L30 92 L70 92 L78 42 Z" fill="#f97316" />
      {/* Bucket stripes */}
      <path d="M36 42 L40 92 L44 92 L40 42 Z" fill="#fed7aa" />
      <path d="M56 42 L60 92 L64 92 L60 42 Z" fill="#fed7aa" />
      {/* Popcorn pieces */}
      <circle cx="34" cy="32" r="10" fill="#fef9c3" />
      <circle cx="50" cy="26" r="11" fill="#fef9c3" />
      <circle cx="66" cy="32" r="10" fill="#fef9c3" />
      <circle cx="42" cy="38" r="9"  fill="#fef9c3" />
      <circle cx="58" cy="38" r="9"  fill="#fef9c3" />
      <circle cx="26" cy="38" r="8"  fill="#fffbeb" />
      <circle cx="74" cy="38" r="8"  fill="#fffbeb" />
    </svg>
  );
}

/** Film clapper board */
function Clapper() {
  return (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Body */}
      <rect x="8" y="30" width="84" height="62" rx="6" fill="#1e293b" />
      {/* Top bar */}
      <rect x="8" y="18" width="84" height="18" rx="4" fill="#334155" />
      {/* Clapper stripes */}
      <clipPath id="cp"><rect x="8" y="8" width="84" height="18" rx="4" /></clipPath>
      <rect x="8"  y="8" width="84" height="18" rx="4" fill="#f1f5f9" />
      <rect x="8"  y="8" width="18" height="18" fill="#1e293b" />
      <rect x="44" y="8" width="18" height="18" fill="#1e293b" />
      <rect x="80" y="8" width="12" height="18" fill="#1e293b" />
      {/* Lines on body */}
      <line x1="8"  y1="52" x2="92" y2="52" stroke="#475569" strokeWidth="2" />
      <line x1="8"  y1="66" x2="92" y2="66" stroke="#475569" strokeWidth="2" />
      <line x1="8"  y1="80" x2="92" y2="80" stroke="#475569" strokeWidth="2" />
    </svg>
  );
}

/** Coin with dollar sign */
function Coin() {
  return (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Shadow */}
      <circle cx="50" cy="54" r="38" fill="#d97706" />
      {/* Face */}
      <circle cx="50" cy="48" r="38" fill="#fbbf24" />
      {/* Rim */}
      <circle cx="50" cy="48" r="38" fill="none" stroke="#f59e0b" strokeWidth="4" />
      {/* Dollar sign */}
      <text x="50" y="62" textAnchor="middle" fontSize="44" fontWeight="bold" fill="#d97706" fontFamily="Georgia, serif">$</text>
    </svg>
  );
}

/** Five-pointed star */
function Star() {
  return (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <polygon
        points="50,6 61,35 92,35 68,54 77,83 50,65 23,83 32,54 8,35 39,35"
        fill="#facc15"
        stroke="#f59e0b"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Clock face */
function Clock() {
  return (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Shadow */}
      <circle cx="50" cy="52" r="40" fill="#fb923c" />
      {/* Face */}
      <circle cx="50" cy="50" r="40" fill="#fff7ed" />
      {/* Rim */}
      <circle cx="50" cy="50" r="40" fill="none" stroke="#f97316" strokeWidth="5" />
      {/* Hour ticks */}
      <line x1="50" y1="14" x2="50" y2="22" stroke="#f97316" strokeWidth="3" strokeLinecap="round" />
      <line x1="50" y1="78" x2="50" y2="86" stroke="#f97316" strokeWidth="3" strokeLinecap="round" />
      <line x1="14" y1="50" x2="22" y2="50" stroke="#f97316" strokeWidth="3" strokeLinecap="round" />
      <line x1="78" y1="50" x2="86" y2="50" stroke="#f97316" strokeWidth="3" strokeLinecap="round" />
      {/* Minute hand */}
      <line x1="50" y1="50" x2="50" y2="20" stroke="#1e293b" strokeWidth="3.5" strokeLinecap="round" />
      {/* Hour hand */}
      <line x1="50" y1="50" x2="68" y2="50" stroke="#1e293b" strokeWidth="4" strokeLinecap="round" />
      {/* Centre dot */}
      <circle cx="50" cy="50" r="4" fill="#f97316" />
    </svg>
  );
}

/** Play button (circle with triangle) */
function PlayButton() {
  return (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Shadow */}
      <circle cx="50" cy="52" r="44" fill="#16a34a" />
      {/* Face */}
      <circle cx="50" cy="50" r="44" fill="#22c55e" />
      {/* Triangle */}
      <polygon points="38,30 38,70 74,50" fill="white" />
    </svg>
  );
}

interface Item {
  Component: () => JSX.Element;
  size: number;
  pos: React.CSSProperties;
  rotate: number;
}

const ITEMS: Item[] = [
  // Left edge
  { Component: TV,          size: 148, rotate: -12, pos: { left: '1%',   top: '2%'    } },
  { Component: Popcorn,     size: 118, rotate:  -8, pos: { left: '0.5%', top: '42%'   } },
  { Component: Coin,        size: 142, rotate:  14, pos: { left: '1.5%', bottom: '5%' } },
  // Right edge
  { Component: Remote,      size: 130, rotate:  18, pos: { right: '1.5%',top: '3%'    } },
  { Component: Clapper,     size: 132, rotate:   8, pos: { right: '1%',  top: '38%'   } },
  { Component: Clock,       size: 128, rotate: -14, pos: { right: '1.5%',bottom: '4%' } },
  { Component: PlayButton,  size: 112, rotate: -20, pos: { right: '3.5%',top: '67%'   } },
  // Top centre strip
  { Component: Star,        size:  88, rotate:   5, pos: { left: '22%',  top: '1%'    } },
  { Component: TV,          size:  96, rotate: -10, pos: { left: '42%',  top: '0.5%'  } },
  { Component: Popcorn,     size:  90, rotate:  16, pos: { right: '22%', top: '0.5%'  } },
  // Mid-left band
  { Component: Clapper,     size: 100, rotate: -15, pos: { left: '10%',  top: '24%'   } },
  { Component: Remote,      size:  96, rotate:  22, pos: { left: '8%',   top: '58%'   } },
  // Centre column
  { Component: Coin,        size: 110, rotate:  10, pos: { left: '44%',  top: '22%'   } },
  { Component: Clock,       size: 104, rotate: -18, pos: { left: '46%',  top: '55%'   } },
  // Mid-right band
  { Component: Star,        size:  92, rotate:  -6, pos: { right: '10%', top: '22%'   } },
  { Component: PlayButton,  size:  96, rotate:  12, pos: { right: '9%',  top: '57%'   } },
  // Bottom centre strip
  { Component: Remote,      size:  94, rotate:  -8, pos: { left: '23%',  bottom: '4%' } },
  { Component: Coin,        size: 100, rotate:  14, pos: { left: '44%',  bottom: '3%' } },
  { Component: Star,        size:  92, rotate:  -5, pos: { right: '23%', bottom: '4%' } },
];

export function BackgroundIllustrations() {
  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 0,
        overflow: 'hidden',
      }}
    >
      {ITEMS.map(({ Component, size, rotate, pos }, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            width: size,
            height: size,
            opacity: 0.22,
            transform: `rotate(${rotate}deg)`,
            ...pos,
          }}
        >
          <Component />
        </div>
      ))}
    </div>
  );
}
