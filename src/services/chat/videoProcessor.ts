import { extractVideoMetadata } from "./mediaMetadata";
import * as VideoThumbnails from "expo-video-thumbnails";
import * as FileSystem from "expo-file-system/legacy";

export const processVideo = async (videoUri: string) => {
  try {
    const thumbnail = await VideoThumbnails.getThumbnailAsync(videoUri, {
      time: 1000,
    });
    const TEN_MB = 10 * 1024 * 1024;
    const metadata = await extractVideoMetadata(videoUri);
    const videoInfo = await FileSystem.getInfoAsync(videoUri);
    const originalSize =
      videoInfo.exists && "size" in videoInfo ? videoInfo.size : 0;

    let compressionLevel: "NONE" | "LIGHT" | "AGGRESSIVE" = "NONE";
    if (originalSize > 50 * 1024 * 1024) {
      compressionLevel = "AGGRESSIVE";
    } else if (originalSize > TEN_MB) {
      compressionLevel = "LIGHT";
    }

    const thumbnailInfo = await FileSystem.getInfoAsync(thumbnail.uri);
    return {
      compressedUri: videoUri,
      compressedSize:
        videoInfo.exists && "size" in videoInfo ? videoInfo.size : null,

      thumbnailUri: thumbnail.uri,

      thumbnailSize:
        thumbnailInfo.exists && "size" in thumbnailInfo
          ? thumbnailInfo.size
          : null,

      width: metadata.width,
      height: metadata.height,
      // duration: metadata.duration,
      orientation: metadata.orientation,

      compressionLevel,
      originalFileSize: originalSize,
      compressionSavedBytes: 0,
    };
  } catch (error) {
    console.log("Video processing error:", error);
    throw error;
  }
};
