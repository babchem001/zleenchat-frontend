import * as FileSystem from "expo-file-system/legacy";
import { Paths } from "expo-file-system";

import { decryptChunk } from "./chunkDecryption";
import { secureDeleteFile } from "../services/chat/secureDelete";
import { useMediaCacheStore } from "@/src/store/chat/mediaCacheStore";
import { API_BASE_URL } from "@/src/services/api/apiClient";
import { getToken } from "@/src/services/storage/tokenService";

type EncryptedThumbnailChunk = {
  encryptedChunk?: string;
  chunk?: string;
  iv?: string;
};

const isEncryptedThumbnailChunk = (
  value: unknown,
): value is EncryptedThumbnailChunk => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const chunk = value as EncryptedThumbnailChunk;
  return (
    typeof chunk.encryptedChunk === "string" || typeof chunk.chunk === "string"
  );
};

const parseThumbnailChunks = (
  serializedContent: string,
): EncryptedThumbnailChunk[] => {
  const content = serializedContent.trim();
  const candidates = [content];

  // Some upload handlers store the JSON thumbnail as base64 text.
  if (content && !content.startsWith("{") && !content.startsWith("[")) {
    try {
      candidates.push(global.atob(content));
    } catch {
      // The content may already be plain JSON lines.
    }
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      const values: unknown[] = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.chunks)
          ? parsed.chunks
          : [parsed];

      if (values.length > 0 && values.every(isEncryptedThumbnailChunk)) {
        return values as EncryptedThumbnailChunk[];
      }
    } catch {
      // Continue with newline-separated JSON chunks.
    }

    const lines = candidate.split(/\r?\n/).filter(Boolean);
    if (lines.length > 1) {
      try {
        const values: unknown[] = lines.map((line) => JSON.parse(line));
        if (values.every(isEncryptedThumbnailChunk)) {
          return values as EncryptedThumbnailChunk[];
        }
      } catch {
        // Try the next representation before reporting invalid thumbnail data.
      }
    }
  }

  throw new Error("Unsupported encrypted thumbnail data format");
};

export const decryptRemoteThumbnail = async ({
  thumbnailUrl,
  encryptedThumbnailKey,
  thumbnailIV,
}: {
  thumbnailUrl: string;
  encryptedThumbnailKey: string;
  thumbnailIV: string;
  thumbnailAuthTag?: string | null;
}) => {
  // ================= CACHE LOOKUP =================

  const cachedThumbnail = useMediaCacheStore
    .getState()
    .getCachedThumbnail(thumbnailUrl);

  if (cachedThumbnail) {
    return cachedThumbnail;
  }

  // ================= DOWNLOAD =================
  const downloadPath = `${Paths.cache.uri}encrypted-thumbnail-${Date.now()}.txt`;

  const remoteUri = thumbnailUrl.startsWith("http")
    ? thumbnailUrl
    : `${API_BASE_URL}${thumbnailUrl}`;

  const token = await getToken();

  if (!token) {
    throw new Error("Authentication token not found for thumbnail download");
  }

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
      `Thumbnail download failed with status ${downloadResult.status}`,
    );
  }

  let encryptedContent = await FileSystem.readAsStringAsync(downloadPath);

  try {
    await secureDeleteFile(downloadPath);
  } catch (error) {
    console.log("Encrypted thumbnail cleanup failed:", error);
  }

  // ================= OUTPUT =================

  const outputPath = `${Paths.cache.uri}thumbnail-${Date.now()}.jpg`;

  try {
    const chunks = parseThumbnailChunks(encryptedContent);
    encryptedContent = "";

    // encryptThumbnail stores the raw AES key in encryptedThumbnailKey.
    // Unlike media files, thumbnail keys are not wrapped with the master key.
    const aesKey = encryptedThumbnailKey;

    // ================= DECRYPT CHUNKS =================

    let reconstructedBase64 = "";

    for (const chunk of chunks) {
      const encryptedChunk = chunk.encryptedChunk || chunk.chunk;
      const chunkIV = chunk.iv || thumbnailIV;

      if (!encryptedChunk || !chunkIV) {
        throw new Error("Encrypted thumbnail chunk is missing its data or IV");
      }

      let decryptedChunk = await decryptChunk({
        encryptedChunk,
        aesKey,
        iv: chunkIV,
      });

      reconstructedBase64 += decryptedChunk;

      decryptedChunk = "";
    }

    // ================= WRITE FILE =================

    await FileSystem.writeAsStringAsync(outputPath, reconstructedBase64, {
      encoding: "base64",
    });

    reconstructedBase64 = "";

    // ================= CACHE SAVE =================

    useMediaCacheStore.getState().cacheThumbnail(thumbnailUrl, outputPath);

    return outputPath;
  } catch (error) {
    try {
      const fileInfo = await FileSystem.getInfoAsync(outputPath);

      if (fileInfo.exists) {
        await secureDeleteFile(outputPath);
      }
    } catch (cleanupError) {
      console.log("Thumbnail cleanup error:", cleanupError);
    }

    console.log("Thumbnail decryption error:", error);

    throw error;
  }
};
