import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import Toast from 'react-native-toast-message';
import type { Creator } from '@/types/creator';
import type { Transcript, TranscriptSegment } from '@/types/transcript';
import { useCreatorsStore } from '@/store/useCreatorsStore';
import { useTranscriptsStore } from '@/store/useTranscriptsStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useSyncStore } from '@/store/useSyncStore';
import { fetchCreatorVideos, requestTranscription } from '@/api/transcripts';
import { ApiClientError } from '@/api/client';
import { generateTranscriptId } from '@/utils/id';
import { saveTranscriptFile } from '@/utils/storage';
import { estimateWordCount } from '@/utils/formatting';

interface SyncResult {
  newTranscripts: number;
  processedCreators: number;
  failedCreators: number;
}

interface SyncOptions {
  creatorIds?: string[];
  silent?: boolean;
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

export function useSyncCreators() {
  const queryClient = useQueryClient();

  const runSync = useCallback(
    async (options: SyncOptions = {}): Promise<SyncResult> => {
      const syncStore = useSyncStore.getState();
      const settings = useSettingsStore.getState();

      if (!settings.backendUrl.trim()) {
        Toast.show({
          type: 'error',
          text1: 'Backend not configured',
          text2: 'Add a transcription backend URL in Settings first.',
          position: 'bottom',
        });
        return { newTranscripts: 0, processedCreators: 0, failedCreators: 0 };
      }

      if (settings.wifiOnlySync) {
        const net = await NetInfo.fetch();
        if (net.type !== 'wifi' && net.isConnected) {
          if (!options.silent) {
            Toast.show({
              type: 'info',
              text1: 'Wi-Fi only',
              text2: 'Sync is set to Wi-Fi only. Skipping.',
              position: 'bottom',
            });
          }
          return { newTranscripts: 0, processedCreators: 0, failedCreators: 0 };
        }
      }

      const allCreators = useCreatorsStore.getState().creators;
      const targets = allCreators.filter((c) => {
        if (c.status !== 'active' || !c.autoSync) return false;
        if (options.creatorIds && !options.creatorIds.includes(c.id)) return false;
        return true;
      });

      if (targets.length === 0) {
        if (!options.silent) {
          Toast.show({
            type: 'info',
            text1: 'Nothing to sync',
            text2: 'Add or enable a creator first.',
            position: 'bottom',
          });
        }
        return { newTranscripts: 0, processedCreators: 0, failedCreators: 0 };
      }

      syncStore.startSync(targets.length);
      let newTranscripts = 0;
      let failed = 0;

      for (let i = 0; i < targets.length; i += 1) {
        const creator = targets[i];
        useSyncStore.getState().updateProgress({
          currentCreatorName: creator.name,
          completedCreators: i,
        });

        try {
          const count = await syncOneCreator(creator);
          newTranscripts += count;
          if (count > 0) {
            useSyncStore.getState().incrementNewTranscripts(count);
          }
          useCreatorsStore
            .getState()
            .update(creator.id, { lastSyncedAt: new Date().toISOString() });
        } catch (err) {
          failed += 1;
          const message =
            err instanceof ApiClientError
              ? err.message
              : err instanceof Error
                ? err.message
                : 'Unknown error';
          useSyncStore.getState().updateProgress({
            currentCreatorName: `${creator.name} — failed: ${message}`,
          });
        }
      }

      useSyncStore.getState().finishSync();
      queryClient.invalidateQueries({ queryKey: ['transcripts'] });
      queryClient.invalidateQueries({ queryKey: ['creators'] });

      if (!options.silent) {
        if (failed > 0 && newTranscripts === 0) {
          Toast.show({
            type: 'error',
            text1: 'Sync failed',
            text2: `Could not sync ${failed} creator${failed === 1 ? '' : 's'}.`,
            position: 'bottom',
          });
        } else {
          Toast.show({
            type: 'success',
            text1: 'Sync complete',
            text2:
              newTranscripts === 0
                ? 'No new videos found.'
                : `${newTranscripts} new transcript${newTranscripts === 1 ? '' : 's'} saved.`,
            position: 'bottom',
          });
        }
      }

      return {
        newTranscripts,
        processedCreators: targets.length - failed,
        failedCreators: failed,
      };
    },
    [queryClient],
  );

  const syncOneCreator = useCallback(async (creator: Creator): Promise<number> => {
    const settings = useSettingsStore.getState();
    const { videos } = await fetchCreatorVideos({
      platform: creator.platform,
      username: creator.username,
      limit: 10,
    });

    const transcriptsStore = useTranscriptsStore.getState();
    const existingIds = new Set(
      transcriptsStore.transcripts
        .filter((t) => t.creatorId === creator.id)
        .map((t) => t.videoId),
    );

    const pending = videos.filter((v) => !existingIds.has(v.videoId));
    let created = 0;

    for (const video of pending) {
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
        videoTitle: video.title,
        thumbnailUrl: video.thumbnailUrl,
        durationSeconds: video.durationSeconds,
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

        const text = result.text?.trim() || segmentsToText(result.segments);
        const wordCount = estimateWordCount(text);
        const completed: Transcript = {
          ...base,
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
            // file write failed — keep transcript in memory
          }
        }

        transcriptsStore.upsert(completed);
        created += 1;
      } catch (err) {
        const message =
          err instanceof ApiClientError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Transcription failed';
        transcriptsStore.upsert({
          ...base,
          status: 'failed',
          errorMessage: message,
          updatedAt: new Date().toISOString(),
        });
      }
    }

    return created;
  }, []);

  return { runSync };
}