import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, LoadingDots, VideoCard } from './components';
import { formatMMSS, formatHMS } from './format';
import { loadRecent } from './storage';
import type { RecentVideo } from './types';
import type { UseBudget } from './useBudget';

interface HomeProps {
  budgetCtl: UseBudget;
  onOpenSettings: () => void;
}

export function HomeScreen({ budgetCtl, onOpenSettings }: HomeProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [recent, setRecent] = useState<RecentVideo[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setRecent(loadRecent());
    inputRef.current?.focus();
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
        padding: 'var(--space-6)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-4)',
      }}
    >
      <header>
        <h1 className="t-display gradient-text">📺 TV Budget</h1>
        <p className="t-h2" style={{ color: 'var(--text-dim)', marginTop: 'var(--space-2)' }}>
          {budgetCtl.noNewVideos
            ? "You're all done for today — come back tomorrow!"
            : `${remainingLabel} left today`}
        </p>
      </header>

      <form onSubmit={onSubmit} style={{ width: '100%', maxWidth: 1400 }}>
        <input
          ref={inputRef}
          data-focusable
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="What do you want to watch?"
          aria-label="Search videos"
          style={{
            width: '100%',
            height: 96,
            padding: '0 var(--space-3)',
            background: 'var(--surface)',
            border: '3px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text)',
            fontSize: 32,
            outline: 'none',
            transition: 'border-color var(--dur-fast) var(--ease)',
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
          onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
        />
      </form>

      <section style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <h2 className="t-h2" style={{ color: 'var(--accent)' }}>▶ Recently watched</h2>
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
            }}
          >
            {recent.map((r) => (
              <div key={r.id} style={{ flex: '0 0 360px' }}>
                <VideoCard
                  thumbnail={r.thumbnail}
                  title={r.title}
                  channel={r.channelTitle}
                  durationLabel={formatMMSS(r.durationSeconds)}
                  fits={r.durationSeconds <= budgetCtl.remaining}
                  disabled={r.durationSeconds > budgetCtl.remaining}
                  onSelect={() => navigate(`/play/${r.id}?d=${r.durationSeconds}`)}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      <footer style={{ display: 'flex', justifyContent: 'flex-end' }}>
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
