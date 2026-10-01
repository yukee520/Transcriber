import React from 'react';
import { View, Text } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { Platform } from '@/types/creator';
import { getPlatformMeta } from '@/utils/platform';

interface PlatformBadgeProps {
  platform: Platform;
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

export default function PlatformBadge({
  platform,
  showLabel = true,
  size = 'sm',
}: PlatformBadgeProps) {
  const meta = getPlatformMeta(platform);
  const iconSize = size === 'sm' ? 12 : 16;

  return (
    <View
      className={[
        'flex-row items-center rounded-full',
        size === 'sm' ? 'px-2 py-0.5' : 'px-3 py-1',
      ].join(' ')}
      style={{ backgroundColor: `${meta.color}1A` }}
    >
      <Ionicons name={meta.icon} size={iconSize} color={meta.color} />
      {showLabel ? (
        <Text
          className={[
            'ml-1 font-medium',
            size === 'sm' ? 'text-xs' : 'text-sm',
          ].join(' ')}
          style={{ color: meta.color }}
        >
          {meta.label}
        </Text>
      ) : null}
    </View>
  );
}