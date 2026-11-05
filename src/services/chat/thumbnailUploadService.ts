import * as FileSystem from "expo-file-system/legacy";
import apiClient from "../api/apiClient";

const CHUNK_SIZE = 1024 * 1024;

export const uploadEncryptedThumbnail = async ({
  encryptedThumbnailUri,
  clientId,
}: {
  encryptedThumbnailUri: string;
  clientId: string;
}) => {
  // ================= FILE INFO =================

  const fileInfo = await FileSystem.getInfoAsync(encryptedThumbnailUri);

  if (!fileInfo.exists) {
    throw new Error("Encrypted thumbnail file does not exist");
  }

  const fileSize = "size" in fileInfo ? fileInfo.size : 0;

  if (fileSize <= 0) {
    throw new Error("Encrypted thumbnail file is empty");
  }

  // Read as Base64 because the backend reconstructs thumbnail
  // uploads using Buffer.from(content, "base64").
  const base64File = await FileSystem.readAsStringAsync(encryptedThumbnailUri, {
    encoding: "base64",
  });

  const totalChunks = Math.ceil(base64File.length / CHUNK_SIZE);

  if (totalChunks <= 0) {
    throw new Error("Encrypted thumbnail contains no uploadable data");
  }

  // ================= START SESSION =================

  const startResponse = await apiClient.post("/messages/upload/start", {
    uploadType: "THUMBNAIL",
    clientId,
    fileName: "thumbnail.enc",
    mimeType: "image/jpeg",
    fileSize,
    totalChunks,
  });

  const { uploadSessionId, uploadedChunks } = startResponse.data;

  // ================= UPLOAD CHUNKS =================

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    if (uploadedChunks.includes(chunkIndex)) {
      continue;
    }

    const start = chunkIndex * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, base64File.length);

    const chunk = base64File.slice(start, end);

    await apiClient.post("/messages/upload/chunk", {
      uploadSessionId,
      chunkIndex,
      totalChunks,
      chunk,
    });
  }

  // ================= COMPLETE UPLOAD =================

  const completeResponse = await apiClient.post("/messages/upload/complete", {
    uploadSessionId,
  });

  return {
    ...completeResponse.data,
    uploadSessionId,
  };
};
