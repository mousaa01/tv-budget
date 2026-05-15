import { parse, toSeconds } from 'iso8601-duration';
import type { SubscribedChannel, VideoResult } from './types';

const API_BASE = 'https://www.googleapis.com/youtube/v3';

// ---------------------------------------------------------------------------
// Per-channel feed cache (localStorage, 1-hour TTL)
// Caches the first page of hydrated VideoResult[] per channel so repeat
// visits are instant — no API calls needed until the cache goes stale.
// ---------------------------------------------------------------------------
const FEED_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const FEED_CACHE_KEY_PREFIX = 'tv-budget:feed:';

interface FeedCache {
  videos: VideoResult[];
  cachedAt: number;
}

function loadFeedCache(channelId: string): VideoResult[] | null {
  try {
    const raw = localStorage.getItem(FEED_CACHE_KEY_PREFIX + channelId);
    if (!raw) return null;
    const c = JSON.parse(raw) as FeedCache;
    if (Date.now() - c.cachedAt > FEED_CACHE_TTL_MS) return null;
    return c.videos;
  } catch { return null; }
}

function saveFeedCache(channelId: string, videos: VideoResult[]): void {
  try {
    localStorage.setItem(
      FEED_CACHE_KEY_PREFIX + channelId,
      JSON.stringify({ videos, cachedAt: Date.now() } satisfies FeedCache),
    );
  } catch { /* ignore quota exceeded */ }
}

function getKey(): string {
  const k = import.meta.env.VITE_YT_API_KEY;
  if (!k) throw new Error('Missing VITE_YT_API_KEY in .env');
  return k;
}

interface SearchListItem {
  id: { videoId: string };
  snippet: {
    title: string;
    channelTitle: string;
    channelId: string;
    thumbnails: { medium?: { url: string }; high?: { url: string }; default: { url: string } };
  };
}

// playlistItems.list returns items shaped slightly differently — videoId lives
// under `contentDetails.videoId` and the snippet has `videoOwnerChannelId`.
interface PlaylistItem {
  contentDetails: { videoId: string };
  snippet: {
    title: string;
    channelTitle?: string;
    videoOwnerChannelTitle?: string;
    videoOwnerChannelId?: string;
    channelId: string;
    thumbnails: { medium?: { url: string }; high?: { url: string }; default: { url: string } };
  };
}

interface VideosListItem {
  id: string;
  contentDetails: { duration: string };
}

export interface SearchOptions {
  maxResults?: number;
  channelIds?: string[];
}

export interface ChannelFeedPage {
  videos: VideoResult[];
  nextPageToken?: string;
}

// The YouTube convention: a channel's "uploads" playlist ID is the channel ID
// with the second character flipped from 'C' to 'U'. e.g. UCxxxx -> UUxxxx.
// This avoids a separate channels.list lookup and works for every channel.
function uploadsPlaylistId(channelId: string): string {
  if (channelId.length < 2 || channelId[1] !== 'C') return channelId;
  return channelId[0] + 'U' + channelId.slice(2);
}

/**
 * Fetch a single page of a channel's uploads.
 *
 * Uses `playlistItems.list` against the channel's auto-generated uploads
 * playlist (UU...) instead of `search.list`. Reasons:
 *   1. Quota: playlistItems = 1 unit/call vs search = 100 units/call. With
 *      auto-pagination through 8 pages, that's 8 vs 800 units — search.list
 *      is the difference between working all day and breaking after a couple
 *      of channel browses.
 *   2. Reliability: search.list with videoEmbeddable+safeSearch occasionally
 *      returns 5xx or empty pages mid-pagination. playlistItems is stable.
 *   3. Completeness: every uploaded video appears in uploads, in order.
 *      search.list silently drops some.
 *
 * Trade-off: playlistItems doesn't accept safeSearch — but our blocklist
 * filter and the kid-friendly channel allowlist already provide that gate.
 */
export async function fetchChannelFeed(
  channelId: string,
  pageToken?: string
): Promise<ChannelFeedPage> {
  // Serve first page from cache if fresh — makes repeat channel visits instant.
  if (!pageToken) {
    const cached = loadFeedCache(channelId);
    if (cached) return { videos: cached };
  }

  const key = getKey();
  const playlistId = uploadsPlaylistId(channelId);
  const params = new URLSearchParams({
    key,
    part: 'snippet,contentDetails',
    playlistId,
    maxResults: '50',
  });
  if (pageToken) params.set('pageToken', pageToken);
  const res = await fetch(`${API_BASE}/playlistItems?${params.toString()}`);
  if (!res.ok) {
    let detail = '';
    try {
      const errBody = (await res.json()) as { error?: { message?: string } };
      detail = errBody.error?.message ?? '';
    } catch { /* ignore body parse errors */ }
    throw new Error(`YouTube channel feed failed (${res.status})${detail ? `: ${detail}` : ''}`);
  }
  const data = (await res.json()) as { items: PlaylistItem[]; nextPageToken?: string };
  // Convert PlaylistItem → SearchListItem-shaped objects so the rest of the
  // pipeline (hydrateDurations) is unchanged.
  const items: SearchListItem[] = (data.items ?? [])
    .filter((it) => it.contentDetails?.videoId)
    .map((it) => ({
      id: { videoId: it.contentDetails.videoId },
      snippet: {
        title: it.snippet.title,
        channelTitle:
          it.snippet.videoOwnerChannelTitle ?? it.snippet.channelTitle ?? '',
        channelId:
          it.snippet.videoOwnerChannelId ?? it.snippet.channelId ?? channelId,
        thumbnails: it.snippet.thumbnails,
      },
    }));
  const videos = await hydrateDurations(items, key);
  // Write first-page results to cache for instant repeat visits.
  if (!pageToken) saveFeedCache(channelId, videos);
  return { videos, nextPageToken: data.nextPageToken };
}

export async function searchVideos(query: string, opts: SearchOptions = {}): Promise<VideoResult[]> {
  const key = getKey();
  const max = opts.maxResults ?? 25;

  // If channel allowlist set, fan out one call per channel and merge
  if (opts.channelIds && opts.channelIds.length > 0) {
    const all = await Promise.all(
      opts.channelIds.map((cid) =>
        fetchSearchPage(query, key, max, cid).catch(() => [] as SearchListItem[])
      )
    );
    return await hydrateDurations(all.flat(), key);
  }

  const items = await fetchSearchPage(query, key, max);
  return await hydrateDurations(items, key);
}

async function fetchSearchPage(
  query: string,
  key: string,
  max: number,
  channelId?: string
): Promise<SearchListItem[]> {
  const params = new URLSearchParams({
    key,
    part: 'snippet',
    q: query,
    type: 'video',
    safeSearch: 'strict',
    maxResults: String(max),
    videoEmbeddable: 'true',
  });
  if (channelId) params.set('channelId', channelId);
  const res = await fetch(`${API_BASE}/search?${params.toString()}`);
  if (!res.ok) throw new Error(`YouTube search failed: ${res.status}`);
  const data = (await res.json()) as { items: SearchListItem[] };
  return data.items ?? [];
}

async function hydrateDurations(
  items: SearchListItem[],
  key: string
): Promise<VideoResult[]> {
  if (items.length === 0) return [];
  const ids = items.map((i) => i.id.videoId).filter(Boolean);
  if (ids.length === 0) return [];

  const params = new URLSearchParams({
    key,
    part: 'contentDetails',
    id: ids.join(','),
  });
  const res = await fetch(`${API_BASE}/videos?${params.toString()}`);
  if (!res.ok) throw new Error(`YouTube videos.list failed: ${res.status}`);
  const data = (await res.json()) as { items: VideosListItem[] };

  const durMap = new Map<string, number>();
  for (const v of data.items) {
    try {
      durMap.set(v.id, toSeconds(parse(v.contentDetails.duration)));
    } catch {
      durMap.set(v.id, 0);
    }
  }

  return items
    .filter((i) => durMap.has(i.id.videoId))
    .map<VideoResult>((i) => ({
      id: i.id.videoId,
      title: i.snippet.title,
      channelTitle: i.snippet.channelTitle,
      channelId: i.snippet.channelId,
      thumbnail:
        i.snippet.thumbnails.medium?.url ??
        i.snippet.thumbnails.high?.url ??
        i.snippet.thumbnails.default.url,
      durationSeconds: durMap.get(i.id.videoId) ?? 0,
    }));
}

export function applyBlocklist(results: VideoResult[], keywords: string[]): VideoResult[] {
  if (keywords.length === 0) return results;
  const lowered = keywords.map((k) => k.toLowerCase()).filter(Boolean);
  return results.filter((r) => {
    const hay = r.title.toLowerCase();
    return !lowered.some((k) => hay.includes(k));
  });
}

const MIN_VIDEO_SECONDS = 120; // filter out videos shorter than 2 minutes

export function partitionByDuration(
  results: VideoResult[],
  remainingSeconds: number
): { fits: VideoResult[]; tooLong: VideoResult[] } {
  const fits: VideoResult[] = [];
  const tooLong: VideoResult[] = [];
  for (const r of results) {
    if (r.durationSeconds > 0 && r.durationSeconds < MIN_VIDEO_SECONDS) continue;
    if (r.durationSeconds > 0 && r.durationSeconds <= remainingSeconds) fits.push(r);
    else tooLong.push(r);
  }
  return { fits, tooLong };
}

interface ChannelsListResponse {
  items?: Array<{
    id: string;
    snippet: {
      title: string;
      thumbnails?: {
        default?: { url: string };
        medium?: { url: string };
        high?: { url: string };
      };
    };
  }>;
}

/**
 * Looks up a YouTube channel's metadata (id, title, thumbnail) from a
 * channel ID, @handle, or YouTube URL. Uses channels.list (1 quota unit).
 *
 * Accepted input formats:
 *   - https://www.youtube.com/@DisneyJunior
 *   - https://www.youtube.com/channel/UCxxxx
 *   - @DisneyJunior
 *   - UCxxxx (24-char channel ID)
 *   - DisneyJunior  (plain name, tried as @handle)
 */
export async function lookupChannel(input: string): Promise<SubscribedChannel> {
  const key = getKey();
  const trimmed = input.trim().replace(/\/+$/, '');

  // Parse common YouTube URL shapes
  let resolved = trimmed;
  const ytUrl = trimmed.match(
    /youtube\.com\/(?:@([\w.-]+)|channel\/(UC[\w-]+)|c\/([\w.-]+)|user\/([\w.-]+))/i,
  );
  if (ytUrl) {
    if (ytUrl[2]) resolved = ytUrl[2];             // /channel/UCxxx → channel ID
    else if (ytUrl[1]) resolved = '@' + ytUrl[1];  // /@handle
    else if (ytUrl[3]) resolved = '@' + ytUrl[3];  // /c/name → try as handle
    else if (ytUrl[4]) resolved = ytUrl[4];        // /user/name
  }

  const params = new URLSearchParams({ key, part: 'snippet' });
  if (/^UC[\w-]{22}$/.test(resolved)) {
    params.set('id', resolved);
  } else if (resolved.startsWith('@')) {
    params.set('forHandle', resolved);
  } else {
    // Plain text (no @) — prepend @ and try as handle
    params.set('forHandle', '@' + resolved);
  }

  const res = await fetch(`${API_BASE}/channels?${params}`);
  if (!res.ok) {
    let detail = '';
    try {
      const e = (await res.json()) as { error?: { message?: string } };
      detail = e.error?.message ?? '';
    } catch { /* ignore */ }
    throw new Error(`Channel lookup failed (${res.status})${detail ? `: ${detail}` : ''}`);
  }
  const data = (await res.json()) as ChannelsListResponse;
  const item = data.items?.[0];
  if (!item) throw new Error('Channel not found — check the URL or @handle and try again');

  const t = item.snippet.thumbnails;
  return {
    id: item.id,
    title: item.snippet.title,
    thumbnail: t?.medium?.url ?? t?.high?.url ?? t?.default?.url ?? '',
  };
}
