import { memo, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { formatHMS, formatMMSS } from './format';
import { incrementVideosWatchedToday, pushRecent } from './storage';
import type { UseBudget } from './useBudget';

interface PlayerProps {
  budgetCtl: UseBudget;
}

// Detect Tizen (Samsung TV WebView). The `tizen` global is only present on Tizen devices.
function isTizen(): boolean {
  return typeof (window as unknown as { tizen?: unknown }).tizen !== 'undefined';
}

// Launch the native YouTube TV app for a video.
// Uses Tizen ApplicationControl with the YouTube TV web URI, which the OS routes to
// the installed YouTube app (every Samsung TV ships with it). Returns true if launched.
function launchYouTubeTvApp(videoId: string): boolean {
  try {
    const w = window as unknown as {
      tizen?: {
        application: {
          launchAppControl: (
            ctrl: unknown,
            appId: string | null,
            onSuccess: (() => void) | null,
            onError: ((e: unknown) => void) | null,
          ) => void;
          ApplicationControl: new (
            operation: string,
            uri: string | null,
          ) => unknown;
        };
      };
    };
    if (!w.tizen?.application) return false;
    const ctrl = new w.tizen.application.ApplicationControl(
      'http://tizen.org/appcontrol/operation/view',
      `https://www.youtube.com/tv#/watch?v=${videoId}`,
    );
    w.tizen.application.launchAppControl(ctrl, null, null, (e) => {
      console.error('launchAppControl failed:', e);
    });
    return true;
  } catch {
    return false;
  }
}

// â”€â”€â”€ Tizen player â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Launches the native YouTube TV app and shows a budget-timer overlay in our app.
// When the user presses Back in YouTube, the TV OS returns focus to our app,
// which we detect via visibilitychange / pageshow and then navigate home.

interface TizenPlayerProps {
  videoId: string;
  title: string;
  knownDuration: number;
  budgetCtl: UseBudget;
}

function TizenPlayer({ videoId, title, knownDuration, budgetCtl }: TizenPlayerProps) {
  const navigate = useNavigate();
  const [elapsed, setElapsed] = useState(0);
  const launchedRef = useRef(false);

  // Launch native YouTube app once on mount.
  useEffect(() => {
    if (launchedRef.current) return;
    launchedRef.current = true;
    budgetCtl.startTicking();
    incrementVideosWatchedToday();
    const launched = launchYouTubeTvApp(videoId);
    if (!launched) {
      // Tizen API unavailable (shouldn't happen on real TV) â€” go home.
      navigate('/', { replace: true });
    }
    return () => budgetCtl.stopTicking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  // Track elapsed time in our overlay while YouTube app is in foreground.
  useEffect(() => {
    const id = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // When the user presses Back in the YouTube app, the OS returns focus/visibility
  // to our app. Detect this and navigate home so the budget is saved.
  useEffect(() => {
    const onVisible = () => {
      if (!document.hidden) {
        // Video session ended (user pressed Back in YouTube app).
        // Pass true so a sub-2-min budget leftover is consumed rather than
        // left as an unusable orphan.
        budgetCtl.stopTicking(true);
        navigate('/', { replace: true });
      }
    };
    const onPageShow = () => {
      budgetCtl.stopTicking(true); // session ended — consume any sub-2-min leftover
      navigate('/', { replace: true });
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [navigate, budgetCtl]);

  // Budget exhausted — force home. One-shot timeout (remaining no longer ticks per-second).
  useEffect(() => {
    const rem = budgetCtl.remaining;
    if (rem <= 0) {
      budgetCtl.stopTicking();
      navigate('/', { replace: true });
      return;
    }
    const id = window.setTimeout(() => {
      budgetCtl.stopTicking();
      navigate('/', { replace: true });
    }, rem * 1000);
    return () => clearTimeout(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once at mount — remaining sampled at video start

  const remaining = formatMMSS(budgetCtl.remaining);
  const videoElapsed = formatMMSS(elapsed);
  const videoTotal = knownDuration > 0 ? formatMMSS(knownDuration) : '??:??';
  const budgetWarn = budgetCtl.remaining > 0 && budgetCtl.remaining <= 120;

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 32, color: '#fff', fontFamily: 'Nunito, sans-serif',
    }}>
      <div style={{ fontSize: 64 }}>▶</div>
      <div style={{
        fontSize: 28, fontWeight: 800, textAlign: 'center',
        maxWidth: 900, padding: '0 40px',
        color: '#f1f5f9',
      }}>
        {title || 'Playing on YouTube'}
      </div>
      <div style={{ fontSize: 22, color: '#94a3b8' }}>
        {videoElapsed} / {videoTotal}
      </div>

      {/* Budget pill */}
      <div style={{
        padding: '12px 32px', borderRadius: 999,
        background: budgetWarn ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.08)',
        border: `2px solid ${budgetWarn ? '#f59e0b' : 'rgba(255,255,255,0.15)'}`,
        fontSize: 22, fontWeight: 700,
        color: budgetWarn ? '#fbbf24' : '#cbd5e1',
      }}>
        {budgetWarn ? '⚠️ ' : '⏱ '}{remaining} budget remaining
      </div>

      <div style={{ fontSize: 18, color: '#475569', marginTop: 16 }}>
        Press <strong style={{ color: '#94a3b8' }}>Back</strong> on the YouTube app to return here
      </div>
    </div>
  );
}

// â”€â”€â”€ Web (iframe) player â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Used in desktop browsers and dev mode where Tizen isn't available.

const YT_ENDED = 0;
const YT_PLAYING = 1;
const YT_PAUSED = 2;
const YT_BUFFERING = 3;

interface WebPlayerProps {
  videoId: string;
  knownDuration: number;
  budgetCtl: UseBudget;
}

function WebPlayerImpl({ videoId, knownDuration, budgetCtl }: WebPlayerProps) {
  const navigate = useNavigate();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  // Direct-DOM refs — no React state changes during video playback.
  // Updating these avoids React re-renders (and the compositor work they trigger
  // on TV browsers) while still keeping the UI accurate every second.
  const budgetTimerRef = useRef<HTMLSpanElement>(null);
  const maskEndRef = useRef<HTMLDivElement>(null);
  const bannerRef = useRef<HTMLDivElement>(null);
  // Tracks whether the YouTube player is currently playing so the visual timer
  // loop only counts down during actual playback (not while paused or buffering).
  const isPlayingRef = useRef(false);

  useEffect(() => {
    // Do NOT start ticking on mount — budget only drains during actual playback.
    // The YT_PLAYING message handler calls startTicking() when the video plays.
    // This prevents budget drain during initial buffering and mid-video buffering.
    return () => budgetCtl.stopTicking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  // Register as a YouTube postMessage listener so the iframe sends us
  // playerState events (PLAYING / PAUSED / ENDED). Without this, no events fire.
  useEffect(() => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    const subscribe = () => {
      try {
        win.postMessage(JSON.stringify({ event: 'listening', id: videoId }), '*');
        win.postMessage(JSON.stringify({ event: 'command', func: 'addEventListener', args: ['onStateChange'] }), '*');
      } catch { /* ignore */ }
    };
    // Send immediately and again after iframe load to catch both timings.
    const t = window.setTimeout(subscribe, 500);
    iframeRef.current?.addEventListener('load', subscribe);
    return () => {
      window.clearTimeout(t);
      iframeRef.current?.removeEventListener('load', subscribe);
    };
  }, [videoId]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        const state: number | undefined = data?.info?.playerState ?? data?.playerState;
        if (state === YT_PLAYING) {
          isPlayingRef.current = true;
          budgetCtl.startTicking();
        } else if (state === YT_PAUSED) {
          isPlayingRef.current = false;
          budgetCtl.stopTicking(); // mid-video — do NOT consume sub-2-min remainder
        } else if (state === YT_BUFFERING) {
          isPlayingRef.current = false;
          budgetCtl.stopTicking(); // buffering — pause timer, do NOT consume sub-2-min remainder
        } else if (state === YT_ENDED) {
          isPlayingRef.current = false;
          // Video completed naturally. Consume any sub-2-min budget leftover
          // before navigating so the child isn't stranded with unusable seconds.
          budgetCtl.stopTicking(true);
          navigate('/', { replace: true });
        }
      } catch { /* ignore */ }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  // startTicking and stopTicking are stable useCallback refs — this effect
  // registers once and never needs to re-register.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, budgetCtl.startTicking, budgetCtl.stopTicking]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Backspace' || e.key === 'Escape') {
        e.preventDefault();
        navigate('/', { replace: true });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate]);

  // All per-second UI updates go through direct DOM refs — zero React
  // re-renders during video playback.
  // DOM mutations are deferred to the next requestAnimationFrame so they land
  // at vsync rather than mid-frame. This prevents the compositor from stalling
  // while it re-evaluates overlay layers during a video frame decode, which was
  // the root cause of visual jumps/cuts (audio was unaffected because it decodes
  // on a separate thread).
  useEffect(() => {
    const startRemaining = budgetCtl.remaining;
    const startDuration = knownDuration;
    // Accumulated milliseconds of actual playback (excludes paused/buffering time).
    let accumulatedMs = 0;
    // Wall-clock time of the last tick — used to compute the delta on each tick.
    let lastCheckTime = Date.now();
    let rafId: number | null = null;

    const tick = () => {
      try {
        const now = Date.now();
        // Advance the counter only while the video is actually playing.
        if (isPlayingRef.current) {
          accumulatedMs += now - lastCheckTime;
        }
        lastCheckTime = now;

        const elapsedSec = accumulatedMs / 1000;
        const rem = Math.max(0, startRemaining - elapsedSec);

        // Live budget countdown in the player corner
        if (budgetTimerRef.current) {
          budgetTimerRef.current.textContent = `⏱ ${rem >= 3600 ? formatHMS(rem) : formatMMSS(rem)} left`;
          budgetTimerRef.current.style.color = rem <= 120 ? '#fbbf24' : 'rgba(255,255,255,0.85)';
        }

        // End-screen gradient mask (hides YouTube's autoplay suggestions)
        if (maskEndRef.current && startDuration > 0) {
          maskEndRef.current.style.display =
            Math.max(0, startDuration - elapsedSec) <= 25 ? 'block' : 'none';
        }

        // Wind-down banner
        if (bannerRef.current) {
          const show2min = rem >= 110 && rem <= 130;
          const show30sec = rem >= 25 && rem <= 35;
          if (show2min || show30sec) {
            bannerRef.current.style.display = 'block';
            bannerRef.current.textContent = show2min
              ? '2 minutes left — this video will finish'
              : '30 seconds left — this video will finish';
          } else {
            bannerRef.current.style.display = 'none';
          }
        }
      } catch { /* ignore — DOM refs may be null during unmount */ }
    };

    // Schedule DOM mutations at the next animation frame so they are
    // committed at vsync, preventing mid-frame compositor invalidation.
    const scheduledTick = () => {
      rafId = requestAnimationFrame(() => tick());
    };

    scheduledTick(); // set initial state immediately
    const id = window.setInterval(scheduledTick, 1000);
    return () => {
      clearInterval(id);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // isPlayingRef is a stable ref — no need in deps; all values captured at mount

  const origin = window.location.origin || 'https://tv-budget.vercel.app';
  const src =
    `https://www.youtube-nocookie.com/embed/${videoId}` +
    `?autoplay=1&rel=0&modestbranding=1&iv_load_policy=3&fs=0&controls=1&playsinline=1` +
    `&enablejsapi=1&origin=${encodeURIComponent(origin)}`;

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000' }}>
      <iframe
        ref={iframeRef}
        src={src}
        style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none',
          // Keep the video on its own GPU compositing layer so that style
          // mutations on the overlay elements (timer, banner) do not
          // invalidate the video layer and cause dropped frames.
          willChange: 'transform',
        }}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
        title="YouTube video"
      />
      {/* End-screen gradient mask — hidden by default, shown via direct DOM */}
      <div
        ref={maskEndRef}
        aria-hidden
        style={{
          display: 'none',
          position: 'absolute', right: 0, bottom: 0, width: '32%', height: '70%',
          background: 'linear-gradient(to top left, rgba(0,0,0,0.85), rgba(0,0,0,0))',
          pointerEvents: 'auto', zIndex: 50,
        }}
        onClick={(e) => e.preventDefault()}
      />
      {/* Transparent click-shield over YouTube's top bar (title + channel chip)
          so taps there don't open YouTube — without hiding any video pixels. */}
      <div aria-hidden style={{
        position: 'absolute', left: 0, right: 0, top: 0,
        height: 80,
        background: 'transparent',
        pointerEvents: 'auto', zIndex: 49,
      }} onClick={(e) => { e.preventDefault(); e.stopPropagation(); }} />
      {/* Transparent click-shield over the bottom region — covers YouTube's
          control bar and "More videos" rail. Kept under 40% to avoid forcing
          a large transparent compositing layer over the video on slower TVs. */}
      <div aria-hidden style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        height: '35%',
        background: 'transparent',
        pointerEvents: 'auto', zIndex: 49,
      }} onClick={(e) => { e.preventDefault(); e.stopPropagation(); }} />
      {/* Budget countdown — corner badge, updated every second via direct DOM */}
      <span
        ref={budgetTimerRef}
        className="tabular"
        aria-label="Budget remaining"
        style={{
          position: 'absolute', top: 16, left: 16,
          background: 'rgba(0,0,0,0.60)',
          padding: '6px 16px', borderRadius: 999,
          fontSize: 20, fontWeight: 700, zIndex: 60,
          pointerEvents: 'none',
          color: 'rgba(255,255,255,0.85)',
        }}
      />
      {/* Wind-down banner — shown/hidden via direct DOM, zero React re-renders */}
      <div
        ref={bannerRef}
        role="status"
        style={{
          display: 'none',
          position: 'fixed',
          top: 0, left: 0, right: 0,
          background: 'rgba(15,15,15,0.92)',
          borderLeft: '8px solid var(--warn)',
          padding: 'var(--space-3) var(--space-6)',
          fontSize: 28,
          fontWeight: 600,
          color: 'var(--text)',
          zIndex: 200,
        }}
      />
    </div>
  );
}

// Memoized: only re-render when the video changes.
// budgetCtl reference changes on stopTicking/startTicking but WebPlayer reads
// time-sensitive values through direct DOM refs — no re-render needed.
const WebPlayer = memo(WebPlayerImpl, (prev, next) => prev.videoId === next.videoId);

// â”€â”€â”€ Route component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function PlayerScreen({ budgetCtl }: PlayerProps) {
  const { videoId } = useParams<{ videoId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const knownDuration = Number(searchParams.get('d') ?? '0');
  const title = searchParams.get('title') ?? '';
  const channelTitle = searchParams.get('channel') ?? '';

  // Budget exhausted — stop playback and return home.
  // One-shot timeout: remaining no longer changes per-second (elapsed-based ticking).
  // This covers both the WebPlayer and TizenPlayer paths in one place.
  useEffect(() => {
    const rem = budgetCtl.remaining;
    if (rem <= 0) {
      budgetCtl.stopTicking();
      navigate('/', { replace: true });
      return;
    }
    const id = window.setTimeout(() => {
      budgetCtl.stopTicking();
      navigate('/', { replace: true });
    }, rem * 1000);
    return () => clearTimeout(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once at mount — remaining sampled at video start

  // Record to recent history on every play.
  useEffect(() => {
    if (!videoId) return;
    pushRecent({
      id: videoId,
      title: title || 'YouTube Video',
      channelTitle,
      channelId: '',
      thumbnail: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
      durationSeconds: knownDuration,
      watchedAt: Date.now(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  if (!videoId) {
    navigate('/', { replace: true });
    return null;
  }

  // On Tizen TV: hand off to native YouTube app.
  // In any other browser: use the iframe embed.
  if (isTizen()) {
    return (
      <TizenPlayer
        videoId={videoId}
        title={title}
        knownDuration={knownDuration}
        budgetCtl={budgetCtl}
      />
    );
  }

  return (
    <WebPlayer
      videoId={videoId}
      knownDuration={knownDuration}
      budgetCtl={budgetCtl}
    />
  );
}

