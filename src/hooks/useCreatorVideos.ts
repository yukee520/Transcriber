import { useQuery } from '@tanstack/react-query';
import type { Platform } from '@/types/creator';
import type { BackendVideo } from '@/types/api';
import { fetchCreatorVideos } from '@/api/videos';
import { toApiError } from '@/api/client';

const CREATOR_VIDEOS_KEY = 'creator-videos';

interface UseCreatorVideosParams {
  creatorId: string;
  platform: Platform;
  username: string;
  limit?: number;
  enabled?: boolean;
}

interface UseCreatorVideosResult {
  videos: BackendVideo[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
  isRefetching: boolean;
}

export function useCreatorVideos({
  creatorId,
  platform,
  username,
  limit = 25,
  enabled = true,
}: UseCreatorVideosParams): UseCreatorVideosResult {
  const query = useQuery<BackendVideo[], Error>({
    queryKey: [CREATOR_VIDEOS_KEY, creatorId, limit],
    enabled: enabled && username.trim().length > 0,
    staleTime: 1000 * 60 * 60,
    retry: 0,
    queryFn: async () => {
      try {
        const response = await fetchCreatorVideos({
          platform,
          username,
          limit,
        });
        return response.videos;
      } catch (err) {
        const apiError = toApiError(err);
        throw new Error(apiError.message);
      }
    },
  });

  return {
    videos: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error ?? null,
    refetch: () => {
      void query.refetch();
    },
    isRefetching: query.isRefetching,
  };
}