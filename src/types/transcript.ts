import type { Platform } from './creator';

export type TranscriptStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

export interface Transcript {
  id: string;
  creatorId: string;
  creatorName: string;
  creatorUsername: string;
  platform: Platform;
  videoId: string;
  videoUrl: string;
  videoTitle: string;
  thumbnailUrl?: string;
  durationSeconds: number;
  language: string;
  status: TranscriptStatus;
  errorMessage?: string;
  text: string;
  segments: TranscriptSegment[];
  wordCount: number;
  filePath?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TranscriptListItem {
  id: string;
  creatorId: string;
  creatorName: string;
  platform: Platform;
  videoTitle: string;
  thumbnailUrl?: string;
  durationSeconds: number;
  language: string;
  status: TranscriptStatus;
  wordCount: number;
  createdAt: string;
}

export interface TranscriptFilter {
  search: string;
  platform: Platform | 'all';
  creatorId: string | 'all';
  status: TranscriptStatus | 'all';
}