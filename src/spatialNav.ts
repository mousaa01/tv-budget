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

function center(el: Element): { x: number; y: number } {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
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
  const a = center(active);

  let best: HTMLElement | null = null;
  let bestScore = Infinity;
  for (const el of candidates) {
    const c = center(el);
    const dx = c.x - a.x;
    const dy = c.y - a.y;
    let primary = 0;
    let secondary = 0;
    switch (direction) {
      case 'up':
        if (dy >= -2) continue;
        primary = -dy;
        secondary = Math.abs(dx);
        break;
      case 'down':
        if (dy <= 2) continue;
        primary = dy;
        secondary = Math.abs(dx);
        break;
      case 'left':
        if (dx >= -2) continue;
        primary = -dx;
        secondary = Math.abs(dy);
        break;
      case 'right':
        if (dx <= 2) continue;
        primary = dx;
        secondary = Math.abs(dy);
        break;
    }
    const score = primary + secondary * 0.5;
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }

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
export function installSpatialNavigation() {
  if (installed) return;
  installed = true;
  window.addEventListener(
    'keydown',
    (e) => {
      // Don't interfere with the YouTube player iframe — it has its own controls.
      const tgt = e.target as HTMLElement | null;
      if (tgt?.tagName === 'IFRAME') return;

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
