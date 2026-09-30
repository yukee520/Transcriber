export type TranscriptionLanguage =
  | 'auto'
  | 'en'
  | 'es'
  | 'fr'
  | 'de'
  | 'pt'
  | 'it'
  | 'ja'
  | 'ko'
  | 'zh'
  | 'ar'
  | 'hi'
  | 'ru';

export interface Settings {
  backendUrl: string;
  apiKey: string;
  defaultLanguage: TranscriptionLanguage;
  autoSyncEnabled: boolean;
  syncIntervalMinutes: number;
  wifiOnlySync: boolean;
  saveTranscriptsToFiles: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  backendUrl: '',
  apiKey: '',
  defaultLanguage: 'auto',
  autoSyncEnabled: false,
  syncIntervalMinutes: 60,
  wifiOnlySync: true,
  saveTranscriptsToFiles: true,
};