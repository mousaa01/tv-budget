// Spatial focus navigation for D-pad remote.
// Arrow Up/Down moves between focusable elements (`[data-focusable]` or focusable form controls).
// Inside text inputs, Up/Down also escapes the input (Left/Right still moves the caret).
// Left/Right inside horizontal scroll-lists works via native focus order — we just nudge.

const FOCUS_SELECTOR = [
  '[data-focusable]:not([disabled])',
  'input:not([disabled])',
  'button:not([disabled])',
  'a[href]',
].join(',');

function getFocusables(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(FOCUS_SELECTOR)).filter(
    (el) =>
      el.offsetParent !== null &&
      !el.hasAttribute('aria-hidden') &&
      el.tabIndex !== -1,
  );
}

function center(el: Element): { x: number; y: number } {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/**
 * Move focus in a direction. For Up/Down we pick the closest focusable whose
 * vertical center is on the requested side, biased toward small horizontal distance.
 * For Left/Right we do the same horizontally.
 */
function moveFocus(direction: 'up' | 'down' | 'left' | 'right') {
  const active = (document.activeElement as HTMLElement | null) ?? document.body;
  const candidates = getFocusables().filter((el) => el !== active);
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
    // weight perpendicular distance more lightly so we prefer same-row/column targets
    const score = primary + secondary * 0.5;
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }
  if (best) {
    best.focus();
    best.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
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

      // Inside text inputs, only intercept Up/Down (preserve Left/Right caret movement).
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
    true, // capture phase so we beat default browser behavior on TV
  );
}
