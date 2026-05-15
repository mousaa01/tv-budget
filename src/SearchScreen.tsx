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
  const [tooLong, setTooLong] = useState<VideoResult[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>(undefined);
  const [subscribedSet, setSubscribedSet] = useState<Set<string>>(new Set());
  // Auto-pagination: when channel feeds return 0 eligible videos (e.g. the
  // most recent uploads are all Shorts, or all longer than the remaining
  // budget), keep paging through until we find some. Capped to keep YouTube
  // quota and TV CPU bounded — 8 pages × 50 = up to 400 videos scanned.
  const autoPagesRef = useRef(0);
  const MAX_AUTO_PAGES = 8;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setFits([]);
    setTooLong([]);
    setNextPageToken(undefined);
    autoPagesRef.current = 0;
    const settings = loadSettings();
    const subscribed = loadSubscribedChannels();
    setSubscribedSet(new Set(subscribed?.channels.map((c) => c.id) ?? []));

    const run = isChannelMode
      ? fetchChannelFeed(channelId).then((page) => {
          const filtered = applyBlocklist(page.videos, settings.blocklistKeywords);
          const split = partitionByDuration(filtered, budgetCtl.remaining);
          if (cancelled) return;
          setFits(split.fits);
          setTooLong(split.tooLong);
          setNextPageToken(page.nextPageToken);
        })
      : searchVideos(query, {
          channelIds: settings.channelAllowlist.length > 0 ? settings.channelAllowlist : undefined,
        }).then((raw) => {
          if (cancelled) return;
          const filtered = applyBlocklist(raw, settings.blocklistKeywords);
          const split = partitionByDuration(filtered, budgetCtl.remaining);
          setFits(split.fits);
          setTooLong(split.tooLong);
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

  const loadMore = (auto = false) => {
    if (!isChannelMode || !nextPageToken || loadingMore) return;
    if (auto) {
      // Increment up-front so concurrent / rapid effect re-runs all see the
      // latest count and the cap is honored even if state batching delays
      // the loadingMore flag.
      if (autoPagesRef.current >= MAX_AUTO_PAGES) return;
      autoPagesRef.current += 1;
    }
    setLoadingMore(true);
    const settings = loadSettings();
    fetchChannelFeed(channelId, nextPageToken)
      .then((page) => {
        const filtered = applyBlocklist(page.videos, settings.blocklistKeywords);
        const split = partitionByDuration(filtered, budgetCtl.remaining);
        setFits((prev) => [...prev, ...split.fits]);
        setTooLong((prev) => [...prev, ...split.tooLong]);
        setNextPageToken(page.nextPageToken);
      })
      .catch((e: unknown) => {
        // Surface the failure so the user knows pagination stopped and why.
        setError(e instanceof Error ? e.message : 'Loading more videos failed');
        // Clear the token so we don't keep trying the same broken page.
        setNextPageToken(undefined);
      })
      .finally(() => setLoadingMore(false));
  };

  // Auto-pagination effect: while there are NO playable videos in view and
  // more pages exist, fetch the next one. We keep going even if `tooLong`
  // has entries — the user wants something they can watch *now*, so we must
  // keep searching forward through the channel's history until we find a
  // video that fits the remaining budget. Bounded by MAX_AUTO_PAGES.
  useEffect(() => {
    if (loading || loadingMore || error) return;
    if (!isChannelMode || !nextPageToken) return;
    if (fits.length > 0) return;
    if (autoPagesRef.current >= MAX_AUTO_PAGES) return;
    loadMore(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, loadingMore, error, isChannelMode, nextPageToken, fits.length]);

  // True while we're still auto-paginating in search of a playable video.
  // During this window we suppress the too-long disabled cards so the user
  // doesn't see a flash of "can't-watch" content before fits have loaded.
  // Auto-pagination only runs in channel mode when fits.length === 0, so
  // this is always false in keyword-search mode (isChannelMode = false).
  const isStillLooking =
    isChannelMode &&
    fits.length === 0 &&
    (loading || loadingMore || (!!nextPageToken && autoPagesRef.current < MAX_AUTO_PAGES));

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
            Couldn't load videos — {error}
          </div>
        )}

        {!loading && !error && fits.length === 0 && tooLong.length === 0 && !isStillLooking && (
          <div className="t-body">
            {isChannelMode
              ? `No videos from ${channelTitle} right now.`
              : `No results for "${query}".`}
          </div>
        )}

        {/* In channel mode: when nothing fits, say why — don't show greyed cards. */}
        {!loading && !error && isChannelMode && fits.length === 0 && tooLong.length > 0 && !isStillLooking && (
          <div className="t-body">
            All videos from {channelTitle} are longer than your remaining time ({formatMMSS(budgetCtl.remaining)}).
            Ask a parent for more time!
          </div>
        )}

        {/* In keyword-search mode only: keep showing too-long results so the
            user can see what's available and ask for more time. */}
        {!loading && !error && !isChannelMode && fits.length === 0 && tooLong.length > 0 && (
          <div className="t-body" style={{ marginBottom: 'var(--space-3)' }}>
            None of these videos fit your remaining {formatMMSS(budgetCtl.remaining)}.
            They’re shown below so you can see what’s available — ask a parent for more time, or come back tomorrow.
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
          {/* Too-long videos rendered as disabled cards only in keyword-search
              mode — channel mode hides them entirely and shows a message instead. */}
          {!isStillLooking && !isChannelMode && tooLong.map((v) => (
            <VideoCard
              key={`long-${v.id}`}
              thumbnail={v.thumbnail}
              title={v.title}
              channel={v.channelTitle}
              durationLabel={formatMMSS(v.durationSeconds)}
              fits={false}
              disabled
              isSubscribed={subscribedSet.has(v.channelId)}
              layout={isChannelMode ? 'grid' : 'list'}
              onSelect={() => { /* disabled */ }}
            />
          ))}
          {isChannelMode && nextPageToken && !loading && (
            <div style={{ gridColumn: '1 / -1', padding: 'var(--space-3) 0', display: 'flex', justifyContent: 'center' }}>
              <Button variant="secondary" onClick={() => loadMore(false)}>
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
