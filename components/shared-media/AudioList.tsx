import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from "react-native";

import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import { Ionicons } from "@expo/vector-icons";

import { SharedMediaItem } from "@/src/services/chat/sharedMediaService";
import { decryptRemoteMedia } from "@/src/utils/mediaPipeline";
import { useMediaCacheStore } from "@/src/store/chat/mediaCacheStore";
import { API_BASE_URL } from "@/src/services/api/apiClient";
import { formatDuration } from "@/src/utils/sharedMediaHelpers";

import SharedMediaSectionList from "./SharedMediaSectionList";
import { groupingSharedMedia } from "@/src/utils/groupingSharedMedia";
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

export default function AudioList({
  items,
  refreshing,
  onRefresh,
  selectionMode,
  selectedItems,
  onEnterSelectionMode,
  onToggleSelection,
}: Props) {
  const sections = useMemo(() => groupingSharedMedia(items), [items]);

  /**
   * Only pass the boolean selection state to each row.
   *
   * This prevents every row from needing to know about the
   * entire selectedItems Set.
   */
  const renderItem = useCallback(
    (item: SharedMediaItem) => (
      <AudioRow
        item={item}
        selectionMode={selectionMode}
        selected={selectedItems.has(item.id)}
        onEnterSelectionMode={onEnterSelectionMode}
        onToggleSelection={onToggleSelection}
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

type AudioRowProps = {
  item: SharedMediaItem;

  selectionMode: boolean;
  selected: boolean;

  onEnterSelectionMode: (id: number) => void;
  onToggleSelection: (id: number) => void;
};

/**
 * Memoized audio row.
 *
 * When selection changes for another item, this row can skip
 * rendering as long as its own props remain unchanged.
 */
const AudioRow = React.memo(function AudioRow({
  item,
  selectionMode,
  selected,
  onEnterSelectionMode,
  onToggleSelection,
}: AudioRowProps) {
  const getCachedMedia = useMediaCacheStore((state) => state.getCachedMedia);

  const [decryptedUri, setDecryptedUri] = useState<string | null>(null);

  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);

  const { scale, opacity } = useSelectionAnimation(selected);

  const displayUri = item.isMediaEncrypted
    ? decryptedUri
    : item.mediaUrl
      ? `${API_BASE_URL}${item.mediaUrl}`
      : null;

  /**
   * Decrypt encrypted audio when necessary.
   *
   * Cached media is used first to avoid unnecessary decryption.
   */
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
        console.log("Audio decrypt error:", error);
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

  /**
   * Release the audio resource when the row unmounts.
   */
  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync().catch(() => {});
      }
    };
  }, [sound]);

  /**
   * Play / pause the audio.
   */
  const playPause = useCallback(async () => {
    try {
      let playableUri = displayUri;

      /**
       * Encrypted media may need to be decrypted on demand.
       */
      if (item.isMediaEncrypted) {
        const info = playableUri
          ? await FileSystem.getInfoAsync(playableUri)
          : { exists: false };

        if (!info.exists) {
          const decrypted = await decryptRemoteMedia({
            mediaUrl: item.mediaUrl!,
            encryptedMediaKey: item.encryptedMediaKey!,
            mediaKeyIV: item.mediaKeyIV!,
            mediaKeyAuthTag: item.mediaKeyAuthTag,
            mimeType: item.mimeType,
            fileName: item.fileName,
          });

          playableUri = decrypted;

          setDecryptedUri(decrypted);
        }
      }

      if (!playableUri) {
        return;
      }

      /**
       * First playback: create the Audio.Sound instance.
       */
      if (!sound) {
        const { sound: newSound } = await Audio.Sound.createAsync(
          {
            uri: playableUri,
          },
          {
            shouldPlay: true,
          },
        );

        newSound.setOnPlaybackStatusUpdate((status) => {
          if (!status.isLoaded) {
            return;
          }

          setPosition(status.positionMillis);

          if (status.didJustFinish) {
            setIsPlaying(false);
            setPosition(0);
          }
        });

        setSound(newSound);
        setIsPlaying(true);

        return;
      }

      /**
       * Existing sound: toggle playback.
       */
      const status = await sound.getStatusAsync();

      if (!status.isLoaded) {
        return;
      }

      if (status.isPlaying) {
        await sound.pauseAsync();
        setIsPlaying(false);
      } else {
        await sound.playAsync();
        setIsPlaying(true);
      }
    } catch (error) {
      console.log("Audio playback error:", error);
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
    sound,
  ]);

  /**
   * Stable selection handlers.
   */
  const handleLongPress = useCallback(() => {
    onEnterSelectionMode(item.id);
  }, [item.id, onEnterSelectionMode]);

  const handlePress = useCallback(() => {
    if (selectionMode) {
      onToggleSelection(item.id);
      return;
    }

    playPause();
  }, [selectionMode, item.id, onToggleSelection, playPause]);

  /**
   * Format playback position.
   */
  const currentSeconds = Math.floor(position / 1000);
  const currentMinutes = Math.floor(currentSeconds / 60);
  const seconds = currentSeconds % 60;

  const playback = `${currentMinutes}:${seconds.toString().padStart(2, "0")}`;

  return (
    <View style={styles.itemContainer}>
      <TouchableOpacity
        activeOpacity={0.85}
        style={styles.card}
        onLongPress={handleLongPress}
        delayLongPress={250}
        onPress={handlePress}
      >
        <View style={styles.playButton}>
          <Ionicons
            name={isPlaying ? "pause" : "play"}
            size={18}
            color="#FFFFFF"
          />
        </View>

        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>
            {item.fileName || "Audio"}
          </Text>

          <Text style={styles.subtitle}>
            {playback} / {formatDuration(item.duration)}
          </Text>
        </View>

        <Ionicons name="musical-notes" size={20} color="#2563EB" />
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

  playButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#2563EB",
    justifyContent: "center",
    alignItems: "center",
  },

  info: {
    flex: 1,
    marginHorizontal: 14,
  },

  title: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
  },

  subtitle: {
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

    top: 8,
    right: 8,
  },
});

export { AudioRow };
