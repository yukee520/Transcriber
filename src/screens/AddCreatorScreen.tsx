import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform as RNAPlatform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Ionicons from 'react-native-vector-icons/Ionicons';
import ScreenHeader from '@/components/ScreenHeader';
import Button from '@/components/Button';
import Card from '@/components/Card';
import { useAddCreator } from '@/hooks/useAddCreator';
import { PLATFORMS, detectPlatform, parseUsername } from '@/utils/platform';
import type { Platform } from '@/types/creator';
import type { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function AddCreatorScreen() {
  const navigation = useNavigation<Nav>();
  const [input, setInput] = useState('');
  const [platform, setPlatform] = useState<Platform>('youtube');
  const [name, setName] = useState('');
  const [touchedPlatform, setTouchedPlatform] = useState(false);
  const addCreator = useAddCreator();

  const detected = useMemo(() => detectPlatform(input), [input]);
  const username = useMemo(() => parseUsername(input), [input]);

  const effectivePlatform: Platform = touchedPlatform ? platform : detected;

  const handleInputChange = (value: string) => {
    setInput(value);
    if (!touchedPlatform && value.trim()) {
      setPlatform(detectPlatform(value));
    }
  };

  const handleSubmit = () => {
    addCreator.mutate(
      {
        rawInput: input,
        platform: effectivePlatform,
        name: name.trim() || undefined,
      },
      {
        onSuccess: () => navigation.goBack(),
      },
    );
  };

  const canSubmit = input.trim().length > 0 && !addCreator.isPending;

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-dark-background">
      <ScreenHeader title="Add creator" showBack />
      <KeyboardAvoidingView
        className="flex-1"
        behavior={RNAPlatform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text className="text-sm text-muted dark:text-dark-muted mb-2">
            Paste a profile URL or type a username.
          </Text>

          <View className="bg-card dark:bg-dark-card border border-border dark:border-dark-border rounded-xl px-3 py-2 mb-1">
            <TextInput
              value={input}
              onChangeText={handleInputChange}
              placeholder="https://youtube.com/@mkbhd or @mkbhd"
              placeholderTextColor="#94A3B8"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              className="text-base text-text dark:text-dark-text py-2"
            />
          </View>

          {username.length > 0 ? (
            <Text className="text-xs text-muted dark:text-dark-muted mb-4">
              Will be saved as @{username}
            </Text>
          ) : (
            <View className="mb-4" />
          )}

          <Text className="text-sm font-semibold text-text dark:text-dark-text mb-2 mt-2">
            Platform
          </Text>
          <View className="flex-row flex-wrap mb-4">
            {PLATFORMS.map((meta) => {
              const active = effectivePlatform === meta.id;
              return (
                <Pressable
                  key={meta.id}
                  onPress={() => {
                    setPlatform(meta.id);
                    setTouchedPlatform(true);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  className={[
                    'flex-row items-center px-3 py-2 rounded-xl border mr-2 mb-2',
                    active
                      ? 'border-primary bg-primary/10'
                      : 'border-border dark:border-dark-border bg-card dark:bg-dark-card',
                  ].join(' ')}
                >
                  <Ionicons
                    name={meta.icon}
                    size={16}
                    color={active ? '#2563EB' : meta.color}
                  />
                  <Text
                    className={[
                      'ml-1.5 text-sm font-medium',
                      active
                        ? 'text-primary dark:text-primary'
                        : 'text-text dark:text-dark-text',
                    ].join(' ')}
                  >
                    {meta.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text className="text-sm font-semibold text-text dark:text-dark-text mb-2">
            Display name (optional)
          </Text>
          <View className="bg-card dark:bg-dark-card border border-border dark:border-dark-border rounded-xl px-3 py-2 mb-5">
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Marques Brownlee"
              placeholderTextColor="#94A3B8"
              autoCapitalize="words"
              returnKeyType="done"
              className="text-base text-text dark:text-dark-text py-2"
            />
          </View>

          <Card className="mb-5">
            <View className="flex-row items-start">
              <Ionicons
                name="information-circle-outline"
                size={20}
                color="#2563EB"
              />
              <Text className="flex-1 ml-2 text-xs text-muted dark:text-dark-muted leading-5">
                We'll check for new videos from this creator whenever you sync.
                Transcripts are stored only on this device.
              </Text>
            </View>
          </Card>

          <Button
            label={addCreator.isPending ? 'Adding…' : 'Add creator'}
            onPress={handleSubmit}
            disabled={!canSubmit}
            loading={addCreator.isPending}
            icon="add"
            fullWidth
            size="lg"
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}