import * as FileSystem from "expo-file-system/legacy";
import { Paths } from "expo-file-system";
import { decryptChunk } from "./chunkDecryption";

export const decryptThumbnail = async ({
  encryptedThumbnailUri,
  thumbnailKey,
  thumbnailIV,
  thumbnailAuthTag,
  mimeType,
}: {
  encryptedThumbnailUri: string;
  thumbnailKey: string;
  thumbnailIV: string;
  thumbnailAuthTag?: string | null;
  mimeType?: string | null;
}) => {
  try {
    const encryptedJson = await FileSystem.readAsStringAsync(
      encryptedThumbnailUri,
    );

    const encryptedData = JSON.parse(encryptedJson);

    let decryptedBase64 = await decryptChunk({
      encryptedChunk: encryptedData.encryptedChunk,
      aesKey: thumbnailKey,
      iv: thumbnailIV,
    });

    const extension = mimeType?.split("/")[1] || "jpg";
    const outputPath = `${Paths.cache.uri}decrypted-thumb-${Date.now()}.${extension}`;

    await FileSystem.writeAsStringAsync(outputPath, decryptedBase64, {
      encoding: "base64",
    });

    // Clear plaintext reference.
    decryptedBase64 = "";

    return outputPath;
  } catch (error) {
    console.log("Thumbnail decrypt error:", error);
    throw error;
  }
};
