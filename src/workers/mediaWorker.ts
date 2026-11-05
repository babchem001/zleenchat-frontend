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

  let messagePersisted = false;

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
     * the queue with processed/compressed media information.
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
     * Local files must not be deleted until:
     *
     * 1. R2 persistence succeeds.
     * 2. Database message/reference creation succeeds.
     * 3. Server-side upload finalization is attempted.
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

    /*
     * ============================================================
     * ORIGINAL MEDIA UPLOAD
     * ============================================================
     */

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

    /*
     * ============================================================
     * BUILD MEDIA MESSAGE PAYLOAD
     * ============================================================
     */

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

    /*
     * ============================================================
     * SEND MESSAGE
     * ============================================================
     */

    if (processedMessage.type === "GROUP") {
      await sendGroupMessage(Number(processedMessage.groupId), mediaPayload);

      messagePersisted = true;
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

      /*
       * The API response is the authoritative persisted message.
       *
       * Some API service implementations return response.data,
       * while others expose the response object. Support both.
       */
      const sendResponse = await sendMessage(
        processedMessage.receiverId!,
        directMessagePayload,
      );

      const persistedMessage = sendResponse?.data ?? sendResponse;

      if (
        !persistedMessage ||
        !Number.isInteger(Number(persistedMessage.id)) ||
        Number(persistedMessage.id) <= 0
      ) {
        throw new Error(
          "Media message response did not contain a valid persisted message ID.",
        );
      }

      messagePersisted = true;

      /*
       * Publish the server-persisted message to the shared queue.
       *
       * Keep the original clientId so ChatScreen can replace
       * the optimistic message instead of adding a duplicate.
       *
       * Keep type and receiverId explicitly because the server
       * response may not include these local queue properties.
       */
      useUploadQueueStore.getState().updateQueuedMessage(clientId, {
        ...persistedMessage,

        id: persistedMessage.id,

        clientId,

        type: processedMessage.type,

        receiverId: processedMessage.receiverId,

        uploadStatus: "SENT",

        uploadProgress: 100,
      });
    }

    /*
     * ============================================================
     * SERVER UPLOAD SESSION FINALIZATION
     * ============================================================
     */

    if (thumbnailUploadSessionId) {
      try {
        await finalizeChunkUpload(thumbnailUploadSessionId);
      } catch (cleanupError) {
        console.error("THUMBNAIL SERVER CLEANUP ERROR:", cleanupError);
      }
    }

    if (mediaUploadSessionId) {
      try {
        await finalizeChunkUpload(mediaUploadSessionId);
      } catch (cleanupError) {
        console.error("MEDIA SERVER CLEANUP ERROR:", cleanupError);
      }
    }

    /*
     * ============================================================
     * LOCAL FILE CLEANUP
     *
     * A local cleanup failure must not turn a successfully
     * persisted message into a failed message.
     * ============================================================
     */

    if (localThumbnailSourceUri) {
      try {
        await deleteFileIfExists(localThumbnailSourceUri);
      } catch (cleanupError) {
        console.error("LOCAL THUMBNAIL CLEANUP ERROR:", cleanupError);
      }
    }

    if (localMediaSourceUri) {
      try {
        await deleteFileIfExists(localMediaSourceUri);
      } catch (cleanupError) {
        console.error("LOCAL MEDIA CLEANUP ERROR:", cleanupError);
      }
    }

    if (
      processedMessage.compressedUri &&
      processedMessage.compressedUri !== localMediaSourceUri
    ) {
      try {
        await deleteFileIfExists(processedMessage.compressedUri);
      } catch (cleanupError) {
        console.error("COMPRESSED MEDIA CLEANUP ERROR:", cleanupError);
      }
    }

    /*
     * ============================================================
     * QUEUE CLEANUP
     *
     * Group messages retain their existing cleanup behaviour.
     *
     * Direct media messages remain in the shared queue until
     * ChatScreen reconciles the persisted message into its
     * visible message list.
     * ============================================================
     */

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

    /*
     * Do not mark an already-persisted message as failed.
     * Its database record already exists.
     */
    if (!messagePersisted) {
      useUploadQueueStore.getState().updateQueuedMessage(clientId, {
        uploadStatus: "FAILED",
        uploadProgress: 0,
      });
    }
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
