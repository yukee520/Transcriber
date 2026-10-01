import axios, { AxiosInstance, AxiosError } from 'axios';
import type { ApiError } from '@/types/api';
import { useSettingsStore } from '@/store/useSettingsStore';

export class ApiClientError extends Error {
  status?: number;
  code?: string;

  constructor(message: string, status?: number, code?: string) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
  }
}

function normalizeAxiosError(error: unknown): ApiClientError {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{ message?: string; error?: string }>;
    const status = axiosError.response?.status;
    const serverMessage =
      axiosError.response?.data?.message ?? axiosError.response?.data?.error;

    if (serverMessage) {
      return new ApiClientError(serverMessage, status);
    }
    if (axiosError.code === 'ECONNABORTED') {
      return new ApiClientError('Request timed out. Please try again.', status);
    }
    if (!axiosError.response) {
      return new ApiClientError(
        'Cannot reach the transcription backend. Check your connection and backend URL in Settings.',
        status,
      );
    }
    if (status === 401 || status === 403) {
      return new ApiClientError('Invalid or missing API key. Check Settings.', status);
    }
    if (status === 429) {
      return new ApiClientError('Too many requests. Please slow down.', status);
    }
    if (status && status >= 500) {
      return new ApiClientError('The backend encountered an error. Try again later.', status);
    }
    return new ApiClientError(axiosError.message || 'Something went wrong.', status);
  }
  if (error instanceof Error) {
    return new ApiClientError(error.message);
  }
  return new ApiClientError('Unknown error occurred.');
}

export function createApiClient(): AxiosInstance {
  const { backendUrl, apiKey } = useSettingsStore.getState();
  const baseURL = backendUrl.trim().replace(/\/+$/, '');

  const instance = axios.create({
    baseURL,
    timeout: 60000,
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
  });

  instance.interceptors.response.use(
    (response) => response,
    (error) => Promise.reject(normalizeAxiosError(error)),
  );

  return instance;
}

export function assertBackendConfigured(): void {
  const { backendUrl } = useSettingsStore.getState();
  if (!backendUrl.trim()) {
    throw new ApiClientError(
      'No transcription backend configured. Add one in Settings to continue.',
    );
  }
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiClientError) {
    return { message: error.message, status: error.status, code: error.code };
  }
  if (error instanceof Error) {
    return { message: error.message };
  }
  return { message: 'Unknown error occurred.' };
}