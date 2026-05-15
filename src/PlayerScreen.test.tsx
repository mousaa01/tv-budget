/**
 * PlayerScreen tests.
 *
 * On non-Tizen environments (jsdom / browser) the WebPlayer branch renders.
 * We also test the isTizen detection and the TizenPlayer budget/navigation logic.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PlayerScreen } from './PlayerScreen';
import type { UseBudget } from './useBudget';

vi.mock('@noriginmedia/norigin-spatial-navigation', () => ({
  useFocusable: () => ({ ref: { current: null }, focused: false }),
  setFocus: vi.fn(),
  FocusContext: { Provider: ({ children }: { children: React.ReactNode }) => children },
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importActual) => {
  const actual = await importActual<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

function makeBudget(overrides: Partial<UseBudget> = {}): UseBudget {
  return {
    budget: {
      date: '2026-05-12',
      morningLimitSeconds: 3600,
      morningSecondsUsed: 0,
      morningBonusSeconds: 0,
      afternoonLimitSeconds: 3600,
      afternoonSecondsUsed: 0,
      afternoonBonusSeconds: 0,
    },
    remaining: 3600,
    noNewVideos: false,
    startTicking: vi.fn(),
    stopTicking: vi.fn(),
    addBonusSeconds: vi.fn(),
    refresh: vi.fn(),
    fiveMinuteWarning: 0,
    ...overrides,
  };
}

function renderPlayer(videoId = 'dQw4w9WgXcQ', budgetCtl?: UseBudget) {
  const budget = budgetCtl ?? makeBudget();
  render(
    <MemoryRouter initialEntries={[`/play/${videoId}?d=212&title=Test+Video&channel=Test+Channel`]}>
      <Routes>
        <Route path="/play/:videoId" element={<PlayerScreen budgetCtl={budget} />} />
      </Routes>
    </MemoryRouter>,
  );
  return budget;
}

beforeEach(() => {
  mockNavigate.mockReset();
  // Ensure tizen global is NOT set (jsdom = web browser path).
  delete (window as unknown as { tizen?: unknown }).tizen;
});

afterEach(() => {
  delete (window as unknown as { tizen?: unknown }).tizen;
});

// â”€â”€ WebPlayer (iframe) branch â€” runs when window.tizen is undefined â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe('PlayerScreen (web/iframe branch)', () => {
  it('renders an <iframe> element', () => {
    renderPlayer();
    expect(screen.getByTitle('YouTube video')).toBeInTheDocument();
    expect(screen.getByTitle('YouTube video').tagName).toBe('IFRAME');
  });

  it('iframe src contains the video ID', () => {
    renderPlayer('dQw4w9WgXcQ');
    const iframe = screen.getByTitle('YouTube video') as HTMLIFrameElement;
    expect(iframe.src).toContain('dQw4w9WgXcQ');
  });

  it('iframe src uses youtube-nocookie.com', () => {
    renderPlayer('abc123');
    const iframe = screen.getByTitle('YouTube video') as HTMLIFrameElement;
    expect(iframe.src).toContain('youtube-nocookie.com/embed/abc123');
  });

  it('iframe src includes autoplay=1', () => {
    renderPlayer('abc123');
    const iframe = screen.getByTitle('YouTube video') as HTMLIFrameElement;
    expect(iframe.src).toContain('autoplay=1');
  });

  it('iframe has allow="autoplay" attribute', () => {
    renderPlayer();
    const iframe = screen.getByTitle('YouTube video') as HTMLIFrameElement;
    expect(iframe.getAttribute('allow')).toContain('autoplay');
  });

  it('calls startTicking on mount', () => {
    const budget = makeBudget();
    renderPlayer('vid1', budget);
    expect(budget.startTicking).toHaveBeenCalledTimes(1);
  });

  it('calls stopTicking on unmount', () => {
    const budget = makeBudget();
    const { unmount } = render(
      <MemoryRouter initialEntries={['/play/vid2?d=100']}>
        <Routes>
          <Route path="/play/:videoId" element={<PlayerScreen budgetCtl={budget} />} />
        </Routes>
      </MemoryRouter>,
    );
    unmount();
    expect(budget.stopTicking).toHaveBeenCalled();
  });

  it('YT_PAUSED does NOT call stopTicking with consumeIfLow — mid-video buffering must not eat the budget', () => {
    // This is the root cause of the "kicked out 2-3 mins early" bug:
    // YouTube's iframe fires YT_PAUSED during buffering. If stopTicking consumed
    // sub-2-min budget on every pause, the user would be evicted before the
    // video finished. The fix: YT_PAUSED calls stopTicking() with no argument
    // (consumeIfLow defaults to false).
    const budget = makeBudget();
    renderPlayer('vidPause', budget);
    vi.mocked(budget.stopTicking).mockClear();

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: JSON.stringify({ info: { playerState: 2 } }), // YT_PAUSED
          origin: 'https://www.youtube-nocookie.com',
        }),
      );
    });

    expect(budget.stopTicking).toHaveBeenCalledTimes(1);
    // Must NOT pass true — no sub-2-min consumption on a pause.
    expect(budget.stopTicking).toHaveBeenCalledWith(); // called with zero args
  });

  it('YT_ENDED calls stopTicking(true) then navigates — consuming sub-2-min leftover on natural completion', () => {
    const budget = makeBudget();
    renderPlayer('vidEnd', budget);
    vi.mocked(budget.stopTicking).mockClear();

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: JSON.stringify({ info: { playerState: 0 } }), // YT_ENDED
          origin: 'https://www.youtube-nocookie.com',
        }),
      );
    });

    expect(budget.stopTicking).toHaveBeenCalledWith(true);
    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
  });

  it('navigates home on Escape key', () => {
    renderPlayer();
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
  });

  it('navigates home on Backspace key', () => {
    renderPlayer();
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true })));
    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
  });

  it('navigates home when YouTube postMessage signals ENDED (state=0)', () => {
    renderPlayer();
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: JSON.stringify({ info: { playerState: 0 } }),
          origin: 'https://www.youtube-nocookie.com',
        }),
      );
    });
    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
  });

  it('calls startTicking when YouTube postMessage signals PLAYING (state=1)', () => {
    const budget = makeBudget();
    renderPlayer('vid3', budget);
    vi.mocked(budget.startTicking).mockClear();
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: JSON.stringify({ info: { playerState: 1 } }),
          origin: 'https://www.youtube-nocookie.com',
        }),
      );
    });
    expect(budget.startTicking).toHaveBeenCalled();
  });

  it('calls stopTicking when YouTube postMessage signals PAUSED (state=2)', () => {
    const budget = makeBudget();
    renderPlayer('vid4', budget);
    vi.mocked(budget.stopTicking).mockClear();
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: JSON.stringify({ info: { playerState: 2 } }),
          origin: 'https://www.youtube-nocookie.com',
        }),
      );
    });
    expect(budget.stopTicking).toHaveBeenCalled();
  });

  it('navigates home immediately when budget is already exhausted (remaining = 0)', () => {
    // If the player is opened with zero remaining budget — e.g. the parent
    // navigated here manually after time ran out — we must redirect home
    // rather than letting the iframe keep playing.
    renderPlayer('vid_exhaust', makeBudget({ remaining: 0, noNewVideos: true }));
    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
  });

  it('renders null when videoId is missing and navigates home', () => {
    mockNavigate.mockReset();
    render(
      <MemoryRouter initialEntries={['/play/']}>
        <Routes>
          <Route path="/play/" element={<PlayerScreen budgetCtl={makeBudget()} />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
  });
});

// â”€â”€ TizenPlayer branch â€” runs when window.tizen is defined â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe('PlayerScreen (Tizen/native-app branch)', () => {
  beforeEach(() => {
    // Inject a mock tizen global to activate the Tizen branch.
    (window as unknown as { tizen: unknown }).tizen = {
      application: {
        launchAppControl: vi.fn(),
        // Must be a regular function (not arrow) so it can be called with `new`.
        ApplicationControl: vi.fn(function (this: Record<string, unknown>, op: string, uri: string) {
          this.op = op;
          this.uri = uri;
        }),
      },
    };
  });

  it('does NOT render an iframe on Tizen', () => {
    renderPlayer();
    expect(screen.queryByTitle('YouTube video')).toBeNull();
  });

  it('shows a budget timer overlay instead of an iframe', () => {
    renderPlayer();
    expect(screen.getByText(/budget remaining/i)).toBeInTheDocument();
  });

  it('calls launchAppControl with the video ID in the URI', () => {
    renderPlayer('tizenVideo');
    const mock = (window as unknown as { tizen: { application: { launchAppControl: ReturnType<typeof vi.fn> } } }).tizen.application.launchAppControl;
    expect(mock).toHaveBeenCalledTimes(1);
    const ctrlArg = mock.mock.calls[0][0] as { uri: string };
    expect(String(ctrlArg.uri ?? '')).toContain('tizenVideo');
  });

  it('calls startTicking on mount', () => {
    const budget = makeBudget();
    renderPlayer('v1', budget);
    expect(budget.startTicking).toHaveBeenCalledTimes(1);
  });

  it('navigates home and stops ticking with consumeIfLow=true when app regains visibility (user pressed Back in YouTube)', () => {
    const budget = makeBudget();
    renderPlayer('v2', budget);
    vi.mocked(budget.stopTicking).mockClear();

    act(() => {
      Object.defineProperty(document, 'hidden', { value: false, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // Must pass true: this is the end of the video session, sub-2-min leftovers
    // should be consumed to avoid leaving an unusable orphan budget.
    expect(budget.stopTicking).toHaveBeenCalledWith(true);
    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
  });

  it('navigates home when budget runs out', () => {
    const budget = makeBudget({ remaining: 0 });
    renderPlayer('v3', budget);
    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
  });
});
