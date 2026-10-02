import { useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { Platform } from '@/types/creator';
import type { BackendVideo } from '@/types/api';
import { fetchCreatorVideos, fetchDynamicVideos } from '@/api/videos';
import { toApiError } from '@/api/client';

const CREATOR_VIDEOS_KEY = 'creator-videos';
const PAGE_SIZE = 25;
const INITIAL_PAGE_SIZE = 50;
const DYNAMIC_PAGE_SIZE = 100;

interface UseCreatorVideosParams {
  creatorId: string;
  platform: Platform;
  username: string;
  enabled?: boolean;
}

interface UseCreatorVideosResult {
  videos: BackendVideo[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
  isRefetching: boolean;
  hasMore: boolean;
  loadMore: () => void;
  isLoadingMore: boolean;
  source: 'dynamic' | 'uploads';
}

interface PageResult {
  videos: BackendVideo[];
  nextCursor: string | null;
}

function isBilibili(platform: Platform): boolean {
  return platform === 'bilibili';
}

export function useCreatorVideos({
  creatorId,
  platform,
  username,
  enabled = true,
}: UseCreatorVideosParams): UseCreatorVideosResult {
  const useDynamic = isBilibili(platform);
  const source: 'dynamic' | 'uploads' = useDynamic ? 'dynamic' : 'uploads';

  const query = useInfiniteQuery<PageResult, Error>({
    queryKey: [CREATOR_VIDEOS_KEY, creatorId, platform, username, source],
    enabled: enabled && username.trim().length > 0,
    staleTime: 1000 * 60 * 60,
    retry: 0,
    initialPageParam: '',
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    queryFn: async ({ pageParam }) => {
      const cursor = typeof pageParam === 'string' ? pageParam : '';

      if (useDynamic) {
        try {
          const response = await fetchDynamicVideos(
            username,
            DYNAMIC_PAGE_SIZE,
            cursor,
          );
          const nextCursor =
            response.hasMore && response.nextOffset
              ? response.nextOffset
              : null;
          return {
            videos: response.videos,
            nextCursor,
          };
        } catch (err) {
          const apiError = toApiError(err);
          throw new Error(apiError.message);
        }
      }

      const startIndex = Number.parseInt(cursor, 10);
      const safeStart = Number.isFinite(startIndex) && startIndex > 0 ? startIndex : 0;
      const isFirstPage = safeStart === 0;
      const limit = isFirstPage ? INITIAL_PAGE_SIZE : PAGE_SIZE;

      try {
        const response = await fetchCreatorVideos({
          platform,
          username,
          limit,
          startIndex: safeStart,
        });
        const returned = response.videos.length;
        const reachedEnd = returned < limit;
        return {
          videos: response.videos,
          nextCursor: reachedEnd ? null : String(safeStart + returned),
        };
      } catch (err) {
        const apiError = toApiError(err);
        throw new Error(apiError.message);
      }
    },
  });

  const videos = useMemo(() => {
    const pages = query.data?.pages ?? [];
    const seen = new Set<string>();
    const merged: BackendVideo[] = [];
    for (const page of pages) {
      for (const v of page.videos) {
        if (!v.videoId || seen.has(v.videoId)) continue;
        seen.add(v.videoId);
        merged.push(v);
      }
    }
    return merged;
  }, [query.data]);

  return {
    videos,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error ?? null,
    refetch: () => {
      void query.refetch();
    },
    isRefetching: query.isRefetching && !query.isFetchingNextPage,
    hasMore: query.hasNextPage ?? false,
    loadMore: () => {
      if (query.hasNextPage && !query.isFetchingNextPage) {
        void query.fetchNextPage();
      }
    },
    isLoadingMore: query.isFetchingNextPage,
    source,
  };
}