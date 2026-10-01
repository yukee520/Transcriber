import React, { useCallback, useMemo } from 'react';
import { View, Text, FlatList, RefreshControl, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useCreators, useToggleCreatorStatus } from '@/hooks/useCreators';
import { useTranscripts } from '@/hooks/useTranscripts';
import { useSyncCreators } from '@/hooks/useSyncCreators';
import { useSyncStore } from '@/store/useSyncStore';
import { useSettings } from '@/hooks/useSettings';
import CreatorCard from '@/components/CreatorCard';
import EmptyState from '@/components/EmptyState';
import ErrorState from '@/components/ErrorState';
import LoadingSpinner from '@/components/LoadingSpinner';
import Button from '@/components/Button';
import type { RootStackParamList } from '@/navigation/types';
import type { Creator, CreatorStatus } from '@/types/creator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function CreatorsScreen() {
  const navigation = useNavigation<Nav>();
  const { items, isLoading, isError, error, refetch, isRefetching, total } =
    useCreators();
  const { data: allTranscripts } = useTranscripts();
  const toggleMutation = useToggleCreatorStatus();
  const { runSync } = useSyncCreators();
  const { isBackendConfigured } = useSettings();
  const syncPhase = useSyncStore((s) => s.phase);

  const transcriptCountByCreator = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of allTranscripts ?? []) {
      map.set(t.creatorId, (map.get(t.creatorId) ?? 0) + 1);
    }
    return map;
  }, [allTranscripts]);

  const handleOpenCreator = useCallback(
    (creator: Creator) => {
      navigation.navigate('CreatorDetail', { creatorId: creator.id });
    },
    [navigation],
  );

  const handleToggleStatus = useCallback(
    (creator: Creator) => {
      const next: CreatorStatus = creator.status === 'active' ? 'paused' : 'active';
      toggleMutation.mutate({ id: creator.id, status: next });
    },
    [toggleMutation],
  );

  const handleSyncAll = useCallback(() => {
    void runSync();
  }, [runSync]);

  const renderItem = useCallback(
    ({ item }: { item: Creator }) => (
      <View className="mb-3">
        <CreatorCard
          creator={item}
          transcriptCount={transcriptCountByCreator.get(item.id) ?? 0}
          onPress={handleOpenCreator}
          onToggleStatus={handleToggleStatus}
        />
      </View>
    ),
    [handleOpenCreator, handleToggleStatus, transcriptCountByCreator],
  );

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background dark:bg-dark-background">
        <LoadingSpinner fullScreen label="Loading creators…" />
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView className="flex-1 bg-background dark:bg-dark-background">
        <ErrorState
          message={error?.message ?? 'Could not load your creators.'}
          onRetry={() => {
            void refetch();
          }}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-dark-background">
      <FlatList
        data={items}
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
          <View className="px-4 pt-2 pb-3">
            <View className="flex-row items-center justify-between mb-4">
              <View>
                <Text className="text-2xl font-bold text-text dark:text-dark-text">
                  Creators
                </Text>
                <Text className="text-sm text-muted dark:text-dark-muted mt-0.5">
                  {total === 0
                    ? 'No creators yet'
                    : `${total} tracked`}
                </Text>
              </View>
              <Pressable
                onPress={() => navigation.navigate('AddCreator')}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Add creator"
                className="w-10 h-10 rounded-full bg-primary items-center justify-center"
              >
                <Ionicons name="add" size={22} color="#FFFFFF" />
              </Pressable>
            </View>

            {isBackendConfigured && total > 0 ? (
              <Button
                label={syncPhase === 'running' ? 'Syncing…' : 'Sync all now'}
                onPress={handleSyncAll}
                variant="secondary"
                icon="refresh"
                loading={syncPhase === 'running'}
                disabled={syncPhase === 'running'}
                fullWidth
              />
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="people-outline"
            title="No creators yet"
            message="Add the creators you want to follow. We'll look for new videos and turn them into text."
            actionLabel="Add a creator"
            onAction={() => navigation.navigate('AddCreator')}
          />
        }
        contentContainerStyle={{ paddingBottom: 32 }}
      />
    </SafeAreaView>
  );
}