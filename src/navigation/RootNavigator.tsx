import React, { useEffect, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useOnboardingStore } from '@/store/useOnboardingStore';
import TabNavigator from './TabNavigator';
import OnboardingScreen from '@/screens/OnboardingScreen';
import TranscriptDetailScreen from '@/screens/TranscriptDetailScreen';
import CreatorDetailScreen from '@/screens/CreatorDetailScreen';
import CreatorVideosScreen from '@/screens/CreatorVideosScreen';
import AddCreatorScreen from '@/screens/AddCreatorScreen';
import SettingsScreen from '@/screens/SettingsScreen';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const hasCompletedOnboarding = useOnboardingStore(
    (s) => s.hasCompletedOnboarding,
  );
  const hydrated = useOnboardingStore((s) => s.hydrated);
  const [forceReady, setForceReady] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setForceReady(true), 1500);
    return () => clearTimeout(t);
  }, []);

  if (!hydrated && !forceReady) {
    return null;
  }

  return (
    <Stack.Navigator
      initialRouteName={hasCompletedOnboarding ? 'MainTabs' : 'Onboarding'}
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: 'transparent' },
      }}
    >
      {!hasCompletedOnboarding ? (
        <Stack.Screen
          name="Onboarding"
          component={OnboardingScreen}
          options={{ animation: 'fade' }}
        />
      ) : (
        <>
          <Stack.Screen name="MainTabs" component={TabNavigator} />
          <Stack.Screen
            name="TranscriptDetail"
            component={TranscriptDetailScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="CreatorDetail"
            component={CreatorDetailScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="CreatorVideos"
            component={CreatorVideosScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="AddCreator"
            component={AddCreatorScreen}
            options={{
              animation: 'slide_from_bottom',
              presentation: 'modal',
            }}
          />
          <Stack.Screen
            name="Settings"
            component={SettingsScreen}
            options={{ animation: 'slide_from_right' }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}