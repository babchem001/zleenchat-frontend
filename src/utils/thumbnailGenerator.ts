import * as ImageManipulator from "expo-image-manipulator";
import * as VideoThumbnails from "expo-video-thumbnails";
export const generateThumbnail = async ({
  uri,
  mimeType,
}: {
  uri: string;

  mimeType?: string | null;
}) => {
  // ================= IMAGE =================

  if (mimeType?.startsWith("image")) {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [
        {
          resize: {
            width: 200,
          },
        },
      ],
      {
        compress: 0.35,

        format: ImageManipulator.SaveFormat.JPEG,

        base64: false,
      },
    );

    return result.uri;
  }

  // ================= VIDEO =================

  if (mimeType?.startsWith("video")) {
    const result = await VideoThumbnails.getThumbnailAsync(uri, {
      time: 1000,
    });

    const compressed = await ImageManipulator.manipulateAsync(
      result.uri,
      [
        {
          resize: {
            width: 250,
          },
        },
      ],
      {
        compress: 0.35,

        format: ImageManipulator.SaveFormat.JPEG,
      },
    );

    return compressed.uri;
  }

  return null;
};
