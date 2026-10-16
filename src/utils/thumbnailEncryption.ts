import * as FileSystem from "expo-file-system/legacy";
import { Paths } from "expo-file-system";
import { encryptChunk } from "./chunkEncryption";
import { generateMediaKey } from "./mediaKeyEncryption";

export const encryptThumbnail = async ({
  thumbnailUri,
}: {
  thumbnailUri: string;
}) => {
  const aesKey = await generateMediaKey();

  let base64 = await FileSystem.readAsStringAsync(thumbnailUri, {
    encoding: "base64",
  });

  const encrypted = await encryptChunk({
    chunkBase64: base64,
    aesKey,
  });

  // Clear the plaintext base64 reference.
  base64 = "";

  const encryptedPath = `${Paths.cache.uri}thumb-${Date.now()}.enc`;

  await FileSystem.writeAsStringAsync(encryptedPath, JSON.stringify(encrypted));

  return {
    encryptedThumbnailUri: encryptedPath,
    thumbnailKey: aesKey,
    thumbnailIV: encrypted.iv,
    thumbnailAuthTag: null,
  };
};
