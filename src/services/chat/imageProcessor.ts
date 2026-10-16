import { extractImageMetadata } from "./mediaMetadata";
import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystem from "expo-file-system/legacy";

export const processImage = async (imageUri: string) => {
  const originalInfo = await FileSystem.getInfoAsync(imageUri);

  const originalSize =
    originalInfo.exists && "size" in originalInfo ? originalInfo.size : 0;

  const TWO_MB = 2 * 1024 * 1024;

  // ================= SMALL IMAGE =================

  if (originalSize < TWO_MB) {
    const metadata = await extractImageMetadata(imageUri);

    return {
      compressedUri: imageUri,
      compressedSize: originalSize,
      compressionLevel: "NONE" as const,
      compressionSavedBytes: 0,
      thumbnailUri: imageUri,
      thumbnailSize: originalSize,
      width: metadata.width,
      height: metadata.height,
      originalFileSize: originalSize,
      orientation: metadata.orientation,
    };
  }

  // ================= COMPRESS IMAGE =================

  const processedImage = await ImageManipulator.manipulateAsync(
    imageUri,
    [
      {
        resize: {
          width: 1920,
        },
      },
    ],
    {
      compress: 0.75,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: false,
    },
  );

  // ================= GENERATE THUMBNAIL =================

  const thumbnail = await ImageManipulator.manipulateAsync(
    imageUri,
    [
      {
        resize: {
          width: 320,
        },
      },
    ],
    {
      compress: 0.6,
      format: ImageManipulator.SaveFormat.JPEG,
    },
  );

  const processedInfo = await FileSystem.getInfoAsync(processedImage.uri);

  const thumbnailInfo = await FileSystem.getInfoAsync(thumbnail.uri);

  const metadata = await extractImageMetadata(processedImage.uri);

  const compressedSize =
    processedInfo.exists && "size" in processedInfo ? processedInfo.size : 0;

  const thumbnailSize =
    thumbnailInfo.exists && "size" in thumbnailInfo ? thumbnailInfo.size : 0;

  return {
    compressedUri: processedImage.uri,

    compressedSize,

    compressionLevel: "LIGHT" as const,
    compressionSavedBytes: Math.max(0, originalSize - compressedSize),
    thumbnailUri: thumbnail.uri,
    thumbnailSize,
    width: metadata.width,
    height: metadata.height,
    orientation: metadata.orientation,
  };
};
