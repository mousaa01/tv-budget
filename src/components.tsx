import { FocusContext, setFocus, useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import type { ReactNode, ButtonHTMLAttributes } from 'react';
import { memo, useEffect, useRef, useState } from 'react';
import { formatHMS, formatMMSS } from './format';

/* ---------------- Button ---------------- */

type Variant = 'primary' | 'secondary' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  fullWidth?: boolean;
  autoFocus?: boolean;
}

export function Button({
  variant = 'primary',
  fullWidth,
  autoFocus,
  style,
  children,
  onClick,
  ...rest
}: ButtonProps) {
  // Separate ref for click() — avoids circular type-inference with useFocusable's ref.
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const { ref, focused } = useFocusable({
    onEnterPress: () => btnRef.current?.click(),
    focusKey: rest.id,
  });
  // Compose LRUD ref + btnRef onto the same DOM node.
  const composedRef = (el: HTMLButtonElement | null) => {
    btnRef.current = el;
    (ref as React.MutableRefObject<HTMLButtonElement | null>).current = el;
  };

  const palette =
    variant === 'primary'
      ? { bg: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)', color: '#fff', border: 'transparent', shadow: '0 4px 22px rgba(249,115,22,0.4)' }
      : variant === 'danger'
      ? { bg: 'transparent', color: 'var(--danger)', border: 'var(--danger)', shadow: 'none' }
      : { bg: 'var(--surface)', color: 'var(--text)', border: 'var(--border)', shadow: '0 2px 8px rgba(0,0,0,0.08)' };

  return (
    <button
      ref={composedRef}
      data-focusable
      className={focused ? 'focused' : undefined}
      onClick={onClick}
      style={{
        minHeight: 80,
        padding: '0 36px',
        background: palette.bg,
        color: palette.color,
        border: `2px solid ${palette.border}`,
        borderRadius: 'var(--radius-lg)',
        fontSize: 24,
        fontWeight: 800,
        boxShadow: palette.shadow,
        transition: `transform var(--dur-fast) var(--ease), box-shadow var(--dur-fast) var(--ease)`,
        width: fullWidth ? '100%' : undefined,
        letterSpacing: '0.2px',
        ...style,
      }}
      onMouseDown={(e) => e.preventDefault()}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ---------------- Pill ---------------- */

interface PillProps {
  color?: 'ok' | 'blocked' | 'warn' | 'dim';
  children: ReactNode;
}

export function Pill({ color = 'dim', children }: PillProps) {
  const c =
    color === 'ok' ? 'var(--ok)' : color === 'warn' ? 'var(--warn)' : color === 'blocked' ? 'var(--blocked)' : 'var(--text-dim)';
  const bg =
    color === 'ok' ? 'rgba(22,163,74,0.12)' :
    color === 'warn' ? 'rgba(245,158,11,0.12)' :
    color === 'blocked' ? 'rgba(148,163,184,0.12)' :
    'rgba(30,27,75,0.06)';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 16px',
        borderRadius: 999,
        border: `2px solid ${c}`,
        background: bg,
        color: c,
        fontSize: 18,
        fontWeight: 700,
      }}
    >
      {children}
    </span>
  );
}

/* ---------------- TimerOverlay (always-on faint timer) ---------------- */

interface TimerOverlayProps {
  remainingSeconds: number;
}

export function TimerOverlay({ remainingSeconds }: TimerOverlayProps) {
  const isWarn = remainingSeconds > 0 && remainingSeconds <= 120;
  const text = remainingSeconds >= 3600 ? formatHMS(remainingSeconds) : formatMMSS(remainingSeconds);

  return (
    <div
      aria-label={`Time remaining: ${text}`}
      className="tabular"
      style={{
        position: 'fixed',
        top: 'var(--space-3)',
        left: 'var(--space-4)',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 20px',
        background: isWarn ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.7)',
        border: `2px solid ${isWarn ? 'rgba(245,158,11,0.6)' : 'rgba(30,27,75,0.15)'}`,
        borderRadius: 999,
        fontSize: 24,
        fontWeight: 800,
        color: isWarn ? '#b45309' : 'var(--text-dim)',
        animation: isWarn ? 'pulse 1.5s var(--ease) infinite' : undefined,
        zIndex: 100,
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    >
      ⏱ {text}
    </div>
  );
}

/* ---------------- WindDownBanner ---------------- */

interface BannerProps {
  show: boolean;
  text: string;
}

export function WindDownBanner({ show, text }: BannerProps) {
  if (!show) return null;
  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        background: 'rgba(15, 15, 15, 0.92)',
        borderLeft: '8px solid var(--warn)',
        padding: 'var(--space-3) var(--space-6)',
        fontSize: 28,
        fontWeight: 600,
        color: 'var(--text)',
        zIndex: 200,
        animation: 'slidedown var(--dur-med) var(--ease)',
      }}
    >
      {text}
    </div>
  );
}

/* ---------------- FiveMinuteWarning ---------------- */

interface FiveMinuteWarningProps {
  trigger: number; // changes (e.g. ticks up) to fire the warning
}

export function FiveMinuteWarning({ trigger }: FiveMinuteWarningProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (trigger === 0) return;
    setVisible(true);
    // Speak via Web Speech API
    try {
      const synth = window.speechSynthesis;
      if (synth) {
        synth.cancel();
        const u = new SpeechSynthesisUtterance('5 minutes left');
        u.rate = 0.95;
        u.pitch = 1.0;
        u.volume = 1.0;
        synth.speak(u);
      }
    } catch {
      /* speech API not available — silently skip */
    }
    // Also play a short beep tone in case TTS is unavailable
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctx) {
        const ctx = new Ctx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 880;
        gain.gain.value = 0.18;
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
        osc.onended = () => ctx.close();
      }
    } catch {
      /* audio not available */
    }
    const t = window.setTimeout(() => setVisible(false), 6000);
    return () => window.clearTimeout(t);
  }, [trigger]);

  if (!visible) return null;
  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        position: 'fixed',
        top: 'var(--space-4)',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'var(--warn)',
        color: '#1a1a1a',
        padding: '18px 32px',
        borderRadius: 'var(--radius-md)',
        fontSize: 36,
        fontWeight: 800,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        zIndex: 300,
        animation: 'slidedown var(--dur-med) var(--ease)',
      }}
    >
      ⏰ 5 minutes left!
    </div>
  );
}

/* ---------------- Card (search result / recent video) ---------------- */

interface VideoCardProps {
  thumbnail: string;
  title: string;
  channel: string;
  durationLabel: string;
  fits: boolean;
  isSubscribed?: boolean;
  onSelect: () => void;
  disabled?: boolean;
  layout?: 'list' | 'grid';
}

export const VideoCard = memo(function VideoCard({
  thumbnail,
  title,
  channel,
  durationLabel,
  fits,
  onSelect,
  disabled,
  layout = 'list',
}: VideoCardProps) {
  const { ref, focused } = useFocusable({
    onEnterPress: disabled ? undefined : () => (ref.current as HTMLButtonElement | null)?.click(),
  });

  if (layout === 'grid') {
    return (
      <button
        ref={disabled ? undefined : (ref as React.Ref<HTMLButtonElement>)}
        data-focusable={!disabled || undefined}
        className={focused && !disabled ? 'focused' : undefined}
        disabled={disabled}
        onClick={onSelect}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          width: '100%',
          textAlign: 'left',
          background: 'var(--surface)',
          border: '2px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: 10,
          opacity: disabled ? 0.45 : 1,
        }}
      >
        <div style={{
          position: 'relative', width: '100%', aspectRatio: '16/9',
          borderRadius: 'var(--radius-sm)', overflow: 'hidden', background: 'var(--surface-2)',
        }}>
          <img src={thumbnail} alt="" loading="lazy" decoding="async"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          <span className="tabular" style={{
            position: 'absolute', right: 6, bottom: 6,
            background: 'rgba(0,0,0,0.78)', color: '#fff',
            fontSize: 16, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
          }}>
            {durationLabel}
          </span>
        </div>
        <div style={{
          fontSize: 18, fontWeight: 700, color: 'var(--text)',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          overflow: 'hidden', lineHeight: 1.25,
        }}>
          {title}
        </div>
        <div className="t-meta">{channel}</div>
        {!fits && <Pill color="blocked">✕ too long for today</Pill>}
      </button>
    );
  }

  return (
    <button
      ref={disabled ? undefined : (ref as React.Ref<HTMLButtonElement>)}
      data-focusable={!disabled || undefined}
      className={focused && !disabled ? 'focused' : undefined}
      disabled={disabled}
      onClick={onSelect}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 'var(--space-3)',
        width: '100%',
        textAlign: 'left',
        background: 'var(--surface)',
        border: '2px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-2)',
        opacity: disabled ? 0.45 : 1,
      }}
    >
      <div
        style={{
          position: 'relative',
          flexShrink: 0,
          width: 320,
          height: 180,
          borderRadius: 'var(--radius-sm)',
          overflow: 'hidden',
          background: 'var(--surface-2)',
        }}
      >
        <img
          src={thumbnail}
          alt=""
          loading="lazy"
          decoding="async"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        <span
          className="tabular"
          style={{
            position: 'absolute',
            right: 8,
            bottom: 8,
            background: 'rgba(0,0,0,0.78)',
            color: '#fff',
            fontSize: 18,
            fontWeight: 600,
            padding: '4px 10px',
            borderRadius: 8,
          }}
        >
          {durationLabel}
        </span>
      </div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div
          style={{
            fontSize: 26,
            fontWeight: 600,
            color: 'var(--text)',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {title}
        </div>
        <div className="t-meta">{channel}</div>
        {!fits && (
          <div style={{ marginTop: 'auto', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <Pill color="blocked">✕ too long for today</Pill>
          </div>
        )}
      </div>
    </button>
  );
});

/* ---------------- Modal ---------------- */

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  scrollRef?: React.Ref<HTMLDivElement>;
}

export function Modal({ open, onClose, title, children, scrollRef }: ModalProps) {
  // LRUD boundary: while the modal is open, arrow keys are trapped inside it.
  const { ref, focusKey } = useFocusable({
    focusKey: 'MODAL',
    trackChildren: true,
    isFocusBoundary: open,
  });

  // Move LRUD focus into the modal when it opens.
  useEffect(() => {
    if (open) setFocus('MODAL');
  }, [open]);

  // Back / Escape key closes the modal.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Backspace' || e.key === 'XF86Back' || e.key === 'XF86Stop') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <FocusContext.Provider value={focusKey}>
      <div
        ref={ref as React.Ref<HTMLDivElement>}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 300,
          animation: 'fadein var(--dur-med) var(--ease)',
        }}
        onClick={onClose}
      >
        <div
          ref={scrollRef}
          onClick={(e) => e.stopPropagation()}
          style={{
            background: 'rgba(255,255,255,0.97)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-5)',
            maxWidth: 800,
            width: '90%',
            maxHeight: '85vh',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-3)',
            boxShadow: '0 8px 48px rgba(0,0,0,0.15)',
          }}
        >
          <h2 className="t-h1">{title}</h2>
          {children}
        </div>
      </div>
    </FocusContext.Provider>
  );
}

/* ---------------- LoadingDots ---------------- */

export function LoadingDots() {
  return (
    <div className="t-meta" aria-label="Loading" style={{ display: 'inline-flex', gap: 8 }}>
      <span style={{ animation: 'pulse 1.4s var(--ease) infinite' }}>·</span>
      <span style={{ animation: 'pulse 1.4s var(--ease) 0.2s infinite' }}>·</span>
      <span style={{ animation: 'pulse 1.4s var(--ease) 0.4s infinite' }}>·</span>
    </div>
  );
}

/* ---------------- ScrollNav (page up / page down floating buttons) ---------------- */

interface ScrollNavProps {
  /** ref to the scrollable container element */
  targetRef: React.RefObject<HTMLElement | null>;
  /** distance per click in px; defaults to 80% of viewport height */
  step?: number;
  bottomOffset?: number | string;
}

export function ScrollNav({ targetRef, step, bottomOffset = 'var(--space-4)' }: ScrollNavProps) {
  const scrollBy = (dir: 1 | -1) => {
    const el = targetRef.current;
    if (!el) return;
    const dist = step ?? Math.round(el.clientHeight * 0.8);
    el.scrollBy({ top: dir * dist, behavior: 'smooth' });
  };
  return (
    <div
      style={{
        position: 'fixed',
        right: 'var(--space-4)',
        bottom: bottomOffset,
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-2)',
        zIndex: 90,
      }}
    >
      <Button variant="secondary" onClick={() => scrollBy(-1)} aria-label="Scroll up">▲</Button>
      <Button variant="secondary" onClick={() => scrollBy(1)} aria-label="Scroll down">▼</Button>
    </div>
  );
}

/* ---------------- Global keyframes (injected once) ---------------- */

let injected = false;
function injectKeyframes() {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  const style = document.createElement('style');
  style.textContent = `
    @keyframes pulse {
      0%, 100% { opacity: 0.45; }
      50% { opacity: 1; }
    }
    @keyframes slidedown {
      from { transform: translateY(-100%); }
      to { transform: translateY(0); }
    }
    @keyframes fadein {
      from { opacity: 0; transform: scale(0.96); }
      to   { opacity: 1; transform: scale(1); }
    }
    /* Focus styling lives in index.css — do not duplicate here. */
  `;
  document.head.appendChild(style);
}
injectKeyframes();
