import { createApiClient, assertBackendConfigured } from './client';
import type { ListVideosRequest, ListVideosResponse } from '@/types/api';

export async function fetchCreatorVideos(
  request: ListVideosRequest,
): Promise<ListVideosResponse> {
  assertBackendConfigured();
  const client = createApiClient();
  const response = await client.post<ListVideosResponse>('/videos/list', {
    platform: request.platform,
    username: request.username,
    limit: request.limit ?? 10,
  });
  return response.data;
}