import React, { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

interface CardProps {
  children: ReactNode;
  className?: string;
  onPress?: () => void;
  padded?: boolean;
}

export default function Card({
  children,
  className,
  onPress,
  padded = true,
}: CardProps) {
  const base = [
    'bg-card dark:bg-dark-card',
    'border border-border dark:border-dark-border',
    'rounded-2xl',
    padded ? 'p-4' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        className={`${base} active:opacity-90`}
      >
        {children}
      </Pressable>
    );
  }

  return <View className={base}>{children}</View>;
}