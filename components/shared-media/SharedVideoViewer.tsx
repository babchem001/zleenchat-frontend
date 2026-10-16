import React, { useEffect, useState, useRef } from "react";
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Dimensions,
} from "react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";

import { VideoView, useVideoPlayer } from "expo-video";

import { SharedMediaItem } from "@/src/services/chat/sharedMediaService";
import SharedVideoPage from "./SharedVideoPage";
import useSharedVideoGallery from "@/hooks/useSharedVideoGallery";

type Props = {
  visible: boolean;
  videos: SharedMediaItem[];
  initialIndex: number;
  onClose: () => void;
  onIndexChange?: (index: number) => void;
};

export default function SharedVideoViewer({
  visible,
  videos,
  initialIndex,
  onClose,
  onIndexChange,
}: Props) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const { sources, loading } = useSharedVideoGallery(videos, currentIndex);
  const insets = useSafeAreaInsets();

  const { width, height } = Dimensions.get("window");
  const listRef = useRef<any>(null);
  useEffect(() => {
    if (!visible) {
      return;
    }

    if (initialIndex >= 0) {
      setCurrentIndex(initialIndex);
    }
  }, [visible, initialIndex]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({
        index: currentIndex,
        animated: false,
      });
    });
  }, [visible, currentIndex]);

  const currentVideo = videos[currentIndex];

  const senderName = currentVideo?.sender?.profile?.username ?? "Unknown";

  const sentAt = currentVideo?.createdAt
    ? new Date(currentVideo.createdAt)
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
  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFFFFF" />
        </View>
      ) : (
        <View style={styles.container}>
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
                {senderName}
              </Text>

              <Text style={styles.date}>
                {formattedDate} • {formattedTime}
              </Text>
            </View>

            <View style={styles.actions}>
              <TouchableOpacity style={styles.toolbarButton}>
                <Ionicons
                  name="share-social-outline"
                  size={20}
                  color="#FFFFFF"
                />
              </TouchableOpacity>

              <TouchableOpacity style={styles.toolbarButton}>
                <Ionicons name="download-outline" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>

          <FlashList
            ref={listRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            data={sources}
            // estimatedItemSize={width}
            extraData={currentIndex}
            initialScrollIndex={initialIndex}
            keyExtractor={(_, index) => index.toString()}
            onMomentumScrollEnd={(event) => {
              const nextIndex = Math.round(
                event.nativeEvent.contentOffset.x / width,
              );

              if (nextIndex !== currentIndex) {
                setCurrentIndex(nextIndex);
                onIndexChange?.(nextIndex);
              }
            }}
            renderItem={({ item, index }) => (
              <View
                style={{
                  width,
                  height,
                }}
              >
                {item.uri ? (
                  <SharedVideoPage
                    uri={item.uri}
                    active={index === currentIndex}
                  />
                ) : (
                  <View style={[styles.videoPage, styles.loadingContainer]}>
                    <ActivityIndicator size="large" color="#FFFFFF" />
                  </View>
                )}
              </View>
            )}
          />

          <View style={styles.counter}>
            <Text style={styles.counterText}>
              {currentIndex + 1} / {videos.length}
            </Text>
          </View>
        </View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },

  loadingContainer: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },

  video: {
    flex: 1,
  },

  toolbar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,

    zIndex: 20,

    flexDirection: "row",
    alignItems: "center",

    paddingHorizontal: 18,
    paddingBottom: 16,

    backgroundColor: "rgba(11,21,69,0.52)",
  },

  toolbarButton: {
    width: 46,
    height: 46,
    borderRadius: 23,

    justifyContent: "center",
    alignItems: "center",

    backgroundColor: "rgba(255,255,255,0.14)",
  },

  titleContainer: {
    flex: 1,
    marginHorizontal: 16,
  },

  sender: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "700",
  },

  date: {
    marginTop: 3,
    color: "rgba(255,255,255,0.75)",
    fontSize: 13,
  },

  actions: {
    flexDirection: "row",
    gap: 10,
  },

  counter: {
    position: "absolute",
    top: 92,
    alignSelf: "center",

    paddingHorizontal: 14,
    paddingVertical: 7,

    borderRadius: 18,

    backgroundColor: "rgba(11,21,69,0.60)",
  },

  counterText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },

  bottomBar: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 26,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 24,
    backgroundColor: "rgba(11,21,69,0.55)",
  },

  controlButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
  },

  timeLabel: {
    width: 46,
    textAlign: "center",
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },

  sliderPlaceholder: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    marginHorizontal: 10,
    backgroundColor: "rgba(255,255,255,0.20)",
  },

  sliderProgress: {
    height: 4,
    borderRadius: 2,
    backgroundColor: "#2563EB",
  },

  videoPage: {
    flex: 1,
  },
});
