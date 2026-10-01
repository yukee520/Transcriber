import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  Image,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useCreators, useDeleteCreator, useToggleCreatorStatus } from '@/hooks/useCreators';
import { useTranscripts } from '@/hooks/useTranscripts';
import { useSyncCreators } from '@/hooks/useSyncCreators';
import { useSyncStore } from '@/store/useSyncStore';
import { useSettings } from '@/hooks/useSettings';
import ScreenHeader from '@/components/ScreenHeader';
import TranscriptCard from '@/components/TranscriptCard';
import EmptyState from '@/components/EmptyState';
import ErrorState from '@/components/ErrorState';
import LoadingSpinner from '@/components/LoadingSpinner';
import PlatformBadge from '@/components/PlatformBadge';
import Button from '@/components/Button';
import Card from '@/components/Card';
import showConfirmDialog from '@/components/ConfirmDialog';
import { formatDate, formatRelativeTime } from '@/utils/formatting';
import type { RootStackParamList } from '@/navigation/types';
import type { TranscriptListItem } from '@/types/transcript';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type DetailRoute = RouteProp<RootStackParamList, 'CreatorDetail'>;

export default function CreatorDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<DetailRoute>();
  const { creatorId } = route.params;

  const { items: allCreators, isLoading: loadingCreators, isError: creatorsError, error: creatorsErrObj, refetch: refetchCreators } =
    useCreators();
  const creator = useMemo(
    () => allCreators.find((c) => c.id === creatorId),
    [allCreators, creatorId],
  );

  const { items: transcripts, isLoading: loadingTranscripts, refetch, isRefetching } =
    useTranscripts({ creatorId });

  const deleteMutation = useDeleteCreator();
  const toggleMutation = useToggleCreatorStatus();
  const { runSync } = useSyncCreators();
  const { isBackendConfigured } = useSettings();
  const syncPhase = useSyncStore((s) => s.phase);

  const handleOpenTranscript = useCallback(
    (id: string) => {
      navigation.navigate('TranscriptDetail', { transcriptId: id });
    },
    [navigation],
  );

  const handleSyncNow = useCallback(() => {
    void runSync({ creatorIds: [creatorId] });
  }, [runSync, creatorId]);

  const handleDelete = useCallback(() => {
    if (!creator) return;
    showConfirmDialog({
      title: 'Remove creator?',
      message: `You'll stop tracking ${creator.name}. Transcripts already saved in your library will NOT be deleted.`,
      confirmLabel: 'Remove',
      destructive: true,
      onConfirm: () => {
        deleteMutation.mutate(creator.id, {
          onSuccess: () => navigation.goBack(),
        });
      },
    });
  }, [creator, deleteMutation, navigation]);

  const handleToggle = useCallback(() => {
    if (!creator) return;
    toggleMutation.mutate({
      id: creator.id,
      status: creator.status === 'active' ? 'paused' : 'active',
    });
  }, [creator, toggleMutation]);

  const renderItem = useCallback(
    ({ item }: { item: TranscriptListItem }) => (
      <View className="mb-3">
        <TranscriptCard item={item} onPress={handleOpenTranscript} />
      </View>
    ),
    [handleOpenTranscript],
  );

  if (loadingCreators) {
    return (
      <SafeAreaView className="flex-1 bg-background dark:bg-dark-background">
        <ScreenHeader title="Creator" showBack />
        <LoadingSpinner fullScreen label="Loading creator…" />
      </SafeAreaView>
    );
  }

  if (creatorsError) {
    return (
      <SafeAreaView className="flex-1 bg-background dark:bg-dark-background">
        <ScreenHeader title="Creator" showBack />
        <ErrorState
          message={creatorsErrObj?.message ?? 'Could not load this creator.'}
          onRetry={() => {
            void refetchCreators();
          }}
        />
      </SafeAreaView>
    );
  }

  if (!creator) {
    return (
      <SafeAreaView className="flex-1 bg-background dark:bg-dark-background">
        <ScreenHeader title="Creator" showBack />
        <ErrorState
          title="Creator not found"
          message="This creator may have been removed."
        />
      </SafeAreaView>
    );
  }

  const isPaused = creator.status === 'paused';
  const isSyncing = syncPhase === 'running';

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-dark-background">
      <ScreenHeader
        title={creator.name}
        showBack
        right={
          <Pressable
            onPress={handleDelete}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Remove creator"
          >
            <Ionicons name="trash-outline" size={22} color="#EF4444" />
          </Pressable>
        }
      />
      <FlatList
        data={transcripts}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => {
              void refetch();
            }}
            tintColor="#2563EB"
          />
        }
        ListHeaderComponent={
          <View className="px-4 pt-3 pb-3">
            <Card className="mb-4">
              <View className="flex-row items-center">
                <View className="w-16 h-16 rounded-full overflow-hidden bg-border dark:bg-dark-border items-center justify-center mr-3">
                  {creator.avatarUrl ? (
                    <Image
                      source={{ uri: creator.avatarUrl }}
                      className="w-16 h-16"
                    />
                  ) : (
                    <Text className="text-xl font-bold text-muted dark:text-dark-muted">
                      {creator.name.charAt(0).toUpperCase()}
                    </Text>
                  )}
                </View>
                <View className="flex-1">
                  <Text
                    numberOfLines={1}
                    className="text-lg font-bold text-text dark:text-dark-text"
                  >
                    {creator.name}
                  </Text>
                  <Text
                    numberOfLines={1}
                    className="text-sm text-muted dark:text-dark-muted mt-0.5"
                  >
                    @{creator.username}
                  </Text>
                  <View className="flex-row items-center mt-2">
                    <PlatformBadge platform={creator.platform} size="sm" />
                    <View
                      className={[
                        'ml-2 px-2 py-0.5 rounded-full',
                        isPaused ? 'bg-muted/20' : 'bg-success/20',
                      ].join(' ')}
                    >
                      <Text
                        className={[
                          'text-[11px] font-medium',
                          isPaused ? 'text-muted' : 'text-success',
                        ].join(' ')}
                      >
                        {isPaused ? 'Paused' : 'Active'}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              <View className="flex-row items-center justify-between mt-3 pt-3 border-t border-border dark:border-dark-border">
                <View className="flex-1 mr-3">
                  <Text className="text-xs text-muted dark:text-dark-muted">
                    Last synced
                  </Text>
                  <Text
                    numberOfLines={1}
                    className="text-sm font-medium text-text dark:text-dark-text mt-0.5"
                  >
                    {creator.lastSyncedAt
                      ? formatRelativeTime(creator.lastSyncedAt)
                      : 'Never'}
                  </Text>
                </View>
                <View className="flex-1 mr-3">
                  <Text className="text-xs text-muted dark:text-dark-muted">
                    Tracking since
                  </Text>
                  <Text
                    numberOfLines={1}
                    className="text-sm font-medium text-text dark:text-dark-text mt-0.5"
                  >
                    {formatDate(creator.createdAt)}
                  </Text>
                </View>
              </View>

              <View className="flex-row gap-3 mt-4">
                <View className="flex-1">
                  <Button
                    label={isPaused ? 'Resume' : 'Pause'}
                    onPress={handleToggle}
                    variant="secondary"
                    icon={isPaused ? 'play' : 'pause'}
                    fullWidth
                    size="sm"
                    loading={toggleMutation.isPending}
                  />
                </View>
                <View className="flex-1">
                  <Button
                    label={isSyncing ? 'Syncing…' : 'Sync now'}
                    onPress={handleSyncNow}
                    icon="refresh"
                    fullWidth
                    size="sm"
                    loading={isSyncing}
                    disabled={isSyncing || !isBackendConfigured || isPaused}
                  />
                </View>
              </View>

              {!isBackendConfigured ? (
                <Text className="text-xs text-muted dark:text-dark-muted mt-2 text-center">
                  Configure a backend in Settings to enable syncing.
                </Text>
              ) : null}
            </Card>

            {loadingTranscripts ? (
              <LoadingSpinner label="Loading transcripts…" />
            ) : transcripts.length > 0 ? (
              <Text className="text-base font-semibold text-text dark:text-dark-text mb-1">
                Transcripts ({transcripts.length})
              </Text>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          loadingTranscripts ? null : (
            <EmptyState
              icon="document-text-outline"
              title="No transcripts yet"
              message={
                isBackendConfigured
                  ? 'Tap "Sync now" above to fetch and transcribe this creator\'s recent videos.'
                  : 'Add a transcription backend in Settings, then sync to build a transcript library for this creator.'
              }
              actionLabel={isBackendConfigured ? 'Sync now' : 'Open settings'}
              onAction={() => {
                if (isBackendConfigured) {
                  handleSyncNow();
                } else {
                  navigation.navigate('Settings');
                }
              }}
            />
          )
        }
        contentContainerStyle={{ paddingBottom: 32 }}
      />
    </SafeAreaView>
  );
}