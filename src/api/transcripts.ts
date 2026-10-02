import { createApiClient, assertBackendConfigured } from './client';
import type {
  ListVideosRequest,
  ListVideosResponse,
  TranscribeRequest,
  TranscribeResponse,
  TranscribeStartRequest,
  TranscribeStartResponse,
  TranscribeStatusResponse,
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
    { timeout: 1800000 },
  );
  return response.data;
}

export async function startTranscription(
  request: TranscribeStartRequest,
): Promise<TranscribeStartResponse> {
  assertBackendConfigured();
  const client = createApiClient();

  const body: TranscribeStartRequest = {
    platform: request.platform,
    videoUrl: request.videoUrl,
    videoId: request.videoId,
    language: request.language,
  };

  if (request.model) {
    body.model = request.model;
  }

  const response = await client.post<TranscribeStartResponse>(
    '/transcribe/start',
    body,
    { timeout: 30000 },
  );

  return response.data;
}

export async function getTranscriptionStatus(
  jobId: string,
): Promise<TranscribeStatusResponse> {
  assertBackendConfigured();
  const client = createApiClient();

  const response = await client.get<TranscribeStatusResponse>(
    `/transcribe/status/${encodeURIComponent(jobId)}`,
    { timeout: 30000 },
  );

  return response.data;
}