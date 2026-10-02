import React, { ReactNode } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  right?: ReactNode;
  onBack?: () => void;
}

export default function ScreenHeader({
  title,
  subtitle,
  showBack = false,
  right,
  onBack,
}: ScreenHeaderProps) {
  const navigation = useNavigation();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigation.goBack();
    }
  };

  return (
    <View className="flex-row items-center px-4 py-3 border-b border-border dark:border-dark-border bg-background dark:bg-dark-background">
      {showBack ? (
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          className="mr-3"
        >
          <Ionicons
            name="chevron-back"
            size={24}
            color="#2563EB"
          />
        </Pressable>
      ) : null}
      <View className="flex-1">
        <Text
          numberOfLines={1}
          className="text-xl font-bold text-text dark:text-dark-text"
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            numberOfLines={1}
            className="text-sm text-muted dark:text-dark-muted mt-0.5"
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ? <View className="ml-3">{right}</View> : null}
    </View>
  );
}