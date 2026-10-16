import apiClient from "../api/apiClient";
import * as FileSystem from "expo-file-system/legacy";
const CHUNK_SIZE = 1024 * 1024;
import { generateMediaKey } from "@/src/utils/mediaEncryption";
import { encryptChunk } from "@/src/utils/chunkEncryption";
import { encryptMediaKey } from "@/src/utils/mediaKeyEncryption";
import { deleteFileIfExists } from "./mediaCleanup";

type UploadOptions = {
  file: any;

  onProgress?: (progress: number) => void;

  onChunkProgress?: (uploadedChunks: number, totalChunks: number) => void;
};

export const uploadMessageFile = async ({
  file,
  onProgress,
  onChunkProgress,
}: UploadOptions) => {
  // ================= CREATE SESSION =================

  const startUploadResponse = await apiClient.post("/messages/upload/start", {
    clientId: file.clientId,
    fileName: file.name,
    mimeType: file.mimeType,
    fileSize: file.size,
  });

  const { uploadSessionId, uploadedChunks } = startUploadResponse.data;

  // ================= FILE INFO =================

  const fileInfo = await FileSystem.getInfoAsync(file.uri);

  if (!fileInfo.exists) {
    throw new Error("File does not exist");
  }
  let base64File = await FileSystem.readAsStringAsync(file.uri, {
    encoding: "base64",
  });
  const totalChunks = Math.ceil(base64File.length / CHUNK_SIZE);

  let uploadedBytes = 0;

  //Generate aes key
  const aesKey = await generateMediaKey();

  const encryptedKeyData = await encryptMediaKey(aesKey);
  // Read file
  // let base64File = await FileSystem.readAsStringAsync(file.uri, {
  //   encoding: "base64",
  // });

  // ================= CHUNK LOOP =================

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    if (uploadedChunks.includes(chunkIndex)) {
      uploadedBytes += CHUNK_SIZE;

      const recoveredProgress = Math.min(
        Math.round((uploadedBytes * 100) / file.size),
        100,
      );

      onProgress?.(recoveredProgress);

      onChunkProgress?.(chunkIndex + 1, totalChunks);

      continue;
    }

    const start = chunkIndex * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, base64File.length);

    const rawChunk = base64File.slice(start, end);
    const encryptedChunkData = await encryptChunk({
      chunkBase64: rawChunk,
      aesKey,
    });

    await apiClient.post("/messages/upload/chunk", {
      uploadSessionId,
      chunkIndex,
      totalChunks,
      chunk: encryptedChunkData.encryptedChunk,
      iv: encryptedChunkData.iv,
      // authTag: encryptedChunkData.authTag,
    });
    uploadedBytes += end - start;

    const overallProgress = Math.round(
      (uploadedBytes * 100) / base64File.length,
    );

    onProgress?.(overallProgress);
    onChunkProgress?.(chunkIndex + 1, totalChunks);
  }
  // ================= FINALIZE =================

  const finalizeResponse = await apiClient.post("/messages/upload/complete", {
    uploadSessionId,
  });
  base64File = ""; // Clear from memory
  await deleteFileIfExists(file.uri);

  return {
    ...finalizeResponse.data,
    encryptedMediaKey: encryptedKeyData.encryptedKey,
    mediaKeyIV: encryptedKeyData.keyIV,
    // mediaKeyAuthTag: encryptedKeyData.keyAuthTag,
    mediaIV: null,
    // mediaAuthTag: null,
    isMediaEncrypted: true,
  };
};

export const uploadThumbnail = async (thumbnailUri: string) => {
  // ================= FILE INFO =================

  const fileInfo = await FileSystem.getInfoAsync(thumbnailUri);

  const base64 = await FileSystem.readAsStringAsync(thumbnailUri, {
    encoding: "base64",
  });

  if (!fileInfo.exists) {
    throw new Error("Thumbnail does not exist");
  }

  const thumbnailSize = "size" in fileInfo ? fileInfo.size : 0;

  // ================= START SESSION =================

  const startResponse = await apiClient.post("/messages/upload/start", {
    uploadType: "THUMBNAIL",
    fileName: `thumb-${Date.now()}.png`,
    mimeType: "image/png",
    fileSize: thumbnailSize,
    clientId: `thumb-${Date.now()}`,
  });

  const { uploadSessionId, uploadedChunks } = startResponse.data;

  // ================= READ FILE =================

  let base64File = await FileSystem.readAsStringAsync(thumbnailUri, {
    encoding: "base64",
  });
  const totalChunks = Math.ceil(base64File.length / CHUNK_SIZE);

  // ================= CHUNK LOOP =================

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

  // ================= COMPLETE =================

  const completeResponse = await apiClient.post("/messages/upload/complete", {
    uploadSessionId,
  });
  base64File = "";
  await deleteFileIfExists(thumbnailUri);
  return completeResponse.data;
};
