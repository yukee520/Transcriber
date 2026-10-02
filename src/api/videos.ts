import { createApiClient, assertBackendConfigured } from './client';
import type {
  FetchTitlesRequest,
  FetchTitlesResponse,
  ListVideosRequest,
  ListVideosResponse,
  TitleFetchItem,
  VideoTitle,
} from '@/types/api';

export async function fetchCreatorVideos(
  request: ListVideosRequest,
): Promise<ListVideosResponse> {
  assertBackendConfigured();
  const client = createApiClient();
  const response = await client.post<ListVideosResponse>('/videos/list', {
    platform: request.platform,
    username: request.username,
    limit: request.limit ?? 50,
    startIndex: request.startIndex ?? 0,
  });
  return response.data;
}

export async function fetchDynamicVideos(
  uid: string,
  limit: number = 100,
): Promise<ListVideosResponse> {
  assertBackendConfigured();
  const client = createApiClient();
  const response = await client.post<ListVideosResponse>(
    '/videos/dynamic',
    { uid, limit },
    { timeout: 180000 },
  );
  return response.data;
}

export async function fetchVideoTitles(
  platform: ListVideosRequest['platform'],
  videos: TitleFetchItem[],
): Promise<VideoTitle[]> {
  if (videos.length === 0) {
    return [];
  }

  assertBackendConfigured();
  const client = createApiClient();

  const body: FetchTitlesRequest = { platform, videos };

  const response = await client.post<FetchTitlesResponse>(
    '/videos/titles',
    body,
    { timeout: 180000 },
  );

  return response.data.titles;
}