import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Transcript } from '@/types/transcript';

interface TranscriptsState {
  transcripts: Transcript[];
  hydrated: boolean;
  setHydrated: (value: boolean) => void;
  upsert: (transcript: Transcript) => void;
  upsertMany: (transcripts: Transcript[]) => void;
  remove: (id: string) => void;
  removeByCreator: (creatorId: string) => void;
  getById: (id: string) => Transcript | undefined;
  clear: () => void;
}

export const useTranscriptsStore = create<TranscriptsState>()(
  persist(
    (set, get) => ({
      transcripts: [],
      hydrated: false,
      setHydrated: (value) => set({ hydrated: value }),
      upsert: (transcript) =>
        set((state) => {
          const index = state.transcripts.findIndex((t) => t.id === transcript.id);
          if (index === -1) {
            return { transcripts: [transcript, ...state.transcripts] };
          }
          const next = state.transcripts.slice();
          next[index] = transcript;
          return { transcripts: next };
        }),
      upsertMany: (incoming) =>
        set((state) => {
          const map = new Map<string, Transcript>();
          for (const t of state.transcripts) map.set(t.id, t);
          for (const t of incoming) map.set(t.id, t);
          const merged = Array.from(map.values()).sort((a, b) =>
            a.createdAt < b.createdAt ? 1 : -1,
          );
          return { transcripts: merged };
        }),
      remove: (id) =>
        set((state) => ({
          transcripts: state.transcripts.filter((t) => t.id !== id),
        })),
      removeByCreator: (creatorId) =>
        set((state) => ({
          transcripts: state.transcripts.filter((t) => t.creatorId !== creatorId),
        })),
      getById: (id) => get().transcripts.find((t) => t.id === id),
      clear: () => set({ transcripts: [] }),
    }),
    {
      name: 'transcriber-transcripts',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ transcripts: state.transcripts }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    },
  ),
);