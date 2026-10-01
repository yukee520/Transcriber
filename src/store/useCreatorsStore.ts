import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Creator } from '@/types/creator';

interface CreatorsState {
  creators: Creator[];
  hydrated: boolean;
  setHydrated: (value: boolean) => void;
  add: (creator: Creator) => void;
  update: (id: string, patch: Partial<Creator>) => Creator | undefined;
  remove: (id: string) => void;
  getById: (id: string) => Creator | undefined;
  findByHandle: (platform: string, username: string) => Creator | undefined;
  clear: () => void;
}

export const useCreatorsStore = create<CreatorsState>()(
  persist(
    (set, get) => ({
      creators: [],
      hydrated: false,
      setHydrated: (value) => set({ hydrated: value }),
      add: (creator) =>
        set((state) => {
          if (state.creators.some((c) => c.id === creator.id)) {
            return state;
          }
          return { creators: [creator, ...state.creators] };
        }),
      update: (id, patch) => {
        let updated: Creator | undefined;
        set((state) => {
          const next = state.creators.map((c) => {
            if (c.id !== id) return c;
            updated = { ...c, ...patch };
            return updated;
          });
          return { creators: next };
        });
        return updated;
      },
      remove: (id) =>
        set((state) => ({
          creators: state.creators.filter((c) => c.id !== id),
        })),
      getById: (id) => get().creators.find((c) => c.id === id),
      findByHandle: (platform, username) =>
        get().creators.find(
          (c) =>
            c.platform === platform &&
            c.username.toLowerCase() === username.toLowerCase(),
        ),
      clear: () => set({ creators: [] }),
    }),
    {
      name: 'transcriber-creators',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ creators: state.creators }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    },
  ),
);