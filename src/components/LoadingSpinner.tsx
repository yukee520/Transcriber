import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';

interface LoadingSpinnerProps {
  label?: string;
  fullScreen?: boolean;
  size?: 'small' | 'large';
}

export default function LoadingSpinner({
  label,
  fullScreen = false,
  size = 'large',
}: LoadingSpinnerProps) {
  return (
    <View
      className={
        fullScreen
          ? 'flex-1 items-center justify-center bg-background dark:bg-dark-background'
          : 'items-center justify-center py-8'
      }
    >
      <ActivityIndicator size={size} color="#2563EB" />
      {label ? (
        <Text className="mt-3 text-sm text-muted dark:text-dark-muted">
          {label}
        </Text>
      ) : null}
    </View>
  );
}