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
  // FILE INFO: Read the local source before starting the upload session
  // so the backend knows exactly how many chunks must arrive.
  const fileInfo = await FileSystem.getInfoAsync(file.uri);

  if (!fileInfo.exists) {
    throw new Error("File does not exist");
  }

  let base64File = await FileSystem.readAsStringAsync(file.uri, {
    encoding: "base64",
  });

  const totalChunks = Math.ceil(base64File.length / CHUNK_SIZE);

  // ================= CREATE SESSION =================

  let startUploadResponse;

  try {
    startUploadResponse = await apiClient.post("/messages/upload/start", {
      clientId: file.clientId,
      fileName: file.name,
      mimeType: file.mimeType,
      fileSize: file.size,
      totalChunks,
    });
  } catch (error: any) {
    console.error("UPLOAD START REQUEST FAILED:", {
      status: error?.response?.status,
      responseData: error?.response?.data,
      message: error?.message,
      requestData: error?.config?.data,
    });

    throw error;
  }

  const { uploadSessionId, uploadedChunks } = startUploadResponse.data;

  let uploadedBytes = 0;

  // Generate AES key.
  const aesKey = await generateMediaKey();

  const encryptedKeyData = await encryptMediaKey(aesKey);

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

    try {
      await apiClient.post("/messages/upload/chunk", {
        uploadSessionId,
        chunkIndex,
        totalChunks,
        chunk: encryptedChunkData.encryptedChunk,
        iv: encryptedChunkData.iv,
      });
    } catch (error: any) {
      console.error("CHUNK UPLOAD REQUEST FAILED:", {
        status: error?.response?.status,
        responseData: error?.response?.data,
        uploadSessionId,
        chunkIndex,
        totalChunks,
        message: error?.message,
      });

      throw error;
    }

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

  base64File = ""; // Clear from memory.

  return {
    ...finalizeResponse.data,

    // Keep this so the worker knows which server-side upload
    // must be finalized after the database write succeeds.
    uploadSessionId,

    encryptedMediaKey: encryptedKeyData.encryptedKey,
    mediaKeyIV: encryptedKeyData.keyIV,
    mediaIV: null,
    isMediaEncrypted: true,
    localSourceUri: file.uri,
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

  return {
    ...completeResponse.data,
    uploadSessionId,

    // Preserve the local source until DB success.
    localSourceUri: thumbnailUri,
  };
};

export const finalizeChunkUpload = async (uploadSessionId: string) => {
  if (!uploadSessionId) {
    throw new Error("Upload session ID is required for finalization");
  }

  const response = await apiClient.post("/messages/upload/finalize", {
    uploadSessionId,
  });

  return response.data;
};
