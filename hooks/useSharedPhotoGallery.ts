import { useEffect, useState } from "react";

import { SharedMediaItem } from "@/src/services/chat/sharedMediaService";
import { decryptRemoteMedia } from "@/src/utils/mediaPipeline";
import { useMediaCacheStore } from "@/src/store/chat/mediaCacheStore";
import { getAuthenticatedMediaSource } from "@/src/utils/mediaReference";
import { Image } from "expo-image";

type GalleryImage = {
  uri: string;
  headers?: Record<string, string>;
};

export default function useSharedPhotoGallery(photos: SharedMediaItem[]) {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);

  const getCachedMedia = useMediaCacheStore((state) => state.getCachedMedia);

  useEffect(() => {
    let mounted = true;

    const prepareGallery = async () => {
      try {
        setLoading(true);

        const gallery = await Promise.all(
          photos.map(async (photo) => {
            if (!photo.mediaUrl) {
              return {
                uri: "",
              };
            }

            // ---------- NOT ENCRYPTED ----------
            if (!photo.isMediaEncrypted) {
              /**
               * PHASE E — STEP 5
               *
               * R2-backed message media is served through the authenticated
               * backend media endpoint.
               *
               * Do not manually concatenate API_BASE_URL here.
               * The central media resolver also preserves legacy
               * /uploads/messages/... references.
               */
              const source = await getAuthenticatedMediaSource(photo.mediaUrl);

              if (!source) {
                return {
                  uri: "",
                };
              }

              return {
                uri: source.uri,
                headers: source.headers,
              };
            }

            // ---------- CACHE ----------
            const cached = getCachedMedia(photo.mediaUrl);

            if (cached) {
              return {
                uri: cached,
              };
            }

            // ---------- DECRYPT ----------
            const decrypted = await decryptRemoteMedia({
              mediaUrl: photo.mediaUrl,
              encryptedMediaKey: photo.encryptedMediaKey!,
              mediaKeyIV: photo.mediaKeyIV!,
              mediaKeyAuthTag: photo.mediaKeyAuthTag,
              mimeType: photo.mimeType,
              fileName: photo.fileName,
            });

            return {
              uri: decrypted,
            };
          }),
        );

        if (mounted) {
          setImages(gallery.filter((image) => image.uri.length > 0));
        }
      } catch (error) {
        console.log("Shared gallery preparation error:", error);

        if (mounted) {
          setImages([]);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    prepareGallery();

    return () => {
      mounted = false;
    };
  }, [photos, getCachedMedia]);

  /**
   * PHASE E — STEP 5
   *
   * Do not prefetch private R2 URLs as plain strings because that would
   * omit the Authorization header.
   *
   * Encrypted media is already local at this point.
   * Unencrypted remote media is loaded by ImageViewing using the
   * authenticated source object above.
   */
  return {
    images,
    loading,
  };
}
