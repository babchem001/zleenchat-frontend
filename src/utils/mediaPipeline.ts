import * as FileSystem from "expo-file-system/legacy";
import { Paths } from "expo-file-system";
import { decryptMediaKey } from "./mediaKeyEncryption";
import { decryptChunk } from "./chunkDecryption";
import { secureDeleteFile } from "../services/chat/secureDelete";
import { useMediaCacheStore } from "../store/chat/mediaCacheStore";

import { API_BASE_URL } from "@/src/services/api/apiClient";
import { getToken } from "@/src/services/storage/tokenService";

type DecryptRemoteMediaParams = {
  mediaUrl: string;
  encryptedMediaKey: string;
  mediaKeyIV: string;
  mediaKeyAuthTag?: string | null;
  mimeType?: string | null;
  fileName?: string | null;
};

export const decryptRemoteMedia = async ({
  mediaUrl,
  encryptedMediaKey,
  mediaKeyIV,
  mediaKeyAuthTag,
  mimeType,
  fileName,
}: DecryptRemoteMediaParams) => {
  // ================= CACHE =================

  const cachedMedia = useMediaCacheStore.getState().getCachedMedia(mediaUrl);

  if (cachedMedia) {
    const cacheInfo = await FileSystem.getInfoAsync(cachedMedia);
    if (cacheInfo.exists) {
      // console.log("CACHE FILE INFO", cacheInfo);
      return cachedMedia;
    }

    useMediaCacheStore.getState().removeCachedMedia(mediaUrl);
  }

  // ================= PATHS =================

  const downloadPath = `${Paths.cache.uri}encrypted-media-${Date.now()}.txt`;
  const extension = mimeType?.split("/")[1] || "bin";
  // Preserve the original filename
  const safeFileName =
    fileName && fileName.trim().length > 0
      ? decodeURIComponent(fileName)
          .replace(/[\\/:*?"<>|]/g, "_")
          .replace(/\s+/g, " ")
      : `decrypted-${Date.now()}.${extension}`;
  // Ensure it has the correct extension
  const finalFileName = safeFileName.endsWith(`.${extension}`)
    ? safeFileName
    : `${safeFileName}.${extension}`;

  const outputPath = `${Paths.cache.uri}${finalFileName}`;

  let encryptedContent = "";

  try {
    // ================= DOWNLOAD =================
    const token = await getToken();

    if (!token) {
      throw new Error("Authentication token not found for media download");
    }

    const remoteUri = mediaUrl.startsWith("http")
      ? mediaUrl
      : `${API_BASE_URL}${mediaUrl}`;

    const downloadResult = await FileSystem.downloadAsync(
      remoteUri,
      downloadPath,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (downloadResult.status !== 200) {
      throw new Error(
        `Media download failed with status ${downloadResult.status}`,
      );
    }

    encryptedContent = await FileSystem.readAsStringAsync(downloadPath);

    // ================= AES KEY =================

    const aesKey = await decryptMediaKey({
      encryptedKey: encryptedMediaKey,
      keyIV: mediaKeyIV,
      keyAuthTag: mediaKeyAuthTag || null,
    });

    // ================= CHUNK REBUILD =================

    const chunkLines = encryptedContent.split("\n").filter(Boolean);
    encryptedContent = "";
    let reconstructedBase64 = "";

    for (const line of chunkLines) {
      // console.log("PROCESSING CHUNK");
      const parsed = JSON.parse(line);

      const decryptedChunk = await decryptChunk({
        encryptedChunk: parsed.chunk,
        aesKey,
        iv: parsed.iv,
      });

      reconstructedBase64 += decryptedChunk;
    }

    const reconstructedLength = reconstructedBase64.length;

    // ================= WRITE FILE =================

    await FileSystem.writeAsStringAsync(outputPath, reconstructedBase64, {
      encoding: "base64",
    });

    reconstructedBase64 = "";

    // ================= CACHE =================

    useMediaCacheStore.getState().cacheMedia(mediaUrl, outputPath);

    return outputPath;
  } catch (error) {
    console.error("MEDIA DECRYPTION FULL ERROR:", error);
    // console.error("Media decryption error:", error);

    try {
      const fileInfo = await FileSystem.getInfoAsync(outputPath);

      if (fileInfo.exists) {
        await secureDeleteFile(outputPath);
      }
    } catch (cleanupError) {
      console.error("Failed partial decrypt cleanup:", cleanupError);
    }

    throw error;
  } finally {
    try {
      const downloadInfo = await FileSystem.getInfoAsync(downloadPath);

      if (downloadInfo.exists) {
        await secureDeleteFile(downloadPath);
      }
    } catch (cleanupError) {
      console.error("Encrypted download cleanup failed:", cleanupError);
    }
  }
};
