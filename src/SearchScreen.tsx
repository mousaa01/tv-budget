import { setFocus, useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, LoadingDots, ScrollNav, VideoCard } from './components';
import { formatMMSS } from './format';
import { loadSettings, loadSubscribedChannels } from './storage';
import type { VideoResult } from './types';
import type { UseBudget } from './useBudget';
import { applyBlocklist, fetchChannelFeed, partitionByDuration, searchVideos } from './youtube';

interface SearchProps {
  budgetCtl: UseBudget;
}

export function SearchScreen({ budgetCtl }: SearchProps) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const query = params.get('q') ?? '';
  const channelId = params.get('channelId') ?? '';
  const channelTitle = params.get('title') ?? '';
  const isChannelMode = channelId.length > 0;

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fits, setFits] = useState<VideoResult[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>(undefined);
  const [subscribedSet, setSubscribedSet] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setFits([]);
    setNextPageToken(undefined);
    const settings = loadSettings();
    const subscribed = loadSubscribedChannels();
    setSubscribedSet(new Set(subscribed?.channels.map((c) => c.id) ?? []));

    const run = isChannelMode
      ? fetchChannelFeed(channelId).then((page) => {
          const filtered = applyBlocklist(page.videos, settings.blocklistKeywords);
          const split = partitionByDuration(filtered, budgetCtl.remaining);
          if (cancelled) return;
          setFits(split.fits);
          setNextPageToken(page.nextPageToken);
        })
      : searchVideos(query, {
          channelIds: settings.channelAllowlist.length > 0 ? settings.channelAllowlist : undefined,
        }).then((raw) => {
          if (cancelled) return;
          const filtered = applyBlocklist(raw, settings.blocklistKeywords);
          const split = partitionByDuration(filtered, budgetCtl.remaining);
          setFits(split.fits);
        });

    run
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
  }, [query, channelId, isChannelMode, budgetCtl.remaining]);

  const loadMore = () => {
    if (!isChannelMode || !nextPageToken || loadingMore) return;
    setLoadingMore(true);
    const settings = loadSettings();
    fetchChannelFeed(channelId, nextPageToken)
      .then((page) => {
        const filtered = applyBlocklist(page.videos, settings.blocklistKeywords);
        const split = partitionByDuration(filtered, budgetCtl.remaining);
        setFits((prev) => [...prev, ...split.fits]);
        setNextPageToken(page.nextPageToken);
      })
      .catch(() => {
        /* ignore */
      })
      .finally(() => setLoadingMore(false));
  };

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

  const mainRef = useRef<HTMLElement>(null);

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
          ← Back
        </Button>
        <div className="t-h1">{isChannelMode ? channelTitle : query}</div>
      </header>

      <main ref={mainRef} className="scroll-list" style={{ flex: 1, minHeight: 0, paddingRight: 'var(--space-2)' }}>
        {loading && <LoadingDots />}
        {error && (
          <div style={{ color: 'var(--danger)', padding: 'var(--space-3)' }}>
            Couldn't search — try again.
          </div>
        )}

        {!loading && !error && fits.length === 0 && (
          <div className="t-body">
            {isChannelMode
              ? `No videos from ${channelTitle} fit the time you have left.`
              : `No results for “${query}”.`}
          </div>
        )}

        <div
          style={
            isChannelMode
              ? {
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 'var(--space-2)',
                  alignItems: 'start',
                }
              : { display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }
          }
        >
          {fits
            .filter((v) => v.durationSeconds <= budgetCtl.remaining)
            .map((v) => (
            <VideoCard
              key={v.id}
              thumbnail={v.thumbnail}
              title={v.title}
              channel={v.channelTitle}
              durationLabel={formatMMSS(v.durationSeconds)}
              fits
              isSubscribed={subscribedSet.has(v.channelId)}
              layout={isChannelMode ? 'grid' : 'list'}
              onSelect={() => {
                // Guard against races: budget may have ticked down between
                // when the list was fetched and the user pressing the card.
                if (v.durationSeconds > budgetCtl.remaining) return;
                navigate(`/play/${v.id}?d=${v.durationSeconds}&title=${encodeURIComponent(v.title)}&channel=${encodeURIComponent(v.channelTitle)}`);
              }}
            />
          ))}
          {isChannelMode && nextPageToken && !loading && (
            <div style={{ gridColumn: '1 / -1', padding: 'var(--space-3) 0', display: 'flex', justifyContent: 'center' }}>
              <Button variant="secondary" onClick={loadMore}>
                {loadingMore ? 'Loading…' : 'Load more videos'}
              </Button>
            </div>
          )}
        </div>
      </main>
      {/* Push above the fixed Settings button (~64px tall + spacing). */}
      <ScrollNav targetRef={mainRef} bottomOffset="calc(var(--space-4) + 88px)" />
    </div>
  );
}
