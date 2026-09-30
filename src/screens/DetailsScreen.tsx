import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Details'>;

export default function DetailsScreen({ navigation }: Props) {
  return (
    <SafeAreaView className="flex-1 bg-background p-6">
      <Text className="text-2xl font-bold text-text mb-2">Details Screen</Text>
      <Text className="text-base text-muted mb-8">
        Replace this with your own content.
      </Text>

      <TouchableOpacity
        className="bg-secondary py-4 rounded-2xl items-center"
        onPress={() => navigation.goBack()}
      >
        <Text className="text-white text-base font-semibold">← Back</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}
