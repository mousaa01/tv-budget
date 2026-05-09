import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, LoadingDots } from './components';
import { formatMMSS, formatHMS } from './format';
import { loadRecent, loadSubscribedChannels } from './storage';
import type { RecentVideo, SubscribedChannel } from './types';
import type { UseBudget } from './useBudget';

interface HomeProps {
  budgetCtl: UseBudget;
  onOpenSettings: () => void;
}

export function HomeScreen({ budgetCtl, onOpenSettings }: HomeProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [recent, setRecent] = useState<RecentVideo[]>([]);
  const [channels, setChannels] = useState<SubscribedChannel[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setRecent(loadRecent());
    const meta = loadSubscribedChannels();
    setChannels(meta?.channels ?? []);
    // NOTE: do NOT auto-focus the search input — on TV that opens the on-screen
    // keyboard. Focus stays on whatever the spatial nav picks first.
  }, []);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (q.length === 0) return;
    if (budgetCtl.noNewVideos) {
      navigate('/timesup');
      return;
    }
    navigate(`/search?q=${encodeURIComponent(q)}`);
  };

  const remainingLabel =
    budgetCtl.remaining >= 3600 ? formatHMS(budgetCtl.remaining) : formatMMSS(budgetCtl.remaining);

  return (
    <div
      style={{
        height: '100%',
        overflowY: 'auto',
        padding: 'var(--space-5) var(--space-6) var(--space-4)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-4)',
      }}
    >
      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 className="t-display" style={{ color: 'var(--accent)' }}>
            <span className="wiggle" style={{ display: 'inline-block', marginRight: 8 }}>🍎</span>
            Adam's Apple
          </h1>
          <p className="t-h2" style={{ color: 'var(--text-dim)', marginTop: 'var(--space-2)' }}>
            {budgetCtl.noNewVideos
              ? "🎈 You're all done for today — come back tomorrow!"
              : `⏰ ${remainingLabel} of fun left today!`}
          </p>
        </div>
        <Button variant="secondary" onClick={onOpenSettings} style={{ flexShrink: 0 }}>
          ⚙ Settings
        </Button>
      </header>

      <form
        onSubmit={onSubmit}
        style={{ width: '100%', maxWidth: 1400, position: 'relative' }}
      >
        {/* Visible "button" the spatial nav can land on without opening the IME.
            Pressing Enter focuses the real input (which then opens the keyboard). */}
        <button
          type="button"
          data-focusable
          onClick={() => inputRef.current?.focus()}
          style={{
            width: '100%',
            height: 96,
            padding: '0 var(--space-3)',
            background: 'var(--surface)',
            border: '3px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            color: query ? 'var(--text)' : 'var(--text-dim)',
            fontSize: 32,
            fontWeight: 700,
            textAlign: 'left',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <span style={{ fontSize: 36 }}>🔍</span>
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {query || 'What do you want to watch?'}
          </span>
        </button>
        {/* The real input — hidden until focused. tabIndex=-1 keeps spatial nav off it. */}
        <input
          ref={inputRef}
          tabIndex={-1}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onBlur={() => { /* keep value; user pressed Back/Done */ }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              inputRef.current?.blur();
            }
          }}
          aria-label="Search videos"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: 96,
            padding: '0 var(--space-3) 0 60px',
            background: 'var(--surface)',
            border: '3px solid var(--accent)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text)',
            fontSize: 32,
            // Hide the input until it has focus so we don't show duplicate UI
            opacity: 0,
            pointerEvents: 'none',
          }}
          onFocus={(e) => {
            e.currentTarget.style.opacity = '1';
            e.currentTarget.style.pointerEvents = 'auto';
          }}
          onBlurCapture={(e) => {
            e.currentTarget.style.opacity = '0';
            e.currentTarget.style.pointerEvents = 'none';
          }}
        />
      </form>

      {/* Subscribed channels row — always shown if signed in */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <h2 className="t-h2" style={{ color: 'var(--accent-3)' }}>
          ⭐ Your channels {channels.length > 0 && `(${channels.length})`}
        </h2>
        {channels.length === 0 ? (
          <div
            style={{
              padding: 'var(--space-3)',
              background: 'rgba(245,158,11,0.12)',
              border: '2px solid rgba(245,158,11,0.4)',
              borderRadius: 'var(--radius-md)',
              color: '#92400e',
              fontSize: 18,
              lineHeight: 1.5,
            }}
          >
            <strong>No channels imported yet.</strong> If you just signed in and expected to see
            channels here, check the browser console (F12) for errors. Common causes:
            <ul style={{ marginTop: 8, paddingLeft: 24 }}>
              <li>Subscriptions are private (YouTube → Settings → Privacy)</li>
              <li>The YouTube readonly scope was unchecked during sign-in</li>
              <li>The signed-in account has no subscriptions</li>
            </ul>
            <div style={{ marginTop: 12 }}>
              Open Settings → YouTube account → Refresh subscriptions to retry, or Disconnect to sign in again.
            </div>
          </div>
        ) : (
          <div
            className="scroll-list"
            style={{
              display: 'flex',
              gap: 'var(--space-2)',
              overflowX: 'auto',
              paddingBottom: 'var(--space-1)',
            }}
          >
            {channels.map((c) => (
              <button
                key={c.id}
                data-focusable
                onClick={() => navigate(`/search?q=${encodeURIComponent(c.title)}`)}
                title={c.title}
                style={{
                  flex: '0 0 140px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                  padding: 12,
                  background: 'var(--surface)',
                  border: '2px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                }}
              >
                <img
                  src={c.thumbnail}
                  alt=""
                  loading="lazy"
                  style={{
                    width: 88,
                    height: 88,
                    borderRadius: '50%',
                    objectFit: 'cover',
                    background: 'var(--surface-2)',
                  }}
                />
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: 'var(--text)',
                    textAlign: 'center',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    lineHeight: 1.2,
                    minHeight: 36,
                  }}
                >
                  {c.title}
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <h2 className="t-h2" style={{ color: 'var(--accent)' }}>▶ Recently watched 🎥</h2>
        {recent.length === 0 ? (
          <div className="t-meta">Search for something to watch above ☝</div>
        ) : (
          <div
            className="scroll-list"
            style={{
              display: 'flex',
              gap: 'var(--space-3)',
              overflowX: 'auto',
              paddingBottom: 'var(--space-2)',
              alignItems: 'flex-start',
            }}
          >
            {recent.map((r) => {
              const disabled = r.durationSeconds > budgetCtl.remaining;
              return (
                <button
                  key={r.id}
                  data-focusable={!disabled || undefined}
                  disabled={disabled}
                  onClick={() => navigate(`/play/${r.id}?d=${r.durationSeconds}`)}
                  style={{
                    flex: '0 0 260px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    background: 'var(--surface)',
                    border: '2px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    padding: 10,
                    textAlign: 'left',
                    opacity: disabled ? 0.5 : 1,
                    cursor: disabled ? 'default' : 'pointer',
                  }}
                >
                  <div style={{
                    width: '100%',
                    aspectRatio: '16/9',
                    borderRadius: 'var(--radius-sm)',
                    overflow: 'hidden',
                    background: 'var(--surface-2)',
                    position: 'relative',
                    flexShrink: 0,
                  }}>
                    <img
                      src={r.thumbnail}
                      alt=""
                      loading="lazy"
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                    <span className="tabular" style={{
                      position: 'absolute', right: 6, bottom: 6,
                      background: 'rgba(0,0,0,0.72)', color: '#fff',
                      fontSize: 16, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                    }}>
                      {formatMMSS(r.durationSeconds)}
                    </span>
                  </div>
                  <div style={{
                    fontSize: 18, fontWeight: 700, color: 'var(--text)',
                    display: '-webkit-box', WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical', overflow: 'hidden',
                  }}>
                    {r.title}
                  </div>
                  <div style={{ fontSize: 16, color: 'var(--text-dim)', fontWeight: 600 }}>
                    {r.channelTitle}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <footer style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'auto' }}>
        <Button variant="secondary" onClick={onOpenSettings}>
          ⚙ Settings
        </Button>
      </footer>
    </div>
  );
}

export function LoadingScreen() {
  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--space-2)',
      }}
    >
      <LoadingDots />
    </div>
  );
}
