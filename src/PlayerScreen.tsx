import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { WindDownBanner } from './components';
import { incrementVideosWatchedToday, pushRecent } from './storage';
import type { UseBudget } from './useBudget';

interface PlayerProps {
  budgetCtl: UseBudget;
}

// YouTube player state constants (sent via postMessage with enablejsapi=1)
const YT_ENDED = 0;
const YT_PLAYING = 1;
const YT_PAUSED = 2;

export function PlayerScreen({ budgetCtl }: PlayerProps) {
  const { videoId } = useParams<{ videoId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const knownDuration = Number(searchParams.get('d') ?? '0');
  const title = searchParams.get('title') ?? '';
  const channelTitle = searchParams.get('channel') ?? '';

  const [showTwoMin, setShowTwoMin] = useState(false);
  const [showThirtySec, setShowThirtySec] = useState(false);
  const [maskEndScreen, setMaskEndScreen] = useState(false);

  // Start budget timer and record this video as watched immediately on mount.
  // Direct iframe approach: no JS API to wait for — budget starts right away.
  useEffect(() => {
    if (!videoId) return;
    budgetCtl.startTicking();
    incrementVideosWatchedToday();
    pushRecent({
      id: videoId,
      title: title || 'YouTube Video',
      channelTitle,
      channelId: '',
      thumbnail: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
      durationSeconds: knownDuration,
      watchedAt: Date.now(),
    });
    return () => budgetCtl.stopTicking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  // Listen for YouTube player state via postMessage (requires enablejsapi=1 in src).
  // YouTube sends: { event: 'infoDelivery', info: { playerState: N } }
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        const state: number | undefined = data?.info?.playerState ?? data?.playerState;
        if (state === YT_PLAYING) {
          budgetCtl.startTicking();
        } else if (state === YT_PAUSED) {
          budgetCtl.stopTicking();
        } else if (state === YT_ENDED) {
          navigate('/', { replace: true });
        }
      } catch { /* ignore non-JSON messages */ }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [navigate, budgetCtl]);

  // Wind-down banners + end-screen mask, polled on a timer.
  const remainingRef = useRef(budgetCtl.remaining);
  useEffect(() => { remainingRef.current = budgetCtl.remaining; }, [budgetCtl.remaining]);

  useEffect(() => {
    const start = Date.now();
    const id = window.setInterval(() => {
      const elapsed = (Date.now() - start) / 1000;
      if (knownDuration > 0) {
        const remainingInVideo = Math.max(0, knownDuration - elapsed);
        setMaskEndScreen(remainingInVideo > 0 && remainingInVideo <= 25);
      }
      const budgetRemaining = remainingRef.current;
      setShowTwoMin(budgetRemaining >= 110 && budgetRemaining <= 130);
      setShowThirtySec(budgetRemaining >= 25 && budgetRemaining <= 35);
    }, 2000);
    return () => clearInterval(id);
  }, [knownDuration]);

  // Back key returns home
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Backspace' || e.key === 'Escape' || e.key === 'XF86Back') {
        e.preventDefault();
        navigate('/', { replace: true });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate]);

  const bannerText = showTwoMin
    ? '2 minutes left — this video will finish'
    : showThirtySec
    ? '30 seconds left — this video will finish'
    : '';

  if (!videoId) return null;

  // Use youtube-nocookie.com — not intercepted by Samsung's native YouTube deep-link handler.
  // enablejsapi=1 + origin allows postMessage state events without the IFrame JS API library.
  const origin = window.location.origin || 'https://tv-budget.vercel.app';
  const src =
    `https://www.youtube-nocookie.com/embed/${videoId}` +
    `?autoplay=1&rel=0&modestbranding=1&iv_load_policy=3` +
    `&fs=0&controls=1&playsinline=1` +
    `&enablejsapi=1&origin=${encodeURIComponent(origin)}`;

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000' }}>
      <iframe
        src={src}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
        allow="autoplay; fullscreen"
        allowFullScreen
        title="YouTube video"
      />

      {/* End-screen mask: blocks bottom-right area where YouTube end cards appear */}
      {maskEndScreen && (
        <>
          <div
            aria-hidden
            style={{
              position: 'absolute',
              right: 0,
              bottom: 0,
              width: '32%',
              height: '70%',
              background: 'linear-gradient(to top left, rgba(0,0,0,0.85), rgba(0,0,0,0))',
              pointerEvents: 'auto',
              zIndex: 50,
            }}
            onClick={(e) => e.preventDefault()}
          />
          <div
            aria-hidden
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              height: '25%',
              background: 'linear-gradient(to top, rgba(0,0,0,0.7), rgba(0,0,0,0))',
              pointerEvents: 'none',
              zIndex: 49,
            }}
          />
        </>
      )}

      <WindDownBanner show={!!bannerText} text={bannerText} />
    </div>
  );
}
