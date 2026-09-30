import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export default function HomeScreen({ navigation }: Props) {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerClassName="p-6">
        <Text className="text-3xl font-bold text-text mb-2">
          RN Blank Template
        </Text>
        <Text className="text-base text-muted mb-8">
          Full-power React Native starter. Ready to build anything.
        </Text>

        <View className="bg-card p-5 rounded-2xl shadow-sm mb-4">
          <Text className="text-lg font-semibold text-text mb-1">
            ✅ What's included
          </Text>
          <Text className="text-sm text-secondary leading-6">
            Navigation · Reanimated · NativeWind{'\n'}
            Zustand · React Query · WebView{'\n'}
            SVG · Icons · Storage · Permissions
          </Text>
        </View>

        <TouchableOpacity
          className="bg-primary py-4 rounded-2xl items-center"
          onPress={() => navigation.navigate('Details')}
        >
          <Text className="text-white text-base font-semibold">
            Go to Details →
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
