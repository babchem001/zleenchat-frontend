import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";

import SharedMediaSectionList from "./SharedMediaSectionList";

import { groupingSharedMedia } from "@/src/utils/groupingSharedMedia";
import { SharedMediaItem } from "@/src/services/chat/sharedMediaService";
import { decryptRemoteMedia } from "@/src/utils/mediaPipeline";
import { useMediaCacheStore } from "@/src/store/chat/mediaCacheStore";
import { API_BASE_URL } from "@/src/services/api/apiClient";
import { openDocuments } from "@/src/utils/openDocuments";

import {
  formatFileSize,
  getDocumentIcon,
  getFileBadgeColor,
} from "@/src/utils/sharedMediaHelpers";
import { useSelectionAnimation } from "@/hooks/useSelectionAnimation";
import { FeedbackType } from "@/src/components/AppFeedbackModal";

type Props = {
  items: SharedMediaItem[];
  refreshing?: boolean;
  onRefresh?: () => void;

  selectionMode: boolean;
  selectedItems: Set<number>;

  onEnterSelectionMode: (id: number) => void;
  onToggleSelection: (id: number) => void;

  showFeedback: (type: FeedbackType, title: string, message: string) => void;
};

export default function FileList({
  items,
  refreshing,
  onRefresh,
  selectionMode,
  selectedItems,
  onEnterSelectionMode,
  onToggleSelection,
  showFeedback,
}: Props) {
  const sections = useMemo(() => groupingSharedMedia(items), [items]);
  const renderItem = useCallback(
    (item: SharedMediaItem) => (
      <FileRow
        item={item}
        selectionMode={selectionMode}
        selected={selectedItems.has(item.id)}
        onEnterSelectionMode={onEnterSelectionMode}
        onToggleSelection={onToggleSelection}
        showFeedback={showFeedback}
      />
    ),
    [selectionMode, selectedItems, onEnterSelectionMode, onToggleSelection],
  );

  return (
    <SharedMediaSectionList
      sections={sections}
      refreshing={refreshing}
      onRefresh={onRefresh}
      renderItem={renderItem}
    />
  );
}

type FileRowProps = {
  item: SharedMediaItem;

  selectionMode: boolean;
  selected: boolean;

  onEnterSelectionMode: (id: number) => void;
  onToggleSelection: (id: number) => void;
  showFeedback: (type: FeedbackType, title: string, message: string) => void;
};

const FileRow = React.memo(function FileRow({
  item,
  selectionMode,
  selected,
  onEnterSelectionMode,
  onToggleSelection,
  showFeedback,
}: FileRowProps) {
  const getCachedMedia = useMediaCacheStore((state) => state.getCachedMedia);

  const [decryptedUri, setDecryptedUri] = useState<string | null>(null);

  const { scale, opacity } = useSelectionAnimation(selected);

  const displayUri = item.isMediaEncrypted
    ? decryptedUri
    : item.mediaUrl
      ? `${API_BASE_URL}${item.mediaUrl}`
      : null;

  useEffect(() => {
    let mounted = true;

    const decrypt = async () => {
      if (
        !item.isMediaEncrypted ||
        !item.mediaUrl ||
        !item.encryptedMediaKey ||
        !item.mediaKeyIV
      ) {
        return;
      }

      try {
        const cached = getCachedMedia(item.mediaUrl);

        if (cached) {
          if (mounted) {
            setDecryptedUri(cached);
          }

          return;
        }

        const decrypted = await decryptRemoteMedia({
          mediaUrl: item.mediaUrl,
          encryptedMediaKey: item.encryptedMediaKey,
          mediaKeyIV: item.mediaKeyIV,
          mediaKeyAuthTag: item.mediaKeyAuthTag,
          mimeType: item.mimeType,
          fileName: item.fileName,
        });

        if (mounted) {
          setDecryptedUri(decrypted);
        }
      } catch (error) {
        console.log("Document decrypt error:", error);
      }
    };

    decrypt();

    return () => {
      mounted = false;
    };
  }, [
    item.isMediaEncrypted,
    item.mediaUrl,
    item.encryptedMediaKey,
    item.mediaKeyIV,
    item.mediaKeyAuthTag,
    item.mimeType,
    item.fileName,
    getCachedMedia,
  ]);

  const openDocument = useCallback(async () => {
    try {
      let path = displayUri;

      if (item.isMediaEncrypted) {
        const info = path
          ? await FileSystem.getInfoAsync(path)
          : { exists: false };

        if (!info.exists) {
          if (!item.mediaUrl || !item.encryptedMediaKey || !item.mediaKeyIV) {
            return;
          }

          const decrypted = await decryptRemoteMedia({
            mediaUrl: item.mediaUrl,
            encryptedMediaKey: item.encryptedMediaKey,
            mediaKeyIV: item.mediaKeyIV,
            mediaKeyAuthTag: item.mediaKeyAuthTag,
            mimeType: item.mimeType,
            fileName: item.fileName,
          });

          setDecryptedUri(decrypted);

          path = decrypted;
        }
      }

      if (!path) {
        return;
      }

      await openDocuments(path, showFeedback);
    } catch (error) {
      console.log("Open document error:", error);
    }
  }, [
    displayUri,
    item.isMediaEncrypted,
    item.mediaUrl,
    item.encryptedMediaKey,
    item.mediaKeyIV,
    item.mediaKeyAuthTag,
    item.mimeType,
    item.fileName,
    showFeedback,
  ]);

  const handlePress = useCallback(() => {
    if (selectionMode) {
      onToggleSelection(item.id);
      return;
    }

    openDocument();
  }, [selectionMode, item.id, onToggleSelection, openDocument]);

  const handleLongPress = useCallback(() => {
    onEnterSelectionMode(item.id);
  }, [item.id, onEnterSelectionMode]);

  const extension = useMemo(
    () => item.fileName?.split(".").pop()?.toUpperCase() ?? "FILE",
    [item.fileName],
  );

  const badgeColor = useMemo(() => getFileBadgeColor(extension), [extension]);

  const documentIcon = useMemo(() => getDocumentIcon(extension), [extension]);

  return (
    <View style={styles.itemContainer}>
      <TouchableOpacity
        activeOpacity={0.85}
        style={styles.card}
        onLongPress={handleLongPress}
        delayLongPress={250}
        onPress={handlePress}
      >
        <View
          style={[
            styles.badge,
            {
              backgroundColor: badgeColor,
            },
          ]}
        >
          <Ionicons name={documentIcon as any} size={22} color="#FFFFFF" />
        </View>

        <View style={styles.info}>
          <Text numberOfLines={1} style={styles.fileName}>
            {item.fileName}
          </Text>

          <Text style={styles.meta}>
            {formatFileSize(item.fileSize)} • {extension}
          </Text>
        </View>

        <Ionicons name="chevron-forward" size={22} color="#9CA3AF" />
      </TouchableOpacity>

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
  container: {
    padding: 12,
    paddingBottom: 24,
  },

  card: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 62,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 12,
    marginBottom: 7,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  badge: {
    width: 40,
    height: 40,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
  },

  info: {
    flex: 1,
    marginHorizontal: 14,
  },

  fileName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
  },

  meta: {
    marginTop: 4,
    fontSize: 13,
    color: "#6B7280",
  },

  itemContainer: {
    position: "relative",
  },

  selectionOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(37,99,235,0.10)",
    borderRadius: 14,
    opacity: 0,
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
