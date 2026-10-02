import React, { useEffect, useRef } from 'react';
import { View, Text, Image, Pressable, Animated } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { BackendVideo, VideoTitle } from '@/types/api';
import { formatDuration, formatRelativeTime } from '@/utils/formatting';

interface VideoSelectCardProps {
  video: BackendVideo;
  selected: boolean;
  saved: boolean;
  disabled?: boolean;
  titleLoading?: boolean;
  resolvedTitle?: VideoTitle;
  onToggle: (videoId: string) => void;
}

function Shimmer({ width }: { width: number | `${number}%` }) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={{ opacity, width }}
      className="h-4 rounded bg-border dark:bg-dark-border"
    />
  );
}

export default function VideoSelectCard({
  video,
  selected,
  saved,
  disabled = false,
  titleLoading = false,
  resolvedTitle,
  onToggle,
}: VideoSelectCardProps) {
  const isDisabled = disabled || saved;

  const mergedTitle =
    (resolvedTitle?.title && resolvedTitle.title.trim().length > 0
      ? resolvedTitle.title
      : video.title
    )?.trim() ?? '';

  const mergedThumb =
    resolvedTitle?.thumbnailUrl || video.thumbnailUrl || undefined;

  const mergedDuration =
    (resolvedTitle?.durationSeconds && resolvedTitle.durationSeconds > 0
      ? resolvedTitle.durationSeconds
      : video.durationSeconds) ?? 0;

  const mergedPublished =
    resolvedTitle?.publishedAt || video.publishedAt || '';

  const hasTitle = mergedTitle.length > 0;
  const showShimmer = titleLoading && !hasTitle;

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
      accessibilityLabel={`Video: ${hasTitle ? mergedTitle : video.videoId}`}
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
          {mergedThumb ? (
            <Image
              source={{ uri: mergedThumb }}
              className="w-20 h-14"
              resizeMode="cover"
            />
          ) : (
            <Ionicons name="videocam-outline" size={22} color="#64748B" />
          )}
          {mergedDuration > 0 ? (
            <View className="absolute bottom-1 right-1 bg-black/70 px-1.5 py-0.5 rounded">
              <Text className="text-white text-[10px] font-medium">
                {formatDuration(mergedDuration)}
              </Text>
            </View>
          ) : null}
        </View>

        <View className="flex-1 justify-between">
          {showShimmer ? (
            <View className="pt-1">
              <Shimmer width="85%" />
              <View className="h-1" />
              <Shimmer width="55%" />
            </View>
          ) : hasTitle ? (
            <Text
              numberOfLines={2}
              className="text-sm font-semibold text-text dark:text-dark-text leading-5"
            >
              {mergedTitle}
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
            ) : mergedPublished ? (
              <Text className="text-[11px] text-muted dark:text-dark-muted">
                {formatRelativeTime(mergedPublished)}
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