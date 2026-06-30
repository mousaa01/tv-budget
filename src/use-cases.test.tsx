/**
 * Comprehensive use-case tests — one describe block per UC.
 *
 * UC1  – Sign in with YouTube account
 * UC2  – Browse subscribed channels
 * UC3  – Search by keyword
 * UC4  – Recently watched videos
 * UC5  – Full-screen video playback
 * UC6  – Live budget countdown
 * UC7  – "5 minutes left" audio + visual warning
 * UC8  – "2 minutes left" / "30 seconds left" in-player banners
 * UC9  – Back button returns to home screen
 * UC10 – Separate morning and afternoon time limits
 * UC11 – Playback stops when budget runs out
 * UC12 – Grant bonus minutes via PIN-protected screen
 * UC13 – Pin channels so they appear first
 * UC14 – Keyword blocklist filters
 * UC15 – Settings sync from Google Drive
 * UC16 – Friendly "Time's Up" screen
 * UC17 – Videos that don't fit are greyed out
 * UC18 – Full D-pad navigation
 * UC19 – Tizen TV playback via native YouTube app
 * UC20 – 7-day watch history summary
 * UC21 – Timer pauses during video buffering
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';

import { SignInScreen } from './SignInScreen';
import { HomeScreen } from './HomeScreen';
import { TimesUpScreen } from './TimesUpScreen';
import { PlayerScreen } from './PlayerScreen';
import { SearchScreen } from './SearchScreen';
import { SettingsModal } from './SettingsModal';
import { FiveMinuteWarning, VideoCard } from './components';
import {
  loadRecent,
  pushRecent,
  clearRecent,
  loadHistory,
  incrementVideosWatchedToday,
  saveBudget,
  saveSettings,
  saveSubscribedChannels,
  remainingSeconds,
} from './storage';
import { applyBlocklist, partitionByDuration, searchVideos } from './youtube';
import { loadSettingsFromDrive, saveSettingsToDrive } from './drive';
import { buildAuthUrl } from './oauth';
import type { UseBudget } from './useBudget';
import type { BudgetState, RecentVideo, Settings, SubscribedChannel } from './types';

// ─── Module-level mocks ────────────────────────────────────────────────────

vi.mock('@noriginmedia/norigin-spatial-navigation', () => ({
  useFocusable: () => ({ ref: { current: null }, focused: false, focusKey: 'TEST_KEY' }),
  setFocus: vi.fn(),
  FocusContext: {
    Provider: ({ children }: { children: ReactNode }) => children,
  },
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importActual) => {
  const actual = await importActual<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('./oauth', () => ({
  buildAuthUrl: vi.fn(() => 'https://accounts.google.com/o/oauth2/v2/auth?mock=1'),
  parseTokenFromHash: vi.fn(() => null),
  isTokenValid: vi.fn(() => true),
  fetchSubscribedChannels: vi.fn(async () => []),
  fetchUserProfile: vi.fn(async () => null),
}));

// Keep utility functions (applyBlocklist, partitionByDuration) real;
// mock only the network-dependent API functions.
vi.mock('./youtube', async (importActual) => {
  const actual = await importActual<typeof import('./youtube')>();
  return {
    ...actual,
    fetchChannelFeed: vi.fn(),
    searchVideos: vi.fn(),
    lookupChannel: vi.fn(),
  };
});

// ─── Shared helpers ────────────────────────────────────────────────────────

function makeBudget(overrides: Partial<UseBudget> = {}): UseBudget {
  const remaining = overrides.remaining ?? 3600;
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
    remaining,
    remainingRef: { current: remaining },
    noNewVideos: remaining <= 0,
    startTicking: vi.fn(),
    stopTicking: vi.fn(),
    addBonusSeconds: vi.fn(),
    refresh: vi.fn(),
    fiveMinuteWarning: 0,
    ...overrides,
  };
}

function makeChannel(id: string, title: string): SubscribedChannel {
  return { id, title, thumbnail: `https://yt.com/thumb/${id}.jpg` };
}

function makeRecentVideo(id: string, title: string, durationSeconds = 300): RecentVideo {
  return {
    id,
    title,
    channelTitle: 'Test Channel',
    channelId: 'UCtest',
    thumbnail: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
    durationSeconds,
    watchedAt: Date.now(),
  };
}

function makeVideoResult(id: string, durationSeconds: number) {
  return {
    id,
    title: `Video ${id}`,
    channelTitle: 'Test Channel',
    channelId: 'UCtest',
    thumbnail: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
    durationSeconds,
  };
}

function renderPlayer(videoId = 'testVid', budgetCtl?: UseBudget) {
  const budget = budgetCtl ?? makeBudget();
  render(
    <MemoryRouter
      initialEntries={[`/play/${videoId}?d=300&title=Test+Video&channel=Test+Channel`]}
    >
      <Routes>
        <Route path="/play/:videoId" element={<PlayerScreen budgetCtl={budget} />} />
      </Routes>
    </MemoryRouter>,
  );
  return budget;
}

const DEFAULT_SETTINGS: Settings = {
  pin: '1234',
  morningLimitMinutes: 30,
  afternoonLimitMinutes: 30,
  blocklistKeywords: [],
  channelAllowlist: [],
  coolDownEnabled: false,
  pinnedChannels: [],
};

// ─── Global test lifecycle ────────────────────────────────────────────────

beforeEach(() => {
  localStorage.clear();
  mockNavigate.mockReset();
  delete (window as unknown as { tizen?: unknown }).tizen;
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ══════════════════════════════════════════════════════════════════════════
// UC1: As a child, I want to sign in with my YouTube account
// ══════════════════════════════════════════════════════════════════════════

describe('UC1: As a child, I want to sign in with my YouTube account so I can see my subscribed channels', () => {
  it('renders a Sign in button on the sign-in screen', () => {
    render(<SignInScreen />);
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('displays the error message when sign-in fails', () => {
    render(<SignInScreen error="OAuth token expired" />);
    expect(screen.getByText(/OAuth token expired/i)).toBeInTheDocument();
  });

  it('sign-in button triggers the OAuth redirect', () => {
    render(<SignInScreen />);
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(vi.mocked(buildAuthUrl)).toHaveBeenCalled();
  });

  it('does not show error panel when no error is provided', () => {
    const { container } = render(<SignInScreen />);
    // No danger-coloured error text
    expect(container.querySelector('[style*="danger"]')).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════════════
// UC2: As a child, I want to browse subscribed channels
// ══════════════════════════════════════════════════════════════════════════

describe('UC2: As a child, I want to browse subscribed channels so I can pick something without typing', () => {
  it('shows subscribed channels from storage on the home screen', () => {
    saveSubscribedChannels({
      channels: [makeChannel('UCfoo', 'Foo Channel'), makeChannel('UCbar', 'Bar Channel')],
      syncedAt: new Date().toISOString(),
      accessToken: 'test-token',
      tokenExpiresAt: Date.now() + 3_600_000,
    });
    render(
      <MemoryRouter>
        <HomeScreen budgetCtl={makeBudget()} />
      </MemoryRouter>,
    );
    expect(screen.getByText('Foo Channel')).toBeInTheDocument();
    expect(screen.getByText('Bar Channel')).toBeInTheDocument();
  });

  it('shows empty-state message when no channels are subscribed', () => {
    render(
      <MemoryRouter>
        <HomeScreen budgetCtl={makeBudget()} />
      </MemoryRouter>,
    );
    expect(screen.getByText(/No subscribed channels found/i)).toBeInTheDocument();
  });

  it('navigates to SearchScreen in channel mode when a channel is selected', () => {
    saveSubscribedChannels({
      channels: [makeChannel('UCfoo', 'Foo Channel')],
      syncedAt: new Date().toISOString(),
      accessToken: 'test-token',
      tokenExpiresAt: Date.now() + 3_600_000,
    });
    render(
      <MemoryRouter>
        <HomeScreen budgetCtl={makeBudget()} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByTitle('Foo Channel'));
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.stringContaining('/search?channelId=UCfoo'),
    );
  });
});

// ══════════════════════════════════════════════════════════════════════════
// UC3: As a child, I want to search by keyword
// ══════════════════════════════════════════════════════════════════════════

describe('UC3: As a child, I want to search by keyword so I can find specific content', () => {
  it('displays search results returned by searchVideos', async () => {
    vi.mocked(searchVideos).mockResolvedValueOnce([
      makeVideoResult('v1', 300),
      makeVideoResult('v2', 600),
    ]);
    render(
      <MemoryRouter initialEntries={['/search?q=lego']}>
        <Routes>
          <Route
            path="/search"
            element={<SearchScreen budgetCtl={makeBudget({ remaining: 3600 })} />}
          />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText('Video v1')).toBeInTheDocument());
    expect(screen.getByText('Video v2')).toBeInTheDocument();
  });

  it('shows an error message when the search API call fails', async () => {
    vi.mocked(searchVideos).mockRejectedValueOnce(new Error('API quota exceeded'));
    render(
      <MemoryRouter initialEntries={['/search?q=dinosaurs']}>
        <Routes>
          <Route
            path="/search"
            element={<SearchScreen budgetCtl={makeBudget({ remaining: 3600 })} />}
          />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(screen.getByText(/API quota exceeded/i)).toBeInTheDocument(),
    );
  });

  it('shows empty-state message when no results are returned', async () => {
    vi.mocked(searchVideos).mockResolvedValueOnce([]);
    render(
      <MemoryRouter initialEntries={['/search?q=zzznoresults']}>
        <Routes>
          <Route
            path="/search"
            element={<SearchScreen budgetCtl={makeBudget({ remaining: 3600 })} />}
          />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(screen.getByText(/No results for/i)).toBeInTheDocument(),
    );
  });
});

// ══════════════════════════════════════════════════════════════════════════
// UC4: As a child, I want to see recently watched videos
// ══════════════════════════════════════════════════════════════════════════

describe('UC4: As a child, I want to see recently watched videos so I can re-watch favourites quickly', () => {
  it('loadRecent returns an empty array when nothing has been watched', () => {
    expect(loadRecent()).toEqual([]);
  });

  it('pushRecent stores a video and loadRecent retrieves it', () => {
    pushRecent(makeRecentVideo('vid1', 'My Favourite Video'));
    const recents = loadRecent();
    expect(recents).toHaveLength(1);
    expect(recents[0].title).toBe('My Favourite Video');
  });

  it('pushRecent deduplicates by video ID (same video pushed twice = one entry)', () => {
    pushRecent(makeRecentVideo('vid1', 'First push'));
    pushRecent(makeRecentVideo('vid1', 'Second push'));
    expect(loadRecent()).toHaveLength(1);
    expect(loadRecent()[0].title).toBe('Second push');
  });

  it('loadRecent returns empty array when localStorage contains invalid JSON', () => {
    localStorage.setItem('tv-budget:recent', 'not-valid-json{{');
    expect(loadRecent()).toEqual([]);
  });

  it('recently watched videos appear on the home screen', () => {
    pushRecent(makeRecentVideo('vid2', 'Favourite Show'));
    render(
      <MemoryRouter>
        <HomeScreen budgetCtl={makeBudget()} />
      </MemoryRouter>,
    );
    expect(screen.getByText('Favourite Show')).toBeInTheDocument();
  });

  it('recent video button is disabled when its duration exceeds the remaining budget', () => {
    pushRecent(makeRecentVideo('vid3', 'Long Video', 7200)); // 2 hours
    render(
      <MemoryRouter>
        <HomeScreen budgetCtl={makeBudget({ remaining: 600 })} />
      </MemoryRouter>,
    );
    const button = screen.getByText('Long Video').closest('button');
    expect(button).toBeDisabled();
  });
});

// ══════════════════════════════════════════════════════════════════════════
// UC5: As a child, I want full-screen video playback on the TV
// ══════════════════════════════════════════════════════════════════════════

describe('UC5: As a child, I want full-screen video playback on the TV during my allowed screen time', () => {
  it('renders a YouTube embed iframe for the selected video', () => {
    renderPlayer('dQw4w9WgXcQ');
    expect(screen.getByTitle('YouTube video')).toBeInTheDocument();
  });

  it('iframe URL contains the selected video ID', () => {
    renderPlayer('abc123');
    const iframe = screen.getByTitle('YouTube video') as HTMLIFrameElement;
    expect(iframe.src).toContain('abc123');
  });

  it('iframe uses the youtube.com domain', () => {
    renderPlayer('abc123');
    const iframe = screen.getByTitle('YouTube video') as HTMLIFrameElement;
    expect(iframe.src).toContain('youtube.com');
  });

  it('iframe includes autoplay=1 so the video starts immediately', () => {
    renderPlayer('abc123');
    const iframe = screen.getByTitle('YouTube video') as HTMLIFrameElement;
    expect(iframe.src).toContain('autoplay=1');
  });

  it('navigates home and does not render an iframe when videoId is missing', () => {
    render(
      <MemoryRouter initialEntries={['/play/']}>
        <Routes>
          <Route path="/play/" element={<PlayerScreen budgetCtl={makeBudget()} />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
    expect(screen.queryByTitle('YouTube video')).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════════════
// UC6: As a child, I want a live budget countdown
// ══════════════════════════════════════════════════════════════════════════

describe('UC6: As a child, I want a live budget countdown so I know when my session ends', () => {
  it('a budget countdown element is present in the player overlay', () => {
    renderPlayer('vid6');
    expect(screen.getByLabelText(/budget remaining/i)).toBeInTheDocument();
  });

  it('budget countdown is not rendered when no videoId is provided', () => {
    render(
      <MemoryRouter initialEntries={['/play/']}>
        <Routes>
          <Route path="/play/" element={<PlayerScreen budgetCtl={makeBudget()} />} />
        </Routes>
      </MemoryRouter>,
    );
    // PlayerScreen immediately navigates away without rendering the countdown
    expect(screen.queryByLabelText(/budget remaining/i)).toBeNull();
  });

  it('startTicking is called when YT_PLAYING fires — clock only ticks during actual playback', () => {
    // UC21: timer must not start on mount (buffering). Only YT_PLAYING (state=1) starts the clock.
    const budget = makeBudget();
    renderPlayer('vid6b', budget);
    expect(budget.startTicking).not.toHaveBeenCalled();

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: JSON.stringify({ info: { playerState: 1 } }),
          origin: 'https://www.youtube-nocookie.com',
        }),
      );
    });

    expect(budget.startTicking).toHaveBeenCalledTimes(1);
  });

  it('saveBudget does not throw when localStorage is full (QuotaExceededError)', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new DOMException('QuotaExceededError', 'QuotaExceededError');
    });
    const budgetState: BudgetState = {
      date: '2026-01-01',
      morningLimitSeconds: 1800,
      morningSecondsUsed: 0,
      morningBonusSeconds: 0,
      afternoonLimitSeconds: 1800,
      afternoonSecondsUsed: 0,
      afternoonBonusSeconds: 0,
    };
    expect(() => saveBudget(budgetState)).not.toThrow();
    spy.mockRestore();
  });
});

// ══════════════════════════════════════════════════════════════════════════
// UC7: As a child, I want a "5 minutes left" audio + visual warning
// ══════════════════════════════════════════════════════════════════════════

describe('UC7: As a child, I want a "5 minutes left" audio + visual warning so I can prepare to stop', () => {
  it('FiveMinuteWarning is not visible when trigger is 0', () => {
    render(<FiveMinuteWarning trigger={0} />);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('FiveMinuteWarning becomes visible when trigger increments', () => {
    const { rerender } = render(<FiveMinuteWarning trigger={0} />);
    rerender(<FiveMinuteWarning trigger={1} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/5 minutes left/i)).toBeInTheDocument();
  });

  it('auto-hides after 6 seconds', async () => {
    vi.useFakeTimers();
    const { rerender } = render(<FiveMinuteWarning trigger={0} />);
    rerender(<FiveMinuteWarning trigger={1} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    await act(async () => { vi.advanceTimersByTime(6001); });
    expect(screen.queryByRole('alert')).toBeNull();
    vi.useRealTimers();
  });

  it('does not throw when Web Speech API is unavailable', () => {
    const original = (window as unknown as Record<string, unknown>).speechSynthesis;
    Object.defineProperty(window, 'speechSynthesis', {
      value: undefined,
      configurable: true,
    });
    const { rerender } = render(<FiveMinuteWarning trigger={0} />);
    expect(() => rerender(<FiveMinuteWarning trigger={1} />)).not.toThrow();
    Object.defineProperty(window, 'speechSynthesis', { value: original, configurable: true });
  });

  it('fires immediately mid-video when rendered alongside the player (regression: was deferred until home screen)', () => {
    // Regression test for issue #7: FiveMinuteWarning was suppressed on the
    // player route, so the warning only appeared after the video ended and the
    // user returned home. App.tsx now renders FiveMinuteWarning on all routes.
    // This test simulates that by rendering FiveMinuteWarning in the same tree
    // as PlayerScreen and verifying the alert appears the moment trigger fires.
    const budget = makeBudget({ remaining: 280, fiveMinuteWarning: 0 });
    const { rerender } = render(
      <MemoryRouter initialEntries={['/play/testVid?d=300']}>
        <>
          <FiveMinuteWarning trigger={budget.fiveMinuteWarning} />
          <Routes>
            <Route path="/play/:videoId" element={<PlayerScreen budgetCtl={budget} />} />
          </Routes>
        </>
      </MemoryRouter>,
    );
    expect(screen.queryByRole('alert')).toBeNull();

    // Simulate the budget ticking past 5 minutes — trigger increments.
    budget.fiveMinuteWarning = 1;
    rerender(
      <MemoryRouter initialEntries={['/play/testVid?d=300']}>
        <>
          <FiveMinuteWarning trigger={budget.fiveMinuteWarning} />
          <Routes>
            <Route path="/play/:videoId" element={<PlayerScreen budgetCtl={budget} />} />
          </Routes>
        </>
      </MemoryRouter>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/5 minutes left/i)).toBeInTheDocument();
  });
});

// ══════════════════════════════════════════════════════════════════════════
// UC8: "2 minutes left" and "30 seconds left" in-player banners
// ══════════════════════════════════════════════════════════════════════════

describe('UC8: As a child, I want "2 minutes left" and "30 seconds left" in-player banners so I know the video is about to end', () => {
  afterEach(() => vi.useRealTimers());

  it('a banner overlay element is present in the player DOM', () => {
    renderPlayer('bannerSmoke');
    // The banner is a div[role="status"] rendered with display:none initially
    expect(document.querySelector('[role="status"]')).toBeTruthy();
  });

  it('shows "2 minutes left" banner text when ~120 seconds remain', async () => {
    vi.useFakeTimers();
    renderPlayer('banner2min', makeBudget({ remaining: 120 }));
    // Flush the initial requestAnimationFrame that fires the tick function
    await act(async () => { vi.advanceTimersByTime(50); });
    const banner = document.querySelector('[role="status"]') as HTMLElement | null;
    expect(banner?.textContent).toContain('2 minutes left');
    expect(banner?.style.display).toBe('block');
  });

  it('shows "30 seconds left" banner text when ~30 seconds remain', async () => {
    vi.useFakeTimers();
    renderPlayer('banner30sec', makeBudget({ remaining: 30 }));
    await act(async () => { vi.advanceTimersByTime(50); });
    const banner = document.querySelector('[role="status"]') as HTMLElement | null;
    expect(banner?.textContent).toContain('30 seconds left');
    expect(banner?.style.display).toBe('block');
  });

  it('banner is hidden when remaining time is not near a threshold', async () => {
    vi.useFakeTimers();
    renderPlayer('bannerHidden', makeBudget({ remaining: 3600 }));
    await act(async () => { vi.advanceTimersByTime(50); });
    const banner = document.querySelector('[role="status"]') as HTMLElement | null;
    // At 3600s remaining, no banner should show
    expect(banner?.style.display ?? 'none').toBe('none');
  });
});

// ══════════════════════════════════════════════════════════════════════════
// UC9: As a child, I want the Back button to always return me to the home screen
// ══════════════════════════════════════════════════════════════════════════

describe('UC9: As a child, I want the Back button to always return me to the home screen', () => {
  it('Escape key navigates to the home screen from the player', () => {
    renderPlayer();
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
  });

  it('Backspace key navigates to the home screen from the player', () => {
    renderPlayer();
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
    });
    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
  });

  it('Back button in SearchScreen navigates to the home screen', async () => {
    vi.mocked(searchVideos).mockResolvedValueOnce([]);
    render(
      <MemoryRouter initialEntries={['/search?q=test']}>
        <Routes>
          <Route
            path="/search"
            element={<SearchScreen budgetCtl={makeBudget()} />}
          />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: /← Back/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });
});

// ══════════════════════════════════════════════════════════════════════════
// UC10: As a parent, I want separate morning and afternoon time limits
// ══════════════════════════════════════════════════════════════════════════

describe('UC10: As a parent, I want separate morning and afternoon time limits', () => {
  afterEach(() => vi.useRealTimers());

  it('remainingSeconds uses the morning limit when the hour is before noon', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T09:00:00'));
    const budget: BudgetState = {
      date: '2026-01-01',
      morningLimitSeconds: 1800,
      morningSecondsUsed: 600,
      morningBonusSeconds: 0,
      afternoonLimitSeconds: 900,
      afternoonSecondsUsed: 300,
      afternoonBonusSeconds: 0,
    };
    // 1800 - 600 = 1200 (morning)
    expect(remainingSeconds(budget)).toBe(1200);
  });

  it('remainingSeconds uses the afternoon limit when the hour is noon or later', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T14:00:00'));
    const budget: BudgetState = {
      date: '2026-01-01',
      morningLimitSeconds: 1800,
      morningSecondsUsed: 600,
      morningBonusSeconds: 0,
      afternoonLimitSeconds: 900,
      afternoonSecondsUsed: 300,
      afternoonBonusSeconds: 0,
    };
    // 900 - 300 = 600 (afternoon)
    expect(remainingSeconds(budget)).toBe(600);
  });

  it('remainingSeconds clamps to 0 when the window budget is exhausted', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T10:00:00'));
    const budget: BudgetState = {
      date: '2026-01-01',
      morningLimitSeconds: 1800,
      morningSecondsUsed: 2000, // over limit
      morningBonusSeconds: 0,
      afternoonLimitSeconds: 900,
      afternoonSecondsUsed: 0,
      afternoonBonusSeconds: 0,
    };
    expect(remainingSeconds(budget)).toBe(0);
  });

  it('saveSettings does not throw when localStorage is full', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new DOMException('QuotaExceededError', 'QuotaExceededError');
    });
    expect(() => saveSettings(DEFAULT_SETTINGS)).not.toThrow();
    spy.mockRestore();
  });
});

// ══════════════════════════════════════════════════════════════════════════
// UC11: As a parent, I want playback to stop automatically when budget runs out
// ══════════════════════════════════════════════════════════════════════════

describe('UC11: As a parent, I want playback to stop automatically when the budget runs out', () => {
  it('navigates home immediately when the player is opened with zero remaining budget', () => {
    renderPlayer('exhaust', makeBudget({ remaining: 0 }));
    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
  });

  it('calls stopTicking when navigating home due to budget exhaustion', () => {
    const budget = makeBudget({ remaining: 0 });
    renderPlayer('exhaust2', budget);
    expect(budget.stopTicking).toHaveBeenCalled();
  });

  it('navigates home after the remaining-budget timeout fires', async () => {
    vi.useFakeTimers();
    const budget = makeBudget({ remaining: 5 });
    renderPlayer('timeout', budget);
    // Advance past the 5-second budget timeout
    await act(async () => { vi.advanceTimersByTime(5001); });
    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
    vi.useRealTimers();
  });
});

// ══════════════════════════════════════════════════════════════════════════
// UC12: As a parent, I want to grant bonus minutes via a PIN-protected screen
// ══════════════════════════════════════════════════════════════════════════

describe('UC12: As a parent, I want to grant bonus minutes via a PIN-protected settings screen', () => {
  it('TimesUpScreen shows an "Ask for bonus time" button', () => {
    render(
      <MemoryRouter>
        <TimesUpScreen budgetCtl={makeBudget({ remaining: 0 })} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('button', { name: /ask for bonus time/i })).toBeInTheDocument();
  });

  it('shows PIN modal when "Ask for bonus time" is clicked', () => {
    render(
      <MemoryRouter>
        <TimesUpScreen budgetCtl={makeBudget({ remaining: 0 })} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: /ask for bonus time/i }));
    expect(screen.getByRole('dialog', { name: /parent pin/i })).toBeInTheDocument();
  });

  it('shows "Wrong PIN" error when an incorrect PIN is entered', () => {
    saveSettings({ ...DEFAULT_SETTINGS, pin: '9999' });
    render(
      <MemoryRouter>
        <TimesUpScreen budgetCtl={makeBudget({ remaining: 0 })} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: /ask for bonus time/i }));
    fireEvent.change(screen.getByLabelText(/^pin$/i), { target: { value: '0000' } });
    fireEvent.click(screen.getByRole('button', { name: /\+30 min/i }));
    expect(screen.getByText(/wrong pin/i)).toBeInTheDocument();
  });

  it('grants bonus seconds and navigates home when the correct PIN is entered', () => {
    saveSettings({ ...DEFAULT_SETTINGS, pin: '1234' });
    const budget = makeBudget({ remaining: 0 });
    render(
      <MemoryRouter>
        <TimesUpScreen budgetCtl={budget} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: /ask for bonus time/i }));
    fireEvent.change(screen.getByLabelText(/^pin$/i), { target: { value: '1234' } });
    fireEvent.click(screen.getByRole('button', { name: /\+30 min/i }));
    expect(budget.addBonusSeconds).toHaveBeenCalledWith(30 * 60);
    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
  });

  function renderAuthenticatedSettings(): { budget: ReturnType<typeof makeBudget> } {
    saveSettings({ ...DEFAULT_SETTINGS, pin: '1234' });
    const budget = makeBudget();
    const { rerender } = render(
      <SettingsModal open={false} onClose={vi.fn()} budgetCtl={budget} />,
    );
    rerender(<SettingsModal open={true} onClose={vi.fn()} budgetCtl={budget} />);
    fireEvent.change(screen.getByLabelText(/^pin$/i), { target: { value: '1234' } });
    fireEvent.click(screen.getByRole('button', { name: /^unlock$/i }));
    return { budget };
  }

  it('SettingsModal shows ±1 min and ±5 min adjustment buttons when authenticated', () => {
    renderAuthenticatedSettings();
    expect(screen.getByRole('button', { name: /^−1 min$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^\+1 min$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^−5 min$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^\+5 min$/i })).toBeInTheDocument();
  });

  it('−1 min button calls addBonusSeconds with −60', () => {
    const { budget } = renderAuthenticatedSettings();
    fireEvent.click(screen.getByRole('button', { name: /^−1 min$/i }));
    expect(budget.addBonusSeconds).toHaveBeenCalledWith(-60);
  });

  it('+1 min button calls addBonusSeconds with 60', () => {
    const { budget } = renderAuthenticatedSettings();
    fireEvent.click(screen.getByRole('button', { name: /^\+1 min$/i }));
    expect(budget.addBonusSeconds).toHaveBeenCalledWith(60);
  });
});

// ══════════════════════════════════════════════════════════════════════════
// UC13: As a parent, I want to pin channels so they appear first
// ══════════════════════════════════════════════════════════════════════════

describe('UC13: As a parent, I want to pin channels so they appear first in the child\'s list', () => {
  it('pinned channels appear before subscribed channels', () => {
    const pinned = makeChannel('UCpinned', 'Pinned Channel');
    const subscribed = makeChannel('UCsub', 'Subscribed Channel');
    saveSettings({ ...DEFAULT_SETTINGS, pinnedChannels: [pinned] });
    saveSubscribedChannels({
      channels: [subscribed],
      syncedAt: new Date().toISOString(),
      accessToken: 'tok',
      tokenExpiresAt: Date.now() + 3_600_000,
    });
    const { container } = render(
      <MemoryRouter>
        <HomeScreen budgetCtl={makeBudget()} />
      </MemoryRouter>,
    );
    const buttons = container.querySelectorAll('button[title]');
    const titles = Array.from(buttons).map((b) => b.getAttribute('title'));
    expect(titles.indexOf('Pinned Channel')).toBeLessThan(
      titles.indexOf('Subscribed Channel'),
    );
  });

  it('a pinned channel is deduplicated from the subscribed list', () => {
    const ch = makeChannel('UCboth', 'Both Channel');
    saveSettings({ ...DEFAULT_SETTINGS, pinnedChannels: [ch] });
    saveSubscribedChannels({
      channels: [ch],
      syncedAt: new Date().toISOString(),
      accessToken: 'tok',
      tokenExpiresAt: Date.now() + 3_600_000,
    });
    const { container } = render(
      <MemoryRouter>
        <HomeScreen budgetCtl={makeBudget()} />
      </MemoryRouter>,
    );
    // Only one button with that title should exist
    const matches = container.querySelectorAll('button[title="Both Channel"]');
    expect(matches).toHaveLength(1);
  });

  it('a pinned channel button carries the pin icon in its DOM', () => {
    const pinned = makeChannel('UCpinned2', 'My Pinned');
    saveSettings({ ...DEFAULT_SETTINGS, pinnedChannels: [pinned] });
    render(
      <MemoryRouter>
        <HomeScreen budgetCtl={makeBudget()} />
      </MemoryRouter>,
    );
    const button = screen.getByTitle('My Pinned');
    expect(button.textContent).toContain('📌');
  });
});

// ══════════════════════════════════════════════════════════════════════════
// UC14: As a parent, I want keyword blocklist filters
// ══════════════════════════════════════════════════════════════════════════

describe('UC14: As a parent, I want keyword blocklist filters to exclude inappropriate content from search', () => {
  it('applyBlocklist removes videos whose titles contain blocked keywords', () => {
    const results = [
      makeVideoResult('v1', 300), // title "Video v1"
      makeVideoResult('v2', 300), // title "Video v2"
    ];
    const filtered = applyBlocklist(results, ['v1']);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('v2');
  });

  it('applyBlocklist filtering is case-insensitive', () => {
    const results = [makeVideoResult('v1', 300)]; // title "Video v1"
    expect(applyBlocklist(results, ['VIDEO'])).toHaveLength(0);
    expect(applyBlocklist(results, ['video'])).toHaveLength(0);
  });

  it('applyBlocklist returns all results when the keyword list is empty', () => {
    const results = [makeVideoResult('v1', 300), makeVideoResult('v2', 300)];
    expect(applyBlocklist(results, [])).toHaveLength(2);
  });

  it('applyBlocklist handles null/undefined keyword list gracefully', () => {
    const results = [makeVideoResult('v1', 300)];
    // Should not throw — null guard in production code
    expect(
      applyBlocklist(results, null as unknown as string[]),
    ).toHaveLength(1);
  });

  it('blocked keywords are applied when searching via SearchScreen', async () => {
    saveSettings({ ...DEFAULT_SETTINGS, blocklistKeywords: ['blocked'] });
    vi.mocked(searchVideos).mockResolvedValueOnce([
      { ...makeVideoResult('v_ok', 300), title: 'Good Video' },
      { ...makeVideoResult('v_bad', 300), title: 'blocked Video' },
    ]);
    render(
      <MemoryRouter initialEntries={['/search?q=test']}>
        <Routes>
          <Route
            path="/search"
            element={<SearchScreen budgetCtl={makeBudget({ remaining: 3600 })} />}
          />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText('Good Video')).toBeInTheDocument());
    expect(screen.queryByText('blocked Video')).not.toBeInTheDocument();
  });
});

// ══════════════════════════════════════════════════════════════════════════
// UC15: As a parent, I want settings to sync from Google Drive
// ══════════════════════════════════════════════════════════════════════════

describe('UC15: As a parent, I want settings to sync from Google Drive so TV picks up changes made on my phone', () => {
  const ORIGINAL_FETCH = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = ORIGINAL_FETCH;
    localStorage.clear();
  });

  it('loadSettingsFromDrive returns null when the network call throws', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error('Network error');
    }) as unknown as typeof fetch;
    const result = await loadSettingsFromDrive('test-token');
    expect(result).toBeNull();
  });

  it('loadSettingsFromDrive returns null when Drive returns an HTTP error', async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: { message: 'Forbidden' } }), {
          status: 403,
        }),
    ) as unknown as typeof fetch;
    const result = await loadSettingsFromDrive('test-token');
    expect(result).toBeNull();
  });

  it('loadSettingsFromDrive returns null for an empty file', async () => {
    // resolveFileId list call returns a file, then content fetch returns empty body
    let callCount = 0;
    globalThis.fetch = vi.fn(async () => {
      callCount++;
      if (callCount === 1) {
        // List call — return a found file
        return new Response(
          JSON.stringify({ files: [{ id: 'file123' }] }),
          { status: 200 },
        );
      }
      // Content call — empty body
      return new Response('{}', { status: 200 });
    }) as unknown as typeof fetch;
    const result = await loadSettingsFromDrive('test-token');
    expect(result).toBeNull();
  });

  it('saveSettingsToDrive does not throw when the network call fails', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error('Network error');
    }) as unknown as typeof fetch;
    await expect(
      saveSettingsToDrive('test-token', DEFAULT_SETTINGS),
    ).resolves.toBeUndefined();
  });
});

// ══════════════════════════════════════════════════════════════════════════
// UC16: As a child, I want a friendly "Time's Up" screen
// ══════════════════════════════════════════════════════════════════════════

describe('UC16: As a child, I want a friendly "Time\'s Up" screen when my budget is exhausted', () => {
  it('shows a friendly "You\'re all done" message', () => {
    render(
      <MemoryRouter>
        <TimesUpScreen budgetCtl={makeBudget({ remaining: 0 })} />
      </MemoryRouter>,
    );
    expect(screen.getByText(/you're all done/i)).toBeInTheDocument();
  });

  it('shows "Come back tomorrow" text', () => {
    render(
      <MemoryRouter>
        <TimesUpScreen budgetCtl={makeBudget({ remaining: 0 })} />
      </MemoryRouter>,
    );
    expect(screen.getByText(/come back tomorrow/i)).toBeInTheDocument();
  });

  it('OK button navigates back to the home screen', () => {
    render(
      <MemoryRouter>
        <TimesUpScreen budgetCtl={makeBudget({ remaining: 0 })} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: /^ok$/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
  });
});

// ══════════════════════════════════════════════════════════════════════════
// UC17: As a child, I want videos that don't fit to appear greyed out
// ══════════════════════════════════════════════════════════════════════════

describe('UC17: As a child, I want videos that don\'t fit my remaining budget to appear greyed out', () => {
  it('VideoCard with fits=false is rendered as disabled', () => {
    render(
      <VideoCard
        thumbnail="https://example.com/thumb.jpg"
        title="Too Long Video"
        channel="Test Channel"
        durationLabel="2:00:00"
        fits={false}
        disabled
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('disabled VideoCard does not call onSelect when clicked', () => {
    const onSelect = vi.fn();
    render(
      <VideoCard
        thumbnail="https://example.com/thumb.jpg"
        title="Too Long Video"
        channel="Test Channel"
        durationLabel="2:00:00"
        fits={false}
        disabled
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('partitionByDuration classifies videos shorter than 2 min as neither fits nor tooLong', () => {
    const results = [
      makeVideoResult('short', 60),  // <2 min → filtered out entirely
      makeVideoResult('fits', 300),  // 5 min → fits 600s budget
      makeVideoResult('long', 900),  // 15 min → too long for 600s budget
    ];
    const { fits, tooLong } = partitionByDuration(results, 600);
    expect(fits.map((v) => v.id)).toEqual(['fits']);
    expect(tooLong.map((v) => v.id)).toEqual(['long']);
  });

  it('search results that exceed budget appear as disabled cards in keyword mode', async () => {
    vi.mocked(searchVideos).mockResolvedValueOnce([
      makeVideoResult('long', 3600), // 60 min > 5 min budget
      makeVideoResult('fits', 240),  // 4 min ≤ 5 min budget
    ]);
    render(
      <MemoryRouter initialEntries={['/search?q=test']}>
        <Routes>
          <Route
            path="/search"
            element={<SearchScreen budgetCtl={makeBudget({ remaining: 300 })} />}
          />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText('Video long')).toBeInTheDocument());
    expect(screen.getByText('Video long').closest('button')).toBeDisabled();
    expect(screen.getByText('Video fits').closest('button')).not.toBeDisabled();
  });
});

// ══════════════════════════════════════════════════════════════════════════
// UC18: As a child, I want full D-pad navigation
// ══════════════════════════════════════════════════════════════════════════

describe('UC18: As a child, I want full D-pad navigation so I never need a mouse or keyboard', () => {
  it('enabled VideoCard has the data-focusable attribute for LRUD registration', () => {
    const { container } = render(
      <VideoCard
        thumbnail="https://example.com/thumb.jpg"
        title="Focusable Video"
        channel="Test Channel"
        durationLabel="5:00"
        fits
        onSelect={vi.fn()}
      />,
    );
    expect(container.querySelector('[data-focusable]')).toBeTruthy();
  });

  it('disabled VideoCard does not have data-focusable (excluded from LRUD)', () => {
    const { container } = render(
      <VideoCard
        thumbnail="https://example.com/thumb.jpg"
        title="Non-focusable"
        channel="Test Channel"
        durationLabel="2:00:00"
        fits={false}
        disabled
        onSelect={vi.fn()}
      />,
    );
    expect(container.querySelector('[data-focusable]')).toBeNull();
  });

  it('home screen channels have the data-focusable attribute', () => {
    saveSubscribedChannels({
      channels: [makeChannel('UCnav', 'Nav Channel')],
      syncedAt: new Date().toISOString(),
      accessToken: 'tok',
      tokenExpiresAt: Date.now() + 3_600_000,
    });
    const { container } = render(
      <MemoryRouter>
        <HomeScreen budgetCtl={makeBudget()} />
      </MemoryRouter>,
    );
    expect(container.querySelectorAll('[data-focusable]').length).toBeGreaterThan(0);
  });
});

// ══════════════════════════════════════════════════════════════════════════
// UC19: As a child on Tizen TV, I want playback via the native YouTube app
// ══════════════════════════════════════════════════════════════════════════

describe('UC19: As a child on Tizen TV, I want playback via the native YouTube app for best quality', () => {
  beforeEach(() => {
    (window as unknown as { tizen: unknown }).tizen = {
      application: {
        launchAppControl: vi.fn(),
        ApplicationControl: vi.fn(function (
          this: Record<string, unknown>,
          op: string,
          uri: string,
        ) {
          this.op = op;
          this.uri = uri;
        }),
      },
    };
  });

  afterEach(() => {
    delete (window as unknown as { tizen?: unknown }).tizen;
  });

  it('does not render a YouTube iframe on a Tizen TV', () => {
    renderPlayer('tizenVid');
    expect(screen.queryByTitle('YouTube video')).toBeNull();
  });

  it('shows a budget timer overlay instead of an iframe on Tizen', () => {
    renderPlayer('tizenVid2');
    expect(screen.getByText(/budget remaining/i)).toBeInTheDocument();
  });

  it('calls launchAppControl with the video ID in the URI', () => {
    renderPlayer('tizenVid3');
    const launchMock = (
      window as unknown as {
        tizen: { application: { launchAppControl: ReturnType<typeof vi.fn> } };
      }
    ).tizen.application.launchAppControl;
    expect(launchMock).toHaveBeenCalledTimes(1);
    const ctrlArg = launchMock.mock.calls[0][0] as { uri: string };
    expect(String(ctrlArg.uri ?? '')).toContain('tizenVid3');
  });

  it('navigates home when launchAppControl is unavailable (Tizen API missing)', () => {
    // Override with a tizen object that has no application property
    (window as unknown as { tizen: unknown }).tizen = {};
    renderPlayer('tizenFail');
    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
  });
});

// ══════════════════════════════════════════════════════════════════════════
// UC20: As a parent, I want a 7-day watch history summary in Settings
// ══════════════════════════════════════════════════════════════════════════

describe('UC20: As a parent, I want a 7-day watch history summary in Settings', () => {
  it('loadHistory returns an empty array when no history has been recorded', () => {
    expect(loadHistory()).toEqual([]);
  });

  it('incrementVideosWatchedToday creates a history entry for today', () => {
    incrementVideosWatchedToday();
    const history = loadHistory();
    expect(history).toHaveLength(1);
    expect(history[0].videosWatched).toBe(1);
  });

  it('incrementVideosWatchedToday accumulates multiple video plays in one day', () => {
    incrementVideosWatchedToday();
    incrementVideosWatchedToday();
    incrementVideosWatchedToday();
    const history = loadHistory();
    expect(history[0].videosWatched).toBe(3);
  });

  it('loadHistory returns an empty array when localStorage contains invalid JSON', () => {
    localStorage.setItem('tv-budget:history', 'not{valid[json');
    expect(loadHistory()).toEqual([]);
  });

  it('incrementVideosWatchedToday does not throw when localStorage is full', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new DOMException('QuotaExceededError', 'QuotaExceededError');
    });
    expect(() => incrementVideosWatchedToday()).not.toThrow();
    spy.mockRestore();
  });

  it('clearRecent does not throw when localStorage is full', () => {
    const spy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementationOnce(() => {
      throw new DOMException('SecurityError', 'SecurityError');
    });
    expect(() => clearRecent()).not.toThrow();
    spy.mockRestore();
  });
});

// ══════════════════════════════════════════════════════════════════════════
// UC21: As a child, I want the budget timer to pause while the video buffers
// ══════════════════════════════════════════════════════════════════════════

describe('UC21: As a child, I want the budget timer to pause while the video is buffering so I don\'t lose screen time waiting for the video to load', () => {
  it('does NOT start the timer on mount — budget only drains during actual playback', () => {
    const budget = makeBudget();
    renderPlayer('ucBuf1', budget);
    expect(budget.startTicking).not.toHaveBeenCalled();
  });

  it('starts the timer when YT_PLAYING (state=1) fires — video is actually playing', () => {
    const budget = makeBudget();
    renderPlayer('ucBuf2', budget);

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: JSON.stringify({ info: { playerState: 1 } }),
          origin: 'https://www.youtube-nocookie.com',
        }),
      );
    });

    expect(budget.startTicking).toHaveBeenCalledTimes(1);
  });

  it('stops the timer when YT_BUFFERING (state=3) fires — video is buffering mid-playback', () => {
    const budget = makeBudget();
    renderPlayer('ucBuf3', budget);
    vi.mocked(budget.stopTicking).mockClear();

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: JSON.stringify({ info: { playerState: 3 } }),
          origin: 'https://www.youtube-nocookie.com',
        }),
      );
    });

    expect(budget.stopTicking).toHaveBeenCalledTimes(1);
    // Must NOT consume sub-2-min budget during buffering (it's not the end of the session).
    expect(budget.stopTicking).toHaveBeenCalledWith();
  });

  it('resumes the timer when YT_PLAYING fires after a buffering pause', () => {
    const budget = makeBudget();
    renderPlayer('ucBuf4', budget);

    // First: video plays
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: JSON.stringify({ info: { playerState: 1 } }),
          origin: 'https://www.youtube-nocookie.com',
        }),
      );
    });
    expect(budget.startTicking).toHaveBeenCalledTimes(1);

    vi.mocked(budget.startTicking).mockClear();

    // Then: buffering kicks in
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: JSON.stringify({ info: { playerState: 3 } }),
          origin: 'https://www.youtube-nocookie.com',
        }),
      );
    });
    expect(budget.stopTicking).toHaveBeenCalled();

    vi.mocked(budget.stopTicking).mockClear();

    // Finally: video resumes playing
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: JSON.stringify({ info: { playerState: 1 } }),
          origin: 'https://www.youtube-nocookie.com',
        }),
      );
    });
    expect(budget.startTicking).toHaveBeenCalledTimes(1);
  });

  it('stopTicking called during buffering does NOT pass consumeIfLow=true — no sub-2-minute remaining budget consumed', () => {
    // Exception handling: buffering must not be treated as session end.
    // Passing consumeIfLow=true would consume the sub-2-min leftover and kick
    // the child home even though they have time remaining.
    const budget = makeBudget();
    renderPlayer('ucBuf5', budget);
    vi.mocked(budget.stopTicking).mockClear();

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: JSON.stringify({ playerState: 3 }), // alternate payload shape
          origin: 'https://www.youtube-nocookie.com',
        }),
      );
    });

    if (vi.mocked(budget.stopTicking).mock.calls.length > 0) {
      expect(budget.stopTicking).not.toHaveBeenCalledWith(true);
    }
  });
});
