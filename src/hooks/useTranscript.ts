import { useQuery } from '@tanstack/react-query';
import type { Transcript } from '@/types/transcript';
import { useTranscriptsStore } from '@/store/useTranscriptsStore';

export function useTranscript(id: string | undefined) {
  return useQuery<Transcript | null, Error>({
    queryKey: ['transcript', id],
    enabled: Boolean(id),
    queryFn: async () => {
      if (!id) return null;
      return useTranscriptsStore.getState().getById(id) ?? null;
    },
    staleTime: 1000 * 30,
  });
}