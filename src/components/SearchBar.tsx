import React from 'react';
import { View, TextInput, Pressable } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onSubmit?: () => void;
}

export default function SearchBar({
  value,
  onChangeText,
  placeholder = 'Search…',
  onSubmit,
}: SearchBarProps) {
  return (
    <View className="flex-row items-center bg-card dark:bg-dark-card border border-border dark:border-dark-border rounded-xl px-3 py-2">
      <Ionicons name="search-outline" size={18} color="#94A3B8" />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="none"
        className="flex-1 ml-2 text-base text-text dark:text-dark-text py-1"
      />
      {value.length > 0 ? (
        <Pressable
          onPress={() => onChangeText('')}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
        >
          <Ionicons name="close-circle" size={18} color="#94A3B8" />
        </Pressable>
      ) : null}
    </View>
  );
}