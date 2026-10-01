import React from 'react';
import { View, Text } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Button from './Button';

interface EmptyStateProps {
  icon?: string;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({
  icon = 'document-text-outline',
  title,
  message,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center px-6 py-12">
      <View className="w-20 h-20 rounded-full items-center justify-center bg-border dark:bg-dark-border mb-4">
        <Ionicons name={icon} size={36} color="#64748B" />
      </View>
      <Text className="text-lg font-semibold text-text dark:text-dark-text text-center mb-2">
        {title}
      </Text>
      <Text className="text-sm text-muted dark:text-dark-muted text-center mb-6 leading-5">
        {message}
      </Text>
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} icon="add" />
      ) : null}
    </View>
  );
}