import React from 'react';
import { View, Text } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

interface StatTileProps {
  icon: string;
  label: string;
  value: string;
  tint?: string;
}

export default function StatTile({
  icon,
  label,
  value,
  tint = '#2563EB',
}: StatTileProps) {
  return (
    <View className="flex-1 bg-card dark:bg-dark-card border border-border dark:border-dark-border rounded-2xl p-3">
      <View
        className="w-9 h-9 rounded-lg items-center justify-center mb-2"
        style={{ backgroundColor: `${tint}1A` }}
      >
        <Ionicons name={icon} size={18} color={tint} />
      </View>
      <Text
        numberOfLines={1}
        className="text-xl font-bold text-text dark:text-dark-text"
      >
        {value}
      </Text>
      <Text
        numberOfLines={1}
        className="text-xs text-muted dark:text-dark-muted mt-0.5"
      >
        {label}
      </Text>
    </View>
  );
}