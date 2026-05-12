import { parse, toSeconds } from 'iso8601-duration';
import type { VideoResult } from './types';

const API_BASE = 'https://www.googleapis.com/youtube/v3';

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

export async function fetchChannelFeed(
  channelId: string,
  pageToken?: string
): Promise<ChannelFeedPage> {
  const key = getKey();
  const params = new URLSearchParams({
    key,
    part: 'snippet',
    channelId,
    type: 'video',
    order: 'date',
    safeSearch: 'strict',
    maxResults: '50',
    videoEmbeddable: 'true',
  });
  if (pageToken) params.set('pageToken', pageToken);
  const res = await fetch(`${API_BASE}/search?${params.toString()}`);
  if (!res.ok) throw new Error(`YouTube channel feed failed: ${res.status}`);
  const data = (await res.json()) as { items: SearchListItem[]; nextPageToken?: string };
  const videos = await hydrateDurations(data.items ?? [], key);
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
