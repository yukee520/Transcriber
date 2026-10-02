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

export interface DynamicVideosRequest {
  uid: string;
  limit?: number;
  offset?: string;
}

export interface DynamicVideosResponse {
  videos: BackendVideo[];
  nextOffset?: string | null;
  hasMore?: boolean;
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

export interface TranscribeStartRequest {
  platform: Platform;
  videoUrl: string;
  videoId: string;
  language: string;
  model?: string;
}

export interface TranscribeStartResponse {
  jobId: string;
  status: string;
}

export type TranscribeJobPhase =
  | 'queued'
  | 'download'
  | 'transcribe'
  | 'done';

export type TranscribeJobStatusValue =
  | 'queued'
  | 'running'
  | 'done'
  | 'failed';

export interface TranscribeStatusResponse {
  jobId: string;
  status: TranscribeJobStatusValue;
  phase?: TranscribeJobPhase | null;
  progress: number;
  message?: string | null;
  startedAt?: number | null;
  finishedAt?: number | null;
  language?: string | null;
  durationSeconds?: number | null;
  title?: string | null;
  text?: string | null;
  segments?: TranscriptSegment[] | null;
  error?: string | null;
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