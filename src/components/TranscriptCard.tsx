import React from 'react';
import { View, Text, Image, Pressable } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { TranscriptListItem } from '@/types/transcript';
import PlatformBadge from './PlatformBadge';
import {
  formatDuration,
  formatRelativeTime,
  formatWordCount,
  truncate,
} from '@/utils/formatting';

interface TranscriptCardProps {
  item: TranscriptListItem;
  onPress: (id: string) => void;
}

const STATUS_META: Record<
  TranscriptListItem['status'],
  { label: string; color: string; icon: string }
> = {
  pending: { label: 'Pending', color: '#94A3B8', icon: 'time-outline' },
  processing: { label: 'Processing', color: '#2563EB', icon: 'sync-outline' },
  completed: { label: 'Done', color: '#10B981', icon: 'checkmark-circle-outline' },
  failed: { label: 'Failed', color: '#EF4444', icon: 'alert-circle-outline' },
};

export default function TranscriptCard({ item, onPress }: TranscriptCardProps) {
  const status = STATUS_META[item.status];

  return (
    <Pressable
      onPress={() => onPress(item.id)}
      accessibilityRole="button"
      accessibilityLabel={`Transcript: ${item.videoTitle}`}
      className="bg-card dark:bg-dark-card border border-border dark:border-dark-border rounded-2xl overflow-hidden active:opacity-90"
    >
      <View className="flex-row p-3">
        <View className="w-24 h-16 rounded-lg overflow-hidden bg-border dark:bg-dark-border items-center justify-center mr-3">
          {item.thumbnailUrl ? (
            <Image
              source={{ uri: item.thumbnailUrl }}
              className="w-24 h-16"
              resizeMode="cover"
            />
          ) : (
            <Ionicons name="videocam-outline" size={24} color="#64748B" />
          )}
          <View className="absolute bottom-1 right-1 bg-black/70 px-1.5 py-0.5 rounded">
            <Text className="text-white text-[10px] font-medium">
              {formatDuration(item.durationSeconds)}
            </Text>
          </View>
        </View>

        <View className="flex-1 justify-between">
          <View>
            <Text
              numberOfLines={2}
              className="text-sm font-semibold text-text dark:text-dark-text leading-5"
            >
              {truncate(item.videoTitle, 90)}
            </Text>
            <View className="flex-row items-center mt-1">
              <PlatformBadge platform={item.platform} size="sm" />
              <Text
                numberOfLines={1}
                className="ml-2 text-xs text-muted dark:text-dark-muted flex-1"
              >
                {item.creatorName}
              </Text>
            </View>
          </View>

          <View className="flex-row items-center justify-between mt-2">
            <View className="flex-row items-center">
              <Ionicons name={status.icon} size={12} color={status.color} />
              <Text
                className="ml-1 text-[11px] font-medium"
                style={{ color: status.color }}
              >
                {status.label}
              </Text>
              {item.status === 'completed' && item.wordCount > 0 ? (
                <Text className="ml-2 text-[11px] text-muted dark:text-dark-muted">
                  {formatWordCount(item.wordCount)}
                </Text>
              ) : null}
            </View>
            <Text className="text-[11px] text-muted dark:text-dark-muted">
              {formatRelativeTime(item.createdAt)}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}