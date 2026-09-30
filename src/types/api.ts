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
}

export interface ListVideosResponse {
  videos: BackendVideo[];
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