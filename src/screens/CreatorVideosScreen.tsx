import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useCreators } from '@/hooks/useCreators';
import { useCreatorVideos } from '@/hooks/useCreatorVideos';
import { useVideoTitles } from '@/hooks/useVideoTitles';
import { useTranscribeSelected } from '@/hooks/useTranscribeSelected';
import { useTranscriptsStore } from '@/store/useTranscriptsStore';
import { useSettings } from '@/hooks/useSettings';
import ScreenHeader from '@/components/ScreenHeader';
import VideoSelectCard from '@/components/VideoSelectCard';
import EmptyState from '@/components/EmptyState';
import ErrorState from '@/components/ErrorState';
import LoadingSpinner from '@/components/LoadingSpinner';
import Button from '@/components/Button';
import type { RootStackParamList } from '@/navigation/types';
import type { BackendVideo } from '@/types/api';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type ScreenRoute = RouteProp<RootStackParamList, 'CreatorVideos'>;

export default function CreatorVideosScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<ScreenRoute>();
  const { creatorId } = route.params;

  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  const { items: creators } = useCreators();
  const creator = useMemo(
    () => creators.find((c) => c.id === creatorId),
    [creators, creatorId],
  );

  const { isBackendConfigured } = useSettings();

  const {
    videos,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
    hasMore,
    loadMore,
    isLoadingMore,
    source,
  } = useCreatorVideos({
    creatorId,
    platform: creator?.platform ?? 'other',
    username: creator?.username ?? '',
    enabled: Boolean(creator) && isBackendConfigured,
  });

  const titlesEnabled = source === 'uploads';

  const {
    titleFor,
    isLoading: titlesLoading,
  } = useVideoTitles({
    platform: creator?.platform ?? 'other',
    videos,
    enabled:
      titlesEnabled &&
      Boolean(creator) &&
      isBackendConfigured &&
      videos.length > 0,
  });

  const transcripts = useTranscriptsStore((s) => s.transcripts);

  const savedVideoIds = useMemo(() => {
    const ids = new Set<string>();
    for (const t of transcripts) {
      if (t.creatorId === creatorId && t.videoId) {
        ids.add(t.videoId);
      }
    }
    return ids;
  }, [transcripts, creatorId]);

  const { isRunning, progress, run } = useTranscribeSelected();

  const toggle = useCallback((videoId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(videoId)) {
        next.delete(videoId);
      } else {
        next.add(videoId);
      }
      return next;
    });
  }, []);

  const handleTranscribe = useCallback(() => {
    if (!creator || selected.size === 0 || isRunning) return;

    const chosen = videos.filter((v) => selected.has(v.videoId));
    if (chosen.length === 0) return;

    void run(creator, chosen).then(() => {
      setSelected(new Set());
    });
  }, [creator, selected, videos, isRunning, run]);

  const renderItem = useCallback(
    ({ item }: { item: BackendVideo }) => {
      const isSaved = savedVideoIds.has(item.videoId);
      const isSelected = selected.has(item.videoId);
      const resolved = titleFor(item.videoId);
      const isTitlePending =
        titlesEnabled && titlesLoading && !resolved && !item.title;

      return (
        <View className="mb-3">
          <VideoSelectCard
            video={item}
            selected={isSelected}
            saved={isSaved}
            disabled={isRunning}
            titleLoading={isTitlePending}
            resolvedTitle={resolved}
            onToggle={toggle}
          />
        </View>
      );
    },
    [
      savedVideoIds,
      selected,
      isRunning,
      toggle,
      titleFor,
      titlesLoading,
      titlesEnabled,
    ],
  );

  const handleBack = useCallback(() => {
    if (isRunning) return;
    navigation.goBack();
  }, [isRunning, navigation]);

  if (!creator) {
    return (
      <SafeAreaView className="flex-1 bg-background dark:bg-dark-background">
        <ScreenHeader title="Videos" showBack onBack={handleBack} />
        <ErrorState
          title="Creator not found"
          message="This creator may have been removed."
        />
      </SafeAreaView>
    );
  }

  if (!isBackendConfigured) {
    return (
      <SafeAreaView className="flex-1 bg-background dark:bg-dark-background">
        <ScreenHeader title={creator.name} showBack onBack={handleBack} />
        <EmptyState
          icon="cloud-offline-outline"
          title="Backend not configured"
          message="Add a transcription backend in Settings to load this creator's videos."
          actionLabel="Open settings"
          onAction={() => navigation.navigate('Settings')}
        />
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background dark:bg-dark-background">
        <ScreenHeader title={creator.name} showBack onBack={handleBack} />
        <LoadingSpinner
          fullScreen
          label={source === 'dynamic' ? 'Loading posts…' : 'Loading videos…'}
        />
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView className="flex-1 bg-background dark:bg-dark-background">
        <ScreenHeader title={creator.name} showBack onBack={handleBack} />
        <ErrorState
          message={error?.message ?? "Could not load this creator's videos."}
          onRetry={refetch}
        />
      </SafeAreaView>
    );
  }

  const selectableCount = videos.filter(
    (v) => !savedVideoIds.has(v.videoId),
  ).length;

  const subtitle =
    videos.length === 0
      ? source === 'dynamic'
        ? 'Dynamic posts'
        : 'Recent videos'
      : source === 'dynamic'
        ? `${videos.length} posts · ${selectableCount} new`
        : `${videos.length} loaded · ${selectableCount} new`;

  const renderFooter = () => {
    if (videos.length === 0) return null;

    if (isLoadingMore) {
      return (
        <View className="py-4 items-center">
          <ActivityIndicator size="small" color="#2563EB" />
          <Text className="mt-2 text-xs text-muted dark:text-dark-muted">
            Loading more…
          </Text>
        </View>
      );
    }

    if (!hasMore) {
      return (
        <View className="py-4 items-center">
          <Text className="text-xs text-muted dark:text-dark-muted">
            {source === 'dynamic'
              ? `${videos.length} posts loaded · end of feed`
              : 'No more videos'}
          </Text>
        </View>
      );
    }

    return (
      <View className="pt-2 pb-4">
        <Button
          label="Load more"
          onPress={loadMore}
          variant="secondary"
          icon="chevron-down"
          fullWidth
          size="sm"
        />
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-dark-background">
      <ScreenHeader
        title={creator.name}
        subtitle={subtitle}
        showBack
        onBack={handleBack}
      />

      <FlatList
        data={videos}
        keyExtractor={(item) => item.videoId}
        renderItem={renderItem}
        extraData={{ savedVideoIds, selected, titlesLoading }}
        removeClippedSubviews
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor="#2563EB"
          />
        }
        contentContainerStyle={{
          padding: 16,
          paddingBottom: selected.size > 0 ? 120 : 32,
        }}
        ListEmptyComponent={
          <EmptyState
            icon="videocam-off-outline"
            title="No videos found"
            message="This creator has no recent videos available, or their content is not publicly listable."
            actionLabel="Refresh"
            onAction={refetch}
          />
        }
        ListFooterComponent={renderFooter}
      />

      {selected.size > 0 ? (
        <View className="absolute left-0 right-0 bottom-0 px-4 pb-6 pt-3 bg-background dark:bg-dark-background border-t border-border dark:border-dark-border">
          {isRunning && progress ? (
            <View className="mb-2">
              <View className="flex-row items-center justify-between mb-1">
                <Text
                  numberOfLines={1}
                  className="flex-1 text-xs text-muted dark:text-dark-muted"
                >
                  {progress.currentTitle || 'Starting…'}
                </Text>
                <Text className="ml-2 text-xs font-medium text-primary dark:text-primary">
                  {progress.current}/{progress.total}
                </Text>
              </View>
              <View className="h-1 rounded-full bg-border dark:bg-dark-border overflow-hidden">
                <View
                  className="h-1 bg-primary"
                  style={{
                    width: `${
                      progress.total === 0
                        ? 0
                        : (progress.current / progress.total) * 100
                    }%`,
                  }}
                />
              </View>
            </View>
          ) : null}

          <View className="flex-row items-center gap-3">
            <View className="flex-row items-center">
              <Ionicons name="checkmark-circle" size={18} color="#2563EB" />
              <Text className="ml-1 text-sm font-medium text-text dark:text-dark-text">
                {selected.size}
              </Text>
            </View>

            <View className="flex-1">
              <Button
                label={
                  isRunning
                    ? 'Transcribing…'
                    : `Transcribe selected (${selected.size})`
                }
                onPress={handleTranscribe}
                loading={isRunning}
                disabled={isRunning}
                icon="sparkles"
                fullWidth
              />
            </View>
          </View>

          {isRunning ? (
            <View className="mt-3 items-center">
              <ActivityIndicator size="small" color="#2563EB" />
            </View>
          ) : null}
        </View>
      ) : null}
    </SafeAreaView>
  );
}