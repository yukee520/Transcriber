import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, FlatList, RefreshControl, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTranscripts } from '@/hooks/useTranscripts';
import { useCreators } from '@/hooks/useCreators';
import SearchBar from '@/components/SearchBar';
import TranscriptCard from '@/components/TranscriptCard';
import EmptyState from '@/components/EmptyState';
import ErrorState from '@/components/ErrorState';
import LoadingSpinner from '@/components/LoadingSpinner';
import { PLATFORMS } from '@/utils/platform';
import type { RootStackParamList } from '@/navigation/types';
import type { Platform } from '@/types/creator';
import type { TranscriptListItem } from '@/types/transcript';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const PLATFORM_FILTERS: Array<{ id: Platform | 'all'; label: string }> = [
  { id: 'all', label: 'All' },
  ...PLATFORMS.filter((p) => p.id !== 'other').map((p) => ({
    id: p.id,
    label: p.label,
  })),
];

export default function LibraryScreen() {
  const navigation = useNavigation<Nav>();
  const [search, setSearch] = useState('');
  const [platform, setPlatform] = useState<Platform | 'all'>('all');
  const [creatorId, setCreatorId] = useState<string | 'all'>('all');

  const { items: creators } = useCreators();

  const filter = useMemo(
    () => ({ search, platform, creatorId, status: 'all' as const }),
    [search, platform, creatorId],
  );

  const { items, isLoading, isError, error, refetch, isRefetching, total, filteredCount } =
    useTranscripts(filter);

  const handleOpenTranscript = useCallback(
    (id: string) => {
      navigation.navigate('TranscriptDetail', { transcriptId: id });
    },
    [navigation],
  );

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
        <LoadingSpinner fullScreen label="Loading library…" />
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView className="flex-1 bg-background dark:bg-dark-background">
        <ErrorState
          message={error?.message ?? 'Could not load your library.'}
          onRetry={() => {
            void refetch();
          }}
        />
      </SafeAreaView>
    );
  }

  const hasActiveFilter =
    search.trim().length > 0 || platform !== 'all' || creatorId !== 'all';

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-dark-background">
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        keyboardShouldPersistTaps="handled"
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
                  Library
                </Text>
                <Text className="text-sm text-muted dark:text-dark-muted mt-0.5">
                  {hasActiveFilter
                    ? `${filteredCount} of ${total} match`
                    : `${total} saved`}
                </Text>
              </View>
            </View>

            <SearchBar
              value={search}
              onChangeText={setSearch}
              placeholder="Search transcripts…"
            />

            <View className="mt-3 -mx-4">
              <FlatList
                data={PLATFORM_FILTERS}
                keyExtractor={(item) => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16 }}
                renderItem={({ item }) => {
                  const active = platform === item.id;
                  return (
                    <Pressable
                      onPress={() => setPlatform(item.id)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      className={[
                        'px-3 py-1.5 rounded-full mr-2 border',
                        active
                          ? 'bg-primary border-primary'
                          : 'bg-card dark:bg-dark-card border-border dark:border-dark-border',
                      ].join(' ')}
                    >
                      <Text
                        className={[
                          'text-xs font-medium',
                          active
                            ? 'text-white'
                            : 'text-text dark:text-dark-text',
                        ].join(' ')}
                      >
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                }}
              />
            </View>

            {creators.length > 0 ? (
              <View className="mt-3 -mx-4">
                <FlatList
                  data={[
                    { id: 'all', name: 'All creators' },
                    ...creators.map((c) => ({ id: c.id, name: c.name })),
                  ]}
                  keyExtractor={(item) => item.id}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 16 }}
                  renderItem={({ item }) => {
                    const active = creatorId === item.id;
                    return (
                      <Pressable
                        onPress={() => setCreatorId(item.id)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        className={[
                          'px-3 py-1.5 rounded-full mr-2 border',
                          active
                            ? 'bg-primary border-primary'
                            : 'bg-card dark:bg-dark-card border-border dark:border-dark-border',
                        ].join(' ')}
                      >
                        <Text
                          numberOfLines={1}
                          className={[
                            'text-xs font-medium',
                            active
                              ? 'text-white'
                              : 'text-text dark:text-dark-text',
                          ].join(' ')}
                        >
                          {item.name}
                        </Text>
                      </Pressable>
                    );
                  }}
                />
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          hasActiveFilter ? (
            <EmptyState
              icon="search-outline"
              title="No matches"
              message="Try a different search term or clear your filters."
              actionLabel="Clear filters"
              onAction={() => {
                setSearch('');
                setPlatform('all');
                setCreatorId('all');
              }}
            />
          ) : (
            <EmptyState
              icon="library-outline"
              title="Your library is empty"
              message="Transcripts from creators you track will appear here. Add a creator to get started."
              actionLabel="Add a creator"
              onAction={() => navigation.navigate('AddCreator')}
            />
          )
        }
        contentContainerStyle={{ paddingBottom: 32 }}
      />
    </SafeAreaView>
  );
}