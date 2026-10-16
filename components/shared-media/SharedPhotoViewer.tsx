import React, { useEffect, useState, useCallback } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
} from "react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";
import ImageViewing from "react-native-image-viewing";
import { Ionicons } from "@expo/vector-icons";

import { SharedMediaItem } from "@/src/services/chat/sharedMediaService";
import useSharedPhotoGallery from "@/hooks/useSharedPhotoGallery";

type Props = {
  visible: boolean;
  photos: SharedMediaItem[];
  initialIndex: number;
  onClose: () => void;
  onIndexChange?: (index: number) => void;
};

export default function SharedPhotoViewer({
  visible,
  photos,
  initialIndex,
  onClose,
  onIndexChange,
}: Props) {
  const { images, loading } = useSharedPhotoGallery(photos);

  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible) {
      setCurrentIndex(initialIndex);
    }
  }, [visible, initialIndex]);

  const handleIndexChange = useCallback(
    (index: number) => {
      setCurrentIndex((previous) => {
        if (previous === index) {
          return previous;
        }

        return index;
      });

      onIndexChange?.(index);
    },
    [onIndexChange],
  );

  const currentPhoto = photos[currentIndex] ?? null;

  const senderName = currentPhoto?.sender?.profile?.username ?? "Unknown";

  const sentAt = currentPhoto?.createdAt
    ? new Date(currentPhoto.createdAt)
    : null;

  const formattedDate = sentAt
    ? sentAt.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";

  const formattedTime = sentAt
    ? sentAt.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      })
    : "";

  const HeaderComponent = useCallback(
    ({ imageIndex }: { imageIndex: number }) => {
      const photo = photos[imageIndex] ?? null;

      const username = photo?.sender?.profile?.username ?? "Unknown";

      const date = photo?.createdAt ? new Date(photo.createdAt) : null;

      const dateText = date
        ? date.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : "";

      const timeText = date
        ? date.toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
          })
        : "";

      return (
        <View
          style={[
            styles.toolbar,
            {
              paddingTop: insets.top + 12,
            },
          ]}
        >
          <TouchableOpacity style={styles.toolbarButton} onPress={onClose}>
            <Ionicons name="close" size={22} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.titleContainer}>
            <Text numberOfLines={1} style={styles.sender}>
              {username}
            </Text>

            <Text style={styles.date}>
              {dateText} • {timeText}
            </Text>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.toolbarButton}>
              <Ionicons name="share-social-outline" size={20} color="#FFFFFF" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.toolbarButton}>
              <Ionicons name="download-outline" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      );
    },
    [insets.top, onClose, photos],
  );

  const FooterComponent = useCallback(
    ({ imageIndex }: { imageIndex: number }) => {
      if (images.length === 0) {
        return null;
      }

      return (
        <View pointerEvents="none" style={styles.counter}>
          <Text style={styles.counterText}>
            {imageIndex + 1} / {images.length}
          </Text>
        </View>
      );
    },
    [images.length],
  );

  if (loading) {
    return null;
  }

  return (
    <ImageViewing
      images={images}
      imageIndex={currentIndex}
      visible={visible}
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
      backgroundColor="#000000"
      swipeToCloseEnabled
      doubleTapToZoomEnabled
      onImageIndexChange={handleIndexChange}
      HeaderComponent={HeaderComponent}
      FooterComponent={FooterComponent}
    />
  );
}

const styles = StyleSheet.create({
  toolbar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,

    flexDirection: "row",
    alignItems: "center",

    paddingHorizontal: 18,
    paddingBottom: 16,

    backgroundColor: "rgba(0,0,0,0.35)",

    zIndex: 1000,
  },

  toolbarButton: {
    width: 44,
    height: 44,

    borderRadius: 22,

    justifyContent: "center",
    alignItems: "center",

    backgroundColor: "rgba(255,255,255,0.18)",
  },

  titleContainer: {
    flex: 1,
    marginHorizontal: 16,
  },

  sender: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
  },

  date: {
    marginTop: 2,
    color: "rgba(255,255,255,0.75)",
    fontSize: 13,
  },

  actions: {
    flexDirection: "row",
    gap: 10,
  },

  counter: {
    alignSelf: "center",

    marginBottom: 40,

    paddingHorizontal: 14,
    paddingVertical: 7,

    borderRadius: 18,

    backgroundColor: "rgba(0,0,0,0.45)",
  },

  counterText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
