import NetInfo from "@react-native-community/netinfo";

import { processMediaFile } from "../store/chat/mediaProcessingQueue";
import { useUploadQueueStore } from "../store/chat/uploadQueueStore";
import { useAuthStore } from "../store/auth/authStorage";

import {
  uploadMessageFile,
  uploadThumbnail,
  finalizeChunkUpload,
} from "../services/chat/mediaService";

import { deleteFileIfExists } from "../services/chat/mediaCleanup";

import { sendMessage } from "../services/chat/chatService";
import { sendGroupMessage } from "../services/group/groupMessageService";

export const processWorkerJob = async (clientId: string) => {
  const authState = useAuthStore.getState();

  if (!authState.isHydrated || !authState.isAuthenticated) {
    return;
  }

  const uploadStore = useUploadQueueStore.getState();

  const message = uploadStore.queuedMessages.find(
    (msg) => msg.clientId === clientId,
  );

  if (!message) {
    return;
  }

  try {
    uploadStore.updateQueuedMessage(clientId, {
      uploadStatus: "UPLOADING",
      uploadProgress: 0,
      chunkUploadProgress: 0,
      uploadedChunks: 0,
    });

    await processMediaFile({
      clientId,
    });

    /*
     * Re-read the message because processMediaFile may update
     * the queue with the processed/compressed media information.
     */
    const processedMessage = useUploadQueueStore
      .getState()
      .queuedMessages.find((msg) => msg.clientId === clientId);

    if (!processedMessage) {
      return;
    }

    /*
     * ============================================================
     * TEXT MESSAGE
     *
     * Text messages do not use the chunked-upload flow.
     * ============================================================
     */

    if (
      processedMessage.contentType === "TEXT" &&
      processedMessage.type === "DIRECT"
    ) {
      await sendMessage(processedMessage.receiverId!, {
        clientId,
        messageContent: processedMessage.messageContent,

        contentType: "TEXT",

        isForwarded: false,
      });

      uploadStore.updateQueuedMessage(clientId, {
        uploadStatus: "SENT",
        uploadProgress: 100,
      });

      uploadStore.removeQueuedMessage(clientId);

      return;
    }

    /*
     * ============================================================
     * PHASE D — STEP 7
     *
     * Track server upload sessions and their corresponding
     * local files.
     *
     * IMPORTANT:
     *
     * These files must NOT be deleted until:
     *
     *   1. R2 persistence succeeds
     *   2. Database Message/reference succeeds
     *   3. Server-side /upload/finalize succeeds
     * ============================================================
     */

    let uploadedThumbnailData: any = null;
    let uploadedFileData: any = null;

    let mediaUploadSessionId: string | null = null;
    let thumbnailUploadSessionId: string | null = null;

    let localMediaSourceUri: string | null = null;
    let localThumbnailSourceUri: string | null = null;

    /*
     * ============================================================
     * THUMBNAIL UPLOAD
     * ============================================================
     */

    if (
      processedMessage.contentType !== "FILE" &&
      processedMessage.thumbnailUri
    ) {
      uploadedThumbnailData = await uploadThumbnail(
        processedMessage.thumbnailUri,
      );

      thumbnailUploadSessionId = uploadedThumbnailData?.uploadSessionId || null;

      localThumbnailSourceUri =
        uploadedThumbnailData?.localSourceUri || processedMessage.thumbnailUri;
    }

    if (processedMessage.localUri) {
      uploadedFileData = await uploadMessageFile({
        file: {
          clientId,
          uri: processedMessage.compressedUri || processedMessage.localUri,
          name: processedMessage.fileName,
          mimeType: processedMessage.mimeType,
          size: processedMessage.fileSize,
        },

        onProgress: (progress) => {
          useUploadQueueStore.getState().updateQueuedMessage(clientId, {
            uploadProgress: progress,
          });
        },

        onChunkProgress: (uploadedChunks, totalChunks) => {
          useUploadQueueStore.getState().updateQueuedMessage(clientId, {
            uploadedChunks,
            totalChunks,

            chunkUploadProgress:
              totalChunks > 0
                ? Math.round((uploadedChunks * 100) / totalChunks)
                : 0,
          });
        },
      });

      mediaUploadSessionId = uploadedFileData?.uploadSessionId || null;

      localMediaSourceUri =
        uploadedFileData?.localSourceUri ||
        processedMessage.compressedUri ||
        processedMessage.localUri;
    }

    const contentType =
      uploadedFileData?.contentType || processedMessage.contentType;

    const mediaPayload = {
      clientId,
      messageContent: processedMessage.messageContent || "",
      contentType,
      mediaUrl: uploadedFileData?.mediaUrl || null,
      fileName: uploadedFileData?.fileName || processedMessage.fileName || null,
      mimeType: uploadedFileData?.mimeType || processedMessage.mimeType || null,
      fileSize: uploadedFileData?.fileSize ?? processedMessage.fileSize ?? null,
      encryptedMediaKey: uploadedFileData?.encryptedMediaKey ?? null,
      mediaIV: uploadedFileData?.mediaIV ?? null,
      mediaAuthTag: uploadedFileData?.mediaAuthTag ?? null,
      isMediaEncrypted:
        uploadedFileData?.isMediaEncrypted ??
        processedMessage.isMediaEncrypted ??
        false,
      mediaKeyIV: uploadedFileData?.mediaKeyIV ?? null,
      mediaKeyAuthTag: uploadedFileData?.mediaKeyAuthTag ?? null,
      duration: processedMessage.duration ?? null,
      waveform: processedMessage.waveform ?? null,
      mediaWidth: processedMessage.videoWidth ?? null,
      mediaHeight: processedMessage.videoHeight ?? null,
      processedWidth: processedMessage.processedWidth ?? null,
      processedHeight: processedMessage.processedHeight ?? null,
      orientation: processedMessage.orientation ?? null,
      bitrate: processedMessage.bitrate ?? null,
      thumbnailUrl: uploadedThumbnailData?.thumbnailUrl ?? null,
      thumbnailSize:
        uploadedThumbnailData?.thumbnailSize ??
        processedMessage.thumbnailSize ??
        null,
      encryptedThumbnailKey:
        uploadedThumbnailData?.encryptedThumbnailKey ??
        processedMessage.encryptedThumbnailKey ??
        null,
      thumbnailIV:
        uploadedThumbnailData?.thumbnailIV ??
        processedMessage.thumbnailIV ??
        null,
      thumbnailAuthTag:
        uploadedThumbnailData?.thumbnailAuthTag ??
        processedMessage.thumbnailAuthTag ??
        null,
      replyToId: processedMessage.replyToId ?? null,
    };

    let persistedDirectMessage: any = null;

    if (processedMessage.type === "GROUP") {
      await sendGroupMessage(Number(processedMessage.groupId), mediaPayload);
    } else {
      const directMessagePayload = {
        ...mediaPayload,
        isForwarded: false,
        videoWidth: mediaPayload.mediaWidth,
        videoHeight: mediaPayload.mediaHeight,
        processedWidth: mediaPayload.processedWidth,
        processedHeight: mediaPayload.processedHeight,
        orientation: mediaPayload.orientation,
        bitrate: mediaPayload.bitrate,
        thumbnailUrl: mediaPayload.thumbnailUrl,
        thumbnailSize: mediaPayload.thumbnailSize,
        encryptedThumbnailKey: mediaPayload.encryptedThumbnailKey,
        thumbnailIV: mediaPayload.thumbnailIV,
        thumbnailAuthTag: mediaPayload.thumbnailAuthTag,
      };

      await sendMessage(processedMessage.receiverId!, directMessagePayload);
    }
    let thumbnailServerCleanupSucceeded = true;
    let mediaServerCleanupSucceeded = true;

    if (thumbnailUploadSessionId) {
      try {
        await finalizeChunkUpload(thumbnailUploadSessionId);

        thumbnailServerCleanupSucceeded = true;
      } catch (cleanupError) {
        thumbnailServerCleanupSucceeded = false;

        console.error("THUMBNAIL SERVER CLEANUP ERROR:", cleanupError);
      }
    }

    if (mediaUploadSessionId) {
      try {
        await finalizeChunkUpload(mediaUploadSessionId);

        mediaServerCleanupSucceeded = true;
      } catch (cleanupError) {
        mediaServerCleanupSucceeded = false;

        console.error("MEDIA SERVER CLEANUP ERROR:", cleanupError);
      }
    }

    if (localThumbnailSourceUri && thumbnailServerCleanupSucceeded) {
      await deleteFileIfExists(localThumbnailSourceUri);
    }

    if (localMediaSourceUri && mediaServerCleanupSucceeded) {
      await deleteFileIfExists(localMediaSourceUri);
    }
    if (
      processedMessage.compressedUri &&
      processedMessage.compressedUri !== localMediaSourceUri &&
      mediaServerCleanupSucceeded
    ) {
      await deleteFileIfExists(processedMessage.compressedUri);
    }
    if (processedMessage.type === "GROUP") {
      uploadStore.updateQueuedMessage(clientId, {
        uploadStatus: "SENT",
        uploadProgress: 100,
      });

      uploadStore.removeQueuedMessage(clientId);
    }
  } catch (error: any) {
    console.error("MEDIA WORKER ERROR:", {
      message: error?.message,
      code: error?.code,
      status: error?.response?.status,
      responseData: error?.response?.data,
      url: error?.config?.url,
      method: error?.config?.method,
      stack: error?.stack,
    });

    useUploadQueueStore.getState().updateQueuedMessage(clientId, {
      uploadStatus: "FAILED",
      uploadProgress: 0,
    });
  }
};

export const processPendingJobs = async () => {
  const authState = useAuthStore.getState();

  if (!authState.isHydrated || !authState.isAuthenticated) {
    return;
  }

  try {
    const network = await NetInfo.fetch();

    if (!network.isConnected) {
      return;
    }

    const queue = useUploadQueueStore.getState().queuedMessages;

    for (const message of queue) {
      if (message.uploadStatus !== "QUEUED") {
        continue;
      }

      if (!message.clientId) {
        continue;
      }

      try {
        await processWorkerJob(message.clientId);
      } catch (error) {
        console.log("AUTO PROCESS ERROR:", error);
      }
    }
  } catch (error) {
    console.log("PROCESS PENDING ERROR:", error);
  }
};
