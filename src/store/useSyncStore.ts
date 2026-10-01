import { create } from 'zustand';

export type SyncPhase = 'idle' | 'running' | 'error';

interface SyncProgress {
  totalCreators: number;
  completedCreators: number;
  currentCreatorName?: string;
  newTranscripts: number;
}

interface SyncState {
  phase: SyncPhase;
  lastRunAt: string | null;
  lastError: string | null;
  progress: SyncProgress;
  startSync: (totalCreators: number) => void;
  updateProgress: (patch: Partial<SyncProgress>) => void;
  incrementNewTranscripts: (amount?: number) => void;
  finishSync: () => void;
  failSync: (message: string) => void;
  reset: () => void;
}

const initialProgress: SyncProgress = {
  totalCreators: 0,
  completedCreators: 0,
  currentCreatorName: undefined,
  newTranscripts: 0,
};

export const useSyncStore = create<SyncState>((set) => ({
  phase: 'idle',
  lastRunAt: null,
  lastError: null,
  progress: initialProgress,
  startSync: (totalCreators) =>
    set({
      phase: 'running',
      lastError: null,
      progress: { ...initialProgress, totalCreators },
    }),
  updateProgress: (patch) =>
    set((state) => ({ progress: { ...state.progress, ...patch } })),
  incrementNewTranscripts: (amount = 1) =>
    set((state) => ({
      progress: {
        ...state.progress,
        newTranscripts: state.progress.newTranscripts + amount,
      },
    })),
  finishSync: () =>
    set((state) => ({
      phase: 'idle',
      lastRunAt: new Date().toISOString(),
      lastError: null,
      progress: {
        ...state.progress,
        currentCreatorName: undefined,
        completedCreators: state.progress.totalCreators,
      },
    })),
  failSync: (message) =>
    set((state) => ({
      phase: 'error',
      lastError: message,
      lastRunAt: new Date().toISOString(),
      progress: { ...state.progress, currentCreatorName: undefined },
    })),
  reset: () =>
    set({
      phase: 'idle',
      lastError: null,
      progress: initialProgress,
    }),
}));