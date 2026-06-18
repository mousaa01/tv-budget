import type { BudgetState, DailySummary, RecentVideo, Settings, SubscribedChannelsMeta } from './types';

const KEYS = {
  budget: 'tv-budget:budget',
  settings: 'tv-budget:settings',
  recent: 'tv-budget:recent',
  history: 'tv-budget:history',
  subscriptions: 'tv-budget:subscribed-channels',
} as const;

export function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEYS.settings);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEYS.settings, JSON.stringify(s));
  } catch { /* QuotaExceededError or similar — best-effort */ }
}

export function loadSubscribedChannels(): SubscribedChannelsMeta | null {
  try {
    const raw = localStorage.getItem(KEYS.subscriptions);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SubscribedChannelsMeta> & { channelIds?: string[] };
    // Reject old shape (pre-channel-info) — force a re-sync
    if (!Array.isArray(parsed.channels)) return null;
    if (typeof parsed.accessToken !== 'string') return null;
    return parsed as SubscribedChannelsMeta;
  } catch {
    return null;
  }
}

export function saveSubscribedChannels(meta: SubscribedChannelsMeta): void {
  try {
    localStorage.setItem(KEYS.subscriptions, JSON.stringify(meta));
  } catch { /* QuotaExceededError or similar — best-effort */ }
}

export function clearSubscribedChannels(): void {
  try {
    localStorage.removeItem(KEYS.subscriptions);
  } catch { /* best-effort */ }
}

// Which time window is currently active.
export function currentWindow(): 'morning' | 'afternoon' {
  return new Date().getHours() < 12 ? 'morning' : 'afternoon';
}

export function loadBudget(): BudgetState {
  const settings = loadSettings();
  const fresh: BudgetState = {
    date: todayStr(),
    morningLimitSeconds: settings.morningLimitMinutes * 60,
    morningSecondsUsed: 0,
    morningBonusSeconds: 0,
    afternoonLimitSeconds: settings.afternoonLimitMinutes * 60,
    afternoonSecondsUsed: 0,
    afternoonBonusSeconds: 0,
  };
  try {
    const raw = localStorage.getItem(KEYS.budget);
    if (!raw) return fresh;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    // Migrate old single-window shape (had secondsUsedToday) → start fresh.
    if ('secondsUsedToday' in parsed) return fresh;
    const stored = parsed as unknown as BudgetState;
    if (stored.date !== todayStr()) {
      archiveDay(stored);
      return fresh;
    }
    // Re-apply limit from settings in case the parent changed it since last save.
    return {
      ...stored,
      morningLimitSeconds: settings.morningLimitMinutes * 60,
      afternoonLimitSeconds: settings.afternoonLimitMinutes * 60,
    };
  } catch {
    return fresh;
  }
}

export function saveBudget(b: BudgetState): void {
  try {
    localStorage.setItem(KEYS.budget, JSON.stringify(b));
  } catch { /* QuotaExceededError or similar — best-effort */ }
}

export function remainingSeconds(b: BudgetState): number {
  if (currentWindow() === 'morning') {
    return Math.max(0, b.morningLimitSeconds + b.morningBonusSeconds - b.morningSecondsUsed);
  }
  return Math.max(0, b.afternoonLimitSeconds + b.afternoonBonusSeconds - b.afternoonSecondsUsed);
}

export function loadRecent(): RecentVideo[] {
  try {
    return JSON.parse(localStorage.getItem(KEYS.recent) ?? '[]') as RecentVideo[];
  } catch {
    return [];
  }
}

export function pushRecent(v: RecentVideo): void {
  const list = loadRecent().filter((r) => r.id !== v.id);
  list.unshift(v);
  try {
    localStorage.setItem(KEYS.recent, JSON.stringify(list.slice(0, 10)));
  } catch { /* QuotaExceededError or similar — best-effort */ }
}

export function clearRecent(): void {
  try {
    localStorage.removeItem(KEYS.recent);
  } catch { /* best-effort */ }
}

export function loadHistory(): DailySummary[] {
  try {
    return JSON.parse(localStorage.getItem(KEYS.history) ?? '[]') as DailySummary[];
  } catch {
    return [];
  }
}

function archiveDay(b: BudgetState): void {
  const history = loadHistory();
  history.unshift({
    date: b.date,
    // Total across both windows for the history display.
    secondsUsed: b.morningSecondsUsed + b.afternoonSecondsUsed,
    videosWatched: 0,
  });
  try {
    localStorage.setItem(KEYS.history, JSON.stringify(history.slice(0, 30)));
  } catch { /* QuotaExceededError or similar — best-effort */ }
}

export function incrementVideosWatchedToday(): void {
  const history = loadHistory();
  const today = todayStr();
  const idx = history.findIndex((h) => h.date === today);
  if (idx >= 0) {
    history[idx].videosWatched += 1;
  } else {
    history.unshift({ date: today, secondsUsed: 0, videosWatched: 1 });
  }
  try {
    localStorage.setItem(KEYS.history, JSON.stringify(history.slice(0, 30)));
  } catch { /* QuotaExceededError or similar — best-effort */ }
}
