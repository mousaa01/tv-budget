/**
 * youtube.ts integration tests — focused on the pieces that have actually
 * broken in production:
 *   - fetchChannelFeed uses playlistItems.list (cheap quota, reliable
 *     pagination) against the channel's UU... uploads playlist, not the
 *     expensive search.list endpoint that triggered "Couldn't search" errors.
 *   - When the API returns an HTTP error, the thrown Error message includes
 *     the response status AND the API's error.message body so the UI can
 *     show something diagnosable instead of a generic "try again".
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchChannelFeed } from './youtube';

const ORIGINAL_FETCH = globalThis.fetch;

beforeEach(() => {
  // Clear the localStorage feed cache so each test starts fresh — otherwise
  // the first fetchChannelFeed call writes a cache entry that later tests
  // would serve instead of hitting the per-test mocked fetch.
  localStorage.clear();

  // Provide a stub VITE_YT_API_KEY for the module's getKey() call.
  // import.meta.env is read fresh on each invocation.
  (import.meta as unknown as { env: Record<string, string> }).env = {
    ...(import.meta as unknown as { env: Record<string, string> }).env,
    VITE_YT_API_KEY: 'TEST_KEY',
  };
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  vi.restoreAllMocks();
});

describe('fetchChannelFeed', () => {
  it('uses playlistItems.list against the UU uploads playlist (1 unit, not search.list 100 units)', async () => {
    const fetchSpy = vi.fn(async (url: RequestInfo | URL) => {
      const u = typeof url === 'string' ? url : url.toString();
      if (u.includes('/playlistItems')) {
        // Channel UCdudu → uploads UUdudu
        expect(u).toContain('playlistId=UUdudu');
        expect(u).toContain('part=snippet%2CcontentDetails');
        expect(u).not.toContain('safeSearch'); // playlistItems doesn't accept it
        return new Response(
          JSON.stringify({
            items: [
              {
                contentDetails: { videoId: 'vid_aaa' },
                snippet: {
                  title: 'A toy review',
                  videoOwnerChannelTitle: 'DuDuPopTOY',
                  videoOwnerChannelId: 'UCdudu',
                  channelId: 'UCsomethingElse',
                  thumbnails: { default: { url: 'http://example/aaa.jpg' } },
                },
              },
            ],
            nextPageToken: 'PAGE2',
          }),
          { status: 200 },
        );
      }
      if (u.includes('/videos')) {
        return new Response(
          JSON.stringify({
            items: [{ id: 'vid_aaa', contentDetails: { duration: 'PT4M44S' } }],
          }),
          { status: 200 },
        );
      }
      throw new Error(`unexpected fetch: ${u}`);
    });
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const page = await fetchChannelFeed('UCdudu');
    expect(page.nextPageToken).toBe('PAGE2');
    expect(page.videos).toHaveLength(1);
    expect(page.videos[0]).toMatchObject({
      id: 'vid_aaa',
      title: 'A toy review',
      // Should prefer videoOwnerChannelTitle over snippet.channelTitle
      channelTitle: 'DuDuPopTOY',
      channelId: 'UCdudu',
      durationSeconds: 4 * 60 + 44,
    });
    // No search.list call — only playlistItems + videos
    const calls = fetchSpy.mock.calls.map((c) =>
      typeof c[0] === 'string' ? c[0] : c[0].toString(),
    );
    expect(calls.some((c) => c.includes('/search?'))).toBe(false);
  });

  it('passes pageToken through for pagination', async () => {
    const fetchSpy = vi.fn(async (url: RequestInfo | URL) => {
      const u = typeof url === 'string' ? url : url.toString();
      if (u.includes('/playlistItems')) {
        expect(u).toContain('pageToken=PAGE2');
        return new Response(
          JSON.stringify({ items: [], nextPageToken: undefined }),
          { status: 200 },
        );
      }
      // hydrateDurations short-circuits when items is empty
      throw new Error(`unexpected fetch: ${u}`);
    });
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const page = await fetchChannelFeed('UCdudu', 'PAGE2');
    expect(page.videos).toEqual([]);
    expect(page.nextPageToken).toBeUndefined();
  });

  it('surfaces the API error message on failure (not a generic "try again")', async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            error: { message: 'The request cannot be completed because you have exceeded your quota.' },
          }),
          { status: 403 },
        ),
    ) as unknown as typeof fetch;

    await expect(fetchChannelFeed('UCdudu')).rejects.toThrow(/403/);
    await expect(fetchChannelFeed('UCdudu')).rejects.toThrow(/exceeded your quota/);
  });

  it('skips items with no videoId (private/deleted uploads)', async () => {
    const fetchSpy = vi.fn(async (url: RequestInfo | URL) => {
      const u = typeof url === 'string' ? url : url.toString();
      if (u.includes('/playlistItems')) {
        return new Response(
          JSON.stringify({
            items: [
              { contentDetails: {}, snippet: { title: 'Deleted', channelId: 'UCdudu', thumbnails: { default: { url: 'x' } } } },
              {
                contentDetails: { videoId: 'good' },
                snippet: { title: 'Good', channelId: 'UCdudu', videoOwnerChannelTitle: 'DuDuPopTOY', thumbnails: { default: { url: 'y' } } },
              },
            ],
          }),
          { status: 200 },
        );
      }
      if (u.includes('/videos')) {
        return new Response(
          JSON.stringify({ items: [{ id: 'good', contentDetails: { duration: 'PT5M' } }] }),
          { status: 200 },
        );
      }
      throw new Error(`unexpected fetch: ${u}`);
    });
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const page = await fetchChannelFeed('UCdudu');
    expect(page.videos.map((v) => v.id)).toEqual(['good']);
  });
});
