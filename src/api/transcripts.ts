import { createApiClient, assertBackendConfigured } from './client';
import type {
  ListVideosRequest,
  ListVideosResponse,
  TranscribeRequest,
  TranscribeResponse,
} from '@/types/api';

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

export async function requestTranscription(
  request: TranscribeRequest,
): Promise<TranscribeResponse> {
  assertBackendConfigured();
  const client = createApiClient();
  const response = await client.post<TranscribeResponse>(
    '/transcribe',
    {
      platform: request.platform,
      videoUrl: request.videoUrl,
      videoId: request.videoId,
      language: request.language,
    },
    { timeout: 180000 },
  );
  return response.data;
}