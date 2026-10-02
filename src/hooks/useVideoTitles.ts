import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Platform } from '@/types/creator';
import type { BackendVideo, TitleFetchItem, VideoTitle } from '@/types/api';
import { fetchVideoTitles } from '@/api/videos';
import { toApiError } from '@/api/client';

const TITLES_KEY = 'video-titles';
const TITLES_BATCH_SIZE = 25;

interface UseVideoTitlesParams {
  platform: Platform;
  videos: BackendVideo[];
  enabled?: boolean;
}

interface UseVideoTitlesResult {
  titleFor: (videoId: string) => VideoTitle | undefined;
  hasTitle: (videoId: string) => boolean;
  isLoading: boolean;
  pendingCount: number;
}

function pickPending(
  videos: BackendVideo[],
  cache: Record<string, VideoTitle>,
): BackendVideo[] {
  const pending: BackendVideo[] = [];
  for (const v of videos) {
    if (!v.videoId) continue;
    if (v.title && v.title.trim().length > 0) continue;
    if (cache[v.videoId]) continue;
    pending.push(v);
  }
  return pending;
}

export function useVideoTitles({
  platform,
  videos,
  enabled = true,
}: UseVideoTitlesParams): UseVideoTitlesResult {
  const queryClient = useQueryClient();
  const [cache, setCache] = useState<Record<string, VideoTitle>>({});
  const [isLoading, setIsLoading] = useState(false);
  const inFlightRef = useRef<Set<string>>(new Set());

  const videosKey = useMemo(
    () => videos.map((v) => v.videoId).join('|'),
    [videos],
  );

  useEffect(() => {
    if (!enabled) return;
    if (videos.length === 0) return;

    const pending = pickPending(videos, cache).filter(
      (v) => !inFlightRef.current.has(v.videoId),
    );

    if (pending.length === 0) return;

    let cancelled = false;

    const run = async () => {
      setIsLoading(true);
      try {
        for (let i = 0; i < pending.length; i += TITLES_BATCH_SIZE) {
          if (cancelled) return;
          const batch = pending.slice(i, i + TITLES_BATCH_SIZE);
          batch.forEach((v) => inFlightRef.current.add(v.videoId));

          const items: TitleFetchItem[] = batch.map((v) => ({
            videoId: v.videoId,
            url: v.url,
          }));

          try {
            const results = await fetchVideoTitles(platform, items);
            if (cancelled) return;

            setCache((prev) => {
              const next = { ...prev };
              for (const t of results) {
                if (!t.title || t.title.trim().length === 0) continue;
                next[t.videoId] = t;
              }
              return next;
            });

            queryClient.setQueryData<Record<string, VideoTitle>>(
              [TITLES_KEY, platform],
              (old) => {
                const next = { ...(old ?? {}) };
                for (const t of results) {
                  if (!t.title || t.title.trim().length === 0) continue;
                  next[t.videoId] = t;
                }
                return next;
              },
            );
          } catch (err) {
            if (cancelled) return;
            const apiError = toApiError(err);
            // Titles are best-effort; keep the list usable even if a batch fails.
            if (__DEV__) {
              console.warn('[useVideoTitles] batch failed:', apiError.message);
            }
          } finally {
            batch.forEach((v) => inFlightRef.current.delete(v.videoId));
          }
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videosKey, platform, enabled]);

  const titleFor = (videoId: string): VideoTitle | undefined =>
    cache[videoId];

  const hasTitle = (videoId: string): boolean => Boolean(cache[videoId]);

  const pendingCount = useMemo(
    () => pickPending(videos, cache).length,
    [videos, cache],
  );

  return { titleFor, hasTitle, isLoading, pendingCount };
}

export function useClearVideoTitlesCache() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.removeQueries({ queryKey: [TITLES_KEY] });
  };
}

const _useQueryUnused = useQuery;
void _useQueryUnused;