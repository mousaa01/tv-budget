import { setFocus, useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, LoadingDots, VideoCard } from './components';
import { formatMMSS } from './format';
import { loadSettings, loadSubscribedChannels } from './storage';
import type { VideoResult } from './types';
import type { UseBudget } from './useBudget';
import { applyBlocklist, partitionByDuration, searchVideos } from './youtube';

interface SearchProps {
  budgetCtl: UseBudget;
}

export function SearchScreen({ budgetCtl }: SearchProps) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const query = params.get('q') ?? '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fits, setFits] = useState<VideoResult[]>([]);
  const [tooLong, setTooLong] = useState<VideoResult[]>([]);
  const [subscribedSet, setSubscribedSet] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const settings = loadSettings();
    const subscribed = loadSubscribedChannels();
    setSubscribedSet(new Set(subscribed?.channels.map((c) => c.id) ?? []));

    // Only fan-out per channel for the small manual allowlist.
    // Subscriptions are used for badging only â€” not filtering â€” to avoid
    // burning 1 quota unit per subscribed channel on every search.
    searchVideos(query, {
      channelIds: settings.channelAllowlist.length > 0 ? settings.channelAllowlist : undefined,
    })
      .then((raw) => {
        if (cancelled) return;
        const filtered = applyBlocklist(raw, settings.blocklistKeywords);
        const split = partitionByDuration(filtered, budgetCtl.remaining);
        setFits(split.fits);
        setTooLong(split.tooLong);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Search failed');
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [query, budgetCtl.remaining]);

  // Screen-level LRUD container.
  const { ref: screenRef } = useFocusable({
    focusKey: 'SEARCH_SCREEN',
    trackChildren: true,
    saveLastFocusedChild: true,
  });

  // Focus the Back button as soon as this screen mounts.
  useEffect(() => {
    setFocus('SEARCH_BACK');
  }, []);

  return (
    <div
      ref={screenRef as React.Ref<HTMLDivElement>}
      style={{
        height: '100%',
        padding: 'var(--space-6)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-3)',
      }}
    >
      <header style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        <Button id="SEARCH_BACK" variant="secondary" onClick={() => navigate('/')}>
          â† Back
        </Button>
        <div className="t-h1">{query}</div>
      </header>

      <main className="scroll-list" style={{ flex: 1, minHeight: 0, paddingRight: 'var(--space-2)' }}>
        {loading && <LoadingDots />}
        {error && (
          <div style={{ color: 'var(--danger)', padding: 'var(--space-3)' }}>
            Couldnâ€™t search â€” try again.
          </div>
        )}

        {!loading && !error && fits.length === 0 && (
          <div className="t-body">No results for â€œ{query}â€.</div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {fits.map((v) => (
            <VideoCard
              key={v.id}
              thumbnail={v.thumbnail}
              title={v.title}
              channel={v.channelTitle}
              durationLabel={formatMMSS(v.durationSeconds)}
              fits
              isSubscribed={subscribedSet.has(v.channelId)}
              onSelect={() => navigate(`/play/${v.id}?d=${v.durationSeconds}&title=${encodeURIComponent(v.title)}&channel=${encodeURIComponent(v.channelTitle)}`)}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
