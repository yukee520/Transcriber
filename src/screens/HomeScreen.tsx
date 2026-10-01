import React, { useCallback, useMemo } from 'react';
import { View, Text, FlatList, RefreshControl, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTranscripts } from '@/hooks/useTranscripts';
import { useCreators } from '@/hooks/useCreators';
import { useSyncCreators } from '@/hooks/useSyncCreators';
import { useSyncStore } from '@/store/useSyncStore';
import { useSettings } from '@/hooks/useSettings';
import TranscriptCard from '@/components/TranscriptCard';
import StatTile from '@/components/StatTile';
import EmptyState from '@/components/EmptyState';
import ErrorState from '@/components/ErrorState';
import LoadingSpinner from '@/components/LoadingSpinner';
import Button from '@/components/Button';
import Card from '@/components/Card';
import type { RootStackParamList } from '@/navigation/types';
import type { TranscriptListItem } from '@/types/transcript';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const { items, isLoading, isError, error, refetch, isRefetching, total } =
    useTranscripts();
  const { total: creatorCount, items: creators } = useCreators();
  const { runSync } = useSyncCreators();
  const { isBackendConfigured } = useSettings();
  const syncPhase = useSyncStore((s) => s.phase);
  const syncProgress = useSyncStore((s) => s.progress);

  const recent = useMemo(() => items.slice(0, 5), [items]);

  const completedCount = useMemo(
    () => items.filter((t) => t.status === 'completed').length,
    [items],
  );

  const totalWords = useMemo(
    () => items.reduce((acc, t) => acc + t.wordCount, 0),
    [items],
  );

  const handleOpenTranscript = useCallback(
    (id: string) => {
      navigation.navigate('TranscriptDetail', { transcriptId: id });
    },
    [navigation],
  );

  const handleSync = useCallback(() => {
    void runSync();
  }, [runSync]);

  const renderItem = useCallback(
    ({ item }: { item: TranscriptListItem }) => (
      <View className="mb-3">
        <TranscriptCard item={item} onPress={handleOpenTranscript} />
      </View>
    ),
    [handleOpenTranscript],
  );

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background dark:bg-dark-background">
        <LoadingSpinner fullScreen label="Loading your library…" />
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView className="flex-1 bg-background dark:bg-dark-background">
        <ErrorState
          message={error?.message ?? 'Could not load your transcripts.'}
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
        data={recent}
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
          <View className="px-4 pt-2 pb-4">
            <View className="flex-row items-center justify-between mb-4">
              <View>
                <Text className="text-2xl font-bold text-text dark:text-dark-text">
                  Transcriber
                </Text>
                <Text className="text-sm text-muted dark:text-dark-muted mt-0.5">
                  {total === 0
                    ? 'Your library is empty'
                    : `${total} ${total === 1 ? 'transcript' : 'transcripts'} saved`}
                </Text>
              </View>
              <Pressable
                onPress={() => navigation.navigate('Settings')}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Open settings"
              >
                <Ionicons
                  name="settings-outline"
                  size={24}
                  color="#2563EB"
                />
              </Pressable>
            </View>

            {!isBackendConfigured ? (
              <Card className="mb-4 border-primary/30">
                <View className="flex-row items-start">
                  <Ionicons
                    name="information-circle-outline"
                    size={22}
                    color="#2563EB"
                  />
                  <View className="flex-1 ml-2">
                    <Text className="text-sm font-semibold text-text dark:text-dark-text">
                      Backend not configured
                    </Text>
                    <Text className="text-sm text-muted dark:text-dark-muted mt-1 leading-5">
                      Add your transcription backend URL in Settings to start
                      syncing creators automatically.
                    </Text>
                    <View className="mt-3">
                      <Button
                        label="Open settings"
                        onPress={() => navigation.navigate('Settings')}
                        size="sm"
                        variant="secondary"
                        icon="settings-outline"
                      />
                    </View>
                  </View>
                </View>
              </Card>
            ) : null}

            <View className="flex-row gap-3 mb-4">
              <StatTile
                icon="document-text-outline"
                label="Transcripts"
                value={completedCount.toString()}
              />
              <StatTile
                icon="people-outline"
                label="Creators"
                value={creatorCount.toString()}
                tint="#64748B"
              />
              <StatTile
                icon="text-outline"
                label="Words"
                value={
                  totalWords >= 1000
                    ? `${Math.round(totalWords / 1000)}k`
                    : totalWords.toString()
                }
                tint="#10B981"
              />
            </View>

            {isBackendConfigured && creatorCount > 0 ? (
              <Card className="mb-4">
                <View className="flex-row items-center justify-between">
                  <View className="flex-1 mr-3">
                    <Text className="text-base font-semibold text-text dark:text-dark-text">
                      Sync creators
                    </Text>
                    <Text className="text-sm text-muted dark:text-dark-muted mt-0.5">
                      {syncPhase === 'running'
                        ? `${syncProgress.completedCreators}/${syncProgress.totalCreators} — ${
                            syncProgress.currentCreatorName ?? 'starting…'
                          }`
                        : `Check ${creators.filter((c) => c.status === 'active').length} active creator${
                            creators.filter((c) => c.status === 'active').length === 1
                              ? ''
                              : 's'
                          } for new videos`}
                    </Text>
                  </View>
                  <Button
                    label={syncPhase === 'running' ? 'Syncing…' : 'Sync'}
                    onPress={handleSync}
                    size="sm"
                    loading={syncPhase === 'running'}
                    disabled={syncPhase === 'running'}
                    icon="refresh"
                  />
                </View>
              </Card>
            ) : null}

            {recent.length > 0 ? (
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-base font-semibold text-text dark:text-dark-text">
                  Recent
                </Text>
                <Pressable
                  onPress={() => navigation.navigate('MainTabs', { screen: 'Library' })}
                  accessibilityRole="button"
                >
                  <Text className="text-sm font-medium text-primary dark:text-primary">
                    See all
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="mic-outline"
            title="No transcripts yet"
            message="Add a creator to start transcribing their videos. Everything you save will show up here."
            actionLabel={creatorCount === 0 ? 'Add a creator' : 'Sync now'}
            onAction={() => {
              if (creatorCount === 0) {
                navigation.navigate('AddCreator');
              } else {
                handleSync();
              }
            }}
          />
        }
        contentContainerStyle={{ paddingBottom: 32 }}
      />
    </SafeAreaView>
  );
}