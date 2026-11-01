import React from "react";
import ImageViewing from "react-native-image-viewing";

type Props = {
  visible: boolean;
  imageUri: string;
  imageHeaders?: Record<string, string>;
  onClose: () => void;
};

export default function ImageViewerModal({
  visible,
  imageUri,
  imageHeaders,
  onClose,
}: Props) {
  return (
    <ImageViewing
      images={[
        {
          uri: imageUri,
          ...(imageHeaders ? { headers: imageHeaders } : {}),
        },
      ]}
      imageIndex={0}
      visible={visible}
      onRequestClose={onClose}
      presentationStyle="fullScreen"
    />
  );
}
