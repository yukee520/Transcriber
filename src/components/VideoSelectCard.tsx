import React from 'react';
import { View, Text, Image, Pressable } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { BackendVideo } from '@/types/api';
import { formatDuration, formatRelativeTime } from '@/utils/formatting';

interface VideoSelectCardProps {
  video: BackendVideo;
  selected: boolean;
  saved: boolean;
  disabled?: boolean;
  onToggle: (videoId: string) => void;
}

export default function VideoSelectCard({
  video,
  selected,
  saved,
  disabled = false,
  onToggle,
}: VideoSelectCardProps) {
  const isDisabled = disabled || saved;
  const hasTitle = video.title.trim().length > 0;

  const handlePress = () => {
    if (isDisabled) return;
    onToggle(video.videoId);
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={isDisabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected, disabled: isDisabled }}
      accessibilityLabel={`Video: ${hasTitle ? video.title : video.videoId}`}
      className={[
        'bg-card dark:bg-dark-card border rounded-2xl overflow-hidden',
        selected
          ? 'border-primary'
          : 'border-border dark:border-dark-border',
        isDisabled ? 'opacity-60' : 'active:opacity-90',
      ].join(' ')}
    >
      <View className="flex-row p-3">
        <View className="w-20 h-14 rounded-lg overflow-hidden bg-border dark:bg-dark-border items-center justify-center mr-3">
          {video.thumbnailUrl ? (
            <Image
              source={{ uri: video.thumbnailUrl }}
              className="w-20 h-14"
              resizeMode="cover"
            />
          ) : (
            <Ionicons name="videocam-outline" size={22} color="#64748B" />
          )}
          {video.durationSeconds > 0 ? (
            <View className="absolute bottom-1 right-1 bg-black/70 px-1.5 py-0.5 rounded">
              <Text className="text-white text-[10px] font-medium">
                {formatDuration(video.durationSeconds)}
              </Text>
            </View>
          ) : (
            <View className="absolute bottom-1 right-1 bg-black/70 px-1.5 py-0.5 rounded">
              <Text className="text-white text-[10px] font-medium">video</Text>
            </View>
          )}
        </View>

        <View className="flex-1 justify-between">
          {hasTitle ? (
            <Text
              numberOfLines={2}
              className="text-sm font-semibold text-text dark:text-dark-text leading-5"
            >
              {video.title}
            </Text>
          ) : (
            <View>
              <Text className="text-sm font-semibold text-text dark:text-dark-text">
                Video {video.videoId.slice(0, 10)}
              </Text>
              <Text
                numberOfLines={1}
                className="text-[11px] text-muted dark:text-dark-muted mt-0.5"
              >
                {video.videoId}
              </Text>
            </View>
          )}

          <View className="flex-row items-center justify-between mt-2">
            {saved ? (
              <View className="flex-row items-center bg-success/15 px-2 py-0.5 rounded-full">
                <Ionicons
                  name="checkmark-circle"
                  size={12}
                  color="#10B981"
                />
                <Text className="ml-1 text-[11px] font-medium text-success">
                  Saved
                </Text>
              </View>
            ) : video.publishedAt ? (
              <Text className="text-[11px] text-muted dark:text-dark-muted">
                {formatRelativeTime(video.publishedAt)}
              </Text>
            ) : (
              <View />
            )}

            <View
              className={[
                'w-6 h-6 rounded-full border-2 items-center justify-center',
                selected
                  ? 'bg-primary border-primary'
                  : 'bg-transparent border-border dark:border-dark-border',
              ].join(' ')}
            >
              {selected ? (
                <Ionicons name="checkmark" size={14} color="#FFFFFF" />
              ) : null}
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
}