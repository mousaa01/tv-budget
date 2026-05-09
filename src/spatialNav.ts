// Spatial focus navigation for D-pad remote.
// Arrow Up/Down moves between focusable elements (`[data-focusable]` or focusable form controls).
// Inside text inputs, Up/Down also escapes the input (Left/Right still moves the caret).

const FOCUS_SELECTOR = [
  '[data-focusable]:not([disabled])',
  'input:not([disabled])',
  'button:not([disabled])',
  'a[href]',
].join(',');

function isVisible(el: HTMLElement): boolean {
  if (el.offsetParent === null && getComputedStyle(el).position !== 'fixed') return false;
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return false;
  return true;
}

function getFocusables(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(FOCUS_SELECTOR)).filter(
    (el) => isVisible(el) && el.tabIndex !== -1 && !el.hasAttribute('aria-hidden'),
  );
}

function focusEl(el: HTMLElement) {
  el.focus({ preventScroll: false });
  el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
}

/**
 * Move focus in a direction. For Up/Down we pick the closest focusable whose
 * vertical center is on the requested side, biased toward small horizontal distance.
 * Fallback: if no candidate is found in the requested direction, wrap to the topmost
 * (down → first below; if none, first above) focusable so the user is never stranded.
 */
function moveFocus(direction: 'up' | 'down' | 'left' | 'right') {
  const active = (document.activeElement as HTMLElement | null) ?? document.body;
  const all = getFocusables();
  const candidates = all.filter((el) => el !== active);
  if (candidates.length === 0) return;
  const ar = active.getBoundingClientRect();

  // Two-pass: first pass requires perpendicular-axis OVERLAP with the active rect
  // (so Down from a channel card lands on whatever is directly below). Second pass
  // falls back to nearest by perpendicular distance.
  function pick(requireOverlap: boolean): HTMLElement | null {
    let best: HTMLElement | null = null;
    let bestScore = Infinity;
    for (const el of candidates) {
      const r = el.getBoundingClientRect();
      let primary = 0; // forward gap along movement axis
      let perpGap = 0; // 0 if rects overlap on perp axis, else gap distance
      switch (direction) {
        case 'up':
          if (r.bottom > ar.top - 1) continue;
          primary = ar.top - r.bottom;
          perpGap = Math.max(0, r.left - ar.right, ar.left - r.right);
          break;
        case 'down':
          if (r.top < ar.bottom + 1) continue;
          primary = r.top - ar.bottom;
          perpGap = Math.max(0, r.left - ar.right, ar.left - r.right);
          break;
        case 'left':
          if (r.right > ar.left - 1) continue;
          primary = ar.left - r.right;
          perpGap = Math.max(0, r.top - ar.bottom, ar.top - r.bottom);
          break;
        case 'right':
          if (r.left < ar.right + 1) continue;
          primary = r.left - ar.right;
          perpGap = Math.max(0, r.top - ar.bottom, ar.top - r.bottom);
          break;
      }
      if (requireOverlap && perpGap > 0) continue;
      // Penalise perpendicular distance heavily so we don't jump diagonally.
      const score = primary + perpGap * 4;
      if (score < bestScore) {
        bestScore = score;
        best = el;
      }
    }
    return best;
  }

  let best = pick(true) ?? pick(false);

  // Fallback: nothing in the requested direction — jump to the next focusable in DOM order
  // (down/right → next, up/left → previous). Beats stranding the user with no visible focus.
  if (!best) {
    const idx = all.indexOf(active);
    if (idx === -1) {
      best = all[0] ?? null;
    } else {
      const forward = direction === 'down' || direction === 'right';
      best = forward ? all[Math.min(idx + 1, all.length - 1)] : all[Math.max(idx - 1, 0)];
    }
  }

  if (best && best !== active) focusEl(best);
}

let installed = false;
let lastMoveAt = 0;
export function installSpatialNavigation() {
  if (installed) return;
  installed = true;
  window.addEventListener(
    'keydown',
    (e) => {
      // Don't interfere with the YouTube player iframe — it has its own controls.
      const tgt = e.target as HTMLElement | null;
      if (tgt?.tagName === 'IFRAME') return;

      // Many TV remotes / OS layers fire keydown twice per press, which makes the
      // selection skip every other item. Throttle directional moves.
      const isArrow =
        e.key === 'ArrowUp' || e.key === 'ArrowDown' ||
        e.key === 'ArrowLeft' || e.key === 'ArrowRight';
      if (isArrow) {
        const now = performance.now();
        if (now - lastMoveAt < 180) {
          e.preventDefault();
          return;
        }
        lastMoveAt = now;
      }

      const isTextInput =
        tgt instanceof HTMLInputElement &&
        (tgt.type === 'text' || tgt.type === 'search' || tgt.type === '');
      const isTextArea = tgt instanceof HTMLTextAreaElement;

      if (isTextInput || isTextArea) {
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          moveFocus('up');
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          moveFocus('down');
        }
        return;
      }

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          moveFocus('up');
          break;
        case 'ArrowDown':
          e.preventDefault();
          moveFocus('down');
          break;
        case 'ArrowLeft':
          e.preventDefault();
          moveFocus('left');
          break;
        case 'ArrowRight':
          e.preventDefault();
          moveFocus('right');
          break;
      }
    },
    true,
  );
}
