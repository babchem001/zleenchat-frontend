import { extractAudioMetadata } from "./mediaMetadata";
import * as FileSystem from "expo-file-system/legacy";

export const processAudio = async (
  audioUri: string,
  waveform: number[] | null = null,
) => {
  const fileInfo = await FileSystem.getInfoAsync(audioUri);
  const fileSize = fileInfo.exists && "size" in fileInfo ? fileInfo.size : 0;
  const FIVE_MB = 5 * 1024 * 1024;
  const compressionLevel: "NONE" | "LIGHT" | "AGGRESSIVE" =
    fileSize > FIVE_MB ? "LIGHT" : "NONE";

  const metadata = await extractAudioMetadata(audioUri);

  return {
    duration: metadata.duration,
    bitrate: metadata.bitrate,
    fileSize,
    waveform,
    compressionLevel,
    originalFileSize: fileSize,
    compressionSavedBytes: 0,
  };
};