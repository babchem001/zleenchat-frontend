import { useUploadQueueStore } from "./uploadQueueStore";

import { processImage } from "@/src/services/chat/imageProcessor";
import { processVideo } from "@/src/services/chat/videoProcessor";
import { processAudio } from "@/src/services/chat/audioProcessor";
import { processDocument } from "@/src/services/chat/documentProcessor";

import { encryptThumbnail } from "@/src/utils/thumbnailEncryption";

export const processMediaFile = async ({ clientId }: { clientId: string }) => {
  const uploadStore = useUploadQueueStore.getState();

  try {
    const message = uploadStore.queuedMessages.find(
      (msg) => msg.clientId === clientId,
    );

    if (!message) {
      throw new Error("Queued message not found");
    }

    uploadStore.updateQueuedMessage(clientId, {
      uploadStatus: "PROCESSING",
    });

    // ==================================================
    // IMAGE
    // ==================================================

    if (message.mimeType?.startsWith("image") && message.localUri) {
      uploadStore.updateQueuedMessage(clientId, {
        uploadStatus: "COMPRESSING",
      });

      const processed = await processImage(message.localUri);

      const encryptedThumb = await encryptThumbnail({
        thumbnailUri: processed.thumbnailUri,
      });

      uploadStore.updateQueuedMessage(clientId, {
        compressedUri: processed.compressedUri,
        isCompressed: true,

        fileSize: processed.compressedSize,

        processedWidth: processed.width,
        processedHeight: processed.height,

        thumbnailUri: encryptedThumb.encryptedThumbnailUri,

        encryptedThumbnailKey: encryptedThumb.thumbnailKey,
        thumbnailIV: encryptedThumb.thumbnailIV,
        thumbnailAuthTag: encryptedThumb.thumbnailAuthTag,

        thumbnailSize: processed.thumbnailSize,

        orientation: processed.orientation,

        compressionLevel: processed.compressionLevel,
        originalFileSize: processed.originalFileSize,
        compressionSavedBytes: processed.compressionSavedBytes,

        uploadStatus: "READY",
      });

      return;
    }

    // ==================================================
    // VIDEO
    // ==================================================

    if (message.mimeType?.startsWith("video") && message.localUri) {
      uploadStore.updateQueuedMessage(clientId, {
        uploadStatus: "GENERATING_THUMBNAIL",
      });

      const processed = await processVideo(message.localUri);

      uploadStore.updateQueuedMessage(clientId, {
        compressedUri: processed.compressedUri,
        isCompressed: true,
        fileSize: processed.compressedSize,
        videoWidth: processed.width,
        videoHeight: processed.height,
        thumbnailUri: processed.thumbnailUri,
        thumbnailSize: processed.thumbnailSize,
        orientation: processed.orientation,
        compressionLevel: processed.compressionLevel,
        originalFileSize: processed.originalFileSize,
        compressionSavedBytes: processed.compressionSavedBytes,
        uploadStatus: "READY",
      });

      return;
    }

    // ==================================================
    // AUDIO
    // ==================================================

    if (message.mimeType?.startsWith("audio") && message.localUri) {
      uploadStore.updateQueuedMessage(clientId, {
        uploadStatus: "PROCESSING",
      });

      const processed = await processAudio(message.localUri);

      uploadStore.updateQueuedMessage(clientId, {
        duration: processed.duration,
        waveform: processed.waveform,
        fileSize: processed.fileSize,
        bitrate: processed.bitrate,
        compressionLevel: processed.compressionLevel,
        originalFileSize: processed.originalFileSize,
        compressionSavedBytes: processed.compressionSavedBytes,
        uploadStatus: "READY",
      });

      return;
    }

    // ==================================================
    // DOCUMENTS
    // ==================================================

    if (message.contentType === "FILE" && message.localUri) {
      uploadStore.updateQueuedMessage(clientId, {
        uploadStatus: "GENERATING_THUMBNAIL",
      });

      const processed = await processDocument({
        fileUri: message.localUri,
        fileName: message.fileName || "",
        mimeType: message.mimeType || "",
      });

      uploadStore.updateQueuedMessage(clientId, {
        fileSize: processed.fileSize,

        thumbnailUri: null,
        encryptedThumbnailKey: null,
        thumbnailIV: null,
        thumbnailAuthTag: null,
        thumbnailSize: null,

        uploadStatus: "READY",
      });

      return;
    }

    // ==================================================
    // FALLBACK
    // ==================================================

    uploadStore.updateQueuedMessage(clientId, {
      uploadStatus: "READY",
    });
  } catch (error) {
    uploadStore.updateQueuedMessage(clientId, {
      uploadStatus: "FAILED",
    });

    throw error;
  }
};
