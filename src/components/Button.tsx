import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator } from 'react-native';

type Props = {
  title: string;
  onPress: () => void;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
};

const variantClasses: Record<NonNullable<Props['variant']>, string> = {
  primary: 'bg-primary',
  secondary: 'bg-secondary',
  danger: 'bg-danger',
};

export default function Button({
  title,
  onPress,
  loading = false,
  variant = 'primary',
}: Props) {
  return (
    <TouchableOpacity
      className={`${variantClasses[variant]} py-4 rounded-2xl items-center`}
      onPress={onPress}
      disabled={loading}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text className="text-white text-base font-semibold">{title}</Text>
      )}
    </TouchableOpacity>
  );
}
