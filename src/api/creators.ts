import { createApiClient, assertBackendConfigured } from './client';
import type {
  ValidateCreatorRequest,
  ValidateCreatorResponse,
} from '@/types/api';

export async function validateCreator(
  request: ValidateCreatorRequest,
): Promise<ValidateCreatorResponse> {
  assertBackendConfigured();
  const client = createApiClient();
  const response = await client.post<ValidateCreatorResponse>('/creator/validate', {
    platform: request.platform,
    username: request.username,
  });
  return response.data;
}