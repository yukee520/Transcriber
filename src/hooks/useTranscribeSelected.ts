import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import type { BackendVideo } from '@/types/api';
import type { Creator } from '@/types/creator';
import type { Transcript, TranscriptSegment } from '@/types/transcript';
import { requestTranscription } from '@/api/transcripts';
import { toApiError } from '@/api/client';
import { useTranscriptsStore } from '@/store/useTranscriptsStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { generateTranscriptId } from '@/utils/id';
import { saveTranscriptFile } from '@/utils/storage';
import { estimateWordCount } from '@/utils/formatting';

export interface TranscribeProgress {
  current: number;
  total: number;
  currentTitle: string;
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
          const result = await requestTranscription({
            platform: creator.platform,
            videoUrl: video.url,
            videoId: video.videoId,
            language: settings.defaultLanguage,
          });

          const serverTitle = result.title ?? null;
          const finalTitle = resolveTitle(video, serverTitle);

          const text = result.text?.trim() || segmentsToText(result.segments);
          const wordCount = estimateWordCount(text);

          const completed: Transcript = {
            ...base,
            videoTitle: finalTitle,
            language: result.language || base.language,
            durationSeconds: result.durationSeconds || base.durationSeconds,
            text,
            segments: result.segments ?? [],
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