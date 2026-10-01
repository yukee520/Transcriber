import { useQuery } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getTranscriptsDirSize } from '@/utils/storage';

export interface StorageUsage {
  filesBytes: number;
  metadataBytes: number;
  totalBytes: number;
}

const STORAGE_KEY_PREFIXES = [
  'transcriber-settings',
  'transcriber-onboarding',
  'transcriber-transcripts',
  'transcriber-creators',
];

async function computeUsage(): Promise<StorageUsage> {
  const filesBytes = await getTranscriptsDirSize();
  let metadataBytes = 0;

  try {
    const keys = await AsyncStorage.getAllKeys();
    const relevant = keys.filter((k) =>
      STORAGE_KEY_PREFIXES.some((prefix) => k.startsWith(prefix)),
    );
    if (relevant.length > 0) {
      const entries = await AsyncStorage.multiGet(relevant);
      for (const [, value] of entries) {
        if (value) metadataBytes += value.length;
      }
    }
  } catch {
    // ignore, metadata size is best-effort
  }

  return {
    filesBytes,
    metadataBytes,
    totalBytes: filesBytes + metadataBytes,
  };
}

export function useStorageUsage() {
  return useQuery<StorageUsage, Error>({
    queryKey: ['storage-usage'],
    queryFn: computeUsage,
    staleTime: 1000 * 15,
  });
}