import * as FileSystem from "expo-file-system/legacy";
import { secureDeleteFile } from "./secureDelete";
const CLEANUP_PREFIXES = [
  "encrypted-media-",
  "decrypted-",
  "thumb-",
  "encrypted-thumb-",
];

export const deleteFileIfExists = async (uri: string | null) => {
  if (!uri) return;

  try {
    const fileInfo = await FileSystem.getInfoAsync(uri);
    if (fileInfo.exists) {
      await secureDeleteFile(uri);
    }
  } catch (error) {
    console.error("Cleanup error:", error);
  }
};

export const cleanupTempDirectory = async () => {
  try {
    const tempDirectory =
      FileSystem.cacheDirectory || FileSystem.documentDirectory;

    if (!tempDirectory) return;

    const files = await FileSystem.readDirectoryAsync(tempDirectory);
    for (const file of files) {
      const shouldDelete = CLEANUP_PREFIXES.some((prefix) =>
        file.startsWith(prefix),
      );
      if (!shouldDelete) {
        continue;
      }
      await secureDeleteFile(`${tempDirectory}${file}`);
    }
  } catch (error) {
    console.log("Temp cleanup error:", error);
  }
};

export const cleanupOldFiles = async (hours = 24) => {
  try {
    const tempDirectory =
      FileSystem.cacheDirectory || FileSystem.documentDirectory;

    if (!tempDirectory) return;

    const files = await FileSystem.readDirectoryAsync(tempDirectory);
    const now = Date.now();
    for (const file of files) {
      const shouldDelete = CLEANUP_PREFIXES.some((prefix) =>
        file.startsWith(prefix),
      );
      if (!shouldDelete) {
        continue;
      }
      const filePath = `${tempDirectory}${file}`;
      const info = await FileSystem.getInfoAsync(filePath);
      if (!info.exists || info.isDirectory) {
        continue;
      }
      const modificationTime = info.modificationTime || 0;
      const ageHours = (now - modificationTime * 1000) / (1000 * 60 * 60);
      if (ageHours > hours) {
        await secureDeleteFile(filePath);
        console.log(`Deleted stale file: ${file}`);
      }
    }
  } catch (error) {
    console.error("Stale cleanup error:", error);
  }
};
