import React from 'react';
import { View, Text, Image, Pressable } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { Creator } from '@/types/creator';
import PlatformBadge from './PlatformBadge';
import { formatRelativeTime } from '@/utils/formatting';

interface CreatorCardProps {
  creator: Creator;
  transcriptCount: number;
  onPress: (creator: Creator) => void;
  onToggleStatus: (creator: Creator) => void;
}

export default function CreatorCard({
  creator,
  transcriptCount,
  onPress,
  onToggleStatus,
}: CreatorCardProps) {
  const isPaused = creator.status === 'paused';

  return (
    <Pressable
      onPress={() => onPress(creator)}
      accessibilityRole="button"
      accessibilityLabel={`Creator: ${creator.name}`}
      className={[
        'bg-card dark:bg-dark-card border border-border dark:border-dark-border rounded-2xl p-3 active:opacity-90',
        isPaused ? 'opacity-70' : '',
      ].join(' ')}
    >
      <View className="flex-row items-center">
        <View className="w-12 h-12 rounded-full overflow-hidden bg-border dark:bg-dark-border items-center justify-center mr-3">
          {creator.avatarUrl ? (
            <Image source={{ uri: creator.avatarUrl }} className="w-12 h-12" />
          ) : (
            <Text className="text-base font-bold text-muted dark:text-dark-muted">
              {creator.name.charAt(0).toUpperCase()}
            </Text>
          )}
        </View>

        <View className="flex-1">
          <Text
            numberOfLines={1}
            className="text-base font-semibold text-text dark:text-dark-text"
          >
            {creator.name}
          </Text>
          <Text
            numberOfLines={1}
            className="text-xs text-muted dark:text-dark-muted mt-0.5"
          >
            @{creator.username}
          </Text>
          <View className="flex-row items-center mt-1.5">
            <PlatformBadge platform={creator.platform} size="sm" />
            <Text className="ml-2 text-[11px] text-muted dark:text-dark-muted">
              {transcriptCount} {transcriptCount === 1 ? 'transcript' : 'transcripts'}
            </Text>
          </View>
        </View>

        <Pressable
          onPress={() => onToggleStatus(creator)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={isPaused ? 'Resume tracking' : 'Pause tracking'}
          className="ml-2 w-10 h-10 rounded-full items-center justify-center bg-background dark:bg-dark-background border border-border dark:border-dark-border"
        >
          <Ionicons
            name={isPaused ? 'play' : 'pause'}
            size={16}
            color="#2563EB"
          />
        </Pressable>
      </View>

      <View className="flex-row items-center justify-between mt-3 pt-3 border-t border-border dark:border-dark-border">
        <View className="flex-row items-center">
          <View
            className={[
              'w-2 h-2 rounded-full mr-2',
              isPaused ? 'bg-muted' : 'bg-success',
            ].join(' ')}
          />
          <Text className="text-xs text-muted dark:text-dark-muted">
            {isPaused ? 'Paused' : 'Active'}
          </Text>
        </View>
        <Text className="text-xs text-muted dark:text-dark-muted">
          {creator.lastSyncedAt
            ? `Synced ${formatRelativeTime(creator.lastSyncedAt)}`
            : 'Never synced'}
        </Text>
      </View>
    </Pressable>
  );
}