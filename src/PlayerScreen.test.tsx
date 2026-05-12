/**
 * PlayerScreen tests.
 *
 * Key invariants we guard:
 *  1. An <iframe> (not a blank div) is rendered for a valid videoId.
 *  2. The iframe src contains the videoId and uses the youtube-nocookie domain.
 *  3. Back/Escape/XF86Back key navigates home.
 *  4. budgetCtl.stopTicking() is called on unmount.
 *  5. budgetCtl.startTicking() is called on mount (immediate — no waiting for YT API).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PlayerScreen } from './PlayerScreen';
import type { UseBudget } from './useBudget';

// Mock LRUD — not needed for PlayerScreen (no focusable elements).
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
    budget: { date: '2026-05-11', dailyLimitSeconds: 3600, secondsUsedToday: 0, bonusSecondsToday: 0 },
    remaining: 3600,
    noNewVideos: false,
    startTicking: vi.fn(),
    stopTicking: vi.fn(),
    addBonusSeconds: vi.fn(),
    refresh: vi.fn(),
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
});

describe('PlayerScreen', () => {
  it('renders an <iframe> element (not a blank container)', () => {
    renderPlayer();
    expect(screen.getByTitle('YouTube video')).toBeInTheDocument();
    expect(screen.getByTitle('YouTube video').tagName).toBe('IFRAME');
  });

  it('iframe src contains the video ID', () => {
    renderPlayer('dQw4w9WgXcQ');
    const iframe = screen.getByTitle('YouTube video') as HTMLIFrameElement;
    expect(iframe.src).toContain('dQw4w9WgXcQ');
  });

  it('iframe src uses youtube-nocookie.com (not intercepted by Samsung native handler)', () => {
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

  it('navigates home on Escape key', () => {
    renderPlayer();
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
  });

  it('navigates home on XF86Back key (Samsung remote Back button)', () => {
    renderPlayer();
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'XF86Back', bubbles: true }));
    });
    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
  });

  it('navigates home on Backspace key', () => {
    renderPlayer();
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
    });
    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
  });

  it('navigates home when YouTube postMessage signals video ENDED (state=0)', () => {
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
    // Reset so we can check it was called again from postMessage
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

  it('renders nothing when videoId is missing from URL', () => {
    const budget = makeBudget();
    const { container } = render(
      <MemoryRouter initialEntries={['/play/']}>
        <Routes>
          <Route path="/play/:videoId" element={<PlayerScreen budgetCtl={budget} />} />
          <Route path="/play/" element={<PlayerScreen budgetCtl={budget} />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(container.querySelector('iframe')).toBeNull();
  });
});
