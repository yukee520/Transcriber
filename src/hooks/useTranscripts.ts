import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import type {
  Transcript,
  TranscriptFilter,
  TranscriptListItem,
} from '@/types/transcript';
import { deleteTranscriptFile } from '@/utils/storage';

const TRANSCRIPTS_KEY = 'transcripts';

async function loadTranscripts(): Promise<Transcript[]> {
  const { useTranscriptsStore } = await import('@/store/useTranscriptsStore');
  return useTranscriptsStore.getState().transcripts;
}

export function useTranscripts(filter?: Partial<TranscriptFilter>) {
  const query = useQuery<Transcript[], Error>({
    queryKey: [TRANSCRIPTS_KEY],
    queryFn: loadTranscripts,
    staleTime: 1000 * 30,
  });

  const items: TranscriptListItem[] = useMemo(() => {
    const data = query.data ?? [];
    const search = (filter?.search ?? '').trim().toLowerCase();
    const platform = filter?.platform ?? 'all';
    const creatorId = filter?.creatorId ?? 'all';
    const status = filter?.status ?? 'all';

    return data
      .filter((t) => {
        if (platform !== 'all' && t.platform !== platform) return false;
        if (creatorId !== 'all' && t.creatorId !== creatorId) return false;
        if (status !== 'all' && t.status !== status) return false;
        if (search) {
          const haystack = `${t.videoTitle} ${t.creatorName} ${t.creatorUsername} ${t.text}`.toLowerCase();
          if (!haystack.includes(search)) return false;
        }
        return true;
      })
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .map((t) => ({
        id: t.id,
        creatorId: t.creatorId,
        creatorName: t.creatorName,
        platform: t.platform,
        videoTitle: t.videoTitle,
        thumbnailUrl: t.thumbnailUrl,
        durationSeconds: t.durationSeconds,
        language: t.language,
        status: t.status,
        wordCount: t.wordCount,
        createdAt: t.createdAt,
      }));
  }, [query.data, filter?.search, filter?.platform, filter?.creatorId, filter?.status]);

  return {
    ...query,
    items,
    total: query.data?.length ?? 0,
    filteredCount: items.length,
  };
}

export function useTranscript(id: string | undefined) {
  return useQuery<Transcript | null, Error>({
    queryKey: [TRANSCRIPTS_KEY, id],
    enabled: Boolean(id),
    queryFn: async () => {
      if (!id) return null;
      const { useTranscriptsStore } = await import('@/store/useTranscriptsStore');
      return useTranscriptsStore.getState().getById(id) ?? null;
    },
  });
}

export function useDeleteTranscript() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (id: string) => {
      const { useTranscriptsStore } = await import('@/store/useTranscriptsStore');
      try {
        await deleteTranscriptFile(id);
      } catch {
        // file may not exist; ignore
      }
      useTranscriptsStore.getState().remove(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TRANSCRIPTS_KEY] });
      Toast.show({
        type: 'success',
        text1: 'Transcript deleted',
        position: 'bottom',
      });
    },
    onError: (error) => {
      Toast.show({
        type: 'error',
        text1: 'Delete failed',
        text2: error.message,
        position: 'bottom',
      });
    },
  });
}