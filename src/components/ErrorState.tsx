import React from 'react';
import { View, Text } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Button from './Button';

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export default function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  retryLabel = 'Try again',
}: ErrorStateProps) {
  return (
    <View className="flex-1 items-center justify-center px-6 py-12">
      <View className="w-20 h-20 rounded-full items-center justify-center bg-danger/10 mb-4">
        <Ionicons name="alert-circle-outline" size={40} color="#EF4444" />
      </View>
      <Text className="text-lg font-semibold text-text dark:text-dark-text text-center mb-2">
        {title}
      </Text>
      <Text className="text-sm text-muted dark:text-dark-muted text-center mb-6 leading-5">
        {message}
      </Text>
      {onRetry ? (
        <Button
          label={retryLabel}
          onPress={onRetry}
          variant="secondary"
          icon="refresh"
        />
      ) : null}
    </View>
  );
}