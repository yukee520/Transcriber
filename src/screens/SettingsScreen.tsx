import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Card from '@/components/Card';
import Button from '@/components/Button';
import ScreenHeader from '@/components/ScreenHeader';
import LoadingSpinner from '@/components/LoadingSpinner';
import showConfirmDialog from '@/components/ConfirmDialog';
import { useSettings } from '@/hooks/useSettings';
import { useStorageUsage } from '@/hooks/useStorageUsage';
import { useTheme } from '@/hooks/useTheme';
import { useTranscriptsStore } from '@/store/useTranscriptsStore';
import { useCreatorsStore } from '@/store/useCreatorsStore';
import { deleteAllTranscriptFiles } from '@/utils/storage';
import { formatBytes } from '@/utils/formatting';
import type { TranscriptionLanguage } from '@/types/settings';

const LANGUAGES: Array<{ id: TranscriptionLanguage; label: string }> = [
  { id: 'auto', label: 'Auto detect' },
  { id: 'en', label: 'English' },
  { id: 'es', label: 'Spanish' },
  { id: 'fr', label: 'French' },
  { id: 'de', label: 'German' },
  { id: 'pt', label: 'Portuguese' },
  { id: 'it', label: 'Italian' },
  { id: 'ja', label: 'Japanese' },
  { id: 'ko', label: 'Korean' },
  { id: 'zh', label: 'Chinese' },
  { id: 'ar', label: 'Arabic' },
  { id: 'hi', label: 'Hindi' },
  { id: 'ru', label: 'Russian' },
];

const SYNC_INTERVALS = [15, 30, 60, 180, 360, 720];

export default function SettingsScreen() {
  const { settings, update, reset, hydrated, isBackendConfigured } = useSettings();
  const { isDark, toggle } = useTheme();
  const storageUsage = useStorageUsage();
  const [backendUrl, setBackendUrl] = useState(settings.backendUrl);
  const [apiKey, setApiKey] = useState(settings.apiKey);
  const [showApiKey, setShowApiKey] = useState(false);

  const persistBackend = useCallback(() => {
    const trimmed = backendUrl.trim();
    update({ backendUrl: trimmed, apiKey: apiKey.trim() });
    Toast.show({
      type: 'success',
      text1: 'Backend saved',
      position: 'bottom',
    });
  }, [backendUrl, apiKey, update]);

  const handleClearTranscripts = useCallback(() => {
    showConfirmDialog({
      title: 'Delete all transcripts?',
      message:
        'This permanently removes every transcript and its exported file from this device. Creators you track will be kept.',
      confirmLabel: 'Delete all',
      destructive: true,
      onConfirm: async () => {
        useTranscriptsStore.getState().clear();
        try {
          await deleteAllTranscriptFiles();
        } catch {
          // ignore file errors
        }
        Toast.show({
          type: 'success',
          text1: 'All transcripts deleted',
          position: 'bottom',
        });
      },
    });
  }, []);

  const handleClearCreators = useCallback(() => {
    showConfirmDialog({
      title: 'Remove all creators?',
      message:
        'You will stop tracking every creator. This does not delete transcripts already in your library.',
      confirmLabel: 'Remove all',
      destructive: true,
      onConfirm: () => {
        useCreatorsStore.getState().clear();
        Toast.show({
          type: 'success',
          text1: 'All creators removed',
          position: 'bottom',
        });
      },
    });
  }, []);

  const handleReset = useCallback(() => {
    showConfirmDialog({
      title: 'Reset settings?',
      message: 'All settings will be restored to their default values.',
      confirmLabel: 'Reset',
      destructive: true,
      onConfirm: () => {
        reset();
        setBackendUrl('');
        setApiKey('');
      },
    });
  }, [reset]);

  if (!hydrated) {
    return (
      <SafeAreaView className="flex-1 bg-background dark:bg-dark-background">
        <ScreenHeader title="Settings" />
        <LoadingSpinner fullScreen label="Loading settings…" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-dark-background">
      <ScreenHeader title="Settings" />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text className="text-xs font-semibold uppercase text-muted dark:text-dark-muted mb-2 ml-1">
          Transcription backend
        </Text>
        <Card className="mb-5">
          <Text className="text-sm text-muted dark:text-dark-muted mb-3 leading-5">
            Transcriber sends video URLs to your own backend to get the text.
            Provide the endpoint and API key issued by your server.
          </Text>

          <Text className="text-sm font-medium text-text dark:text-dark-text mb-1">
            Backend URL
          </Text>
          <View className="bg-background dark:bg-dark-background border border-border dark:border-dark-border rounded-xl px-3 py-2 mb-3">
            <TextInput
              value={backendUrl}
              onChangeText={setBackendUrl}
              onBlur={persistBackend}
              placeholder="https://your-server.example.com"
              placeholderTextColor="#94A3B8"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              className="text-base text-text dark:text-dark-text py-2"
            />
          </View>

          <Text className="text-sm font-medium text-text dark:text-dark-text mb-1">
            API key
          </Text>
          <View className="flex-row items-center bg-background dark:bg-dark-background border border-border dark:border-dark-border rounded-xl px-3 py-2 mb-3">
            <TextInput
              value={apiKey}
              onChangeText={setApiKey}
              onBlur={persistBackend}
              placeholder="sk_…"
              placeholderTextColor="#94A3B8"
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry={!showApiKey}
              className="flex-1 text-base text-text dark:text-dark-text py-2"
            />
            <Pressable
              onPress={() => setShowApiKey((v) => !v)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={showApiKey ? 'Hide API key' : 'Show API key'}
            >
              <Ionicons
                name={showApiKey ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color="#94A3B8"
              />
            </Pressable>
          </View>

          <View className="flex-row items-center mb-2">
            <View
              className={[
                'w-2 h-2 rounded-full mr-2',
                isBackendConfigured ? 'bg-success' : 'bg-muted',
              ].join(' ')}
            />
            <Text className="text-xs text-muted dark:text-dark-muted">
              {isBackendConfigured
                ? 'Backend configured'
                : 'No backend configured yet'}
            </Text>
          </View>

          <Button
            label="Save backend"
            onPress={persistBackend}
            variant="secondary"
            icon="save-outline"
            fullWidth
            size="sm"
          />
        </Card>

        <Text className="text-xs font-semibold uppercase text-muted dark:text-dark-muted mb-2 ml-1">
          Transcription
        </Text>
        <Card className="mb-5">
          <Text className="text-sm font-medium text-text dark:text-dark-text mb-2">
            Default language
          </Text>
          <View className="flex-row flex-wrap">
            {LANGUAGES.map((lang) => {
              const active = settings.defaultLanguage === lang.id;
              return (
                <Pressable
                  key={lang.id}
                  onPress={() => update({ defaultLanguage: lang.id })}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  className={[
                    'px-3 py-1.5 rounded-full mr-2 mb-2 border',
                    active
                      ? 'bg-primary border-primary'
                      : 'bg-background dark:bg-dark-background border-border dark:border-dark-border',
                  ].join(' ')}
                >
                  <Text
                    className={[
                      'text-xs font-medium',
                      active ? 'text-white' : 'text-text dark:text-dark-text',
                    ].join(' ')}
                  >
                    {lang.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View className="mt-3 pt-3 border-t border-border dark:border-dark-border">
            <View className="flex-row items-center justify-between">
              <View className="flex-1 mr-3">
                <Text className="text-sm font-medium text-text dark:text-dark-text">
                  Save transcripts to files
                </Text>
                <Text className="text-xs text-muted dark:text-dark-muted mt-0.5">
                  Export each transcript as a .txt file you can share.
                </Text>
              </View>
              <Switch
                value={settings.saveTranscriptsToFiles}
                onValueChange={(v) => update({ saveTranscriptsToFiles: v })}
                trackColor={{ false: '#334155', true: '#2563EB' }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>
        </Card>

        <Text className="text-xs font-semibold uppercase text-muted dark:text-dark-muted mb-2 ml-1">
          Syncing
        </Text>
        <Card className="mb-5">
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-1 mr-3">
              <Text className="text-sm font-medium text-text dark:text-dark-text">
                Auto sync in background
              </Text>
              <Text className="text-xs text-muted dark:text-dark-muted mt-0.5">
                Automatically refresh tracked creators on a schedule.
              </Text>
            </View>
            <Switch
              value={settings.autoSyncEnabled}
              onValueChange={(v) => update({ autoSyncEnabled: v })}
              trackColor={{ false: '#334155', true: '#2563EB' }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-1 mr-3">
              <Text className="text-sm font-medium text-text dark:text-dark-text">
                Wi-Fi only
              </Text>
              <Text className="text-xs text-muted dark:text-dark-muted mt-0.5">
                Skip syncing on mobile data.
              </Text>
            </View>
            <Switch
              value={settings.wifiOnlySync}
              onValueChange={(v) => update({ wifiOnlySync: v })}
              trackColor={{ false: '#334155', true: '#2563EB' }}
              thumbColor="#FFFFFF"
            />
          </View>

          <Text className="text-sm font-medium text-text dark:text-dark-text mb-2 mt-2">
            Sync interval
          </Text>
          <View className="flex-row flex-wrap">
            {SYNC_INTERVALS.map((minutes) => {
              const active = settings.syncIntervalMinutes === minutes;
              const label =
                minutes < 60
                  ? `${minutes}m`
                  : minutes < 360
                    ? `${minutes / 60}h`
                    : `${minutes / 60}h`;
              return (
                <Pressable
                  key={minutes}
                  onPress={() => update({ syncIntervalMinutes: minutes })}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  className={[
                    'px-3 py-1.5 rounded-full mr-2 mb-2 border',
                    active
                      ? 'bg-primary border-primary'
                      : 'bg-background dark:bg-dark-background border-border dark:border-dark-border',
                  ].join(' ')}
                >
                  <Text
                    className={[
                      'text-xs font-medium',
                      active ? 'text-white' : 'text-text dark:text-dark-text',
                    ].join(' ')}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Card>

        <Text className="text-xs font-semibold uppercase text-muted dark:text-dark-muted mb-2 ml-1">
          Appearance
        </Text>
        <Card className="mb-5">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 mr-3">
              <Text className="text-sm font-medium text-text dark:text-dark-text">
                Dark mode
              </Text>
              <Text className="text-xs text-muted dark:text-dark-muted mt-0.5">
                Currently {isDark ? 'on' : 'off'}.
              </Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggle}
              trackColor={{ false: '#334155', true: '#2563EB' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </Card>

        <Text className="text-xs font-semibold uppercase text-muted dark:text-dark-muted mb-2 ml-1">
          Storage
        </Text>
        <Card className="mb-5">
          {storageUsage.isLoading ? (
            <View className="py-2">
              <LoadingSpinner size="small" label="Calculating usage…" />
            </View>
          ) : storageUsage.isError ? (
            <Text className="text-sm text-danger">
              Could not calculate storage usage.
            </Text>
          ) : (
            <>
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-sm text-muted dark:text-dark-muted">
                  Transcript files
                </Text>
                <Text className="text-sm font-medium text-text dark:text-dark-text">
                  {formatBytes(storageUsage.data?.filesBytes ?? 0)}
                </Text>
              </View>
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-sm text-muted dark:text-dark-muted">
                  Metadata
                </Text>
                <Text className="text-sm font-medium text-text dark:text-dark-text">
                  {formatBytes(storageUsage.data?.metadataBytes ?? 0)}
                </Text>
              </View>
              <View className="flex-row items-center justify-between pt-3 border-t border-border dark:border-dark-border">
                <Text className="text-sm font-semibold text-text dark:text-dark-text">
                  Total
                </Text>
                <Text className="text-sm font-bold text-text dark:text-dark-text">
                  {formatBytes(storageUsage.data?.totalBytes ?? 0)}
                </Text>
              </View>
            </>
          )}
        </Card>

        <Text className="text-xs font-semibold uppercase text-muted dark:text-dark-muted mb-2 ml-1">
          Danger zone
        </Text>
        <Card className="mb-5">
          <View className="mb-3">
            <Button
              label="Delete all transcripts"
              onPress={handleClearTranscripts}
              variant="danger"
              icon="trash-outline"
              fullWidth
              size="sm"
            />
          </View>
          <View className="mb-3">
            <Button
              label="Remove all creators"
              onPress={handleClearCreators}
              variant="danger"
              icon="people-outline"
              fullWidth
              size="sm"
            />
          </View>
          <Button
            label="Reset settings"
            onPress={handleReset}
            variant="secondary"
            icon="refresh-outline"
            fullWidth
            size="sm"
          />
        </Card>

        <Text className="text-center text-xs text-muted dark:text-dark-muted mt-2">
          Transcriber · v1.0.0
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}