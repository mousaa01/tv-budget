export interface VideoResult {
  id: string;
  title: string;
  channelTitle: string;
  channelId: string;
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

export interface SubscribedChannel {
  id: string;
  title: string;
  thumbnail: string;
}

export interface UserProfile {
  name: string;
  avatar: string;
}

export interface SubscribedChannelsMeta {
  channels: SubscribedChannel[];
  syncedAt: string; // ISO timestamp
  accessToken: string;
  tokenExpiresAt: number; // unix ms
  profile?: UserProfile;
}
