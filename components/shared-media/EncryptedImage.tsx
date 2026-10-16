import { ActivityIndicator, StyleProp, ImageStyle, View } from "react-native";
import { Image } from "expo-image";

import { SharedMediaItem } from "@/src/services/chat/sharedMediaService";
import useDecryptedImage from "@/hooks/useDecryptedImage";

type Props = {
  item: SharedMediaItem;
  style?: StyleProp<ImageStyle>;
};

export default function EncryptedImage({ item, style }: Props) {
  const { uri, loading } = useDecryptedImage(item);

  if (loading) {
    return (
      <View
        style={[
          style,
          {
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "#F4F4F4",
          },
        ]}
      >
        <ActivityIndicator />
      </View>
    );
  }

  if (!uri) {
    return null;
  }

  return (
    <Image
      source={{ uri }}
      style={style}
      contentFit="cover"
      transition={150}
      cachePolicy="memory-disk"
    />
  );
}
