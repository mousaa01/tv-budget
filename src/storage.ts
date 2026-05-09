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
  dailyLimitMinutes: 30,
  blocklistKeywords: [],
  channelAllowlist: [],
  coolDownEnabled: false,
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
  localStorage.setItem(KEYS.settings, JSON.stringify(s));
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
  localStorage.setItem(KEYS.subscriptions, JSON.stringify(meta));
}

export function clearSubscribedChannels(): void {
  localStorage.removeItem(KEYS.subscriptions);
}

export function loadBudget(): BudgetState {
  const settings = loadSettings();
  const dailyLimitSeconds = settings.dailyLimitMinutes * 60;
  try {
    const raw = localStorage.getItem(KEYS.budget);
    if (!raw) {
      return { date: todayStr(), secondsUsedToday: 0, dailyLimitSeconds, bonusSecondsToday: 0 };
    }
    const parsed = JSON.parse(raw) as BudgetState;
    if (parsed.date !== todayStr()) {
      // Archive yesterday and reset
      archiveDay(parsed);
      return { date: todayStr(), secondsUsedToday: 0, dailyLimitSeconds, bonusSecondsToday: 0 };
    }
    return { ...parsed, dailyLimitSeconds };
  } catch {
    return { date: todayStr(), secondsUsedToday: 0, dailyLimitSeconds, bonusSecondsToday: 0 };
  }
}

export function saveBudget(b: BudgetState): void {
  localStorage.setItem(KEYS.budget, JSON.stringify(b));
}

export function remainingSeconds(b: BudgetState): number {
  return Math.max(0, b.dailyLimitSeconds + b.bonusSecondsToday - b.secondsUsedToday);
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
  localStorage.setItem(KEYS.recent, JSON.stringify(list.slice(0, 10)));
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
    secondsUsed: b.secondsUsedToday,
    videosWatched: 0,
  });
  localStorage.setItem(KEYS.history, JSON.stringify(history.slice(0, 30)));
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
  localStorage.setItem(KEYS.history, JSON.stringify(history.slice(0, 30)));
}
