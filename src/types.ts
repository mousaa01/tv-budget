export interface VideoResult {
  id: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
  durationSeconds: number;
}

export interface RecentVideo extends VideoResult {
  watchedAt: number;
}

export interface BudgetState {
  date: string; // YYYY-MM-DD
  secondsUsedToday: number;
  dailyLimitSeconds: number;
  bonusSecondsToday: number;
}

export interface DailySummary {
  date: string;
  secondsUsed: number;
  videosWatched: number;
}

export interface Settings {
  pin: string;
  dailyLimitMinutes: number;
  blocklistKeywords: string[];
  channelAllowlist: string[];
  coolDownEnabled: boolean;
}

export interface SubscribedChannelsMeta {
  channelIds: string[];
  syncedAt: string; // ISO timestamp
}
