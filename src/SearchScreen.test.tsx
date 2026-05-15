/**
 * SearchScreen tests — channel-mode pagination.
 *
 * Verifies that when a channel is selected, EVERY video from that channel
 * meeting the time-budget criteria (>= 2 min, <= remaining time) is
 * eventually accessible to the user (via pagination through "Load more").
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SearchScreen } from './SearchScreen';
import type { UseBudget } from './useBudget';
import type { VideoResult } from './types';

vi.mock('@noriginmedia/norigin-spatial-navigation', () => ({
  useFocusable: () => ({ ref: { current: null }, focused: false }),
  setFocus: vi.fn(),
  FocusContext: { Provider: ({ children }: { children: React.ReactNode }) => children },
}));

// fetchChannelFeed is the only YT entry-point we exercise here.
const fetchChannelFeedMock = vi.fn();
vi.mock('./youtube', async (importActual) => {
  const actual = await importActual<typeof import('./youtube')>();
  return {
    ...actual,
    fetchChannelFeed: (...args: unknown[]) => fetchChannelFeedMock(...args),
    searchVideos: vi.fn(),
  };
});

vi.mock('./storage', () => ({
  loadSettings: () => ({
    morningLimitMinutes: 60,
    afternoonLimitMinutes: 60,
    blocklistKeywords: [],
    channelAllowlist: [],
    pin: '0000',
    coolDownEnabled: false,
  }),
  loadSubscribedChannels: () => ({ channels: [], syncedAt: 0 }),
}));

function makeBudget(remaining = 3600): UseBudget {
  return {
    budget: {
      date: '2026-05-12',
      // Set both windows to `remaining` so tests pass regardless of clock time.
      morningLimitSeconds: remaining,
      morningSecondsUsed: 0,
      morningBonusSeconds: 0,
      afternoonLimitSeconds: remaining,
      afternoonSecondsUsed: 0,
      afternoonBonusSeconds: 0,
    },
    remaining,
    noNewVideos: false,
    startTicking: vi.fn(),
    stopTicking: vi.fn(),
    addBonusSeconds: vi.fn(),
    refresh: vi.fn(),
    fiveMinuteWarning: 0,
  };
}

function makeVideo(id: string, durationSeconds: number): VideoResult {
  return {
    id,
    title: `Video ${id}`,
    channelTitle: 'Test Channel',
    channelId: 'UC_test',
    thumbnail: `https://example.com/${id}.jpg`,
    durationSeconds,
  };
}

function renderChannel() {
  render(
    <MemoryRouter initialEntries={['/search?channelId=UC_test&title=Test%20Channel']}>
      <Routes>
        <Route path="/search" element={<SearchScreen budgetCtl={makeBudget(3600)} />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  fetchChannelFeedMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SearchScreen channel mode', () => {
  it('eventually exposes every video meeting the time criteria across paginated pages', async () => {
    // Page 1: 3 valid (>=120s, <=3600s) + 1 too-short (60s, filtered out)
    // Page 2: 2 valid + 1 too-long (4000s, filtered out)
    // Page 3: 2 valid, no further token
    const page1 = {
      videos: [
        makeVideo('a', 180),
        makeVideo('b', 600),
        makeVideo('c', 60),   // filtered: < 2 min
        makeVideo('d', 1500),
      ],
      nextPageToken: 'PAGE2',
    };
    const page2 = {
      videos: [
        makeVideo('e', 240),
        makeVideo('f', 4000), // filtered: longer than remaining
        makeVideo('g', 900),
      ],
      nextPageToken: 'PAGE3',
    };
    const page3 = {
      videos: [makeVideo('h', 200), makeVideo('i', 300)],
      nextPageToken: undefined,
    };

    fetchChannelFeedMock
      .mockResolvedValueOnce(page1)
      .mockResolvedValueOnce(page2)
      .mockResolvedValueOnce(page3);

    renderChannel();

    // Page 1 settles
    await waitFor(() => expect(screen.getByText('Video a')).toBeInTheDocument());
    expect(screen.getByText('Video b')).toBeInTheDocument();
    expect(screen.getByText('Video d')).toBeInTheDocument();
    expect(screen.queryByText('Video c')).not.toBeInTheDocument(); // too short — fully filtered

    // Click load-more for page 2
    await act(async () => { fireEvent.click(screen.getByText('Load more videos')); });
    await waitFor(() => expect(screen.getByText('Video e')).toBeInTheDocument());
    expect(screen.getByText('Video g')).toBeInTheDocument();
    // Video f (4000s) is too long for the 1h budget — appears as DISABLED card,
    // not hidden, so the user knows the channel has more content.
    expect(screen.getByText('Video f')).toBeInTheDocument();
    expect(screen.getByText('Video f').closest('button')).toBeDisabled();

    // Click load-more for page 3
    await act(async () => { fireEvent.click(screen.getByText('Load more videos')); });
    await waitFor(() => expect(screen.getByText('Video h')).toBeInTheDocument());
    expect(screen.getByText('Video i')).toBeInTheDocument();

    // No more pages — Load more button hidden
    expect(screen.queryByText('Load more videos')).not.toBeInTheDocument();

    // Final assertion: every eligible video (>=120s, <=3600s) is visible
    const eligibleIds = ['a', 'b', 'd', 'e', 'g', 'h', 'i'];
    for (const id of eligibleIds) {
      expect(screen.getByText(`Video ${id}`)).toBeInTheDocument();
      expect(screen.getByText(`Video ${id}`).closest('button')).not.toBeDisabled();
    }

    // Sub-2-min Shorts are still fully filtered (never visible).
    expect(screen.queryByText('Video c')).not.toBeInTheDocument();

    // Three pages requested with the expected page tokens
    expect(fetchChannelFeedMock).toHaveBeenNthCalledWith(1, 'UC_test');
    expect(fetchChannelFeedMock).toHaveBeenNthCalledWith(2, 'UC_test', 'PAGE2');
    expect(fetchChannelFeedMock).toHaveBeenNthCalledWith(3, 'UC_test', 'PAGE3');
  });

  it('auto-paginates when the first page contains zero eligible videos (e.g. all Shorts)', async () => {
    // Page 1: 50 sub-2-min Shorts → 0 fits.
    // Page 2: 2 valid videos → fits found, auto-pagination stops.
    const shorts = Array.from({ length: 50 }, (_, i) => makeVideo(`s${i}`, 60));
    const page1 = { videos: shorts, nextPageToken: 'PAGE2' };
    const page2 = {
      videos: [makeVideo('real1', 240), makeVideo('real2', 300)],
      nextPageToken: undefined,
    };
    fetchChannelFeedMock
      .mockResolvedValueOnce(page1)
      .mockResolvedValueOnce(page2);

    renderChannel();

    // Without intervention, real videos from page 2 should appear automatically.
    await waitFor(() => expect(screen.getByText('Video real1')).toBeInTheDocument());
    expect(screen.getByText('Video real2')).toBeInTheDocument();
    expect(fetchChannelFeedMock).toHaveBeenCalledTimes(2);
    expect(fetchChannelFeedMock).toHaveBeenNthCalledWith(2, 'UC_test', 'PAGE2');
  });

  it('caps auto-pagination so an all-Shorts channel does not loop forever', async () => {
    // Every page is shorts only with a next token — auto loader must stop
    // after MAX_AUTO_PAGES (8) follow-ups (1 initial + 8 auto = 9 total).
    fetchChannelFeedMock.mockImplementation((_id: string, token?: string) => {
      const next = token ? `${token}_n` : 'P1';
      return Promise.resolve({
        videos: [makeVideo(`short_${next}`, 60)],
        nextPageToken: next,
      });
    });

    renderChannel();

    // Wait long enough for all auto-loads to settle.
    await waitFor(
      () => expect(fetchChannelFeedMock).toHaveBeenCalledTimes(9),
      { timeout: 5000 },
    );

    // Stays at 9 — does not keep paging.
    await new Promise((r) => setTimeout(r, 100));
    expect(fetchChannelFeedMock).toHaveBeenCalledTimes(9);
  });

  it('does not show videos longer than the live remaining budget', async () => {
    // Render with only 200 seconds remaining: the 600s video is filtered out.
    fetchChannelFeedMock.mockResolvedValue({
      videos: [makeVideo('short_ok', 180), makeVideo('long_no', 600)],
      nextPageToken: undefined,
    });
    render(
      <MemoryRouter initialEntries={['/search?channelId=UC_test&title=Test%20Channel']}>
        <Routes>
          <Route path="/search" element={<SearchScreen budgetCtl={makeBudget(200)} />} />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText('Video short_ok')).toBeInTheDocument());
    // The too-long video IS shown (as a disabled card) so the user knows it exists.
    expect(screen.getByText('Video long_no')).toBeInTheDocument();
    // ...but its card is disabled so it cannot be selected/navigated to.
    const longBtn = screen.getByText('Video long_no').closest('button');
    expect(longBtn).toBeDisabled();
    const okBtn = screen.getByText('Video short_ok').closest('button');
    expect(okBtn).not.toBeDisabled();
  });

  it('DuDuPopTOY scenario: 9-min budget, page 1 all 10-20 min, page 2 has a 5-min video — auto-paginates to find it', async () => {
    // First page mimics DuDuPopTOY: all toy reviews 10-20 min (none fit 9 min).
    // Second page contains a 5-min clip that DOES fit. Auto-paginator must
    // keep going past tooLong results to surface the playable video.
    const tooLong = [
      makeVideo('dudu1', 12 * 60),
      makeVideo('dudu2', 15 * 60),
      makeVideo('dudu3', 18 * 60),
      makeVideo('dudu4', 10 * 60),
      makeVideo('dudu5', 20 * 60),
    ];
    const page2 = {
      videos: [makeVideo('dudu_short', 5 * 60), makeVideo('dudu6', 14 * 60)],
      nextPageToken: undefined,
    };
    fetchChannelFeedMock
      .mockResolvedValueOnce({ videos: tooLong, nextPageToken: 'PAGE2' })
      .mockResolvedValueOnce(page2);

    render(
      <MemoryRouter initialEntries={['/search?channelId=UCdudu&title=DuDuPopTOY']}>
        <Routes>
          <Route path="/search" element={<SearchScreen budgetCtl={makeBudget(561)} />} />
        </Routes>
      </MemoryRouter>,
    );

    // The 5-min video from page 2 must appear, and be enabled (not disabled).
    await waitFor(() => expect(screen.getByText('Video dudu_short')).toBeInTheDocument());
    expect(screen.getByText('Video dudu_short').closest('button')).not.toBeDisabled();
    // The too-long videos still appear as disabled cards.
    expect(screen.getByText('Video dudu1').closest('button')).toBeDisabled();
    // Two pages fetched total.
    expect(fetchChannelFeedMock).toHaveBeenCalledTimes(2);
  });

  it('hides too-long cards while auto-pagination is still searching for fits', async () => {
    // The root cause of the "lag" bug: page 1 returns 0 fits + some tooLong
    // videos. Previously they were shown as disabled cards immediately, then
    // "went away" visually once fits were found on page 2. The fix: suppress
    // tooLong cards whenever isStillLooking is true.
    let resolvePage2!: (val: unknown) => void;
    const page2Promise = new Promise<unknown>((resolve) => {
      resolvePage2 = resolve;
    });
    fetchChannelFeedMock
      .mockResolvedValueOnce({ videos: [makeVideo('long_p1', 4500)], nextPageToken: 'PAGE2' })
      .mockReturnValueOnce(page2Promise); // page 2 is deliberately in-flight

    renderChannel();

    // Wait for auto-pagination to fire (page 2 fetch in-flight).
    await waitFor(() => expect(fetchChannelFeedMock).toHaveBeenCalledTimes(2));

    // While page 2 is pending, the tooLong card from page 1 must NOT be visible.
    // isStillLooking = true (fits.length=0, nextPageToken set, pages<MAX).
    expect(screen.queryByText('Video long_p1')).not.toBeInTheDocument();

    // Resolve page 2 with a fit video.
    resolvePage2({ videos: [makeVideo('fit_p2', 300)], nextPageToken: undefined });

    // Now the fit appears, and the previously-suppressed tooLong card is revealed.
    await waitFor(() => expect(screen.getByText('Video fit_p2')).toBeInTheDocument());
    expect(screen.getByText('Video long_p1')).toBeInTheDocument();
    expect(screen.getByText('Video long_p1').closest('button')).toBeDisabled();
  });

  it('text search: low budget shows over-budget results as disabled, not as empty list', async () => {
    // Mock searchVideos via youtube module — re-mock the module per-test.
    const { searchVideos } = await import('./youtube');
    vi.mocked(searchVideos).mockResolvedValueOnce([
      makeVideo('s1', 480), // 8 min — too long for 5 min budget
      makeVideo('s2', 240), // 4 min — fits
    ]);

    render(
      <MemoryRouter initialEntries={['/search?q=lego']}>
        <Routes>
          <Route path="/search" element={<SearchScreen budgetCtl={makeBudget(300)} />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('Video s2')).toBeInTheDocument());
    expect(screen.getByText('Video s1')).toBeInTheDocument();
    expect(screen.getByText('Video s2').closest('button')).not.toBeDisabled();
    expect(screen.getByText('Video s1').closest('button')).toBeDisabled();
  });
});
