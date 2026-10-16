import { useEffect, useState } from "react";

import { API_BASE_URL } from "@/src/services/api/apiClient";
import { SharedMediaItem } from "@/src/services/chat/sharedMediaService";
import { decryptRemoteMedia } from "@/src/utils/mediaPipeline";
import { useMediaCacheStore } from "@/src/store/chat/mediaCacheStore";

export default function useDecryptedImage(item: SharedMediaItem | null) {
  const [uri, setUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const getCachedMedia = useMediaCacheStore((state) => state.getCachedMedia);

  useEffect(() => {
    if (!item || !item.mediaUrl) {
      setUri(null);
      setLoading(false);
      return;
    }

    const mediaUrl = item.mediaUrl;

    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);

        // ---------- NOT ENCRYPTED ----------
        if (!item.isMediaEncrypted) {
          if (mounted) {
            setUri(`${API_BASE_URL}${item.mediaUrl}`);
          }

          return;
        }

        // ---------- CACHE ----------
        const cached = getCachedMedia(mediaUrl);

        if (cached) {
          if (mounted) {
            setUri(cached);
          }

          return;
        }

        // ---------- DECRYPT ----------
        const decrypted = await decryptRemoteMedia({
          mediaUrl: mediaUrl,
          encryptedMediaKey: item.encryptedMediaKey!,
          mediaKeyIV: item.mediaKeyIV!,
          mediaKeyAuthTag: item.mediaKeyAuthTag,
          mimeType: item.mimeType,
          fileName: item.fileName,
        });

        if (mounted) {
          setUri(decrypted);
        }
      } catch (error) {
        console.log("Image decrypt error:", error);

        if (mounted) {
          setUri(null);
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
    uri,
    loading,
  };
}
