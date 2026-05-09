import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { WindDownBanner } from './components';
import { incrementVideosWatchedToday, pushRecent } from './storage';
import type { UseBudget } from './useBudget';

interface PlayerProps {
  budgetCtl: UseBudget;
}

// YouTube IFrame API typings (minimal)
interface YTPlayer {
  destroy: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getVideoData: () => { title: string; author: string; video_id: string };
}
interface YTStateEvent {
  data: number;
}
interface YTReadyEvent {
  target: YTPlayer;
}
declare global {
  interface Window {
    YT?: {
      Player: new (
        el: HTMLElement | string,
        opts: {
          videoId: string;
          width?: string | number;
          height?: string | number;
          playerVars?: Record<string, string | number>;
          events?: {
            onReady?: (e: YTReadyEvent) => void;
            onStateChange?: (e: YTStateEvent) => void;
          };
        }
      ) => YTPlayer;
      PlayerState: {
        UNSTARTED: -1;
        ENDED: 0;
        PLAYING: 1;
        PAUSED: 2;
        BUFFERING: 3;
        CUED: 5;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiLoading: Promise<void> | null = null;
function loadYouTubeApi(): Promise<void> {
  if (window.YT && window.YT.Player) return Promise.resolve();
  if (apiLoading) return apiLoading;
  apiLoading = new Promise<void>((resolve) => {
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
    window.onYouTubeIframeAPIReady = () => resolve();
  });
  return apiLoading;
}

export function PlayerScreen({ budgetCtl }: PlayerProps) {
  const { videoId } = useParams<{ videoId: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const knownDuration = Number(params.get('d') ?? '0');

  const [showTwoMin, setShowTwoMin] = useState(false);
  const [showThirtySec, setShowThirtySec] = useState(false);
  const [maskEndScreen, setMaskEndScreen] = useState(false);
  const isPlayingRef = useRef(false);

  // Load API + create player
  useEffect(() => {
    if (!videoId) return;
    let mounted = true;

    loadYouTubeApi().then(() => {
      if (!mounted || !containerRef.current || !window.YT) return;

      playerRef.current = new window.YT.Player(containerRef.current, {
        videoId,
        width: '100%',
        height: '100%',
        playerVars: {
          autoplay: 1,
          rel: 0,
          modestbranding: 1,
          iv_load_policy: 3,
          disablekb: 1,
          fs: 0,
          controls: 1,
          playsinline: 1,
        },
        events: {
          onReady: (e) => {
            try {
              // Cap quality at 720p — saves bandwidth, faster start on Samsung TV browser
              try { (e.target as unknown as { setPlaybackQuality?: (q: string) => void }).setPlaybackQuality?.('hd720'); } catch { /* old API ignored */ }
              const data = e.target.getVideoData();
              const duration = knownDuration || e.target.getDuration() || 0;
              pushRecent({
                id: data.video_id,
                title: data.title,
                channelTitle: data.author,
                channelId: '',
                thumbnail: `https://i.ytimg.com/vi/${data.video_id}/mqdefault.jpg`,
                durationSeconds: duration,
                watchedAt: Date.now(),
              });
              incrementVideosWatchedToday();
            } catch {
              /* ignore */
            }
          },
          onStateChange: (e) => {
            if (!window.YT) return;
            const s = e.data;
            if (s === window.YT.PlayerState.PLAYING) {
              isPlayingRef.current = true;
              budgetCtl.startTicking();
            } else {
              isPlayingRef.current = false;
              budgetCtl.stopTicking();
            }
            if (s === window.YT.PlayerState.ENDED) {
              navigate('/', { replace: true });
            }
          },
        },
      });
    });

    return () => {
      mounted = false;
      budgetCtl.stopTicking();
      try {
        playerRef.current?.destroy();
      } catch {
        /* ignore */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  // Wind-down banners + end-screen mask, polled from currentTime.
  // Use a ref for budgetCtl.remaining so the interval doesn't restart every second.
  const remainingRef = useRef(budgetCtl.remaining);
  useEffect(() => { remainingRef.current = budgetCtl.remaining; }, [budgetCtl.remaining]);

  useEffect(() => {
    const id = window.setInterval(() => {
      const player = playerRef.current;
      if (!player) return;
      let current = 0;
      let duration = knownDuration;
      try {
        current = player.getCurrentTime();
        if (!duration) duration = player.getDuration();
      } catch {
        return;
      }
      const remainingInVideo = Math.max(0, duration - current);
      setMaskEndScreen(remainingInVideo > 0 && remainingInVideo <= 25);

      const budgetRemaining = remainingRef.current;
      setShowTwoMin(budgetRemaining >= 110 && budgetRemaining <= 130);
      setShowThirtySec(budgetRemaining >= 25 && budgetRemaining <= 35);
    }, 2000); // 2s instead of 1s — saves CPU on TV
    return () => clearInterval(id);
  }, [knownDuration]);

  // Back key returns home (never to YT end screen)
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

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#000',
      }}
    >
      {/* className="yt-fill" — CSS forces the YT-injected wrapper div + iframe to cover the container */}
      <div ref={containerRef} className="yt-fill" style={{ position: 'absolute', inset: 0 }} />

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
              background:
                'linear-gradient(to top left, rgba(0,0,0,0.85), rgba(0,0,0,0))',
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
              background:
                'linear-gradient(to top, rgba(0,0,0,0.7), rgba(0,0,0,0))',
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
