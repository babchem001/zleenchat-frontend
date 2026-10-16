import { useEffect, useState } from "react";

import { API_BASE_URL } from "@/src/services/api/apiClient";
import { SharedMediaItem } from "@/src/services/chat/sharedMediaService";
import { decryptRemoteMedia } from "@/src/utils/mediaPipeline";
import { useMediaCacheStore } from "@/src/store/chat/mediaCacheStore";
import { Image } from "expo-image";

type GalleryImage = {
  uri: string;
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
              return {
                uri: `${API_BASE_URL}${photo.mediaUrl}`,
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

  useEffect(() => {
    if (images.length === 0) {
      return;
    }

    Image.prefetch(images.map((image) => image.uri));
  }, [images]);

  return {
    images,
    loading,
  };
}
