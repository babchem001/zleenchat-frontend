import NetInfo from "@react-native-community/netinfo";

import { processMediaFile } from "../store/chat/mediaProcessingQueue";
import { useUploadQueueStore } from "../store/chat/uploadQueueStore";
import { useAuthStore } from "../store/auth/authStorage";
import {
  uploadMessageFile,
  uploadThumbnail,
} from "../services/chat/mediaService";

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

    // Re-read the message because processMediaFile may update the queue.
    const processedMessage = useUploadQueueStore
      .getState()
      .queuedMessages.find((msg) => msg.clientId === clientId);

    if (!processedMessage) {
      return;
    }

    if (
      processedMessage.contentType === "TEXT" &&
      processedMessage.type === "DIRECT"
    ) {
      await sendMessage(processedMessage.receiverId!, {
        clientId,
        messageContent: processedMessage.messageContent,
        contentType: "TEXT",

        // Required by SendMessagePayload.
        isForwarded: false,
      });

      uploadStore.updateQueuedMessage(clientId, {
        uploadStatus: "SENT",
        uploadProgress: 100,
      });

      uploadStore.removeQueuedMessage(clientId);

      return;
    }

    let uploadedThumbnailData: any = null;

    if (
      processedMessage.contentType !== "FILE" &&
      processedMessage.thumbnailUri
    ) {
      uploadedThumbnailData = await uploadThumbnail(
        processedMessage.thumbnailUri,
      );
    }

    let uploadedFileData: any = null;

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

    if (processedMessage.type === "GROUP") {
      await sendGroupMessage(Number(processedMessage.groupId), mediaPayload);
    } else {
      const directMessagePayload = {
        ...mediaPayload,

        isForwarded: false,
        videoWidth: mediaPayload.mediaWidth,
        videoHeight: mediaPayload.mediaHeight,

        // Keep the original field names expected by chatService.
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

    uploadStore.updateQueuedMessage(clientId, {
      uploadStatus: "SENT",
      uploadProgress: 100,
    });

    uploadStore.removeQueuedMessage(clientId);
  } catch (error) {
    console.log("MEDIA WORKER ERROR:", error);

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

    // No internet connection.
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
