import React from "react";
import ImageViewing from "react-native-image-viewing";

type Props = {
  visible: boolean;
  imageUri: string;
  onClose: () => void;
};
export default function ImageViewerModal({
  visible,
  imageUri,
  onClose,
}: Props) {
  return (
    <ImageViewing
      images={[
        {
          uri: imageUri,
        },
      ]}
      imageIndex={0}
      visible={visible}
      onRequestClose={onClose}
      presentationStyle="fullScreen"
    />
  );
}