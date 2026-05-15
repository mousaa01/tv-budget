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
  // Morning window: 00:00 → 11:59
  morningLimitSeconds: number;
  morningSecondsUsed: number;
  morningBonusSeconds: number;
  // Afternoon window: 12:00 → 23:59
  afternoonLimitSeconds: number;
  afternoonSecondsUsed: number;
  afternoonBonusSeconds: number;
}

export interface DailySummary {
  date: string;
  secondsUsed: number;
  videosWatched: number;
}

export interface Settings {
  pin: string;
  morningLimitMinutes: number;   // budget before 12 PM, default 30
  afternoonLimitMinutes: number; // budget from 12 PM, default 30
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
