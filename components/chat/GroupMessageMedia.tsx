import { API_BASE_URL } from "@/src/services/api/apiClient";
import React, { useEffect, useState } from "react";
import { Audio } from "expo-av";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import { Image } from "expo-image";

import { Message } from "@/src/types/chat.types";
import { decryptRemoteMedia } from "@/src/utils/mediaPipeline";
import { useMediaCacheStore } from "@/src/store/chat/mediaCacheStore";
import ImageViewerModal from "../media/ImageViewerModal";
import VideoViewerModal from "../media/VideoViewerModal";
import { openDocuments } from "@/src/utils/openDocuments";
import { FeedbackType } from "@/src/components/AppFeedbackModal";

type Props = {
  message: Message;
  selectionMode?: boolean;
  onSelect?: () => void;
  showFeedback?: (type: FeedbackType, title: string, message: string) => void;
};

const GroupMessageMedia: React.FC<Props> = ({
  message,
  selectionMode = false,
  onSelect,
  showFeedback,
}) => {
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [showVideoViewer, setShowVideoViewer] = useState(false);
  const [decryptedUri, setDecryptedUri] = useState<string | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [thumbnailLoading, setThumbnailLoading] = useState(true);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);

  const MEDIA_WIDTH = 238;
  const MEDIA_HEIGHT = 190;

  const AUDIO_WIDTH = 248;
  const DOCUMENT_WIDTH = 270;

  const getCachedMedia = useMediaCacheStore((state) => state.getCachedMedia);

  const mediaUrl = message.mediaUrl
    ? `${API_BASE_URL}${message.mediaUrl}`
    : null;

  const displayMedia =
    message.uploadStatus === "UPLOADING" || message.uploadStatus === "FAILED"
      ? message.localUri
      : message.isMediaEncrypted
        ? decryptedUri
        : mediaUrl;

  useEffect(() => {
    let mounted = true;

    const decryptMedia = async () => {
      if (
        !message.isMediaEncrypted ||
        !message.mediaUrl ||
        !message.encryptedMediaKey ||
        !message.mediaKeyIV
      ) {
        return;
      }

      // Preserve existing behavior:
      // encrypted video is decrypted when the viewer is opened.
      if (message.contentType === "VIDEO" && !showVideoViewer) {
        return;
      }

      try {
        const cachedMedia = getCachedMedia(message.mediaUrl);

        if (cachedMedia) {
          if (mounted) {
            setDecryptedUri(cachedMedia);
          }

          return;
        }

        setIsDecrypting(true);

        const decrypted = await decryptRemoteMedia({
          mediaUrl: message.mediaUrl,
          encryptedMediaKey: message.encryptedMediaKey,
          mediaKeyIV: message.mediaKeyIV,
          mediaKeyAuthTag: message.mediaKeyAuthTag,
          mimeType: message.mimeType,
          fileName: message.fileName,
        });

        if (mounted) {
          setDecryptedUri(decrypted);
        }
      } catch (error) {
        console.error("GROUP MEDIA DECRYPTION ERROR:", error);
      } finally {
        if (mounted) {
          setIsDecrypting(false);
        }
      }
    };

    decryptMedia();

    return () => {
      mounted = false;
    };
  }, [
    message.id,
    message.mediaUrl,
    message.encryptedMediaKey,
    message.mediaKeyIV,
    message.contentType,
    getCachedMedia,
    showVideoViewer,
  ]);

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  const formatDuration = (duration?: number | null) => {
    if (!duration) {
      return "0:00";
    }
    const totalSeconds = Math.floor(duration / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const formatPlaybackTime = (millis: number) => {
    const totalSeconds = Math.floor(millis / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const playPauseAudio = async () => {
    try {
      let playableUri = displayMedia;

      if (message.isMediaEncrypted) {
        const fileInfo = playableUri
          ? await FileSystem.getInfoAsync(playableUri)
          : { exists: false };

        if (!fileInfo.exists) {
          console.log("GROUP AUDIO FILE MISSING - REDECRYPTING");

          const decrypted = await decryptRemoteMedia({
            mediaUrl: message.mediaUrl!,
            encryptedMediaKey: message.encryptedMediaKey!,
            mediaKeyIV: message.mediaKeyIV!,
            mediaKeyAuthTag: message.mediaKeyAuthTag,
            mimeType: message.mimeType,
            fileName: message.fileName,
          });

          setDecryptedUri(decrypted);

          playableUri = decrypted;
        }
      }

      if (!playableUri) {
        return;
      }

      if (!sound) {
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: playableUri },
          { shouldPlay: true },
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
      console.log("GROUP AUDIO PLAYBACK ERROR:", error);
    }
  };

  const formatFileSize = (bytes?: number | null) => {
    if (!bytes) {
      return "";
    }

    if (bytes < 1024) {
      return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileExtension = () => {
    return message.fileName?.split(".").pop()?.toUpperCase() || "FILE";
  };

  const getDocumentIcon = () => {
    const ext = getFileExtension().toLowerCase();

    switch (ext) {
      case "pdf":
        return "document-text";

      case "doc":
      case "docx":
        return "document";

      case "xls":
      case "xlsx":
      case "csv":
        return "grid";

      case "ppt":
      case "pptx":
        return "easel";

      case "zip":
      case "rar":
      case "7z":
        return "archive";

      default:
        return "document-outline";
    }
  };

  const getFileBadgeColor = () => {
    const ext = getFileExtension().toLowerCase();

    switch (ext) {
      case "pdf":
        return "#EF4444";

      case "doc":
      case "docx":
        return "#2563EB";

      case "xls":
      case "xlsx":
      case "csv":
        return "#16A34A";

      case "ppt":
      case "pptx":
        return "#F97316";

      case "zip":
      case "rar":
      case "7z":
        return "#71717A";

      case "txt":
        return "#64748B";

      case "apk":
        return "#16A34A";

      default:
        return "#71717A";
    }
  };

  // ============================================================
  // PHASE 7 — STEP 3: GROUP MEDIA CAPTION RENDERING
  // Captions for IMAGE/VIDEO/AUDIO/FILE messages are persisted
  // in message.messageContent and must render beneath the
  // associated media.
  // ============================================================
  const renderMediaCaption = () => {
    const caption =
      typeof message.messageContent === "string"
        ? message.messageContent.trim()
        : "";

    if (!caption) {
      return null;
    }

    return (
      <View style={styles.mediaCaptionContainer}>
        <Text style={styles.mediaCaptionText}>{caption}</Text>
      </View>
    );
  };

  const openFile = async () => {
    try {
      let documentPath = displayMedia;

      if (message.isMediaEncrypted) {
        const fileInfo = documentPath
          ? await FileSystem.getInfoAsync(documentPath)
          : { exists: false };

        if (!fileInfo.exists) {
          const decrypted = await decryptRemoteMedia({
            mediaUrl: message.mediaUrl!,
            encryptedMediaKey: message.encryptedMediaKey!,
            mediaKeyIV: message.mediaKeyIV!,
            mediaKeyAuthTag: message.mediaKeyAuthTag,
            mimeType: message.mimeType,
            fileName: message.fileName,
          });

          setDecryptedUri(decrypted);

          documentPath = decrypted;
        }
      }

      if (!documentPath) {
        return;
      }

      await openDocuments(documentPath, showFeedback ?? (() => {}));
    } catch (error) {
      console.log("GROUP OPEN DOCUMENT ERROR:", error);
    }
  };

  if (message.contentType === "IMAGE") {
    if (!displayMedia) {
      return null;
    }

    return (
      <>
        <View
          style={[
            styles.mediaWrapper,
            {
              width: MEDIA_WIDTH,
              height: MEDIA_HEIGHT,
            },
          ]}
        >
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={selectionMode ? onSelect : () => setShowImageViewer(true)}
            onLongPress={selectionMode ? onSelect : undefined}
          >
            <Image
              source={displayMedia}
              style={[
                styles.image,
                {
                  width: MEDIA_WIDTH,
                  height: MEDIA_HEIGHT,
                },
              ]}
              contentFit="cover"
              transition={200}
              cachePolicy="memory-disk"
            />

            {/* Fullscreen indicator */}
            <View pointerEvents="none" style={styles.mediaViewIndicator}>
              <Ionicons name="expand-outline" size={15} color="#FFFFFF" />
            </View>
          </TouchableOpacity>

          {/* Uploading */}
          {message.uploadStatus === "UPLOADING" && (
            <View style={styles.uploadOverlay}>
              <View style={styles.overlayStatus}>
                <Ionicons
                  name="cloud-upload-outline"
                  size={17}
                  color="#FFFFFF"
                />

                <Text style={styles.uploadText}>
                  {message.uploadProgress || 0}%
                </Text>
              </View>
            </View>
          )}

          {/* Failed */}
          {message.uploadStatus === "FAILED" && (
            <View style={styles.failedOverlay}>
              <View style={styles.overlayStatus}>
                <Ionicons
                  name="alert-circle-outline"
                  size={18}
                  color="#FFFFFF"
                />

                <Text style={styles.failedText}>Upload Failed</Text>
              </View>
            </View>
          )}

          {/* Decrypting */}
          {isDecrypting && (
            <View style={styles.uploadOverlay}>
              <View style={styles.overlayStatus}>
                <Ionicons
                  name="lock-closed-outline"
                  size={16}
                  color="#FFFFFF"
                />

                <Text style={styles.uploadText}>Decrypting...</Text>
              </View>
            </View>
          )}
        </View>
        {renderMediaCaption()}
        <ImageViewerModal
          visible={showImageViewer}
          imageUri={displayMedia || ""}
          onClose={() => setShowImageViewer(false)}
        />
      </>
    );
  }

  if (message.contentType === "VIDEO") {
    const thumbnailSource = message.thumbnailUrl
      ? `${API_BASE_URL}${message.thumbnailUrl}`
      : message.thumbnailUri || message.localUri;

    return (
      <>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={selectionMode ? onSelect : () => setShowVideoViewer(true)}
          onLongPress={selectionMode ? onSelect : undefined}
        >
          <View
            style={[
              styles.mediaWrapper,
              {
                width: MEDIA_WIDTH,
                height: MEDIA_HEIGHT,
              },
            ]}
          >
            <Image
              source={thumbnailSource}
              style={[
                styles.video,
                {
                  width: MEDIA_WIDTH,
                  height: MEDIA_HEIGHT,
                },
              ]}
              contentFit="cover"
              onLoad={() => setThumbnailLoading(false)}
              onError={() => setThumbnailLoading(false)}
            />

            {/* Thumbnail loading */}
            {thumbnailLoading && (
              <View style={styles.loadingOverlay}>
                <View style={styles.overlayStatus}>
                  <Ionicons name="image-outline" size={17} color="#FFFFFF" />

                  <Text style={styles.loadingText}>Loading...</Text>
                </View>
              </View>
            )}

            {/* Play button */}
            <View style={styles.playOverlay}>
              <Ionicons name="play" size={27} color="#FFFFFF" />
            </View>

            {/* Duration */}
            <View style={styles.durationBadge}>
              <Ionicons name="videocam-outline" size={12} color="#FFFFFF" />

              <Text style={styles.durationText}>
                {formatDuration(message.duration)}
              </Text>
            </View>

            {/* Fullscreen indicator */}
            <View pointerEvents="none" style={styles.mediaViewIndicator}>
              <Ionicons name="expand-outline" size={15} color="#FFFFFF" />
            </View>

            {/* Uploading */}
            {message.uploadStatus === "UPLOADING" && (
              <View style={styles.uploadOverlay}>
                <View style={styles.overlayStatus}>
                  <Ionicons
                    name="cloud-upload-outline"
                    size={17}
                    color="#FFFFFF"
                  />

                  <Text style={styles.uploadText}>
                    {message.uploadProgress || 0}%
                  </Text>
                </View>
              </View>
            )}

            {/* Failed */}
            {message.uploadStatus === "FAILED" && (
              <View style={styles.failedOverlay}>
                <View style={styles.overlayStatus}>
                  <Ionicons
                    name="alert-circle-outline"
                    size={18}
                    color="#FFFFFF"
                  />

                  <Text style={styles.failedText}>Upload Failed</Text>
                </View>
              </View>
            )}

            {/* Decrypting */}
            {isDecrypting && (
              <View style={styles.uploadOverlay}>
                <View style={styles.overlayStatus}>
                  <Ionicons
                    name="lock-closed-outline"
                    size={16}
                    color="#FFFFFF"
                  />

                  <Text style={styles.uploadText}>Decrypting...</Text>
                </View>
              </View>
            )}
          </View>
        </TouchableOpacity>
        {renderMediaCaption()}
        <VideoViewerModal
          visible={showVideoViewer}
          videoUri={displayMedia || ""}
          onClose={() => setShowVideoViewer(false)}
        />
      </>
    );
  }

  if (message.contentType === "AUDIO" && displayMedia) {
    return (
      <>
        <TouchableOpacity
          style={[
            styles.audioBubble,
            {
              width: AUDIO_WIDTH,
            },
          ]}
          activeOpacity={0.8}
          onPress={selectionMode ? onSelect : playPauseAudio}
          onLongPress={selectionMode ? onSelect : undefined}
        >
          <View style={styles.audioPlayButton}>
            <Ionicons
              name={isPlaying ? "pause" : "play"}
              size={20}
              color="#FFFFFF"
            />
          </View>

          <View style={styles.audioContent}>
            <View style={styles.waveformContainer}>
              {(message.waveform || []).map((value, index) => {
                const progress =
                  message.duration && message.duration > 0
                    ? position / message.duration
                    : 0;

                const playedBars = Math.floor(
                  progress * (message.waveform?.length || 1),
                );

                return (
                  <View
                    key={index}
                    style={[
                      styles.waveBar,
                      {
                        height: Math.max(4, value / 2),

                        backgroundColor:
                          index <= playedBars ? "#2563EB" : "#CBD5E1",
                      },
                    ]}
                  />
                );
              })}
            </View>

            <View style={styles.audioMetaRow}>
              <Text style={styles.audioDuration}>
                {formatPlaybackTime(position)} /{" "}
                {formatDuration(message.duration)}
              </Text>

              <Ionicons
                name="volume-medium-outline"
                size={13}
                color="#71717A"
              />
            </View>
          </View>
        </TouchableOpacity>

        {renderMediaCaption()}
      </>
    );
  }

  if (message.contentType === "FILE") {
    const fileMeta = `${formatFileSize(
      message.fileSize,
    )} • ${getFileExtension()}`;

    return (
      <>
        <TouchableOpacity
          activeOpacity={0.9}
          style={[
            styles.documentBubble,
            {
              width: DOCUMENT_WIDTH,
            },
          ]}
          onPress={selectionMode ? onSelect : openFile}
          onLongPress={selectionMode ? onSelect : undefined}
        >
          <View style={styles.documentRow}>
            <View
              style={[
                styles.fileBadge,
                {
                  backgroundColor: getFileBadgeColor(),
                },
              ]}
            >
              <Ionicons
                name={getDocumentIcon() as any}
                size={21}
                color="#FFFFFF"
              />
            </View>

            <View style={styles.fileInfo}>
              <Text style={styles.documentName} numberOfLines={1}>
                {message.fileName}
              </Text>

              <Text style={styles.documentType}>{fileMeta}</Text>
            </View>

            <View style={styles.downloadButton}>
              <Ionicons name="download-outline" size={17} color="#2563EB" />
            </View>
          </View>
        </TouchableOpacity>
        {renderMediaCaption()}
      </>
    );
  }

  return null;
};

export default React.memo(GroupMessageMedia);

const styles = StyleSheet.create({
  mediaWrapper: {
    position: "relative",
    overflow: "hidden",
    width: 238,
    height: 190,
    borderRadius: 16,
    backgroundColor: "#F4F7FD",
  },

  mediaCaptionContainer: {
    width: "100%",
    paddingHorizontal: 3,
    paddingTop: 7,
    paddingBottom: 1,
  },

  mediaCaptionText: {
    fontSize: 15,
    lineHeight: 19,
    color: "#18181B",
    fontWeight: "400",
    includeFontPadding: false,
  },

  image: {
    width: 238,
    height: 190,
    borderRadius: 16,
    backgroundColor: "#F4F7FD",
  },

  video: {
    width: 238,
    height: 190,

    borderRadius: 16,

    backgroundColor: "#F4F7FD",
  },

  mediaViewIndicator: {
    position: "absolute",

    top: 9,
    right: 9,

    width: 29,
    height: 29,

    borderRadius: 15,

    justifyContent: "center",
    alignItems: "center",

    backgroundColor: "rgba(24,24,27,0.48)",
  },

  playOverlay: {
    position: "absolute",

    top: "50%",
    left: "50%",

    width: 56,
    height: 56,

    marginLeft: -28,
    marginTop: -28,

    borderRadius: 28,

    justifyContent: "center",
    alignItems: "center",

    backgroundColor: "rgba(24,24,27,0.55)",

    shadowColor: "#000000",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 3,
    },

    elevation: 5,
  },

  durationBadge: {
    position: "absolute",
    right: 10,
    bottom: 10,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: "rgba(24,24,27,0.72)",
  },

  durationText: {
    marginLeft: 4,
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.15,
  },

  audioBubble: {
    width: 248,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 3,
  },

  audioPlayButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#2563EB",
    shadowColor: "#2563EB",
    shadowOpacity: 0.18,
    shadowRadius: 7,
    shadowOffset: {
      width: 0,
      height: 3,
    },

    elevation: 2,
  },

  audioContent: {
    flex: 1,
    marginLeft: 12,
    overflow: "hidden",
  },

  waveformContainer: {
    height: 29,
    flexDirection: "row",
    alignItems: "flex-end",
    overflow: "hidden",
  },

  waveBar: {
    width: 3,
    borderRadius: 2,
    marginRight: 2,
    opacity: 0.9,
  },

  audioMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 5,
    paddingRight: 3,
  },

  audioDuration: {
    fontSize: 11,
    color: "#71717A",
    fontWeight: "500",
  },

  documentBubble: {
    width: 270,
  },

  documentRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
  },

  fileBadge: {
    width: 46,
    height: 46,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
  },

  fileInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },

  documentName: {
    fontSize: 14.5,
    color: "#18181B",
    fontWeight: "700",
  },

  documentType: {
    marginTop: 3,
    fontSize: 11.5,
    color: "#71717A",
    fontWeight: "500",
  },

  downloadButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
  },

  uploadOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(24,24,27,0.38)",
    borderRadius: 16,
  },

  overlayStatus: {
    flexDirection: "row",
    alignItems: "center",
  },

  uploadText: {
    marginLeft: 6,
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },

  failedOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(239,68,68,0.35)",
    borderRadius: 16,
  },

  failedText: {
    marginLeft: 6,
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 13,
  },

  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(24,24,27,0.22)",
    borderRadius: 16,
  },

  loadingText: {
    marginLeft: 6,
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
});
