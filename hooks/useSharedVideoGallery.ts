import { useEffect, useState } from "react";

import { SharedMediaItem } from "@/src/services/chat/sharedMediaService";
import { API_BASE_URL } from "@/src/services/api/apiClient";
import { decryptRemoteMedia } from "@/src/utils/mediaPipeline";
import { useMediaCacheStore } from "@/src/store/chat/mediaCacheStore";

export type SharedVideoSource = {
  uri: string;
};

export default function useSharedVideoGallery(
  videos: SharedMediaItem[],
  currentIndex: number,
) {
  const getCachedMedia = useMediaCacheStore((state) => state.getCachedMedia);
  const cacheMedia = useMediaCacheStore((state) => state.cacheMedia);

  const [sources, setSources] = useState<SharedVideoSource[]>(
    videos.map(() => ({
      uri: "",
    })),
  );

  const [loading, setLoading] = useState(true);

  // Keep sources array in sync if the number of videos changes.
  useEffect(() => {
    setSources((previous) => {
      if (previous.length === videos.length) {
        return previous;
      }

      return videos.map((_, index) => previous[index] ?? { uri: "" });
    });
  }, [videos]);

  useEffect(() => {
    let mounted = true;

    const loadVideos = async () => {
      try {
        setLoading(true);

        const indexes = [
          currentIndex - 1,
          currentIndex,
          currentIndex + 1,
        ].filter((index) => index >= 0 && index < videos.length);

        // First populate non-encrypted and already-cached videos.
        if (mounted) {
          setSources((previous) => {
            const updated = [...previous];

            for (const index of indexes) {
              const video = videos[index];

              if (!video?.mediaUrl) {
                continue;
              }

              // Already loaded
              if (updated[index]?.uri) {
                continue;
              }

              // Normal (not encrypted)
              if (!video.isMediaEncrypted) {
                updated[index] = {
                  uri: `${API_BASE_URL}${video.mediaUrl}`,
                };
                continue;
              }

              // Already decrypted and cached
              const cached = getCachedMedia(video.mediaUrl);

              if (cached) {
                updated[index] = {
                  uri: cached,
                };
              }
            }

            return updated;
          });
        }

        // Decrypt only the encrypted videos that are still missing.
        for (const index of indexes) {
          const video = videos[index];

          if (!video?.mediaUrl || !video.isMediaEncrypted) {
            continue;
          }

          const cached = getCachedMedia(video.mediaUrl);

          if (cached) {
            continue;
          }

          const decrypted = await decryptRemoteMedia({
            mediaUrl: video.mediaUrl,
            encryptedMediaKey: video.encryptedMediaKey!,
            mediaKeyIV: video.mediaKeyIV!,
            mediaKeyAuthTag: video.mediaKeyAuthTag,
            mimeType: video.mimeType,
            fileName: video.fileName,
          });

          cacheMedia(video.mediaUrl, decrypted);

          if (mounted) {
            setSources((previous) => {
              const updated = [...previous];

              updated[index] = {
                uri: decrypted,
              };

              return updated;
            });
          }
        }
      } catch (error) {
        console.log("Shared video gallery error:", error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadVideos();

    return () => {
      mounted = false;
    };
  }, [videos, currentIndex, getCachedMedia, cacheMedia]);

  return {
    sources,
    loading,
  };
}
