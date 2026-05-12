/**
 * Decorative background illustrations scattered across the app.
 * Flat, friendly SVG drawings in warm tones — consistent art style.
 * Fixed-position, pointer-events: none, low opacity so they never compete with content.
 */

function Planet() {
  return (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="8"  cy="14" r="3.5" fill="#facc15" />
      <circle cx="90" cy="9"  r="2.5" fill="#facc15" />
      <circle cx="94" cy="66" r="2"   fill="#fde047" />
      <circle cx="5"  cy="82" r="2"   fill="#fde047" />
      <circle cx="50" cy="54" r="30"  fill="#f97316" />
      <ellipse cx="50" cy="54" rx="48" ry="12" stroke="#fdba74" strokeWidth="7" />
    </svg>
  );
}

function Atom() {
  return (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="50" cy="50" rx="44" ry="16" stroke="#8b5cf6" strokeWidth="2.5" />
      <ellipse cx="50" cy="50" rx="44" ry="16" stroke="#8b5cf6" strokeWidth="2.5" transform="rotate(60 50 50)" />
      <ellipse cx="50" cy="50" rx="44" ry="16" stroke="#8b5cf6" strokeWidth="2.5" transform="rotate(120 50 50)" />
      <circle cx="50" cy="50" r="9" fill="#ec4899" />
      <circle cx="94" cy="50" r="5.5" fill="#a78bfa" />
      <circle cx="28" cy="75" r="5.5" fill="#a78bfa" />
      <circle cx="28" cy="25" r="5.5" fill="#a78bfa" />
    </svg>
  );
}

function Flask() {
  return (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="36" y="7" width="28" height="26" rx="4" fill="#0891b2" />
      <path d="M36 32 L14 80 Q14 92 26 92 L74 92 Q86 92 86 80 L64 32 Z" fill="#06b6d4" />
      <path d="M19 70 L14 80 Q14 92 26 92 L74 92 Q86 92 86 80 L81 70 Z" fill="#3b82f6" />
      <circle cx="43" cy="73" r="5"   fill="white" opacity="0.55" />
      <circle cx="62" cy="66" r="3.5" fill="white" opacity="0.5"  />
      <circle cx="53" cy="81" r="3"   fill="white" opacity="0.45" />
    </svg>
  );
}

function DinoFootprint() {
  return (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Middle toe */}
      <ellipse cx="50" cy="23" rx="11" ry="20" fill="#22c55e" />
      {/* Left toe */}
      <ellipse cx="50" cy="23" rx="11" ry="20" fill="#22c55e" transform="rotate(-48 50 23) translate(-26 18)" />
      {/* Right toe */}
      <ellipse cx="50" cy="23" rx="11" ry="20" fill="#22c55e" transform="rotate(48 50 23) translate(26 18)" />
      {/* Palm */}
      <ellipse cx="50" cy="68" rx="22" ry="16" fill="#16a34a" />
    </svg>
  );
}

function LegoBrick() {
  return (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Left stud cylinder + top cap */}
      <rect x="15" y="22" width="28" height="20" rx="3" fill="#fb923c" />
      <ellipse cx="29" cy="22" rx="14" ry="5.5" fill="#fdba74" />
      {/* Right stud cylinder + top cap */}
      <rect x="57" y="22" width="28" height="20" rx="3" fill="#fb923c" />
      <ellipse cx="71" cy="22" rx="14" ry="5.5" fill="#fdba74" />
      {/* Brick body */}
      <rect x="8" y="38" width="84" height="46" rx="6" fill="#f97316" />
      {/* Bottom edge shadow */}
      <rect x="8" y="77" width="84" height="9" rx="4" fill="#c2410c" />
    </svg>
  );
}

function Tools() {
  return (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Hammer handle */}
      <rect x="46" y="36" width="11" height="55" rx="4.5" fill="#92400e" transform="rotate(-18 51.5 63.5)" />
      {/* Hammer head */}
      <rect x="18" y="16" width="52" height="21" rx="7" fill="#78716c" transform="rotate(-18 44 26.5)" />
      {/* Wrench handle body */}
      <rect x="43" y="36" width="11" height="50" rx="4.5" fill="#475569" transform="rotate(20 48.5 61)" />
      {/* Wrench open end (ring) */}
      <circle cx="74" cy="26" r="13" fill="#475569" />
      <circle cx="74" cy="26" r="6.5" fill="#fff7ed" />
    </svg>
  );
}

function Telescope() {
  return (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Tube */}
      <rect x="22" y="34" width="58" height="20" rx="9" fill="#8b5cf6" transform="rotate(-22 51 44)" />
      {/* Eyepiece (narrow end) */}
      <ellipse cx="28" cy="57" rx="9" ry="6" fill="#7c3aed" transform="rotate(-22 28 57)" />
      {/* Objective lens (wide end) */}
      <ellipse cx="76" cy="30" rx="14" ry="9" fill="#7c3aed" transform="rotate(-22 76 30)" />
      {/* Tripod legs */}
      <line x1="52" y1="64" x2="28" y2="92" stroke="#a16207" strokeWidth="5" strokeLinecap="round" />
      <line x1="52" y1="64" x2="72" y2="92" stroke="#a16207" strokeWidth="5" strokeLinecap="round" />
      <line x1="52" y1="64" x2="52" y2="93" stroke="#a16207" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

function StarCluster() {
  return (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* 4-point star */}
      <polygon points="50,8 56,42 90,50 56,58 50,92 44,58 10,50 44,42" fill="#facc15" />
      <circle cx="18" cy="16" r="4" fill="#fde047" />
      <circle cx="84" cy="12" r="3" fill="#fde047" />
      <circle cx="88" cy="80" r="3.5" fill="#fde047" />
      <circle cx="12" cy="78" r="3" fill="#fde047" />
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
  { Component: Planet,        size: 148, rotate: -12, pos: { left: '1%',   top: '2%'    } },
  { Component: Flask,         size: 118, rotate:  -8, pos: { left: '0.5%', top: '42%'   } },
  { Component: LegoBrick,     size: 142, rotate:  14, pos: { left: '1.5%', bottom: '5%' } },
  // Right edge
  { Component: Atom,          size: 130, rotate:  18, pos: { right: '1.5%',top: '3%'    } },
  { Component: DinoFootprint, size: 132, rotate:   8, pos: { right: '1%',  top: '38%'   } },
  { Component: Tools,         size: 128, rotate: -14, pos: { right: '1.5%',bottom: '4%' } },
  { Component: Telescope,     size: 112, rotate: -20, pos: { right: '3.5%',top: '67%'   } },
  // Top centre strip
  { Component: StarCluster,   size:  88, rotate:   5, pos: { left: '22%',  top: '1%'    } },
  { Component: LegoBrick,     size:  96, rotate: -10, pos: { left: '42%',  top: '0.5%'  } },
  { Component: Flask,         size:  90, rotate:  16, pos: { right: '22%', top: '0.5%'  } },
  // Mid-left band
  { Component: DinoFootprint, size: 100, rotate: -15, pos: { left: '10%',  top: '24%'   } },
  { Component: Telescope,     size:  96, rotate:  22, pos: { left: '8%',   top: '58%'   } },
  // Centre column
  { Component: Planet,        size: 110, rotate:  10, pos: { left: '44%',  top: '22%'   } },
  { Component: Atom,          size: 104, rotate: -18, pos: { left: '46%',  top: '55%'   } },
  // Mid-right band
  { Component: StarCluster,   size:  92, rotate:  -6, pos: { right: '10%', top: '22%'   } },
  { Component: Tools,         size:  96, rotate:  12, pos: { right: '9%',  top: '57%'   } },
  // Bottom centre strip
  { Component: Atom,          size:  94, rotate:  -8, pos: { left: '23%',  bottom: '4%' } },
  { Component: DinoFootprint, size: 100, rotate:  14, pos: { left: '44%',  bottom: '3%' } },
  { Component: Planet,        size:  92, rotate:  -5, pos: { right: '23%', bottom: '4%' } },
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
            opacity: 0.10,
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
