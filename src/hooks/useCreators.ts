import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import type { Creator, CreatorStatus } from '@/types/creator';
import { useCreatorsStore } from '@/store/useCreatorsStore';

const CREATORS_KEY = 'creators';

async function loadCreators(): Promise<Creator[]> {
  return useCreatorsStore.getState().creators;
}

export function useCreators(statusFilter?: CreatorStatus | 'all') {
  const query = useQuery<Creator[], Error>({
    queryKey: [CREATORS_KEY],
    queryFn: loadCreators,
    staleTime: 1000 * 30,
  });

  const items: Creator[] = useMemo(() => {
    const data = query.data ?? [];
    const filter = statusFilter ?? 'all';
    const filtered =
      filter === 'all' ? data : data.filter((c) => c.status === filter);
    return filtered
      .slice()
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }, [query.data, statusFilter]);

  return {
    ...query,
    items,
    total: query.data?.length ?? 0,
  };
}

export function useToggleCreatorStatus() {
  const queryClient = useQueryClient();

  return useMutation<Creator, Error, { id: string; status: CreatorStatus }>({
    mutationFn: async ({ id, status }) => {
      const updated = useCreatorsStore.getState().update(id, { status });
      if (!updated) {
        throw new Error('Creator not found');
      }
      return updated;
    },
    onSuccess: (creator) => {
      queryClient.invalidateQueries({ queryKey: [CREATORS_KEY] });
      Toast.show({
        type: 'success',
        text1:
          creator.status === 'paused'
            ? `${creator.name} paused`
            : `${creator.name} resumed`,
        position: 'bottom',
      });
    },
    onError: (error) => {
      Toast.show({
        type: 'error',
        text1: 'Update failed',
        text2: error.message,
        position: 'bottom',
      });
    },
  });
}

export function useDeleteCreator() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (id: string) => {
      useCreatorsStore.getState().remove(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CREATORS_KEY] });
      Toast.show({
        type: 'success',
        text1: 'Creator removed',
        text2: 'Saved transcripts are still available in Library.',
        position: 'bottom',
      });
    },
    onError: (error) => {
      Toast.show({
        type: 'error',
        text1: 'Remove failed',
        text2: error.message,
        position: 'bottom',
      });
    },
  });
}