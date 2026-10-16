import { extractAudioMetadata } from "./mediaMetadata";
import * as FileSystem from "expo-file-system/legacy";

export const processAudio = async (audioUri: string) => {
  const fileInfo = await FileSystem.getInfoAsync(audioUri);
  const fileSize = fileInfo.exists && "size" in fileInfo ? fileInfo.size : 0;
  const FIVE_MB = 5 * 1024 * 1024;
  let compressionLevel: "NONE" | "LIGHT" | "AGGRESSIVE" = "NONE";

  if (fileSize > FIVE_MB) {
    compressionLevel = "LIGHT";
  }
  const metadata = await extractAudioMetadata(audioUri);
  const waveform = generateWaveformData();
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
const generateWaveformData = () => {
  return Array.from({ length: 40 }, () => Math.floor(Math.random() * 100));
};
