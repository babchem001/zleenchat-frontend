import * as FileSystem from "expo-file-system/legacy";
import apiClient from "../api/apiClient";

export const uploadEncryptedThumbnail = async ({
  encryptedThumbnailUri,
  clientId,
}: {
  encryptedThumbnailUri: string;
  clientId: string;
}) => {
  const fileInfo = await FileSystem.getInfoAsync(encryptedThumbnailUri);

  if (!fileInfo.exists) {
    throw new Error("Encrypted thumbnail file does not exist");
  }

  const startResponse = await apiClient.post("/messages/upload/start", {
    uploadType: "THUMBNAIL",
    clientId,
    fileName: "thumbnail.enc",
    mimeType: "image/jpeg",
    fileSize: fileInfo.size,
  });

  const { uploadSessionId } = startResponse.data;

  const content = await FileSystem.readAsStringAsync(encryptedThumbnailUri);

  await apiClient.post("/messages/upload/chunk", {
    uploadSessionId,
    chunkIndex: 0,
    totalChunks: 1,
    chunk: content,
  });

  const completeResponse = await apiClient.post("/messages/upload/complete", {
    uploadSessionId,
  });
  return completeResponse.data;
};
