import type { Platform, PlatformMeta } from '@/types/creator';

export const PLATFORMS: PlatformMeta[] = [
  { id: 'youtube', label: 'YouTube', color: '#FF0000', icon: 'logo-youtube' },
  { id: 'tiktok', label: 'TikTok', color: '#000000', icon: 'musical-notes' },
  { id: 'instagram', label: 'Instagram', color: '#E1306C', icon: 'logo-instagram' },
  { id: 'twitter', label: 'X', color: '#0F172A', icon: 'logo-twitter' },
  { id: 'facebook', label: 'Facebook', color: '#1877F2', icon: 'logo-facebook' },
  { id: 'bilibili', label: 'Bilibili', color: '#00A1D6', icon: 'tv-outline' },
  { id: 'other', label: 'Other', color: '#64748B', icon: 'globe-outline' },
];

const PLATFORM_MAP: Record<Platform, PlatformMeta> = PLATFORMS.reduce(
  (acc, meta) => {
    acc[meta.id] = meta;
    return acc;
  },
  {} as Record<Platform, PlatformMeta>,
);

export function getPlatformMeta(platform: Platform): PlatformMeta {
  return PLATFORM_MAP[platform] ?? PLATFORM_MAP.other;
}

export function isPlatform(value: string): value is Platform {
  return PLATFORMS.some((meta) => meta.id === value);
}

export function detectPlatform(input: string): Platform {
  const value = input.trim().toLowerCase();
  if (!value) return 'other';
  if (value.includes('youtube.com') || value.includes('youtu.be')) return 'youtube';
  if (value.includes('tiktok.com')) return 'tiktok';
  if (value.includes('instagram.com')) return 'instagram';
  if (
    value.includes('bilibili.com') ||
    value.includes('b23.tv') ||
    value.includes('bilibili.tv')
  ) {
    return 'bilibili';
  }
  if (
    value.includes('twitter.com') ||
    value.includes('x.com') ||
    value.startsWith('@')
  ) {
    return 'twitter';
  }
  if (value.includes('facebook.com') || value.includes('fb.com')) return 'facebook';
  return 'other';
}

export function parseUsername(input: string): string {
  const value = input.trim();
  if (!value) return '';

  if (!value.includes('/') && !value.includes('.')) {
    return value.replace(/^@/, '');
  }

  try {
    const normalized = value.startsWith('http') ? value : `https://${value}`;
    const url = new URL(normalized);
    const segments = url.pathname.split('/').filter(Boolean);
    if (segments.length === 0) return '';

    const platform = detectPlatform(value);

    if (platform === 'bilibili') {
      const match = url.pathname.match(/^\/(\d+)/);
      if (match) return match[1];
      if (segments[0]) return segments[0];
    }

    if (platform === 'tiktok' && segments[0].startsWith('@')) {
      return segments[0].replace(/^@/, '');
    }

    if (platform === 'twitter' && segments[0]) {
      const reserved = ['i', 'home', 'explore', 'notifications', 'messages'];
      if (!reserved.includes(segments[0])) return segments[0].replace(/^@/, '');
    }

    return segments[0].replace(/^@/, '');
  } catch {
    return value.replace(/^@/, '');
  }
}

export function buildProfileUrl(platform: Platform, username: string): string {
  const handle = username.replace(/^@/, '').trim();
  switch (platform) {
    case 'youtube':
      return `https://www.youtube.com/@${handle}`;
    case 'tiktok':
      return `https://www.tiktok.com/@${handle}`;
    case 'instagram':
      return `https://www.instagram.com/${handle}`;
    case 'twitter':
      return `https://x.com/${handle}`;
    case 'facebook':
      return `https://www.facebook.com/${handle}`;
    case 'bilibili':
      return `https://space.bilibili.com/${handle}`;
    default:
      return handle.startsWith('http') ? handle : `https://${handle}`;
  }
}