import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_SETTINGS, type Settings } from '@/types/settings';

interface SettingsState extends Settings {
  hydrated: boolean;
  setSettings: (patch: Partial<Settings>) => void;
  resetSettings: () => void;
  setHydrated: (value: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      hydrated: false,
      setSettings: (patch) => set((state) => ({ ...state, ...patch })),
      resetSettings: () => set({ ...DEFAULT_SETTINGS, hydrated: true }),
      setHydrated: (value) => set({ hydrated: value }),
    }),
    {
      name: 'transcriber-settings',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        backendUrl: state.backendUrl,
        apiKey: state.apiKey,
        defaultLanguage: state.defaultLanguage,
        autoSyncEnabled: state.autoSyncEnabled,
        syncIntervalMinutes: state.syncIntervalMinutes,
        wifiOnlySync: state.wifiOnlySync,
        saveTranscriptsToFiles: state.saveTranscriptsToFiles,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    },
  ),
);