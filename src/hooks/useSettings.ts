import { useCallback } from 'react';
import Toast from 'react-native-toast-message';
import { useSettingsStore } from '@/store/useSettingsStore';
import type { Settings } from '@/types/settings';
import { DEFAULT_SETTINGS } from '@/types/settings';

interface UseSettingsResult {
  settings: Settings;
  hydrated: boolean;
  update: (patch: Partial<Settings>) => void;
  reset: () => void;
  isBackendConfigured: boolean;
}

export function useSettings(): UseSettingsResult {
  const {
    backendUrl,
    apiKey,
    defaultLanguage,
    autoSyncEnabled,
    syncIntervalMinutes,
    wifiOnlySync,
    saveTranscriptsToFiles,
    hydrated,
    setSettings,
    resetSettings,
  } = useSettingsStore();

  const settings: Settings = {
    backendUrl,
    apiKey,
    defaultLanguage,
    autoSyncEnabled,
    syncIntervalMinutes,
    wifiOnlySync,
    saveTranscriptsToFiles,
  };

  const update = useCallback(
    (patch: Partial<Settings>) => {
      setSettings(patch);
    },
    [setSettings],
  );

  const reset = useCallback(() => {
    resetSettings();
    Toast.show({
      type: 'success',
      text1: 'Settings reset',
      text2: 'Restored default values.',
      position: 'bottom',
    });
  }, [resetSettings]);

  return {
    settings,
    hydrated,
    update,
    reset,
    isBackendConfigured: backendUrl.trim().length > 0,
  };
}

export { DEFAULT_SETTINGS };