import { useEffect, useState } from "react";

import { getAuthenticatedMediaSource } from "@/src/utils/mediaReference";
import { SharedMediaItem } from "@/src/services/chat/sharedMediaService";
import { decryptRemoteMedia } from "@/src/utils/mediaPipeline";
import { useMediaCacheStore } from "@/src/store/chat/mediaCacheStore";

type ImageSource = {
  uri: string;
  headers?: Record<string, string>;
};

export default function useDecryptedImage(item: SharedMediaItem | null) {
  /*
   * ============================================================
   * PHASE F — STEP 4
   *
   * Shared images may be private remote media and therefore need
   * both the URI and the Authorization header.
   *
   * Decrypted/local media remains a plain local URI.
   * ============================================================
   */

  const [source, setSource] = useState<ImageSource | null>(null);
  const [loading, setLoading] = useState(false);

  const getCachedMedia = useMediaCacheStore((state) => state.getCachedMedia);

  useEffect(() => {
    if (!item || !item.mediaUrl) {
      setSource(null);
      setLoading(false);
      return;
    }

    const mediaUrl = item.mediaUrl;

    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);
        setSource(null);

        // NOT ENCRYPTED
        if (!item.isMediaEncrypted) {
          const authenticatedSource =
            await getAuthenticatedMediaSource(mediaUrl);

          if (mounted) {
            setSource(authenticatedSource);
          }

          return;
        }

        // CACHE
        const cached = getCachedMedia(mediaUrl);

        if (cached) {
          if (mounted) {
            /*
             * Cached/decrypted media is local media.
             * No Authorization header is required.
             */
            setSource({
              uri: cached,
            });
          }

          return;
        }

        // DECRYPT
        const decrypted = await decryptRemoteMedia({
          mediaUrl,
          encryptedMediaKey: item.encryptedMediaKey!,
          mediaKeyIV: item.mediaKeyIV!,
          mediaKeyAuthTag: item.mediaKeyAuthTag,
          mimeType: item.mimeType,
          fileName: item.fileName,
        });

        if (mounted) {
          /*
           * Decrypted media is stored locally and therefore does
           * not need the authenticated remote-media header.
           */
          setSource({
            uri: decrypted,
          });
        }
      } catch (error) {
        console.log("Image decrypt error:", error);

        if (mounted) {
          setSource(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, [item, getCachedMedia]);

  return {
    source,
    loading,
  };
}
