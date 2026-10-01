import { useMutation, useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import type { Creator, Platform } from '@/types/creator';
import { useCreatorsStore } from '@/store/useCreatorsStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { validateCreator } from '@/api/creators';
import { ApiClientError } from '@/api/client';
import { generateCreatorId } from '@/utils/id';
import { buildProfileUrl, parseUsername } from '@/utils/platform';

export interface AddCreatorInput {
  rawInput: string;
  platform: Platform;
  name?: string;
}

export function useAddCreator() {
  const queryClient = useQueryClient();

  return useMutation<Creator, Error, AddCreatorInput>({
    mutationFn: async ({ rawInput, platform, name }) => {
      const username = parseUsername(rawInput);
      if (!username) {
        throw new Error('Enter a valid username or profile URL.');
      }

      const existing = useCreatorsStore
        .getState()
        .findByHandle(platform, username);
      if (existing) {
        throw new Error(
          `${existing.name} (@${existing.username}) is already being tracked.`,
        );
      }

      const { backendUrl } = useSettingsStore.getState();
      let displayName = name?.trim() || username;
      let avatarUrl: string | undefined;

      if (backendUrl.trim()) {
        try {
          const validated = await validateCreator({ platform, username });
          if (!validated.valid) {
            throw new Error(
              validated.errorMessage ??
                `Could not find @${username} on ${platform}.`,
            );
          }
          if (validated.name) displayName = validated.name;
          avatarUrl = validated.avatarUrl;
        } catch (err) {
          if (err instanceof ApiClientError && err.status === 404) {
            throw new Error(`@${username} was not found on ${platform}.`);
          }
          if (err instanceof Error && !(err instanceof ApiClientError)) {
            throw err;
          }
          throw new Error(
            'Could not verify this creator. Check your backend settings and try again.',
          );
        }
      }

      const now = new Date().toISOString();
      const creator: Creator = {
        id: generateCreatorId(),
        name: displayName,
        username,
        profileUrl: buildProfileUrl(platform, username),
        platform,
        avatarUrl,
        status: 'active',
        autoSync: true,
        createdAt: now,
      };

      useCreatorsStore.getState().add(creator);
      return creator;
    },
    onSuccess: (creator) => {
      queryClient.invalidateQueries({ queryKey: ['creators'] });
      Toast.show({
        type: 'success',
        text1: 'Creator added',
        text2: `Now tracking ${creator.name}`,
        position: 'bottom',
      });
    },
    onError: (error) => {
      Toast.show({
        type: 'error',
        text1: 'Could not add creator',
        text2: error.message,
        position: 'bottom',
      });
    },
  });
}