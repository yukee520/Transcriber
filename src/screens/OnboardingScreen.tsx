import React, { useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useOnboardingStore } from '@/store/useOnboardingStore';
import { usePermissions } from '@/hooks/usePermissions';
import Button from '@/components/Button';

interface FeatureRowProps {
  icon: string;
  title: string;
  description: string;
}

function FeatureRow({ icon, title, description }: FeatureRowProps) {
  return (
    <View className="flex-row items-start mb-5">
      <View className="w-11 h-11 rounded-xl bg-primary/10 items-center justify-center mr-3">
        <Ionicons name={icon} size={22} color="#2563EB" />
      </View>
      <View className="flex-1">
        <Text className="text-base font-semibold text-text dark:text-dark-text">
          {title}
        </Text>
        <Text className="text-sm text-muted dark:text-dark-muted mt-1 leading-5">
          {description}
        </Text>
      </View>
    </View>
  );
}

export default function OnboardingScreen() {
  const completeOnboarding = useOnboardingStore((s) => s.completeOnboarding);
  const { requesting, requestNotifications, requestStorage } = usePermissions();
  const [step, setStep] = useState<0 | 1>(0);

  const handleContinue = async () => {
    if (step === 0) {
      setStep(1);
      return;
    }
    await requestNotifications();
    await requestStorage();
    completeOnboarding();
  };

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-dark-background">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, padding: 24 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="items-center mt-6 mb-8">
          <View className="w-20 h-20 rounded-3xl bg-primary items-center justify-center mb-4">
            <Ionicons name="mic-outline" size={40} color="#FFFFFF" />
          </View>
          <Text className="text-3xl font-bold text-text dark:text-dark-text text-center">
            Transcriber
          </Text>
          <Text className="text-base text-muted dark:text-dark-muted text-center mt-2 leading-6">
            Turn videos from your favorite creators into searchable text — saved
            right on your device.
          </Text>
        </View>

        {step === 0 ? (
          <View className="mb-6">
            <FeatureRow
              icon="people-outline"
              title="Track creators"
              description="Add creators from YouTube, TikTok, Instagram, X, and more."
            />
            <FeatureRow
              icon="sparkles-outline"
              title="Auto transcribe"
              description="New videos are transcribed in the background using your own backend."
            />
            <FeatureRow
              icon="library-outline"
              title="Search your library"
              description="Find any phrase across every transcript you've saved."
            />
            <FeatureRow
              icon="lock-closed-outline"
              title="Private by default"
              description="Transcripts stay on your device. Nothing is sent anywhere else."
            />
          </View>
        ) : (
          <View className="mb-6">
            <Text className="text-lg font-semibold text-text dark:text-dark-text mb-2">
              Almost done
            </Text>
            <Text className="text-sm text-muted dark:text-dark-muted leading-5 mb-4">
              We'll ask for two permissions to keep your transcripts fresh:
            </Text>
            <View className="bg-card dark:bg-dark-card border border-border dark:border-dark-border rounded-2xl p-4 mb-3">
              <View className="flex-row items-center mb-2">
                <Ionicons name="notifications-outline" size={20} color="#2563EB" />
                <Text className="ml-2 text-base font-semibold text-text dark:text-dark-text">
                  Notifications
                </Text>
              </View>
              <Text className="text-sm text-muted dark:text-dark-muted leading-5">
                Alerts when a new transcript is ready. Optional.
              </Text>
            </View>
            <View className="bg-card dark:bg-dark-card border border-border dark:border-dark-border rounded-2xl p-4">
              <View className="flex-row items-center mb-2">
                <Ionicons name="folder-outline" size={20} color="#2563EB" />
                <Text className="ml-2 text-base font-semibold text-text dark:text-dark-text">
                  Storage
                </Text>
              </View>
              <Text className="text-sm text-muted dark:text-dark-muted leading-5">
                Export transcripts to text files. Optional.
              </Text>
            </View>
          </View>
        )}

        <View className="flex-1 justify-end">
          <Button
            label={step === 0 ? 'Get started' : 'Allow & continue'}
            onPress={handleContinue}
            loading={requesting}
            fullWidth
            size="lg"
          />
          {step === 1 ? (
            <View className="mt-3">
              <Button
                label="Skip for now"
                onPress={completeOnboarding}
                variant="ghost"
                fullWidth
              />
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}