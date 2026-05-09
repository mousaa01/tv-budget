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
  // If a modal dialog is open, restrict focus to its contents — otherwise arrows
  // would escape the modal and let the user trigger things they can't see.
  const modal = document.querySelector<HTMLElement>('[role="dialog"][aria-modal="true"]');
  const root: ParentNode = modal ?? document;
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUS_SELECTOR)).filter(
    (el) => isVisible(el) && el.tabIndex !== -1 && !el.hasAttribute('aria-hidden'),
  );
}

function center(el: Element): { x: number; y: number } {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function focusEl(el: HTMLElement) {
  el.focus({ preventScroll: false });
  el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
}

/**
 * Center-based spatial nav. For each direction, candidates must have their center
 * past the active center on the primary axis. Score = primary-axis distance + 2x
 * perpendicular distance, so we prefer items roughly aligned with the current one.
 */
function moveFocus(direction: 'up' | 'down' | 'left' | 'right') {
  const all = getFocusables();
  if (all.length === 0) return;

  const activeRaw = document.activeElement as HTMLElement | null;
  const active =
    activeRaw && activeRaw !== document.body && all.includes(activeRaw) ? activeRaw : null;

  if (!active) {
    focusEl(all[0]);
    return;
  }

  const candidates = all.filter((el) => el !== active);
  if (candidates.length === 0) return;
  const a = center(active);

  let best: HTMLElement | null = null;
  let bestScore = Infinity;
  for (const el of candidates) {
    const c = center(el);
    const dx = c.x - a.x;
    const dy = c.y - a.y;
    let primary = 0;
    let perp = 0;
    switch (direction) {
      case 'up':
        if (dy >= -8) continue;
        primary = -dy;
        perp = Math.abs(dx);
        break;
      case 'down':
        if (dy <= 8) continue;
        primary = dy;
        perp = Math.abs(dx);
        break;
      case 'left':
        if (dx >= -8) continue;
        primary = -dx;
        perp = Math.abs(dy);
        break;
      case 'right':
        if (dx <= 8) continue;
        primary = dx;
        perp = Math.abs(dy);
        break;
    }
    const score = primary + perp * 2;
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }

  // DOM-order fallback so the user is never stranded.
  if (!best) {
    const idx = all.indexOf(active);
    const forward = direction === 'down' || direction === 'right';
    best = forward ? all[Math.min(idx + 1, all.length - 1)] : all[Math.max(idx - 1, 0)];
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
