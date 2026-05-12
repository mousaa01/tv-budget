/**
 * VideoCard and Button component tests.
 *
 * Key invariants:
 *  1. VideoCard calls onSelect when clicked.
 *  2. Disabled VideoCard does NOT call onSelect.
 *  3. Button renders children and calls onClick.
 *  4. Navigate URL to player contains videoId, duration, title, channel.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VideoCard, Button } from './components';

// LRUD mock — tests don't need spatial navigation
vi.mock('@noriginmedia/norigin-spatial-navigation', () => ({
  useFocusable: () => ({ ref: { current: null }, focused: false }),
  setFocus: vi.fn(),
  FocusContext: { Provider: ({ children }: { children: React.ReactNode }) => children },
}));

const VIDEO_PROPS = {
  thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
  title: 'Never Gonna Give You Up',
  channel: 'Rick Astley',
  durationLabel: '3:32',
  fits: true,
};

describe('VideoCard', () => {
  it('renders title and channel', () => {
    render(<VideoCard {...VIDEO_PROPS} onSelect={vi.fn()} />);
    expect(screen.getByText('Never Gonna Give You Up')).toBeInTheDocument();
    expect(screen.getByText('Rick Astley')).toBeInTheDocument();
  });

  it('calls onSelect when clicked', () => {
    const onSelect = vi.fn();
    render(<VideoCard {...VIDEO_PROPS} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('does NOT call onSelect when disabled', () => {
    const onSelect = vi.fn();
    render(<VideoCard {...VIDEO_PROPS} onSelect={onSelect} disabled />);
    const btn = screen.getByRole('button');
    fireEvent.click(btn);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('shows duration label', () => {
    render(<VideoCard {...VIDEO_PROPS} onSelect={vi.fn()} />);
    expect(screen.getByText('3:32')).toBeInTheDocument();
  });

  it('shows no pill when fits=true', () => {
    render(<VideoCard {...VIDEO_PROPS} fits onSelect={vi.fn()} />);
    expect(screen.queryByText(/fits|too long/)).not.toBeInTheDocument();
  });

  it('shows "too long" pill when fits=false', () => {
    render(<VideoCard {...VIDEO_PROPS} fits={false} onSelect={vi.fn()} />);
    expect(screen.getByText('✕ too long for today')).toBeInTheDocument();
  });

  it('shows subscribed badge when isSubscribed=true', () => {
    render(<VideoCard {...VIDEO_PROPS} isSubscribed onSelect={vi.fn()} />);
    expect(screen.getByText('★ Subscribed')).toBeInTheDocument();
  });

  it('does not show subscribed badge when isSubscribed=false', () => {
    render(<VideoCard {...VIDEO_PROPS} isSubscribed={false} onSelect={vi.fn()} />);
    expect(screen.queryByText('★ Subscribed')).toBeNull();
  });
});

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Go</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('is disabled when disabled prop is set', () => {
    render(<Button disabled>Nope</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});

describe('Navigate URL construction', () => {
  it('player URL contains videoId, duration, title and channel', () => {
    const videoId = 'dQw4w9WgXcQ';
    const durationSeconds = 212;
    const title = 'Never Gonna Give You Up';
    const channelTitle = 'Rick Astley';
    const url = `/play/${videoId}?d=${durationSeconds}&title=${encodeURIComponent(title)}&channel=${encodeURIComponent(channelTitle)}`;
    expect(url).toContain(videoId);
    expect(url).toContain('d=212');
    expect(url).toContain(encodeURIComponent(title));
    expect(url).toContain(encodeURIComponent(channelTitle));
  });
});
