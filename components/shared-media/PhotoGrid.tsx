import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";

import { Ionicons } from "@expo/vector-icons";

import { SharedMediaItem } from "@/src/services/chat/sharedMediaService";
import { groupingSharedMedia } from "@/src/utils/groupingSharedMedia";

import SharedMediaSectionList from "./SharedMediaSectionList";
import EncryptedImage from "./EncryptedImage";
import SharedPhotoViewer from "./SharedPhotoViewer";
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

export default function PhotoGrid({
  items,
  refreshing,
  onRefresh,
  selectionMode,
  selectedItems,
  onEnterSelectionMode,
  onToggleSelection,
}: Props) {
  const sections = useMemo(() => groupingSharedMedia(items), [items]);

  const photos = useMemo(() => items, [items]);

  const [viewerVisible, setViewerVisible] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  /**
   * Open the photo viewer at the selected photo.
   */
  const openViewer = useCallback(
    (photoId: number) => {
      const index = photos.findIndex((photo) => photo.id === photoId);

      setSelectedIndex(index < 0 ? 0 : index);
      setViewerVisible(true);
    },
    [photos],
  );

  /**
   * Stable callback for closing the viewer.
   */
  const closeViewer = useCallback(() => {
    setViewerVisible(false);
  }, []);

  /**
   * Stable render function.
   *
   * Each row receives only the boolean selection state it needs,
   * rather than the entire Set.
   */
  const renderItem = useCallback(
    (item: SharedMediaItem) => (
      <PhotoCell
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

  const listRef = useRef(null);

  return (
    <>
      <SharedMediaSectionList
        ref={listRef}
        sections={sections}
        refreshing={refreshing}
        onRefresh={onRefresh}
        renderItem={renderItem}
        numColumns={3}
      />

      <SharedPhotoViewer
        visible={viewerVisible}
        photos={photos}
        initialIndex={selectedIndex}
        onIndexChange={setSelectedIndex}
        onClose={closeViewer}
      />
    </>
  );
}

type PhotoCellProps = {
  item: SharedMediaItem;
  selectionMode: boolean;
  selected: boolean;

  onOpenViewer: (id: number) => void;
  onEnterSelectionMode: (id: number) => void;
  onToggleSelection: (id: number) => void;
};

const PhotoCell = memo(function PhotoCell({
  item,
  selectionMode,
  selected,
  onOpenViewer,
  onEnterSelectionMode,
  onToggleSelection,
}: PhotoCellProps) {
  const { scale, opacity } = useSelectionAnimation(selected);

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
        style={styles.cell}
        onPress={handlePress}
        onLongPress={handleLongPress}
        delayLongPress={250}
      >
        <EncryptedImage item={item} style={styles.image} />
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
  cell: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#F1F5F9",
  },

  image: {
    width: "100%",
    height: "100%",
    borderRadius: 10,
  },

  itemContainer: {
    flex: 1,
    padding: 3,
  },

  selectionOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(37,99,235,0.10)",
    opacity: 0,
    borderRadius: 10,
  },

  checkmark: {
    position: "absolute",
    top: 9,
    right: 9,
  },
});
