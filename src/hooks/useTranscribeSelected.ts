import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import type { BackendVideo } from '@/types/api';
import type { Creator } from '@/types/creator';
import type { Transcript, TranscriptSegment } from '@/types/transcript';
import {
  getTranscriptionStatus,
  startTranscription,
} from '@/api/transcripts';
import { toApiError } from '@/api/client';
import { useTranscriptsStore } from '@/store/useTranscriptsStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { generateTranscriptId } from '@/utils/id';
import { saveTranscriptFile } from '@/utils/storage';
import { estimateWordCount } from '@/utils/formatting';

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 60 * 60 * 1000;

export interface TranscribeProgress {
  current: number;
  total: number;
  currentTitle: string;
  currentPhase: string;
  currentPercent: number;
}

export interface TranscribeSelectedResult {
  succeeded: number;
  failed: number;
  errors: string[];
}

interface UseTranscribeSelectedResult {
  isRunning: boolean;
  progress: TranscribeProgress | null;
  run: (
    creator: Creator,
    videos: BackendVideo[],
  ) => Promise<TranscribeSelectedResult>;
}

function segmentsToText(segments: TranscriptSegment[]): string {
  if (!segments.length) return '';
  return segments
    .map((s) => s.text.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function resolveTitle(video: BackendVideo, fromServer?: string | null): string {
  if (fromServer && fromServer.trim().length > 0) {
    return fromServer.trim();
  }
  if (video.title && video.title.trim().length > 0) {
    return video.title.trim();
  }
  return video.videoId;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function phaseLabel(phase?: string | null): string {
  switch (phase) {
    case 'queued':
      return 'Queued…';
    case 'download':
      return 'Downloading…';
    case 'transcribe':
      return 'Transcribing…';
    case 'done':
      return 'Done';
    default:
      return 'Working…';
  }
}

export function useTranscribeSelected(): UseTranscribeSelectedResult {
  const queryClient = useQueryClient();
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<TranscribeProgress | null>(null);

  const run = useCallback(
    async (
      creator: Creator,
      videos: BackendVideo[],
    ): Promise<TranscribeSelectedResult> => {
      if (videos.length === 0) {
        return { succeeded: 0, failed: 0, errors: [] };
      }

      const settings = useSettingsStore.getState();
      const transcriptsStore = useTranscriptsStore.getState();

      setIsRunning(true);
      setProgress({
        current: 0,
        total: videos.length,
        currentTitle: videos[0].title || videos[0].videoId,
        currentPhase: 'Queued…',
        currentPercent: 0,
      });

      let succeeded = 0;
      let failed = 0;
      const errors: string[] = [];

      for (let i = 0; i < videos.length; i += 1) {
        const video = videos[i];
        const workingTitle = resolveTitle(video);

        setProgress({
          current: i,
          total: videos.length,
          currentTitle: workingTitle,
          currentPhase: 'Queued…',
          currentPercent: 0,
        });

        const id = generateTranscriptId();
        const now = new Date().toISOString();

        const base: Transcript = {
          id,
          creatorId: creator.id,
          creatorName: creator.name,
          creatorUsername: creator.username,
          platform: creator.platform,
          videoId: video.videoId,
          videoUrl: video.url,
          videoTitle: workingTitle,
          thumbnailUrl: video.thumbnailUrl ?? undefined,
          durationSeconds: video.durationSeconds ?? 0,
          language: settings.defaultLanguage,
          status: 'processing',
          text: '',
          segments: [],
          wordCount: 0,
          createdAt: now,
          updatedAt: now,
        };

        transcriptsStore.upsert(base);

        try {
          const startRes = await startTranscription({
            platform: creator.platform,
            videoUrl: video.url,
            videoId: video.videoId,
            language: settings.defaultLanguage,
          });

          const jobId = startRes.jobId;
          const deadline = Date.now() + POLL_TIMEOUT_MS;
          let finalStatus: Awaited<
            ReturnType<typeof getTranscriptionStatus>
          > | null = null;

while (Date.now() < deadline) {
  await sleep(POLL_INTERVAL_MS);

  let statusRes;
  try {
    statusRes = await getTranscriptionStatus(jobId);
  } catch (pollErr) {
    // If the server says the job doesn't exist (404), stop polling.
    // This happens after a server restart — the in-memory job is gone.
    const err = pollErr as { status?: number };
    const statusCode =
      typeof err?.status === 'number' ? err.status : undefined;
    if (statusCode === 404) {
      throw new Error(
        'The job was lost on the server (server may have restarted). Retry.',
      );
    }
    // Other errors are transient; keep trying.
    if (__DEV__) {
      console.warn('[transcribe] poll failed', pollErr);
    }
    continue;
  }

            setProgress({
              current: i,
              total: videos.length,
              currentTitle: workingTitle,
              currentPhase: phaseLabel(statusRes.phase ?? statusRes.status),
              currentPercent: Math.max(0, Math.min(100, statusRes.progress ?? 0)),
            });

            if (statusRes.status === 'done') {
              finalStatus = statusRes;
              break;
            }

            if (statusRes.status === 'failed') {
              throw new Error(statusRes.error || 'Transcription failed');
            }
          }

          if (finalStatus === null || finalStatus.status !== 'done') {
            throw new Error('Transcription timed out');
          }

          const serverTitle = finalStatus.title ?? null;
          const finalTitle = resolveTitle(video, serverTitle);

          const segments = finalStatus.segments ?? [];
          const text =
            (finalStatus.text ?? '').trim() || segmentsToText(segments);
          const wordCount = estimateWordCount(text);

          const completed: Transcript = {
            ...base,
            videoTitle: finalTitle,
            language: finalStatus.language || base.language,
            durationSeconds:
              finalStatus.durationSeconds || base.durationSeconds,
            text,
            segments,
            wordCount,
            status: 'completed',
            updatedAt: new Date().toISOString(),
          };

          if (settings.saveTranscriptsToFiles) {
            try {
              const path = await saveTranscriptFile(completed);
              completed.filePath = path;
            } catch {
              // file write failed — transcript still saved in memory
            }
          }

          transcriptsStore.upsert(completed);
          succeeded += 1;
        } catch (err) {
          const apiError = toApiError(err);
          const message = apiError.message || 'Transcription failed';
          errors.push(`${workingTitle}: ${message}`);

          transcriptsStore.upsert({
            ...base,
            status: 'failed',
            errorMessage: message,
            updatedAt: new Date().toISOString(),
          });
          failed += 1;
        }
      }

      setProgress({
        current: videos.length,
        total: videos.length,
        currentTitle: '',
        currentPhase: 'Done',
        currentPercent: 100,
      });

      queryClient.invalidateQueries({
        queryKey: ['transcripts'],
        refetchType: 'all',
      });
      queryClient.invalidateQueries({
        queryKey: ['creator-videos'],
        refetchType: 'all',
      });

      setIsRunning(false);
      setProgress(null);

      if (failed === 0) {
        Toast.show({
          type: 'success',
          text1: 'Transcription complete',
          text2: `${succeeded} ${
            succeeded === 1 ? 'video' : 'videos'
          } saved to your library.`,
          position: 'bottom',
        });
      } else if (succeeded === 0) {
        Toast.show({
          type: 'error',
          text1: 'Transcription failed',
          text2:
            errors[0] ??
            `Could not transcribe ${failed} ${
              failed === 1 ? 'video' : 'videos'
            }.`,
          position: 'bottom',
        });
      } else {
        Toast.show({
          type: 'info',
          text1: 'Partially complete',
          text2: `${succeeded} succeeded, ${failed} failed.`,
          position: 'bottom',
        });
      }

      return { succeeded, failed, errors };
    },
    [queryClient],
  );

  return { isRunning, progress, run };
} 