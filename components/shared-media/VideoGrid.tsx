import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Image, Pressable, StyleSheet, View, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { SharedMediaItem } from "@/src/services/chat/sharedMediaService";
import { groupingSharedMedia } from "@/src/utils/groupingSharedMedia";
import { getAuthenticatedMediaSource } from "@/src/utils/mediaReference";

import SharedMediaSectionList from "./SharedMediaSectionList";
import SharedVideoViewer from "./SharedVideoViewer";
import { useSelectionAnimation } from "@/hooks/useSelectionAnimation";

type Props = {
  items: SharedMediaItem[];
  refreshing?: boolean;
  onRefresh?: () => void;

  selectionMode: boolean;
  selectedItems: Set<number>;

  onEnterSelectionMode: (id: number) => void;
  onToggleSelection: (id: number) => void;
};

export default function VideoGrid({
  items,
  refreshing,
  onRefresh,
  selectionMode,
  selectedItems,
  onEnterSelectionMode,
  onToggleSelection,
}: Props) {
  const sections = useMemo(() => groupingSharedMedia(items), [items]);

  const [viewerVisible, setViewerVisible] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const videos = items;

  const openViewer = useCallback(
    (itemId: number) => {
      const index = videos.findIndex((video) => video.id === itemId);

      if (index < 0) {
        return;
      }

      setSelectedIndex(index);
      setViewerVisible(true);
    },
    [videos],
  );

  const closeViewer = useCallback(() => {
    setViewerVisible(false);
  }, []);

  const renderItem = useCallback(
    (item: SharedMediaItem) => (
      <VideoCell
        item={item}
        selectionMode={selectionMode}
        selected={selectedItems.has(item.id)}
        onOpenViewer={openViewer}
        onEnterSelectionMode={onEnterSelectionMode}
        onToggleSelection={onToggleSelection}
      />
    ),
    [
      selectionMode,
      selectedItems,
      openViewer,
      onEnterSelectionMode,
      onToggleSelection,
    ],
  );

  return (
    <>
      <SharedMediaSectionList
        sections={sections}
        refreshing={refreshing}
        onRefresh={onRefresh}
        renderItem={renderItem}
        numColumns={3}
      />

      <SharedVideoViewer
        visible={viewerVisible}
        videos={videos}
        initialIndex={selectedIndex}
        onClose={closeViewer}
        onIndexChange={setSelectedIndex}
      />
    </>
  );
}

type VideoCellProps = {
  item: SharedMediaItem;
  selectionMode: boolean;
  selected: boolean;

  onOpenViewer: (id: number) => void;
  onEnterSelectionMode: (id: number) => void;
  onToggleSelection: (id: number) => void;
};

const VideoCell = memo(function VideoCell({
  item,
  selectionMode,
  selected,
  onOpenViewer,
  onEnterSelectionMode,
  onToggleSelection,
}: VideoCellProps) {
  const { scale, opacity } = useSelectionAnimation(selected);

  const [thumbnailSource, setThumbnailSource] = useState<{
    uri: string;
    headers?: Record<string, string>;
  } | null>(null);

  const [thumbnailError, setThumbnailError] = useState(false);

  /**
   * PHASE E — STEP 5
   *
   * Resolve the video's thumbnail/media reference through the
   * authenticated backend media endpoint.
   *
   * The backend now treats R2 message media as private, so the
   * Authorization header must be attached to the request.
   *
   * Prefer thumbnailUrl when available. Fall back to mediaUrl for
   * older/shared-media records that do not have a separate thumbnail.
   */
  useEffect(() => {
    let mounted = true;

    const resolveThumbnail = async () => {
      const reference = item.thumbnailUrl ?? item.mediaUrl;

      if (!reference) {
        if (mounted) {
          setThumbnailSource(null);
          setThumbnailError(true);
        }

        return;
      }

      try {
        setThumbnailError(false);

        const source = await getAuthenticatedMediaSource(reference);

        if (mounted) {
          setThumbnailSource(source);
        }
      } catch (error) {
        console.log("VIDEO GRID THUMBNAIL SOURCE ERROR:", error);

        if (mounted) {
          setThumbnailSource(null);
          setThumbnailError(true);
        }
      }
    };

    resolveThumbnail();

    return () => {
      mounted = false;
    };
  }, [item.thumbnailUrl, item.mediaUrl]);

  const handlePress = useCallback(() => {
    if (selectionMode) {
      onToggleSelection(item.id);
      return;
    }

    onOpenViewer(item.id);
  }, [selectionMode, item.id, onToggleSelection, onOpenViewer]);

  const handleLongPress = useCallback(() => {
    onEnterSelectionMode(item.id);
  }, [item.id, onEnterSelectionMode]);

  return (
    <View style={styles.itemContainer}>
      <Pressable
        style={styles.card}
        onPress={handlePress}
        onLongPress={handleLongPress}
        delayLongPress={250}
      >
        {thumbnailSource && !thumbnailError ? (
          <Image
            source={thumbnailSource}
            style={styles.thumbnail}
            resizeMode="cover"
            onError={() => {
              setThumbnailError(true);
            }}
          />
        ) : (
          <View style={styles.thumbnailFallback}>
            <Ionicons name="videocam-outline" size={34} color="#64748B" />
          </View>
        )}

        <View style={styles.overlay}>
          <Ionicons name="play-circle" size={34} color="#FFFFFF" />
        </View>
      </Pressable>

      {selectionMode && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.selectionOverlay,
            {
              opacity: selected ? 1 : 0,
            },
          ]}
        />
      )}

      {selectionMode && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.checkmark,
            {
              opacity,
              transform: [{ scale }],
            },
          ]}
        >
          <Ionicons name="checkmark-circle" size={28} color="#2563EB" />
        </Animated.View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  itemContainer: {
    flex: 1,
    padding: 3,
  },

  card: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#F1F5F9",
  },

  thumbnail: {
    width: "100%",
    height: "100%",
  },

  thumbnailFallback: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#E2E8F0",
  },

  overlay: {
    ...StyleSheet.absoluteFillObject,

    justifyContent: "center",
    alignItems: "center",

    backgroundColor: "rgba(0,0,0,0.16)",
  },

  selectionOverlay: {
    ...StyleSheet.absoluteFillObject,

    backgroundColor: "rgba(37,99,235,0.10)",

    opacity: 0,

    borderRadius: 12,
  },

  selectionOverlayActive: {
    opacity: 1,
  },

  checkmark: {
    position: "absolute",
    top: 10,
    right: 10,
  },
});
