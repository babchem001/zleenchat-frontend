import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { secureDeleteFile } from "@/src/services/chat/secureDelete";

export type MediaCacheEntry = {
  remoteUrl: string;
  localUri: string;
  cachedAt: number;
};

type MediaCacheState = {
  // ================= HYDRATION =================
  hasHydrated: boolean;
  setHasHydrated: (value: boolean) => void;

  // ================= MEDIA =================
  mediaCache: Record<string, MediaCacheEntry>;
  cacheMedia: (remoteUrl: string, localUri: string) => void;
  getCachedMedia: (remoteUrl: string) => string | null;
  removeCachedMedia: (remoteUrl: string) => void;

  // ================= THUMBNAILS =================
  thumbnailCache: Record<string, MediaCacheEntry>;
  cacheThumbnail: (thumbnailUrl: string, localUri: string) => void;
  getCachedThumbnail: (thumbnailUrl: string) => string | null;
  removeCachedThumbnail: (thumbnailUrl: string) => void;

  // ================= GLOBAL =================
  clearCache: () => Promise<void>;
};

export const useMediaCacheStore = create<MediaCacheState>()(
  persist(
    (set, get) => ({
      // ================= HYDRATION =================
      hasHydrated: false,

      setHasHydrated: (value) => set({ hasHydrated: value }),

      // ================= MEDIA =================
      mediaCache: {},

      cacheMedia: (remoteUrl, localUri) =>
        set((state) => ({
          mediaCache: {
            ...state.mediaCache,
            [remoteUrl]: {
              remoteUrl,
              localUri,
              cachedAt: Date.now(),
            },
          },
        })),

      getCachedMedia: (remoteUrl) => {
        const entry = get().mediaCache[remoteUrl];
        return entry?.localUri || null;
      },

      removeCachedMedia: (remoteUrl) =>
        set((state) => {
          const updated = { ...state.mediaCache };
          delete updated[remoteUrl];

          return { mediaCache: updated };
        }),

      // ================= THUMBNAILS =================
      thumbnailCache: {},

      cacheThumbnail: (thumbnailUrl, localUri) =>
        set((state) => ({
          thumbnailCache: {
            ...state.thumbnailCache,
            [thumbnailUrl]: {
              remoteUrl: thumbnailUrl,
              localUri,
              cachedAt: Date.now(),
            },
          },
        })),

      getCachedThumbnail: (thumbnailUrl) => {
        const entry = get().thumbnailCache[thumbnailUrl];
        return entry?.localUri || null;
      },

      removeCachedThumbnail: (thumbnailUrl) =>
        set((state) => {
          const updated = { ...state.thumbnailCache };
          delete updated[thumbnailUrl];

          return { thumbnailCache: updated };
        }),

      // ================= CLEAR =================
      clearCache: async () => {
        const state = get();

        const cachedFiles = new Set([
          ...Object.values(state.mediaCache).map((entry) => entry.localUri),
          ...Object.values(state.thumbnailCache).map((entry) => entry.localUri),
        ]);

        await Promise.all([...cachedFiles].map((uri) => secureDeleteFile(uri)));

        set({
          mediaCache: {},
          thumbnailCache: {},
        });
      },
    }),
    {
      name: "media-cache-storage",
      storage: createJSONStorage(() => AsyncStorage),

      onRehydrateStorage: () => (_state, error) => {
        if (error) {
          console.error("Error rehydrating media cache:", error);
        }
        useMediaCacheStore.getState().setHasHydrated(true);
      },
    },
  ),
);

// Wait until persisted cache metadata has been restored.
export const waitForMediaCacheHydration = async (): Promise<void> => {
  if (useMediaCacheStore.getState().hasHydrated) {
    return;
  }

  await new Promise<void>((resolve) => {
    const unsubscribe = useMediaCacheStore.subscribe((state) => {
      if (state.hasHydrated) {
        unsubscribe();
        resolve();
      }
    });

    // Recheck after subscribing to avoid missing a hydration completion.
    if (useMediaCacheStore.getState().hasHydrated) {
      unsubscribe();
      resolve();
    }
  });
};
