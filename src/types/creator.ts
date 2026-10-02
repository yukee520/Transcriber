export type Platform =
  | 'youtube'
  | 'tiktok'
  | 'instagram'
  | 'twitter'
  | 'facebook'
  | 'bilibili'
  | 'other';

export type CreatorStatus = 'active' | 'paused';

export interface Creator {
  id: string;
  name: string;
  username: string;
  profileUrl: string;
  platform: Platform;
  avatarUrl?: string;
  status: CreatorStatus;
  autoSync: boolean;
  lastSyncedAt?: string;
  createdAt: string;
}

export interface PlatformMeta {
  id: Platform;
  label: string;
  color: string;
  icon: string;
}