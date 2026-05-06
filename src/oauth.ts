const SCOPE = 'https://www.googleapis.com/auth/youtube.readonly';

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
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

/**
 * After OAuth redirects back the hash looks like:
 *   #access_token=xxx&token_type=Bearer&expires_in=3600&scope=...
 * Returns the token string, or null if not present.
 */
export function parseTokenFromHash(hash: string): string | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  return params.get('access_token');
}

interface SubscriptionItem {
  snippet: { resourceId: { channelId: string } };
}

interface SubscriptionsPage {
  items: SubscriptionItem[];
  nextPageToken?: string;
}

/** Fetches all subscribed channel IDs for the authenticated user. */
export async function fetchSubscribedChannels(accessToken: string): Promise<string[]> {
  const channelIds: string[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({ part: 'snippet', mine: 'true', maxResults: '50' });
    if (pageToken) params.set('pageToken', pageToken);

    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/subscriptions?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!res.ok) {
      const msg = await res.text().catch(() => res.statusText);
      throw new Error(`Subscriptions fetch failed: ${msg}`);
    }
    const data = (await res.json()) as SubscriptionsPage;
    for (const item of data.items) {
      channelIds.push(item.snippet.resourceId.channelId);
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  return channelIds;
}
