import type { Platform } from './creator';
import type { TranscriptSegment } from './transcript';

export interface BackendVideo {
  videoId: string;
  title: string;
  url: string;
  thumbnailUrl?: string;
  durationSeconds: number;
  publishedAt: string;
}

export interface ListVideosRequest {
  platform: Platform;
  username: string;
  limit?: number;
  startIndex?: number;
}

export interface ListVideosResponse {
  videos: BackendVideo[];
}

export interface TitleFetchItem {
  videoId: string;
  url: string;
}

export interface FetchTitlesRequest {
  platform: Platform;
  videos: TitleFetchItem[];
}

export interface VideoTitle {
  videoId: string;
  title: string;
  thumbnailUrl?: string | null;
  durationSeconds: number;
  publishedAt: string;
  error?: string | null;
}

export interface FetchTitlesResponse {
  titles: VideoTitle[];
}

export interface TranscribeRequest {
  platform: Platform;
  videoUrl: string;
  videoId: string;
  language: string;
}

export interface TranscribeResponse {
  language: string;
  durationSeconds: number;
  title?: string | null;
  text: string;
  segments: TranscriptSegment[];
}

export interface ValidateCreatorRequest {
  platform: Platform;
  username: string;
}

export interface ValidateCreatorResponse {
  valid: boolean;
  name?: string;
  avatarUrl?: string;
  errorMessage?: string;
}

export interface ApiError {
  message: string;
  status?: number;
  code?: string;
}