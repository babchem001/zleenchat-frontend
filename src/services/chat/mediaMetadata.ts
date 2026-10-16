import * as FileSystem from "expo-file-system/legacy";
import { Audio } from "expo-av";
import * as VideoThumbnails from "expo-video-thumbnails";
import * as ImageManipulator from "expo-image-manipulator";

export const extractImageMetadata = async (uri: string) => {
  const imageInfo = await ImageManipulator.manipulateAsync(uri, []);
  const fileInfo = await FileSystem.getInfoAsync(uri);
  let orientation: "portrait" | "landscape" | "square" = "square";
  if (imageInfo.width > imageInfo.height) {
    orientation = "landscape";
  } else if (imageInfo.height > imageInfo.width) {
    orientation = "portrait";
  }
  return {
    width: imageInfo.width,
    height: imageInfo.height,
    orientation,
    fileSize: fileInfo.exists && "size" in fileInfo ? fileInfo.size : null,
  };
};

export const extractVideoMetadata = async (uri: string) => {
  const thumbnail = await VideoThumbnails.getThumbnailAsync(uri, {
    time: 1000,
  });
  const thumbInfo = await FileSystem.getInfoAsync(thumbnail.uri);
  const imageInfo = await ImageManipulator.manipulateAsync(thumbnail.uri, []);

  let orientation: "portrait" | "landscape" | "square" = "square";
  if (imageInfo.width > imageInfo.height) {
    orientation = "landscape";
  } else if (imageInfo.height > imageInfo.width) {
    orientation = "portrait";
  }
  return {
    width: imageInfo.width,
    height: imageInfo.height,
    orientation,

    thumbnailSize:
      thumbInfo.exists && "size" in thumbInfo ? thumbInfo.size : null,
  };
};

export const extractAudioMetadata = async (uri: string) => {
  const sound = new Audio.Sound();
  try {
    await sound.loadAsync({
      uri,
    });
    const status = await sound.getStatusAsync();
    const fileInfo = await FileSystem.getInfoAsync(uri);
    const duration = status.isLoaded ? status.durationMillis || 0 : 0;

    const bitrate =
      fileInfo.exists && "size" in fileInfo && duration > 0
        ? Math.round(((fileInfo.size * 8) / duration) * 1000)
        : null;

    return {
      duration,
      bitrate,
    };
  } finally {
    await sound.unloadAsync();
  }
};
