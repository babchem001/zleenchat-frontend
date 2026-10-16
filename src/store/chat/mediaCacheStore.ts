import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type MediaCacheEntry = {
  remoteUrl: string;
  localUri: string;
  cachedAt: number;
};

type MediaCacheState = {
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

  clearCache: () => void;
};

export const useMediaCacheStore = create<MediaCacheState>()(
  persist(
    (set, get) => ({
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

        if (!entry?.localUri) {
          return null;
        }

        return entry?.localUri || null;
      },

      removeCachedMedia: (remoteUrl) =>
        set((state) => {
          const updated = {
            ...state.mediaCache,
          };

          delete updated[remoteUrl];

          return {
            mediaCache: updated,
          };
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
          const updated = {
            ...state.thumbnailCache,
          };

          delete updated[thumbnailUrl];

          return {
            thumbnailCache: updated,
          };
        }),

      // ================= CLEAR =================

      clearCache: () =>
        set({
          mediaCache: {},
          thumbnailCache: {},
        }),
    }),

    {
      name: "media-cache-storage",

      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
