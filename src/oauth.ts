const SCOPE = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
  // Settings are synced to Drive appDataFolder (hidden app folder, not visible
  // in the user's regular Drive). Tokens from before this change won't have
  // this scope — Drive calls gracefully fall back to localStorage in that case.
  'https://www.googleapis.com/auth/drive.appdata',
].join(' ');

function getClientId(): string {
  const id = import.meta.env.VITE_YT_OAUTH_CLIENT_ID;
  if (!id) throw new Error('Missing VITE_YT_OAUTH_CLIENT_ID in .env');
  return id;
}

/** The redirect_uri must exactly match what you register in Google Cloud Console. */
function redirectUri(): string {
  // Use the page origin + path with no hash — OAuth appends the token as a new fragment.
  return window.location.origin + window.location.pathname;
}

export function buildAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: getClientId(),
    redirect_uri: redirectUri(),
    response_type: 'token',
    scope: SCOPE,
    include_granted_scopes: 'true',
    prompt: 'select_account',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

/**
 * After OAuth redirects back the hash looks like:
 *   #access_token=xxx&token_type=Bearer&expires_in=3600&scope=...
 * Returns token + expiry, or null if not present.
 */
export function parseTokenFromHash(hash: string): { token: string; expiresAt: number } | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const token = params.get('access_token');
  const expiresIn = params.get('expires_in');
  if (!token) return null;
  // Subtract 60s buffer so we refresh before the token actually expires
  const expiresAt = Date.now() + (Number(expiresIn ?? 3600) - 60) * 1000;
  return { token, expiresAt };
}

export function isTokenValid(meta: { tokenExpiresAt: number; accessToken: string }): boolean {
  return !!meta.accessToken && Date.now() < meta.tokenExpiresAt;
}

interface SubscriptionItem {
  snippet: {
    title: string;
    resourceId: { channelId: string };
    thumbnails?: {
      default?: { url: string };
      medium?: { url: string };
      high?: { url: string };
    };
  };
}

interface SubscriptionsPage {
  items: SubscriptionItem[];
  nextPageToken?: string;
}

export interface FetchedChannel {
  id: string;
  title: string;
  thumbnail: string;
}

/** Fetches all subscribed channels (id + title + thumbnail) for the authenticated user.
 *  Tries mine=true first; if that returns 0, falls back to channelId=<user's own channel id>. */
export async function fetchSubscribedChannels(accessToken: string): Promise<FetchedChannel[]> {
  // First, try mine=true
  let channels = await fetchSubsWith(accessToken, { mine: 'true' });
  console.log(`[oauth] mine=true returned ${channels.length} channels`);

  if (channels.length === 0) {
    // Fallback: get the user's own channel id then query subscriptions by channelId
    try {
      const meRes = await fetch(
        'https://www.googleapis.com/youtube/v3/channels?part=id&mine=true',
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (meRes.ok) {
        const meData = (await meRes.json()) as MyChannelResponse;
        const myChannelId = meData.items?.[0]?.id;
        console.log('[oauth] my channel id:', myChannelId);
        if (myChannelId) {
          channels = await fetchSubsWith(accessToken, { channelId: myChannelId });
          console.log(`[oauth] channelId=${myChannelId} returned ${channels.length} channels`);
        }
      }
    } catch (e) {
      console.warn('[oauth] channelId fallback failed', e);
    }
  }

  console.log(`[oauth] total subscribed channels: ${channels.length}`);
  return channels;
}

async function fetchSubsWith(
  accessToken: string,
  baseParams: Record<string, string>,
): Promise<FetchedChannel[]> {
  const channels: FetchedChannel[] = [];
  let pageToken: string | undefined;
  let pageCount = 0;

  do {
    const params = new URLSearchParams({
      part: 'snippet',
      maxResults: '50',
      // NOTE: do NOT use order:'alphabetical' here — YouTube's API has a known bug
      // where server-side alphabetical pagination silently drops some subscriptions.
      // We sort client-side instead (see after the loop).
      ...baseParams,
    });
    if (pageToken) params.set('pageToken', pageToken);

    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/subscriptions?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!res.ok) {
      const msg = await res.text().catch(() => res.statusText);
      console.error('[oauth] subscriptions fetch HTTP error', res.status, msg);
      throw new Error(`Subscriptions fetch failed (${res.status}): ${msg}`);
    }
    const data = (await res.json()) as SubscriptionsPage;
    pageCount++;
    console.log(`[oauth] subs page ${pageCount} (${JSON.stringify(baseParams)}): ${data.items?.length ?? 0} items`);
    if (!data.items || data.items.length === 0) {
      if (pageCount === 1) {
        console.warn('[oauth] subs response had no items. Full response:', data);
      }
      break;
    }
    for (const item of data.items) {
      const thumbs = item.snippet.thumbnails;
      const thumbnail =
        thumbs?.medium?.url ?? thumbs?.high?.url ?? thumbs?.default?.url ?? '';
      channels.push({
        id: item.snippet.resourceId.channelId,
        title: item.snippet.title,
        thumbnail,
      });
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  // Sort alphabetically client-side so display order is consistent without
  // relying on the buggy server-side order=alphabetical parameter.
  channels.sort((a, b) => a.title.localeCompare(b.title));

  return channels;
}

interface MyChannelResponse {
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

/** Returns the authenticated user's YouTube channel name + avatar.
 *  Falls back to Google userinfo if the user has no YouTube channel. */
export async function fetchUserProfile(
  accessToken: string,
): Promise<{ name: string; avatar: string } | null> {
  // Try YouTube channel first
  try {
    const res = await fetch(
      'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (res.ok) {
      const data = (await res.json()) as MyChannelResponse;
      const item = data.items?.[0];
      if (item) {
        const t = item.snippet.thumbnails;
        const profile = {
          name: item.snippet.title,
          avatar: t?.medium?.url ?? t?.default?.url ?? t?.high?.url ?? '',
        };
        console.log('[oauth] profile from YouTube channel:', profile.name);
        return profile;
      }
      console.warn('[oauth] no YouTube channel for this account, falling back to userinfo');
    } else {
      console.warn('[oauth] YouTube channels fetch failed', res.status);
    }
  } catch (e) {
    console.warn('[oauth] YouTube channels fetch threw', e);
  }

  // Fallback: Google userinfo endpoint (works for any Google account)
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      console.warn('[oauth] userinfo fetch failed', res.status);
      return null;
    }
    const data = (await res.json()) as { name?: string; email?: string; picture?: string };
    const profile = {
      name: data.name ?? data.email ?? 'YouTube user',
      avatar: data.picture ?? '',
    };
    console.log('[oauth] profile from userinfo:', profile.name);
    return profile;
  } catch (e) {
    console.warn('[oauth] userinfo fetch threw', e);
    return null;
  }
}
