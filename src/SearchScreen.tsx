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

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const settings = loadSettings();
    const subscribed = loadSubscribedChannels();
    const allChannelIds = [
      ...settings.channelAllowlist,
      ...(subscribed?.channelIds ?? []),
    ];

    searchVideos(query, {
      channelIds: allChannelIds.length > 0 ? allChannelIds : undefined,
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

  return (
    <div
      style={{
        height: '100%',
        padding: 'var(--space-6)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-3)',
      }}
    >
      <header style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        <Button variant="secondary" autoFocus onClick={() => navigate('/')}>
          ← Back
        </Button>
        <div>
          <div className="t-meta">Showing results for</div>
          <div className="t-h1">{query}</div>
        </div>
      </header>

      <main className="scroll-list" style={{ flex: 1, minHeight: 0, paddingRight: 'var(--space-2)' }}>
        {loading && <LoadingDots />}
        {error && (
          <div style={{ color: 'var(--danger)', padding: 'var(--space-3)' }}>
            Couldn't search: {error}
            <div className="t-meta" style={{ marginTop: 'var(--space-2)' }}>
              Make sure VITE_YT_API_KEY is set in your .env file.
            </div>
          </div>
        )}

        {!loading && !error && fits.length === 0 && tooLong.length === 0 && (
          <div className="t-body">
            No videos found that fit in your time. Try a shorter search?
          </div>
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
              onSelect={() => navigate(`/play/${v.id}?d=${v.durationSeconds}`)}
            />
          ))}
        </div>

        {tooLong.length > 0 && (
          <>
            <div
              className="t-meta"
              style={{
                borderTop: '2px solid var(--border)',
                marginTop: 'var(--space-4)',
                paddingTop: 'var(--space-3)',
              }}
            >
              Too long for today
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {tooLong.map((v) => (
                <VideoCard
                  key={v.id}
                  thumbnail={v.thumbnail}
                  title={v.title}
                  channel={v.channelTitle}
                  durationLabel={formatMMSS(v.durationSeconds)}
                  fits={false}
                  disabled
                  onSelect={() => undefined}
                />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
