/**
 * Decorative background illustrations themed around Adam's interests:
 * atoms/molecules, science experiments, dinosaurs, and Lego.
 * Fixed-position, pointer-events: none, low opacity so they never compete with content.
 */

/** Atom: nucleus + three electron orbits */
function Atom() {
  return (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="50" cy="50" rx="46" ry="16" stroke="#8b5cf6" strokeWidth="3" />
      <ellipse cx="50" cy="50" rx="46" ry="16" stroke="#8b5cf6" strokeWidth="3" transform="rotate(60 50 50)" />
      <ellipse cx="50" cy="50" rx="46" ry="16" stroke="#8b5cf6" strokeWidth="3" transform="rotate(120 50 50)" />
      {/* Nucleus */}
      <circle cx="50" cy="50" r="10" fill="#ec4899" />
      {/* Electrons */}
      <circle cx="96" cy="50" r="5" fill="#a78bfa" />
      <circle cx="27" cy="76" r="5" fill="#a78bfa" />
      <circle cx="27" cy="24" r="5" fill="#a78bfa" />
    </svg>
  );
}

/** Molecule: three connected circles (H2O style) */
function Molecule() {
  return (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Bonds */}
      <line x1="50" y1="50" x2="20" y2="75" stroke="#6366f1" strokeWidth="5" strokeLinecap="round" />
      <line x1="50" y1="50" x2="80" y2="75" stroke="#6366f1" strokeWidth="5" strokeLinecap="round" />
      <line x1="50" y1="50" x2="50" y2="16" stroke="#6366f1" strokeWidth="5" strokeLinecap="round" />
      {/* Atoms */}
      <circle cx="50" cy="50" r="16" fill="#f97316" />
      <circle cx="20" cy="75" r="12" fill="#60a5fa" />
      <circle cx="80" cy="75" r="12" fill="#60a5fa" />
      <circle cx="50" cy="16" r="12" fill="#34d399" />
    </svg>
  );
}

/** Science flask / erlenmeyer */
function Flask() {
  return (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Neck */}
      <rect x="36" y="6" width="28" height="26" rx="5" fill="#0891b2" />
      {/* Body */}
      <path d="M36 32 L12 82 Q12 93 26 93 L74 93 Q88 93 88 82 L64 32 Z" fill="#06b6d4" />
      {/* Liquid level */}
      <path d="M16 72 L12 82 Q12 93 26 93 L74 93 Q88 93 88 82 L84 72 Z" fill="#0e7490" />
      {/* Bubbles */}
      <circle cx="42" cy="76" r="5"   fill="white" opacity="0.5" />
      <circle cx="61" cy="68" r="4"   fill="white" opacity="0.45" />
      <circle cx="52" cy="84" r="3.5" fill="white" opacity="0.4" />
    </svg>
  );
}

/** Test tube with liquid */
function TestTube() {
  return (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Tube body */}
      <rect x="38" y="8" width="24" height="70" rx="12" fill="#a3e635" />
      {/* Liquid fill */}
      <rect x="38" y="46" width="24" height="32" rx="0" fill="#65a30d" />
      <rect x="38" y="66" width="24" height="12" rx="12" fill="#65a30d" />
      {/* Bubble */}
      <circle cx="50" cy="60" r="5" fill="white" opacity="0.45" />
      {/* Stopper */}
      <rect x="34" y="4" width="32" height="10" rx="4" fill="#713f12" />
    </svg>
  );
}

/** Dinosaur footprint: three toes + heel pad */
function DinoFootprint() {
  return (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Toe 1 – centre */}
      <ellipse cx="50" cy="22" rx="9" ry="18" fill="#16a34a" />
      {/* Toe 2 – left */}
      <ellipse cx="28" cy="32" rx="9" ry="17" fill="#16a34a" transform="rotate(-35 28 32)" />
      {/* Toe 3 – right */}
      <ellipse cx="72" cy="32" rx="9" ry="17" fill="#16a34a" transform="rotate(35 72 32)" />
      {/* Heel pad */}
      <ellipse cx="50" cy="72" rx="20" ry="14" fill="#15803d" />
    </svg>
  );
}

/** T-Rex side silhouette (simple blocky) */
function TRex() {
  return (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Body */}
      <ellipse cx="52" cy="58" rx="26" ry="18" fill="#22c55e" />
      {/* Head */}
      <ellipse cx="82" cy="38" rx="18" ry="12" fill="#22c55e" />
      {/* Snout / jaw */}
      <rect x="72" y="44" width="28" height="8" rx="4" fill="#16a34a" />
      {/* Eye */}
      <circle cx="87" cy="34" r="3" fill="white" />
      <circle cx="88" cy="34" r="1.5" fill="#1e293b" />
      {/* Tiny arm */}
      <line x1="66" y1="52" x2="72" y2="62" stroke="#16a34a" strokeWidth="5" strokeLinecap="round" />
      {/* Tail */}
      <path d="M26 60 Q6 66 4 78" stroke="#22c55e" strokeWidth="10" strokeLinecap="round" fill="none" />
      {/* Legs */}
      <rect x="44" y="72" width="12" height="20" rx="5" fill="#16a34a" />
      <rect x="58" y="72" width="12" height="20" rx="5" fill="#16a34a" />
    </svg>
  );
}

/** Lego 2×2 brick */
function LegoBrick() {
  return (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Left stud */}
      <ellipse cx="31" cy="26" rx="13" ry="5" fill="#fdba74" />
      <rect x="18" y="26" width="26" height="14" rx="2" fill="#fb923c" />
      {/* Right stud */}
      <ellipse cx="69" cy="26" rx="13" ry="5" fill="#fdba74" />
      <rect x="56" y="26" width="26" height="14" rx="2" fill="#fb923c" />
      {/* Brick body */}
      <rect x="8" y="38" width="84" height="46" rx="7" fill="#f97316" />
      {/* Bottom shadow strip */}
      <rect x="8" y="76" width="84" height="8" rx="4" fill="#c2410c" />
    </svg>
  );
}

/** Lego minifig head (round, smiley) */
function LegoHead() {
  return (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Head */}
      <rect x="24" y="12" width="52" height="60" rx="14" fill="#fbbf24" />
      {/* Eyes */}
      <circle cx="38" cy="38" r="6" fill="white" />
      <circle cx="62" cy="38" r="6" fill="white" />
      <circle cx="40" cy="39" r="3.5" fill="#1e293b" />
      <circle cx="64" cy="39" r="3.5" fill="#1e293b" />
      {/* Smile */}
      <path d="M37 55 Q50 68 63 55" stroke="#1e293b" strokeWidth="3.5" strokeLinecap="round" fill="none" />
      {/* Stud on top */}
      <ellipse cx="50" cy="12" rx="10" ry="4" fill="#f59e0b" />
      <rect x="40" y="4" width="20" height="10" rx="3" fill="#fbbf24" />
      {/* Neck */}
      <rect x="38" y="72" width="24" height="14" rx="4" fill="#f59e0b" />
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
  { Component: Atom,          size: 148, rotate: -12, pos: { left: '1%',   top: '2%'    } },
  { Component: Flask,         size: 118, rotate:  -8, pos: { left: '0.5%', top: '42%'   } },
  { Component: LegoBrick,     size: 142, rotate:  14, pos: { left: '1.5%', bottom: '5%' } },
  // Right edge
  { Component: TRex,          size: 130, rotate:  18, pos: { right: '1.5%',top: '3%'    } },
  { Component: DinoFootprint, size: 132, rotate:   8, pos: { right: '1%',  top: '38%'   } },
  { Component: LegoHead,      size: 128, rotate: -14, pos: { right: '1.5%',bottom: '4%' } },
  { Component: Molecule,      size: 112, rotate: -20, pos: { right: '3.5%',top: '67%'   } },
  // Top centre strip
  { Component: TestTube,      size:  88, rotate:   5, pos: { left: '22%',  top: '1%'    } },
  { Component: Atom,          size:  96, rotate: -10, pos: { left: '42%',  top: '0.5%'  } },
  { Component: LegoBrick,     size:  90, rotate:  16, pos: { right: '22%', top: '0.5%'  } },
  // Mid-left band
  { Component: DinoFootprint, size: 100, rotate: -15, pos: { left: '10%',  top: '24%'   } },
  { Component: Molecule,      size:  96, rotate:  22, pos: { left: '8%',   top: '58%'   } },
  // Centre column
  { Component: TRex,          size: 110, rotate:  10, pos: { left: '44%',  top: '22%'   } },
  { Component: Flask,         size: 104, rotate: -18, pos: { left: '46%',  top: '55%'   } },
  // Mid-right band
  { Component: LegoHead,      size:  92, rotate:  -6, pos: { right: '10%', top: '22%'   } },
  { Component: TestTube,      size:  96, rotate:  12, pos: { right: '9%',  top: '57%'   } },
  // Bottom centre strip
  { Component: Atom,          size:  94, rotate:  -8, pos: { left: '23%',  bottom: '4%' } },
  { Component: DinoFootprint, size: 100, rotate:  14, pos: { left: '44%',  bottom: '3%' } },
  { Component: LegoBrick,     size:  92, rotate:  -5, pos: { right: '23%', bottom: '4%' } },
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
