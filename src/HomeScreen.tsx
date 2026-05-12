import { setFocus, useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LoadingDots } from './components';
import { formatMMSS, formatHMS } from './format';
import { loadRecent, loadSubscribedChannels } from './storage';
import type { RecentVideo, SubscribedChannel } from './types';
import type { UseBudget } from './useBudget';

// ----------- Focusable sub-components for inline buttons -----------

function SearchPlaceholder({ query, onPress }: { query: string; onPress: () => void }) {
  const { ref, focused } = useFocusable({ onEnterPress: onPress, focusKey: 'HOME_SEARCH' });
  return (
    <button
      ref={ref as React.Ref<HTMLButtonElement>}
      type="button"
      data-focusable
      className={focused ? 'focused' : undefined}
      onClick={onPress}
      style={{
        width: '100%',
        maxWidth: 1400,
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
  );
}

function ChannelButton({ channel, onPress }: { channel: SubscribedChannel; onPress: () => void }) {
  const { ref, focused } = useFocusable({ onEnterPress: onPress });
  return (
    <button
      ref={ref as React.Ref<HTMLButtonElement>}
      data-focusable
      className={focused ? 'focused' : undefined}
      onClick={onPress}
      title={channel.title}
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
        src={channel.thumbnail}
        alt=""
        loading="lazy"
        style={{ width: 88, height: 88, borderRadius: '50%', objectFit: 'cover', background: 'var(--surface-2)' }}
      />
      <div style={{
        fontSize: 15, fontWeight: 700, color: 'var(--text)', textAlign: 'center',
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        overflow: 'hidden', lineHeight: 1.2, minHeight: 36,
      }}>
        {channel.title}
      </div>
    </button>
  );
}

function RecentButton({ video, disabled, onPress }: { video: RecentVideo; disabled: boolean; onPress: () => void }) {
  const { ref, focused } = useFocusable({ onEnterPress: disabled ? undefined : onPress });
  return (
    <button
      ref={disabled ? undefined : (ref as React.Ref<HTMLButtonElement>)}
      data-focusable={!disabled || undefined}
      className={focused && !disabled ? 'focused' : undefined}
      disabled={disabled}
      onClick={onPress}
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
        width: '100%', aspectRatio: '16/9', borderRadius: 'var(--radius-sm)',
        overflow: 'hidden', background: 'var(--surface-2)', position: 'relative', flexShrink: 0,
      }}>
        <img src={video.thumbnail} alt="" loading="lazy"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        <span className="tabular" style={{
          position: 'absolute', right: 6, bottom: 6,
          background: 'rgba(0,0,0,0.72)', color: '#fff',
          fontSize: 16, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
        }}>
          {formatMMSS(video.durationSeconds)}
        </span>
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)',
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {video.title}
      </div>
      <div style={{ fontSize: 16, color: 'var(--text-dim)', fontWeight: 600 }}>
        {video.channelTitle}
      </div>
    </button>
  );
}

interface HomeProps {
  budgetCtl: UseBudget;
}

export function HomeScreen({ budgetCtl }: HomeProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
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

  // Screen-level LRUD container: tracks children so arrow keys stay within the screen.
  const { ref: screenRef } = useFocusable({
    focusKey: 'HOME_SCREEN',
    trackChildren: true,
    saveLastFocusedChild: true,
    preferredChildFocusKey: 'HOME_SEARCH',
  });

  // Explicitly give LRUD focus to the search bar on mount — more reliable than
  // forceFocus on a container because children are registered by the time this runs.
  useEffect(() => {
    setFocus('HOME_SEARCH');
  }, []);

  return (
    <div
      ref={screenRef as React.Ref<HTMLDivElement>}
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
              : `⏰ ${remainingLabel} left today!`}
          </p>
        </div>
      </header>

      {/* Search row.
          IMPORTANT: when searching=false there is NO <input> in the DOM, so the
          on-screen keyboard cannot open from arrow-key navigation. Pressing OK
          on the search button sets searching=true which mounts the input and
          autofocuses it. Esc / submit closes it again. */}
      {!searching ? (
        <SearchPlaceholder query={query} onPress={() => setSearching(true)} />
      ) : (
        <form onSubmit={onSubmit} style={{ width: '100%', maxWidth: 1400 }}>
          <input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                // Spatial-nav swallows Enter as "OK" — handle submit ourselves.
                e.preventDefault();
                e.stopPropagation();
                onSubmit(e as unknown as React.FormEvent);
              } else if (e.key === 'Escape') {
                e.preventDefault();
                setSearching(false);
              } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                // Spatial nav will move focus away; collapse the search input too
                // so the search button reappears.
                setSearching(false);
              }
            }}
            placeholder="What do you want to watch?"
            aria-label="Search videos"
            style={{
              width: '100%',
              height: 96,
              padding: '0 var(--space-3)',
              background: 'var(--surface)',
              border: '3px solid var(--accent)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text)',
              fontSize: 32,
            }}
          />
        </form>
      )}

      {/* Subscribed channels row — always shown if signed in */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <h2 className="t-h2" style={{ color: 'var(--accent-3)' }}>Your channels</h2>
        {channels.length === 0 ? (
          <div className="t-meta" style={{ padding: 'var(--space-1) 0', color: 'var(--text-faint)' }}>
            No subscribed channels found.
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
              <ChannelButton
                key={c.id}
                channel={c}
                onPress={() => navigate(`/search?q=${encodeURIComponent(c.title)}`)}
              />
            ))}
          </div>
        )}
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <h2 className="t-h2" style={{ color: 'var(--accent)' }}>Recently watched</h2>
        {recent.length === 0 ? null : (
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
                <RecentButton
                  key={r.id}
                  video={r}
                  disabled={disabled}
                  onPress={() => navigate(`/play/${r.id}?d=${r.durationSeconds}&title=${encodeURIComponent(r.title)}&channel=${encodeURIComponent(r.channelTitle)}`)}                />
              );
            })}
          </div>
        )}
      </section>
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
